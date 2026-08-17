import { config } from "../config.js";

const HISTORY_PAGE_SIZE = 1000;

function getAuthHeader() {
  const token = config.secrets.sonarToken;
  if (!token) {
    throw new Error("SONAR_TOKEN is not set. Add it to your .env file.");
  }
  return `Bearer ${token}`;
}

async function sonarFetch(pathname, params) {
  const url = new URL(`https://sonarcloud.io${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `SonarCloud ${pathname} for ${params.component} failed (${response.status}): ${text}`
    );
  }

  return response.json();
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Historical ncloc/coverage per analysis date, so metrics can be recomputed
 * for any end date without calling SonarCloud again.
 */
async function fetchMeasureHistory(projectKey, from) {
  const byDate = new Map();
  let page = 1;

  while (true) {
    const data = await sonarFetch("/api/measures/search_history", {
      component: projectKey,
      metrics: "ncloc,coverage",
      from,
      p: page,
      ps: HISTORY_PAGE_SIZE,
    });

    for (const measure of data.measures || []) {
      for (const point of measure.history || []) {
        if (!point.date) continue;
        const entry = byDate.get(point.date) || { date: point.date, ncloc: null, coverage: null };
        entry[measure.metric] = toNumberOrNull(point.value);
        byDate.set(point.date, entry);
      }
    }

    const paging = data.paging || {};
    const seen = (paging.pageIndex || page) * (paging.pageSize || HISTORY_PAGE_SIZE);
    if (!paging.total || seen >= paging.total) {
      break;
    }
    page += 1;
  }

  return [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Fetch current ncloc/coverage plus history for configured SonarCloud projects.
 */
export async function fetchSonarMeasures() {
  const projects = config.sonarCloud.projects || [];
  const results = [];

  for (const project of projects) {
    const data = await sonarFetch("/api/measures/component", {
      component: project.key,
      metricKeys: "ncloc,coverage",
    });

    const measures = data.component?.measures || [];
    const byMetric = Object.fromEntries(
      measures.map((m) => [m.metric, toNumberOrNull(m.value)])
    );

    const history = await fetchMeasureHistory(project.key, config.cutDate);

    results.push({
      projectKey: project.key,
      repository: project.repository || null,
      ncloc: byMetric.ncloc ?? 0,
      coverage: byMetric.coverage ?? null,
      history,
    });
  }

  return results;
}
