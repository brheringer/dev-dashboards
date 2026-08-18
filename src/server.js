import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config, rootDirPath } from "./config.js";
import { readCache, writeCache } from "./cache.js";
import { computeMetrics } from "./metrics.js";
import { computeTrend } from "./trend.js";
import { computeRepoSummaries } from "./repos.js";
import { computeWorkItems } from "./workItems.js";
import { getWorkItemsPage, getPullRequestsPage } from "./details.js";
import { fetchClosedWorkItems } from "./sources/adoWorkItems.js";
import { fetchPullRequests } from "./sources/adoPullRequests.js";
import { fetchSonarMeasures } from "./sources/sonarCloud.js";

const app = express();
let refreshInProgress = false;
const publicDir = path.join(rootDirPath, "public");
const indexPath = path.join(publicDir, "index.html");

app.use(express.json());

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderIndexHtml() {
  const template = fs.readFileSync(indexPath, "utf8");
  const { author, product } = config.branding;
  return template
    .replaceAll("{{branding.json}}", JSON.stringify({ author, product }).replaceAll("<", "\\u003c"))
    .replaceAll("{{branding.author}}", escapeHtml(author))
    .replaceAll("{{branding.product}}", escapeHtml(product));
}

app.get(["/", "/index.html"], (_req, res) => {
  res.type("html").send(renderIndexHtml());
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

function readDetailQuery(req) {
  return {
    ...readDateFilters(req),
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
  });
});

app.get("/api/metrics", (req, res) => {
  const cache = readCache();
  const filters = readDateFilters(req);
  res.json({
    metrics: computeMetrics(cache, filters),
    refreshing: refreshInProgress,
    cutDate: cache?.cutDate || config.cutDate,
  });
});

app.get("/api/trend", (req, res) => {
  const cache = readCache();
  const filters = readDateFilters(req);
  const metric = typeof req.query.metric === "string" ? req.query.metric : "storyPoints";
  res.json({
    trend: computeTrend(cache, { ...filters, metric }),
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

app.get("/api/work-items", (req, res) => {
  const cache = readCache();
  const filters = readDateFilters(req);
  res.json({
    workItems: computeWorkItems(cache, filters),
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
