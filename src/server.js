import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config, rootDirPath } from "./config.js";
import { readCache, writeCache } from "./cache.js";
import { computeMetrics } from "./metrics.js";
import { computeTrend } from "./trend.js";
import { computeRepoSummaries } from "./repos.js";
import { computeWorkItems } from "./workItems.js";
import { computeDevMetricsChart } from "./devMetricsChart.js";
import { getWorkItemsPage, getPullRequestsPage } from "./details.js";
import { fetchClosedWorkItems } from "./sources/adoWorkItems.js";
import { fetchPullRequests } from "./sources/adoPullRequests.js";
import { fetchSonarMeasures } from "./sources/sonarCloud.js";

const app = express();
let refreshInProgress = false;
const publicDir = path.join(rootDirPath, "public");
const layoutPath = path.join(publicDir, "layout.html");
const dashboardsDir = path.join(publicDir, "dashboards");

const DASHBOARDS = {
  "dev-metrics": { name: "Dev Metrics" },
  comparison: { name: "Comparison" },
  trend: { name: "Trend" },
  "work-items": { name: "Work Items" },
  repos: { name: "Repos" },
};

const PATH_TO_DASHBOARD = {
  "/": "dev-metrics",
  "/index.html": "dev-metrics",
  "/dev-metrics": "dev-metrics",
  "/comparison": "comparison",
  "/trend": "trend",
  "/work-items": "work-items",
  "/repos": "repos",
};

app.use(express.json());

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDashboardHtml(dashboardId) {
  const layout = fs.readFileSync(layoutPath, "utf8");
  const fragment = fs.readFileSync(path.join(dashboardsDir, `${dashboardId}.html`), "utf8");
  const { author, product } = config.branding;
  const name = DASHBOARDS[dashboardId].name;
  let html = layout
    .replaceAll("{{dashboard}}", fragment)
    .replaceAll("{{dashboardId}}", dashboardId)
    .replaceAll("{{dashboardName}}", escapeHtml(name))
    .replaceAll("{{branding.json}}", JSON.stringify({ author, product }).replaceAll("<", "\\u003c"))
    .replaceAll("{{branding.author}}", escapeHtml(author))
    .replaceAll("{{branding.product}}", escapeHtml(product));

  for (const id of Object.keys(DASHBOARDS)) {
    html = html.replaceAll(`{{navClass.${id}}}`, id === dashboardId ? " active" : "");
  }
  return html;
}

app.get(Object.keys(PATH_TO_DASHBOARD), (req, res) => {
  const dashboardId = PATH_TO_DASHBOARD[req.path] || "dev-metrics";
  res.type("html").send(renderDashboardHtml(dashboardId));
});

app.get(["/layout.html", "/dashboards/:page"], (req, res) => {
  const id = String(req.params.page || "").replace(/\.html$/, "");
  if (DASHBOARDS[id]) {
    res.redirect(id === "dev-metrics" ? "/" : `/${id}`);
    return;
  }
  res.redirect("/");
});

app.use(express.static(publicDir, { index: false }));

function readDateFilters(req) {
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : null;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : null;
  return {
    startDate: startDate || null,
    endDate: endDate || null,
  };
}

function readWorkItemsFilters(req) {
  const areaPath = typeof req.query.areaPath === "string" ? req.query.areaPath.trim() : "";
  return {
    ...readDateFilters(req),
    areaPath: areaPath || null,
  };
}

function readDetailQuery(req) {
  return {
    ...readWorkItemsFilters(req),
    page: req.query.page,
    pageSize: req.query.pageSize,
  };
}

app.get("/api/config", (_req, res) => {
  const cache = readCache();
  res.json({
    cutDate: cache?.cutDate || config.cutDate,
    fetchedAt: cache?.fetchedAt || null,
    branding: config.branding,
    areaPaths: config.azureDevOps.areaPathsOfInterest,
  });
});

app.get("/api/metrics", (req, res) => {
  const cache = readCache();
  const filters = readWorkItemsFilters(req);
  res.json({
    metrics: computeMetrics(cache, filters),
    areaPaths: config.azureDevOps.areaPathsOfInterest,
    refreshing: refreshInProgress,
    cutDate: cache?.cutDate || config.cutDate,
  });
});

app.get("/api/trend", (req, res) => {
  const cache = readCache();
  const filters = readWorkItemsFilters(req);
  const metric = typeof req.query.metric === "string" ? req.query.metric : "storyPoints";
  res.json({
    trend: computeTrend(cache, { ...filters, metric }),
    areaPaths: config.azureDevOps.areaPathsOfInterest,
    refreshing: refreshInProgress,
    cutDate: cache?.cutDate || config.cutDate,
  });
});

app.get("/api/repos", (req, res) => {
  const cache = readCache();
  const filters = readDateFilters(req);
  res.json({
    repos: computeRepoSummaries(cache, filters),
    refreshing: refreshInProgress,
    cutDate: cache?.cutDate || config.cutDate,
  });
});

app.get("/api/dev-metrics/chart", (req, res) => {
  const cache = readCache();
  const filters = readWorkItemsFilters(req);
  const metric = typeof req.query.metric === "string" ? req.query.metric : "storyPoints";
  const grain = typeof req.query.grain === "string" ? req.query.grain : "daily";
  res.json({
    chart: computeDevMetricsChart(cache, { ...filters, metric, grain }),
    areaPaths: config.azureDevOps.areaPathsOfInterest,
    refreshing: refreshInProgress,
    cutDate: cache?.cutDate || config.cutDate,
  });
});

app.get("/api/work-items", (req, res) => {
  const cache = readCache();
  const filters = readWorkItemsFilters(req);
  res.json({
    workItems: computeWorkItems(cache, filters),
    areaPaths: config.azureDevOps.areaPathsOfInterest,
    refreshing: refreshInProgress,
    cutDate: cache?.cutDate || config.cutDate,
  });
});

app.get("/api/details/work-items", (req, res) => {
  const cache = readCache();
  res.json(getWorkItemsPage(cache, readDetailQuery(req)));
});

app.get("/api/details/pull-requests", (req, res) => {
  const cache = readCache();
  res.json(getPullRequestsPage(cache, readDetailQuery(req)));
});

app.post("/api/refresh", async (req, res) => {
  if (refreshInProgress) {
    res.status(409).json({ error: "A refresh is already in progress." });
    return;
  }

  refreshInProgress = true;
  try {
    const [workItems, pullRequests, sonar] = await Promise.all([
      fetchClosedWorkItems(),
      fetchPullRequests(),
      fetchSonarMeasures(),
    ]);

    const cache = {
      fetchedAt: new Date().toISOString(),
      cutDate: config.cutDate,
      workItems,
      pullRequests,
      sonar,
    };

    if (!Array.isArray(workItems) || !Array.isArray(pullRequests) || !Array.isArray(sonar)) {
      throw new Error("Refresh returned incomplete data. Previous cache was kept.");
    }

    writeCache(cache);

    const filters = readDateFilters(req);
    res.json({
      metrics: computeMetrics(cache, filters),
      refreshing: false,
      cutDate: cache.cutDate,
    });
  } catch (error) {
    console.error("Refresh failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Refresh failed",
    });
  } finally {
    refreshInProgress = false;
  }
});

app.listen(config.port, () => {
  console.log(`Dashboard listening on http://localhost:${config.port}`);
});
