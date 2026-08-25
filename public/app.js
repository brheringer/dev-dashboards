import { attachDatePresetMenus, attachRangePresetMenus } from "./datePresetMenu.js";
import { savePageDates, loadPageDates } from "./dateStorage.js";
import { renderTrendChart } from "./trendChart.js";
import { renderDevMetricsChart } from "./devMetricsChart.js";
import {
  renderPieChart,
  renderColumnChart,
  renderMultiLineChart,
  renderStackedColumnChart,
} from "./workItemsCharts.js";

const DASHBOARDS = {
  "dev-metrics": { name: "Dev Metrics", path: "/" },
  "work-items": { name: "Work Items", path: "/work-items" },
  "pull-requests": { name: "Pull Requests", path: "/pull-requests" },
  comparison: { name: "Comparison", path: "/comparison" },
  trend: { name: "Trend", path: "/trend" },
  repos: { name: "Repos", path: "/repos" },
  "resolving-time": { name: "Resolving Time", path: "/resolving-time" },
};

function dashboardIdFromHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  if (raw === "overview") return "comparison";
  return DASHBOARDS[raw] ? raw : "";
}

const legacyHashId = dashboardIdFromHash(window.location.hash);
const shouldRedirectLegacyHash = Boolean(legacyHashId);
if (shouldRedirectLegacyHash) {
  window.location.replace(DASHBOARDS[legacyHashId].path);
}

const currentDashboardId = document.body.dataset.dashboard || "dev-metrics";

const refreshBtn = document.getElementById("refreshBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const areaPathSelect = document.getElementById("devAreaPath");
const statusEl = document.getElementById("status");
const emptyState = document.getElementById("emptyState");
const metricsGrid = document.getElementById("metricsGrid");
const errorEl = document.getElementById("error");
const dataAccordion = document.getElementById("dataAccordion");
const devMetricsYAxisSelect = document.getElementById("devMetricsYAxis");
const devMetricsXAxisSelect = document.getElementById("devMetricsXAxis");
const devMetricsChartSection = document.getElementById("devMetricsChartSection");
const devMetricsChartEl = document.getElementById("devMetricsChart");
const devMetricsChartTitle = document.getElementById("devMetricsChartTitle");
const devMetricsChartHint = document.getElementById("devMetricsChartHint");
const devMetricsChartTotal = document.getElementById("devMetricsChartTotal");

const fields = {
  userStories: document.getElementById("userStories"),
  storyPoints: document.getElementById("storyPoints"),
  sprintBugs: document.getElementById("sprintBugs"),
  usBugs: document.getElementById("usBugs"),
  techDebts: document.getElementById("techDebts"),
  pullRequests: document.getElementById("pullRequests"),
  linesOfCode: document.getElementById("linesOfCode"),
  coverage: document.getElementById("coverage"),
};

const hints = {
  linesOfCode: document.getElementById("linesOfCodeHint"),
  coverage: document.getElementById("coverageHint"),
};

const deltas = {
  linesOfCode: document.getElementById("linesOfCodeDelta"),
  coverage: document.getElementById("coverageDelta"),
};

const tabs = {
  workItems: document.getElementById("tabWorkItems"),
  pullRequests: document.getElementById("tabPullRequests"),
};

const panels = {
  workItems: document.getElementById("panelWorkItems"),
  pullRequests: document.getElementById("panelPullRequests"),
};

const tableState = {
  workItems: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    loaded: false,
    requestId: 0,
    body: document.getElementById("workItemsBody"),
    pageSizeSelect: document.getElementById("workItemsPageSize"),
    pageInfo: document.getElementById("workItemsPageInfo"),
    prevBtn: document.getElementById("workItemsPrev"),
    nextBtn: document.getElementById("workItemsNext"),
  },
  pullRequests: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    loaded: false,
    requestId: 0,
    body: document.getElementById("pullRequestsBody"),
    pageSizeSelect: document.getElementById("pullRequestsPageSize"),
    pageInfo: document.getElementById("pullRequestsPageInfo"),
    prevBtn: document.getElementById("pullRequestsPrev"),
    nextBtn: document.getElementById("pullRequestsNext"),
  },
};

const cmpClearFiltersBtn = document.getElementById("cmpClearFiltersBtn");
const cmpStartDateInput = document.getElementById("cmpStartDate");
const cmpEndDateInput = document.getElementById("cmpEndDate");
const cmpStartDate2Input = document.getElementById("cmpStartDate2");
const cmpEndDate2Input = document.getElementById("cmpEndDate2");
const cmpAreaPathSelect = document.getElementById("cmpAreaPath");
const cmpStatusEl = document.getElementById("cmpStatus");
const cmpEmptyState = document.getElementById("cmpEmptyState");
const cmpMetricsGrid = document.getElementById("cmpMetricsGrid");
const cmpErrorEl = document.getElementById("cmpError");

const trendClearFiltersBtn = document.getElementById("trendClearFiltersBtn");
const trendStartDateInput = document.getElementById("trendStartDate");
const trendEndDateInput = document.getElementById("trendEndDate");
const trendMetricSelect = document.getElementById("trendMetric");
const trendAreaPathSelect = document.getElementById("trendAreaPath");
const trendStatusEl = document.getElementById("trendStatus");
const trendEmptyState = document.getElementById("trendEmptyState");
const trendResults = document.getElementById("trendResults");
const trendChartEl = document.getElementById("trendChart");
const trendErrorEl = document.getElementById("trendError");
const trendMetricTitle = document.getElementById("trendMetricTitle");
const trendMetricHint = document.getElementById("trendMetricHint");
const trendMetricValue = document.getElementById("trendMetricValue");
const trendFirstDerivative = document.getElementById("trendFirstDerivative");
const trendSecondDerivative = document.getElementById("trendSecondDerivative");
const TREND_METRIC_KEY = "brheringer.dashboard-trend.metric";
const DEV_METRICS_Y_AXIS_KEY = "brheringer.dashboard-dev-metrics.y-axis";
const DEV_METRICS_X_AXIS_KEY = "brheringer.dashboard-dev-metrics.x-axis";

const reposClearFiltersBtn = document.getElementById("reposClearFiltersBtn");
const reposStartDateInput = document.getElementById("reposStartDate");
const reposEndDateInput = document.getElementById("reposEndDate");
const reposStatusEl = document.getElementById("reposStatus");
const reposEmptyState = document.getElementById("reposEmptyState");
const reposTableCard = document.getElementById("reposTableCard");
const reposBody = document.getElementById("reposBody");
const reposErrorEl = document.getElementById("reposError");

const wiClearFiltersBtn = document.getElementById("wiClearFiltersBtn");
const wiStartDateInput = document.getElementById("wiStartDate");
const wiEndDateInput = document.getElementById("wiEndDate");
const wiAreaPathSelect = document.getElementById("wiAreaPath");
const wiStatusEl = document.getElementById("wiStatus");
const wiEmptyState = document.getElementById("wiEmptyState");
const wiResults = document.getElementById("wiResults");
const wiErrorEl = document.getElementById("wiError");
const wiPieChart = document.getElementById("wiPieChart");
const wiColumnChart = document.getElementById("wiColumnChart");
const wiLineChart = document.getElementById("wiLineChart");
const wiStackedChart = document.getElementById("wiStackedChart");
const wiMonthlyLineChart = document.getElementById("wiMonthlyLineChart");
const wiMonthlyStackedChart = document.getElementById("wiMonthlyStackedChart");
const wiCountMonthlyLineChart = document.getElementById("wiCountMonthlyLineChart");
const wiCountMonthlyStackedChart = document.getElementById("wiCountMonthlyStackedChart");
const wiChartTabs = {
  total: document.getElementById("wiTabTotal"),
  accDaily: document.getElementById("wiTabAccDaily"),
  accStacked: document.getElementById("wiTabAccStacked"),
  accMonthly: document.getElementById("wiTabAccMonthly"),
  accMonthlyStacked: document.getElementById("wiTabAccMonthlyStacked"),
  monthly: document.getElementById("wiTabMonthly"),
  monthlyStacked: document.getElementById("wiTabMonthlyStacked"),
};
const wiChartPanels = {
  total: document.getElementById("wiPanelTotal"),
  accDaily: document.getElementById("wiPanelAccDaily"),
  accStacked: document.getElementById("wiPanelAccStacked"),
  accMonthly: document.getElementById("wiPanelAccMonthly"),
  accMonthlyStacked: document.getElementById("wiPanelAccMonthlyStacked"),
  monthly: document.getElementById("wiPanelMonthly"),
  monthlyStacked: document.getElementById("wiPanelMonthlyStacked"),
};

const prClearFiltersBtn = document.getElementById("prClearFiltersBtn");
const prStartDateInput = document.getElementById("prStartDate");
const prEndDateInput = document.getElementById("prEndDate");
const prAuthorsSelect = document.getElementById("prAuthors");
const prXAxisSelect = document.getElementById("prXAxis");
const prStatusEl = document.getElementById("prStatus");
const prEmptyState = document.getElementById("prEmptyState");
const prResults = document.getElementById("prResults");
const prErrorEl = document.getElementById("prError");
const prLineChart = document.getElementById("prLineChart");
const prStackedChart = document.getElementById("prStackedChart");
const prChartTabs = {
  line: document.getElementById("prTabLine"),
  stacked: document.getElementById("prTabStacked"),
};
const prChartPanels = {
  line: document.getElementById("prPanelLine"),
  stacked: document.getElementById("prPanelStacked"),
};
const PR_X_AXIS_KEY = "brheringer.dashboard-pull-requests.x-axis";
const PR_AUTHORS_KEY = "brheringer.dashboard-pull-requests.authors";
const RT_X_AXIS_KEY = "brheringer.dashboard-resolving-time.x-axis";

const rtClearFiltersBtn = document.getElementById("rtClearFiltersBtn");
const rtStartDateInput = document.getElementById("rtStartDate");
const rtEndDateInput = document.getElementById("rtEndDate");
const rtXAxisSelect = document.getElementById("rtXAxis");
const rtAreaPathSelect = document.getElementById("rtAreaPath");
const rtStatusEl = document.getElementById("rtStatus");
const rtEmptyState = document.getElementById("rtEmptyState");
const rtResults = document.getElementById("rtResults");
const rtErrorEl = document.getElementById("rtError");
const rtWorkItemCount = document.getElementById("rtWorkItemCount");
const rtAverageDays = document.getElementById("rtAverageDays");
const rtMedianDays = document.getElementById("rtMedianDays");
const rtRangeDays = document.getElementById("rtRangeDays");
const rtChartEl = document.getElementById("rtChart");
const rtChartHint = document.getElementById("rtChartHint");
const rtChartAverage = document.getElementById("rtChartAverage");

function metricSet(prefix) {
  return {
    userStories: document.getElementById(`${prefix}-userStories`),
    storyPoints: document.getElementById(`${prefix}-storyPoints`),
    sprintBugs: document.getElementById(`${prefix}-sprintBugs`),
    usBugs: document.getElementById(`${prefix}-usBugs`),
    techDebts: document.getElementById(`${prefix}-techDebts`),
    pullRequests: document.getElementById(`${prefix}-pullRequests`),
    linesOfCode: document.getElementById(`${prefix}-linesOfCode`),
    coverage: document.getElementById(`${prefix}-coverage`),
    linesOfCodeDelta: document.getElementById(`${prefix}-linesOfCodeDelta`),
    coverageDelta: document.getElementById(`${prefix}-coverageDelta`),
    linesOfCodeHint: document.getElementById(`${prefix}-linesOfCodeHint`),
    coverageHint: document.getElementById(`${prefix}-coverageHint`),
  };
}

const comparisonSets = {
  period1: metricSet("cmp1"),
  period2: metricSet("cmp2"),
};

const PAGE_DATE_INPUTS = {
  "dev-metrics": [startDateInput, endDateInput, areaPathSelect],
  "work-items": [wiStartDateInput, wiEndDateInput, wiAreaPathSelect],
  "pull-requests": [prStartDateInput, prEndDateInput],
  comparison: [
    cmpStartDateInput,
    cmpEndDateInput,
    cmpStartDate2Input,
    cmpEndDate2Input,
    cmpAreaPathSelect,
  ],
  trend: [trendStartDateInput, trendEndDateInput, trendAreaPathSelect],
  repos: [reposStartDateInput, reposEndDateInput],
  "resolving-time": [rtStartDateInput, rtEndDateInput, rtAreaPathSelect],
};

function persistPageDates(pageId) {
  savePageDates(pageId, PAGE_DATE_INPUTS[pageId] || []);
}

function restorePageDates(pageId) {
  return loadPageDates(pageId, PAGE_DATE_INPUTS[pageId] || []);
}

let latestRequestId = 0;
let latestDevMetricsChartRequestId = 0;
let latestComparisonRequestId = 0;
let latestTrendRequestId = 0;
let latestReposRequestId = 0;
let latestWorkItemsRequestId = 0;
let latestPullRequestsRequestId = 0;
let latestResolvingTimeRequestId = 0;
let lastTrend = null;
let lastWorkItems = null;
let lastPullRequests = null;
let activeTab = "workItems";
let activeWiChartTab = "total";
let activePrChartTab = "line";

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function formatSignedNumber(value) {
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

function formatSignedPercent(value) {
  const formatted = Math.abs(value).toFixed(1);
  if (value > 0) return `+${formatted} pp`;
  if (value < 0) return `−${formatted} pp`;
  return `${formatted} pp`;
}

function setDelta(el, value, formatter) {
  el.classList.remove("up", "down", "flat");
  if (value === null || value === undefined) {
    el.textContent = "";
    return;
  }
  el.textContent = formatter(value);
  if (value > 0) el.classList.add("up");
  else if (value < 0) el.classList.add("down");
  else el.classList.add("flat");
}

function formatDateTime(iso) {
  if (!iso) return "Never";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDevMetricsChartFilters() {
  const metric = devMetricsYAxisSelect?.value || "storyPoints";
  const areaPath = metric === "pullRequests" ? null : areaPathSelect?.value || null;
  return {
    startDate: startDateInput?.value || null,
    endDate: endDateInput?.value || null,
    areaPath,
    metric,
    grain: devMetricsXAxisSelect?.value || "daily",
  };
}

function getFilters() {
  return {
    startDate: startDateInput?.value || null,
    endDate: endDateInput?.value || null,
    areaPath: areaPathSelect?.value || null,
  };
}

function getWorkItemsFilters() {
  return {
    startDate: wiStartDateInput?.value || null,
    endDate: wiEndDateInput?.value || null,
    areaPath: wiAreaPathSelect?.value || null,
  };
}

function getSelectedAuthors(select) {
  if (!select) return [];
  return [...select.selectedOptions].map((option) => option.value).filter(Boolean);
}

function getPullRequestsFilters() {
  const authors = getSelectedAuthors(prAuthorsSelect);
  return {
    startDate: prStartDateInput?.value || null,
    endDate: prEndDateInput?.value || null,
    authors: authors.length ? authors : null,
    grain: prXAxisSelect?.value || "daily",
  };
}

function getResolvingTimeFilters() {
  return {
    startDate: rtStartDateInput?.value || null,
    endDate: rtEndDateInput?.value || null,
    areaPath: rtAreaPathSelect?.value || null,
    grain: rtXAxisSelect?.value || "daily",
  };
}

function buildPullRequestsQuery(filters = getPullRequestsFilters()) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.grain) params.set("grain", filters.grain);
  for (const author of filters.authors || []) {
    params.append("authors", author);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildResolvingTimeQuery(filters = getResolvingTimeFilters()) {
  return buildQuery(
    { grain: filters.grain, areaPath: filters.areaPath },
    filters
  );
}

function getReposFilters() {
  return {
    startDate: reposStartDateInput?.value || null,
    endDate: reposEndDateInput?.value || null,
  };
}

const TREND_METRICS_WITHOUT_AREA_PATH = new Set(["pullRequests", "linesOfCode", "coverage"]);

function trendAreaPathEnabled() {
  const metric = trendMetricSelect?.value || "storyPoints";
  return !TREND_METRICS_WITHOUT_AREA_PATH.has(metric);
}

function syncTrendAreaPathFilter() {
  if (!trendAreaPathSelect) return;
  const enabled = trendAreaPathEnabled();
  trendAreaPathSelect.disabled = !enabled;
  trendAreaPathSelect.closest(".filter-field")?.classList.toggle("is-disabled", !enabled);
}

function getTrendFilters() {
  return {
    startDate: trendStartDateInput?.value || null,
    endDate: trendEndDateInput?.value || null,
    metric: trendMetricSelect?.value || "storyPoints",
    areaPath: trendAreaPathEnabled() ? trendAreaPathSelect?.value || null : null,
  };
}

function getComparisonPeriod(index) {
  if (index === 2) {
    return {
      startDate: cmpStartDate2Input?.value || null,
      endDate: cmpEndDate2Input?.value || null,
      areaPath: cmpAreaPathSelect?.value || null,
    };
  }
  return {
    startDate: cmpStartDateInput?.value || null,
    endDate: cmpEndDateInput?.value || null,
    areaPath: cmpAreaPathSelect?.value || null,
  };
}

function buildQuery(extra = {}, filters = getFilters()) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.areaPath) params.set("areaPath", filters.areaPath);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function setError(message) {
  if (!errorEl) return;
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function setRefreshing(isRefreshing) {
  if (!refreshBtn) return;
  refreshBtn.disabled = isRefreshing;
  refreshBtn.textContent = isRefreshing ? "Refreshing…" : "Refresh data";
}

function fillMetricSet(set, metrics) {
  set.userStories.textContent = formatNumber(metrics.userStories);
  set.storyPoints.textContent = formatNumber(metrics.storyPoints);
  set.sprintBugs.textContent = formatNumber(metrics.sprintBugs);
  set.usBugs.textContent = formatNumber(metrics.usBugs);
  set.techDebts.textContent = formatNumber(metrics.techDebts);
  set.pullRequests.textContent = formatNumber(metrics.pullRequests);
  set.linesOfCode.textContent = formatNumber(metrics.linesOfCode);
  set.coverage.textContent =
    metrics.coverage === null || metrics.coverage === undefined
      ? "—"
      : `${metrics.coverage}%`;

  setDelta(set.linesOfCodeDelta, metrics.linesOfCodeDelta, (value) => {
    return `${formatSignedNumber(value)} in period`;
  });
  setDelta(set.coverageDelta, metrics.coverageDelta, (value) => {
    return `${formatSignedPercent(value)} in period`;
  });

  const asOfLabel = metrics.codeAsOf
    ? `as of ${formatDate(metrics.codeAsOf)}`
    : "latest analysis";
  const baselineLabel = metrics.codeBaselineAsOf
    ? ` · vs ${formatDate(metrics.codeBaselineAsOf)}`
    : "";
  set.linesOfCodeHint.textContent = `${asOfLabel}${baselineLabel}`;
  set.coverageHint.textContent = `${asOfLabel}${baselineLabel}`;
}

function percentVariance(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from === 0 && to === 0) return 0;
  if (from === 0) return null;
  return Math.round(((to - from) / Math.abs(from)) * 1000) / 10;
}

function setVariance(el, from, to) {
  el.classList.remove("up", "down", "flat");
  const valueEl = el.querySelector(".compare-variance-value");
  const variance = percentVariance(from, to);
  if (variance === null) {
    valueEl.textContent = "—";
    return;
  }

  valueEl.textContent = `${formatSignedNumber(variance)}%`;
  if (variance > 0) el.classList.add("up");
  else if (variance < 0) el.classList.add("down");
  else el.classList.add("flat");
}

const COMPARISON_VARIANCE_KEYS = [
  "storyPoints",
  "userStories",
  "techDebts",
  "sprintBugs",
  "usBugs",
  "pullRequests",
  "linesOfCode",
  "coverage",
];

function rangeLabel(metrics) {
  const rangeParts = [];
  if (metrics.startDate) rangeParts.push(`from ${metrics.startDate}`);
  if (metrics.endDate) rangeParts.push(`to ${metrics.endDate}`);
  return rangeParts.length ? rangeParts.join(" ") : "all cached data";
}

function renderMetrics(metrics) {
  metricsGrid.classList.remove("is-stale");

  if (!metrics?.hasData) {
    metricsGrid.classList.add("hidden");
    emptyState.classList.remove("hidden");
    statusEl.textContent = "No cached data loaded yet.";
    return;
  }

  emptyState.classList.add("hidden");
  metricsGrid.classList.remove("hidden");
  syncAreaPathMetricVisibility(metrics.areaPath);
  fillMetricSet(
    {
      userStories: fields.userStories,
      storyPoints: fields.storyPoints,
      sprintBugs: fields.sprintBugs,
      usBugs: fields.usBugs,
      techDebts: fields.techDebts,
      pullRequests: fields.pullRequests,
      linesOfCode: fields.linesOfCode,
      coverage: fields.coverage,
      linesOfCodeDelta: deltas.linesOfCode,
      coverageDelta: deltas.coverage,
      linesOfCodeHint: hints.linesOfCode,
      coverageHint: hints.coverage,
    },
    metrics
  );

  statusEl.textContent = `Last refreshed: ${formatDateTime(metrics.fetchedAt)} · Filtered ${rangeLabel(metrics)}${
    metrics.areaPath ? ` · ${metrics.areaPath}` : ""
  }`;
}

const DEV_METRICS_GRAIN_LABELS = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly",
};

function renderDevMetricsChartPanel(chart) {
  if (!devMetricsChartSection) return;
  devMetricsChartSection.classList.remove("is-stale");

  if (!chart?.hasData) {
    devMetricsChartSection.classList.add("hidden");
    return;
  }

  devMetricsChartSection.classList.remove("hidden");
  if (devMetricsChartTitle) devMetricsChartTitle.textContent = chart.metricLabel;
  if (devMetricsChartTotal) {
    devMetricsChartTotal.textContent = formatNumber(chart.total);
  }
  if (devMetricsChartHint) {
    const grainLabel = DEV_METRICS_GRAIN_LABELS[chart.grain] || chart.grain;
    const dateField = chart.metric === "pullRequests" ? "creation date" : "closed date";
    const areaHint =
      chart.metric === "pullRequests"
        ? ""
        : chart.areaPath
          ? ` · ${chart.areaPath}`
          : "";
    devMetricsChartHint.textContent = `${grainLabel} buckets by ${dateField}${areaHint}`;
  }

  renderDevMetricsChart(devMetricsChartEl, {
    points: chart.points,
    metric: chart.metric,
    metricLabel: chart.metricLabel,
    grain: chart.grain,
    unit: chart.unit,
    emptyMessage: "No data in this date range.",
  });
}

function setReposError(message) {
  if (!reposErrorEl) return;
  if (!message) {
    reposErrorEl.classList.add("hidden");
    reposErrorEl.textContent = "";
    return;
  }
  reposErrorEl.textContent = message;
  reposErrorEl.classList.remove("hidden");
}

function renderRepos(data) {
  reposTableCard.classList.remove("is-stale");

  if (!data?.hasData) {
    reposTableCard.classList.add("hidden");
    reposEmptyState.classList.remove("hidden");
    reposStatusEl.textContent = "No cached data loaded yet.";
    return;
  }

  reposEmptyState.classList.add("hidden");
  reposTableCard.classList.remove("hidden");

  const rows = data.repos || [];
  if (!rows.length) {
    reposBody.innerHTML =
      '<tr><td colspan="4" class="table-empty">No repositories in this date range.</td></tr>';
  } else {
    reposBody.innerHTML = rows
      .map((row) => {
        const loc =
          row.linesOfCode === null || row.linesOfCode === undefined
            ? "—"
            : formatNumber(row.linesOfCode);
        const coverage =
          row.coverage === null || row.coverage === undefined
            ? "—"
            : `${row.coverage}%`;
        return `<tr>
          <td>${escapeHtml(row.repository)}</td>
          <td class="num">${formatNumber(row.pullRequests)}</td>
          <td class="num">${loc}</td>
          <td class="num">${coverage}</td>
        </tr>`;
      })
      .join("");
  }

  reposStatusEl.textContent = `Last refreshed: ${formatDateTime(data.fetchedAt)} · Filtered ${rangeLabel(data)}`;
}

function setWorkItemsError(message) {
  if (!wiErrorEl) return;
  if (!message) {
    wiErrorEl.classList.add("hidden");
    wiErrorEl.textContent = "";
    return;
  }
  wiErrorEl.textContent = message;
  wiErrorEl.classList.remove("hidden");
}

function paintWorkItemsCharts(data) {
  const emptyMessage = "No work items in this date range.";
  const totals = data.totals || {};
  const points = data.points || [];
  const monthPoints = data.monthPoints || [];
  const monthCounts = data.monthCounts || [];
  const monthChart = {
    emptyMessage,
    xGrain: "month",
    legendTotals: totals,
  };

  if (activeWiChartTab === "total") {
    renderPieChart(wiPieChart, { totals, emptyMessage });
    renderColumnChart(wiColumnChart, { totals, emptyMessage });
    return;
  }
  if (activeWiChartTab === "accDaily") {
    renderMultiLineChart(wiLineChart, { points, emptyMessage });
    return;
  }
  if (activeWiChartTab === "accStacked") {
    renderStackedColumnChart(wiStackedChart, { points, emptyMessage });
    return;
  }
  if (activeWiChartTab === "accMonthly") {
    renderMultiLineChart(wiMonthlyLineChart, { ...monthChart, points: monthPoints });
    return;
  }
  if (activeWiChartTab === "accMonthlyStacked") {
    renderStackedColumnChart(wiMonthlyStackedChart, { ...monthChart, points: monthPoints });
    return;
  }
  if (activeWiChartTab === "monthly") {
    renderMultiLineChart(wiCountMonthlyLineChart, { ...monthChart, points: monthCounts });
    return;
  }
  renderStackedColumnChart(wiCountMonthlyStackedChart, { ...monthChart, points: monthCounts });
}

function setWorkItemsChartTab(tabId) {
  activeWiChartTab = wiChartTabs[tabId] ? tabId : "total";
  for (const [key, tab] of Object.entries(wiChartTabs)) {
    const selected = key === activeWiChartTab;
    tab?.classList.toggle("active", selected);
    tab?.setAttribute("aria-selected", selected ? "true" : "false");
    wiChartPanels[key]?.classList.toggle("hidden", !selected);
    if (wiChartPanels[key]) wiChartPanels[key].hidden = !selected;
  }
  if (lastWorkItems) {
    requestAnimationFrame(() => paintWorkItemsCharts(lastWorkItems));
  }
}

function renderWorkItemsDashboard(data) {
  lastWorkItems = data;
  wiResults.classList.remove("is-stale");

  if (!data?.hasData) {
    wiResults.classList.add("hidden");
    wiEmptyState.classList.remove("hidden");
    wiStatusEl.textContent = "No cached data loaded yet.";
    return;
  }

  wiEmptyState.classList.add("hidden");
  wiResults.classList.remove("hidden");
  requestAnimationFrame(() => paintWorkItemsCharts(data));
  wiStatusEl.textContent = `Last refreshed: ${formatDateTime(data.fetchedAt)} · Filtered ${rangeLabel(data)}${
    data.areaPath ? ` · ${data.areaPath}` : ""
  }`;
}

function setPullRequestsError(message) {
  if (!prErrorEl) return;
  if (!message) {
    prErrorEl.classList.add("hidden");
    prErrorEl.textContent = "";
    return;
  }
  prErrorEl.textContent = message;
  prErrorEl.classList.remove("hidden");
}

function setResolvingTimeError(message) {
  if (!rtErrorEl) return;
  if (!message) {
    rtErrorEl.classList.add("hidden");
    rtErrorEl.textContent = "";
    return;
  }
  rtErrorEl.textContent = message;
  rtErrorEl.classList.remove("hidden");
}

function formatResolvingTimeDays(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const days = Number(value);
  if (days < 1) {
    const hours = Math.round(days * 24 * 10) / 10;
    return `${hours} h`;
  }
  return `${days.toLocaleString(undefined, { maximumFractionDigits: 1 })} d`;
}

function formatResolvingTimeRange(minDays, maxDays) {
  if (
    minDays === null ||
    maxDays === null ||
    !Number.isFinite(Number(minDays)) ||
    !Number.isFinite(Number(maxDays))
  ) {
    return "—";
  }
  return `${formatResolvingTimeDays(minDays)} – ${formatResolvingTimeDays(maxDays)}`;
}

function pullRequestsAuthorLabel(data) {
  if (!data?.authors?.length) return "";
  if (data.authors.length === 1) return ` · ${data.authors[0]}`;
  return ` · ${data.authors.length} authors`;
}

function pullRequestsChartOptions(data) {
  const emptyMessage = "No pull requests in this date range.";
  return {
    points: data.points || [],
    series: data.series || [],
    totals: data.totals || {},
    emptyMessage,
    xGrain: data.grain || "daily",
    legendTotals: data.totals || {},
  };
}

function paintPullRequestsCharts(data) {
  const options = pullRequestsChartOptions(data);
  if (activePrChartTab === "line") {
    renderMultiLineChart(prLineChart, options);
    return;
  }
  renderStackedColumnChart(prStackedChart, options);
}

function setPullRequestsChartTab(tabId) {
  activePrChartTab = prChartTabs[tabId] ? tabId : "line";
  for (const [key, tab] of Object.entries(prChartTabs)) {
    const selected = key === activePrChartTab;
    tab?.classList.toggle("active", selected);
    tab?.setAttribute("aria-selected", selected ? "true" : "false");
    prChartPanels[key]?.classList.toggle("hidden", !selected);
    if (prChartPanels[key]) prChartPanels[key].hidden = !selected;
  }
  if (lastPullRequests) {
    requestAnimationFrame(() => paintPullRequestsCharts(lastPullRequests));
  }
}

function fillAuthorOptions(authors, selected = []) {
  if (!prAuthorsSelect) return;
  const selectedSet = new Set(selected);
  prAuthorsSelect.replaceChildren();
  for (const author of authors) {
    const option = document.createElement("option");
    option.value = author;
    option.textContent = author;
    option.selected = selectedSet.has(author);
    prAuthorsSelect.appendChild(option);
  }
}

function renderPullRequestsDashboard(data) {
  lastPullRequests = data;
  prResults?.classList.remove("is-stale");

  if (!data?.hasData) {
    prResults?.classList.add("hidden");
    prEmptyState?.classList.remove("hidden");
    if (prStatusEl) prStatusEl.textContent = "No cached data loaded yet.";
    return;
  }

  prEmptyState?.classList.add("hidden");
  prResults?.classList.remove("hidden");
  requestAnimationFrame(() => paintPullRequestsCharts(data));
  if (prStatusEl) {
    prStatusEl.textContent = `Last refreshed: ${formatDateTime(data.fetchedAt)} · Filtered ${rangeLabel(data)}${pullRequestsAuthorLabel(data)} · ${formatNumber(data.total || 0)} PRs`;
  }
}

function renderResolvingTime(data) {
  rtResults?.classList.remove("is-stale");

  if (!data?.hasData) {
    rtResults?.classList.add("hidden");
    rtEmptyState?.classList.remove("hidden");
    if (rtStatusEl) rtStatusEl.textContent = "No cached data loaded yet.";
    return;
  }

  rtEmptyState?.classList.add("hidden");
  rtResults?.classList.remove("hidden");

  const summary = data.summary || {};
  if (rtWorkItemCount) rtWorkItemCount.textContent = formatNumber(summary.workItemCount || 0);
  if (rtAverageDays) rtAverageDays.textContent = formatResolvingTimeDays(summary.averageDays);
  if (rtMedianDays) rtMedianDays.textContent = formatResolvingTimeDays(summary.medianDays);
  if (rtRangeDays) rtRangeDays.textContent = formatResolvingTimeRange(summary.minDays, summary.maxDays);
  if (rtChartAverage) rtChartAverage.textContent = formatResolvingTimeDays(summary.averageDays);

  const grainLabel = DEV_METRICS_GRAIN_LABELS[data.grain] || data.grain;
  if (rtChartHint) {
    rtChartHint.textContent = `${grainLabel} buckets by resolved date${
      data.areaPath ? ` · ${data.areaPath}` : ""
    }`;
  }

  renderTrendChart(rtChartEl, {
    points: data.points || [],
    formatY: (value) => formatResolvingTimeDays(value),
    yMin: 0,
    emptyMessage: "No resolving time data in this date range.",
  });

  if (rtStatusEl) {
    rtStatusEl.textContent = `Last refreshed: ${formatDateTime(data.fetchedAt)} · Filtered ${rangeLabel(data)}${
      data.areaPath ? ` · ${data.areaPath}` : ""
    }`;
  }
}

function persistPullRequestsChartFilters() {
  if (prXAxisSelect) {
    localStorage.setItem(PR_X_AXIS_KEY, prXAxisSelect.value);
  }
  localStorage.setItem(PR_AUTHORS_KEY, JSON.stringify(getSelectedAuthors(prAuthorsSelect)));
}

function restorePullRequestsChartFilters() {
  const savedX = localStorage.getItem(PR_X_AXIS_KEY);
  if (savedX && prXAxisSelect) {
    const valid = [...prXAxisSelect.options].some((option) => option.value === savedX);
    if (valid) prXAxisSelect.value = savedX;
  }
  try {
    const savedAuthors = JSON.parse(localStorage.getItem(PR_AUTHORS_KEY) || "[]");
    if (Array.isArray(savedAuthors)) {
      for (const option of prAuthorsSelect?.options || []) {
        option.selected = savedAuthors.includes(option.value);
      }
    }
  } catch {
    // Ignore invalid saved author filters.
  }
}

function persistResolvingTimeChartFilters() {
  if (rtXAxisSelect) {
    localStorage.setItem(RT_X_AXIS_KEY, rtXAxisSelect.value);
  }
}

function restoreResolvingTimeChartFilters() {
  const savedX = localStorage.getItem(RT_X_AXIS_KEY);
  if (savedX && rtXAxisSelect) {
    const valid = [...rtXAxisSelect.options].some((option) => option.value === savedX);
    if (valid) rtXAxisSelect.value = savedX;
  }
}

function setTrendError(message) {
  if (!trendErrorEl) return;
  if (!message) {
    trendErrorEl.classList.add("hidden");
    trendErrorEl.textContent = "";
    return;
  }
  trendErrorEl.textContent = message;
  trendErrorEl.classList.remove("hidden");
}

function formatTrendValue(value, unit, { compact = false } = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  if (unit === "percent") return `${Number(value).toFixed(1)}%`;
  if (compact && Math.abs(Number(value)) >= 10000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return formatNumber(value);
}

function formatTrendDerivative(value, unit, order) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const suffix = unit === "percent"
    ? order === 2 ? " pp/day²" : " pp/day"
    : order === 2 ? " / day²" : " / day";
  const abs = Math.abs(Number(value));
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
  const formatted = abs.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
  if (value > 0) return `+${formatted}${suffix}`;
  if (value < 0) return `−${formatted}${suffix}`;
  return `${formatted}${suffix}`;
}

function setSignedValue(el, value, formatted) {
  el.classList.remove("up", "down", "flat");
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    el.textContent = "—";
    return;
  }
  el.textContent = formatted;
  if (value > 0) el.classList.add("up");
  else if (value < 0) el.classList.add("down");
  else el.classList.add("flat");
}

function renderTrend(trend) {
  lastTrend = trend;
  trendResults.classList.remove("is-stale");

  if (!trend?.hasData) {
    trendResults.classList.add("hidden");
    trendEmptyState.classList.remove("hidden");
    trendStatusEl.textContent = "No cached data loaded yet.";
    return;
  }

  trendEmptyState.classList.add("hidden");
  trendResults.classList.remove("hidden");
  trendMetricTitle.textContent = trend.metricLabel || "Trend";
  trendMetricHint.textContent = trend.hint || "";
  trendMetricValue.textContent = formatTrendValue(trend.total, trend.unit);
  setSignedValue(
    trendFirstDerivative,
    trend.firstDerivative,
    formatTrendDerivative(trend.firstDerivative, trend.unit, 1)
  );
  setSignedValue(
    trendSecondDerivative,
    trend.secondDerivative,
    formatTrendDerivative(trend.secondDerivative, trend.unit, 2)
  );

  renderTrendChart(trendChartEl, {
    points: trend.points || [],
    formatY: (value) => formatTrendValue(value, trend.unit, { compact: true }),
    yMin: trend.kind === "cumulative" || trend.unit === "percent" ? 0 : null,
    yMax: trend.unit === "percent" ? 100 : null,
    emptyMessage:
      trend.unit === "percent"
        ? "No coverage history in this date range."
        : "No data in this date range.",
  });

  trendStatusEl.textContent = `Last refreshed: ${formatDateTime(trend.fetchedAt)} · Filtered ${rangeLabel(trend)}${
    trend.areaPath ? ` · ${trend.areaPath}` : ""
  }`;
}

function setCmpError(message) {
  if (!cmpErrorEl) return;
  if (!message) {
    cmpErrorEl.classList.add("hidden");
    cmpErrorEl.textContent = "";
    return;
  }
  cmpErrorEl.textContent = message;
  cmpErrorEl.classList.remove("hidden");
}

function renderComparison(period1, period2) {
  cmpMetricsGrid.classList.remove("is-stale");

  if (!period1?.hasData && !period2?.hasData) {
    cmpMetricsGrid.classList.add("hidden");
    cmpEmptyState.classList.remove("hidden");
    cmpStatusEl.textContent = "No cached data loaded yet.";
    return;
  }

  cmpEmptyState.classList.add("hidden");
  cmpMetricsGrid.classList.remove("hidden");
  syncAreaPathMetricVisibility(period1.areaPath || period2.areaPath);
  fillMetricSet(comparisonSets.period1, period1);
  fillMetricSet(comparisonSets.period2, period2);

  for (const key of COMPARISON_VARIANCE_KEYS) {
    const from = period1[key];
    const to = period2[key];
    setVariance(
      document.getElementById(`cmpVar-${key}`),
      from === null || from === undefined ? NaN : Number(from),
      to === null || to === undefined ? NaN : Number(to)
    );
  }

  const fetchedAt = period1.fetchedAt || period2.fetchedAt;
  cmpStatusEl.textContent = `Last refreshed: ${formatDateTime(fetchedAt)} · Period 1 ${rangeLabel(period1)} · Period 2 ${rangeLabel(period2)}${
    period1.areaPath || period2.areaPath ? ` · ${period1.areaPath || period2.areaPath}` : ""
  }`;
}

function renderWorkItemsRows(items) {
  const state = tableState.workItems;
  if (!items.length) {
    state.body.innerHTML =
      '<tr><td colspan="7" class="table-empty">No work items in this date range.</td></tr>';
    return;
  }

  state.body.innerHTML = items
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.workItemType)}</td>
        <td>${escapeHtml(formatDateTime(item.closedDate))}</td>
        <td>${item.storyPoints === null || item.storyPoints === undefined ? "—" : escapeHtml(item.storyPoints)}</td>
        <td>${escapeHtml(item.tags || "—")}</td>
        <td>${escapeHtml(item.areaPath || "—")}</td>
        <td>${escapeHtml(item.iterationPath || "—")}</td>
      </tr>`;
    })
    .join("");
}

function renderPullRequestsRows(items) {
  const state = tableState.pullRequests;
  if (!items.length) {
    state.body.innerHTML =
      '<tr><td colspan="4" class="table-empty">No pull requests in this date range.</td></tr>';
    return;
  }

  state.body.innerHTML = items
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(formatDateTime(item.creationDate))}</td>
        <td>${escapeHtml(item.repository || "—")}</td>
        <td>${escapeHtml(item.author || "—")}</td>
      </tr>`;
    })
    .join("");
}

function updatePager(kind) {
  const state = tableState[kind];
  const from = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const to = Math.min(state.page * state.pageSize, state.total);
  state.pageInfo.textContent = `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(state.total)}`;
  state.prevBtn.disabled = state.page <= 1;
  state.nextBtn.disabled = state.page >= state.totalPages;
}

async function loadTable(kind, { resetPage = false } = {}) {
  if (!dataAccordion?.open) return;

  const state = tableState[kind];
  if (resetPage) state.page = 1;

  const requestId = ++state.requestId;
  state.body.innerHTML =
    `<tr><td colspan="${kind === "workItems" ? 7 : 4}" class="table-empty">Loading…</td></tr>`;

  const endpoint =
    kind === "workItems" ? "/api/details/work-items" : "/api/details/pull-requests";
  const response = await fetch(
    `${endpoint}${buildQuery({ page: state.page, pageSize: state.pageSize })}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load ${kind === "workItems" ? "work items" : "pull requests"}.`);
  }

  const data = await response.json();
  if (requestId !== state.requestId) return;

  state.page = data.page;
  state.pageSize = data.pageSize;
  state.total = data.total;
  state.totalPages = data.totalPages;
  state.loaded = true;
  state.pageSizeSelect.value = String(state.pageSize);

  if (kind === "workItems") renderWorkItemsRows(data.items);
  else renderPullRequestsRows(data.items);

  updatePager(kind);
}

function setActiveTab(kind) {
  activeTab = kind;
  for (const [key, tab] of Object.entries(tabs)) {
    const selected = key === kind;
    tab?.classList.toggle("active", selected);
    tab?.setAttribute("aria-selected", selected ? "true" : "false");
    panels[key]?.classList.toggle("hidden", !selected);
    if (panels[key]) panels[key].hidden = !selected;
  }

  if (dataAccordion?.open) {
    loadTable(kind).catch((error) => {
      setError(error instanceof Error ? error.message : "Failed to load table.");
    });
  }
}

function reloadOpenTables({ resetPage = true } = {}) {
  if (!dataAccordion?.open) {
    tableState.workItems.loaded = false;
    tableState.pullRequests.loaded = false;
    return;
  }

  loadTable(activeTab, { resetPage }).catch((error) => {
    setError(error instanceof Error ? error.message : "Failed to load table.");
  });
}

function fillAreaPathSelect(select, areaPaths) {
  if (!select) return;
  const previous = select.value;
  const paths = Array.isArray(areaPaths) ? areaPaths : [];

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All area paths";
  select.appendChild(allOption);

  for (const path of paths) {
    const option = document.createElement("option");
    option.value = path;
    option.textContent = path;
    select.appendChild(option);
  }

  const stillValid = [...select.options].some((option) => option.value === previous);
  select.value = stillValid ? previous : "";
}

function fillAreaPathOptions(areaPaths) {
  fillAreaPathSelect(wiAreaPathSelect, areaPaths);
  fillAreaPathSelect(trendAreaPathSelect, areaPaths);
  fillAreaPathSelect(areaPathSelect, areaPaths);
  fillAreaPathSelect(cmpAreaPathSelect, areaPaths);
  fillAreaPathSelect(rtAreaPathSelect, areaPaths);
  syncTrendAreaPathFilter();
}

function syncAreaPathMetricVisibility(areaPath) {
  const hide = Boolean(areaPath);
  metricsGrid?.classList.toggle("area-path-filtered", hide);
  cmpMetricsGrid?.classList.toggle("area-path-filtered", hide);
  tabs.pullRequests?.classList.toggle("hidden", hide);
  if (hide && activeTab === "pullRequests" && tabs.workItems) setActiveTab("workItems");
}

async function applyWorkItemsFilters() {
  const requestId = ++latestWorkItemsRequestId;
  setWorkItemsError("");
  wiResults.classList.add("is-stale");

  const filters = getWorkItemsFilters();
  const response = await fetch(
    `/api/work-items${buildQuery({ areaPath: filters.areaPath }, filters)}`
  );
  if (!response.ok) {
    throw new Error("Failed to load work item charts from cache.");
  }

  const data = await response.json();
  if (requestId !== latestWorkItemsRequestId) return;

  fillAreaPathOptions(data.areaPaths);
  renderWorkItemsDashboard(data.workItems);
}

async function applyPullRequestsFilters() {
  const requestId = ++latestPullRequestsRequestId;
  setPullRequestsError("");
  prResults?.classList.add("is-stale");

  const filters = getPullRequestsFilters();
  const savedAuthors = getSelectedAuthors(prAuthorsSelect);
  const response = await fetch(`/api/pull-requests${buildPullRequestsQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Failed to load pull request charts from cache.");
  }

  const data = await response.json();
  if (requestId !== latestPullRequestsRequestId) return;

  fillAuthorOptions(data.pullRequests?.availableAuthors || [], savedAuthors);
  renderPullRequestsDashboard(data.pullRequests);
}

async function applyResolvingTimeFilters() {
  const requestId = ++latestResolvingTimeRequestId;
  setResolvingTimeError("");
  rtResults?.classList.add("is-stale");

  const filters = getResolvingTimeFilters();
  const response = await fetch(`/api/resolving-time${buildResolvingTimeQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Failed to load resolving time from cache.");
  }

  const data = await response.json();
  if (requestId !== latestResolvingTimeRequestId) return;

  fillAreaPathOptions(data.areaPaths);
  renderResolvingTime(data.resolvingTime);
}

async function applyReposFilters() {
  const requestId = ++latestReposRequestId;
  setReposError("");
  reposTableCard.classList.add("is-stale");

  const response = await fetch(`/api/repos${buildQuery({}, getReposFilters())}`);
  if (!response.ok) {
    throw new Error("Failed to load repository summaries from cache.");
  }

  const data = await response.json();
  if (requestId !== latestReposRequestId) return;

  renderRepos(data.repos);
}

async function applyTrendFilters() {
  const requestId = ++latestTrendRequestId;
  setTrendError("");
  trendResults.classList.add("is-stale");

  const filters = getTrendFilters();
  const response = await fetch(
    `/api/trend${buildQuery({ metric: filters.metric, areaPath: filters.areaPath }, filters)}`
  );
  if (!response.ok) {
    throw new Error("Failed to load trend from cache.");
  }

  const data = await response.json();
  if (requestId !== latestTrendRequestId) return;

  fillAreaPathOptions(data.areaPaths);
  renderTrend(data.trend);
}

async function applyComparisonFilters() {
  const requestId = ++latestComparisonRequestId;
  setCmpError("");
  cmpMetricsGrid.classList.add("is-stale");

  const [response1, response2] = await Promise.all([
    fetch(`/api/metrics${buildQuery({}, getComparisonPeriod(1))}`),
    fetch(`/api/metrics${buildQuery({}, getComparisonPeriod(2))}`),
  ]);

  if (!response1.ok || !response2.ok) {
    throw new Error("Failed to load comparison metrics from cache.");
  }

  const data1 = await response1.json();
  const data2 = await response2.json();
  if (requestId !== latestComparisonRequestId) return;

  fillAreaPathOptions(data1.areaPaths || data2.areaPaths);
  renderComparison(data1.metrics, data2.metrics);
}

async function applyDevMetricsChart() {
  if (!devMetricsChartSection) return;
  const requestId = ++latestDevMetricsChartRequestId;
  devMetricsChartSection.classList.add("is-stale");

  const filters = getDevMetricsChartFilters();
  const response = await fetch(
    `/api/dev-metrics/chart${buildQuery(
      { metric: filters.metric, grain: filters.grain, areaPath: filters.areaPath },
      filters
    )}`
  );
  if (!response.ok) {
    throw new Error("Failed to load dev metrics chart from cache.");
  }

  const data = await response.json();
  if (requestId !== latestDevMetricsChartRequestId) return;

  renderDevMetricsChartPanel(data.chart);
}

async function applyFilters() {
  const requestId = ++latestRequestId;
  const chartRequestId = ++latestDevMetricsChartRequestId;
  setError("");
  metricsGrid.classList.add("is-stale");
  devMetricsChartSection?.classList.add("is-stale");

  const chartFilters = getDevMetricsChartFilters();
  const [response, chartResponse] = await Promise.all([
    fetch(`/api/metrics${buildQuery()}`),
    devMetricsChartSection
      ? fetch(
          `/api/dev-metrics/chart${buildQuery(
            {
              metric: chartFilters.metric,
              grain: chartFilters.grain,
              areaPath: chartFilters.areaPath,
            },
            chartFilters
          )}`
        )
      : Promise.resolve(null),
  ]);
  if (!response.ok) {
    throw new Error("Failed to load metrics from cache.");
  }

  const data = await response.json();
  if (requestId !== latestRequestId) {
    return;
  }

  fillAreaPathOptions(data.areaPaths);
  renderMetrics(data.metrics);
  reloadOpenTables({ resetPage: true });

  if (chartResponse) {
    if (!chartResponse.ok) {
      throw new Error("Failed to load dev metrics chart from cache.");
    }
    const chartData = await chartResponse.json();
    if (requestId === latestRequestId && chartRequestId === latestDevMetricsChartRequestId) {
      renderDevMetricsChartPanel(chartData.chart);
    }
  }

  if (data.refreshing) {
    setRefreshing(true);
    if (statusEl) statusEl.textContent = "Refresh in progress…";
  }
}

async function refreshData() {
  setRefreshing(true);
  setError("");
  setCmpError("");
  setTrendError("");
  setReposError("");
  setWorkItemsError("");
  setPullRequestsError("");
  setResolvingTimeError("");
  const previousStatus = statusEl?.textContent;
  const previousCmpStatus = cmpStatusEl?.textContent;
  const previousTrendStatus = trendStatusEl?.textContent;
  const previousReposStatus = reposStatusEl?.textContent;
  const previousWiStatus = wiStatusEl?.textContent;
  const previousPrStatus = prStatusEl?.textContent;
  const previousRtStatus = rtStatusEl?.textContent;
  if (statusEl) statusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  if (cmpStatusEl) cmpStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  if (trendStatusEl) trendStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  if (reposStatusEl) reposStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  if (wiStatusEl) wiStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  if (prStatusEl) prStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  if (rtStatusEl) rtStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";

  try {
    const response = await fetch("/api/refresh", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Refresh failed.");
    }
    latestRequestId += 1;
    await reloadCurrentDashboard();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed.";
    setError(message);
    setCmpError(message);
    setTrendError(message);
    setReposError(message);
    setWorkItemsError(message);
    setPullRequestsError(message);
    setResolvingTimeError(message);
    if (statusEl) statusEl.textContent = previousStatus;
    if (cmpStatusEl) cmpStatusEl.textContent = previousCmpStatus;
    if (trendStatusEl) trendStatusEl.textContent = previousTrendStatus;
    if (reposStatusEl) reposStatusEl.textContent = previousReposStatus;
    if (wiStatusEl) wiStatusEl.textContent = previousWiStatus;
    if (prStatusEl) prStatusEl.textContent = previousPrStatus;
    if (rtStatusEl) rtStatusEl.textContent = previousRtStatus;
    metricsGrid?.classList.remove("is-stale");
    devMetricsChartSection?.classList.remove("is-stale");
    cmpMetricsGrid?.classList.remove("is-stale");
    trendResults?.classList.remove("is-stale");
    reposTableCard?.classList.remove("is-stale");
    wiResults?.classList.remove("is-stale");
    prResults?.classList.remove("is-stale");
    rtResults?.classList.remove("is-stale");
  } finally {
    setRefreshing(false);
  }
}

function onFiltersChanged() {
  persistPageDates("dev-metrics");
  reloadDevMetrics();
}

function onComparisonFiltersChanged() {
  persistPageDates("comparison");
  reloadComparisonMetrics();
}

function persistDevMetricsChartFilters() {
  if (devMetricsYAxisSelect) {
    localStorage.setItem(DEV_METRICS_Y_AXIS_KEY, devMetricsYAxisSelect.value);
  }
  if (devMetricsXAxisSelect) {
    localStorage.setItem(DEV_METRICS_X_AXIS_KEY, devMetricsXAxisSelect.value);
  }
}

function restoreDevMetricsChartFilters() {
  const savedY = localStorage.getItem(DEV_METRICS_Y_AXIS_KEY);
  if (savedY && devMetricsYAxisSelect) {
    const valid = [...devMetricsYAxisSelect.options].some((option) => option.value === savedY);
    if (valid) devMetricsYAxisSelect.value = savedY;
  }
  const savedX = localStorage.getItem(DEV_METRICS_X_AXIS_KEY);
  if (savedX && devMetricsXAxisSelect) {
    const valid = [...devMetricsXAxisSelect.options].some((option) => option.value === savedX);
    if (valid) devMetricsXAxisSelect.value = savedX;
  }
}

function onDevMetricsChartFiltersChanged() {
  persistDevMetricsChartFilters();
  reloadDevMetricsChart();
}

function persistTrendMetric() {
  if (!trendMetricSelect) return;
  localStorage.setItem(TREND_METRIC_KEY, trendMetricSelect.value);
}

function restoreTrendMetric() {
  if (!trendMetricSelect) return;
  const saved = localStorage.getItem(TREND_METRIC_KEY);
  if (!saved) return;
  const valid = [...trendMetricSelect.options].some((option) => option.value === saved);
  if (valid) trendMetricSelect.value = saved;
}

function onTrendFiltersChanged() {
  syncTrendAreaPathFilter();
  persistPageDates("trend");
  persistTrendMetric();
  reloadTrendMetrics();
}

function onWorkItemsFiltersChanged() {
  persistPageDates("work-items");
  reloadWorkItems();
}

function onPullRequestsFiltersChanged() {
  persistPageDates("pull-requests");
  persistPullRequestsChartFilters();
  reloadPullRequests();
}

function onResolvingTimeFiltersChanged() {
  persistPageDates("resolving-time");
  persistResolvingTimeChartFilters();
  reloadResolvingTime();
}

function onReposFiltersChanged() {
  persistPageDates("repos");
  reloadRepos();
}

function reloadDevMetrics() {
  applyFilters().catch((error) => {
    metricsGrid.classList.remove("is-stale");
    devMetricsChartSection?.classList.remove("is-stale");
    setError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadDevMetricsChart() {
  applyDevMetricsChart().catch((error) => {
    devMetricsChartSection?.classList.remove("is-stale");
    setError(error instanceof Error ? error.message : "Failed to load chart.");
  });
}

function reloadComparisonMetrics() {
  applyComparisonFilters().catch((error) => {
    cmpMetricsGrid.classList.remove("is-stale");
    setCmpError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadTrendMetrics() {
  applyTrendFilters().catch((error) => {
    trendResults.classList.remove("is-stale");
    setTrendError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadWorkItems() {
  applyWorkItemsFilters().catch((error) => {
    wiResults.classList.remove("is-stale");
    setWorkItemsError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadPullRequests() {
  applyPullRequestsFilters().catch((error) => {
    prResults?.classList.remove("is-stale");
    setPullRequestsError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadResolvingTime() {
  applyResolvingTimeFilters().catch((error) => {
    rtResults?.classList.remove("is-stale");
    setResolvingTimeError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadRepos() {
  applyReposFilters().catch((error) => {
    reposTableCard.classList.remove("is-stale");
    setReposError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function reloadCurrentDashboard() {
  if (currentDashboardId === "comparison") return applyComparisonFilters();
  if (currentDashboardId === "trend") return applyTrendFilters();
  if (currentDashboardId === "repos") return applyReposFilters();
  if (currentDashboardId === "work-items") return applyWorkItemsFilters();
  if (currentDashboardId === "pull-requests") return applyPullRequestsFilters();
  if (currentDashboardId === "resolving-time") return applyResolvingTimeFilters();
  return applyFilters();
}

function clearFilters() {
  startDateInput.value = "";
  endDateInput.value = "";
  onFiltersChanged();
}

function clearComparisonFilters() {
  cmpStartDateInput.value = "";
  cmpEndDateInput.value = "";
  cmpStartDate2Input.value = "";
  cmpEndDate2Input.value = "";
  onComparisonFiltersChanged();
}

function clearTrendFilters() {
  trendStartDateInput.value = "";
  trendEndDateInput.value = "";
  onTrendFiltersChanged();
}

function clearWorkItemsFilters() {
  wiStartDateInput.value = "";
  wiEndDateInput.value = "";
  onWorkItemsFiltersChanged();
}

function clearPullRequestsFilters() {
  prStartDateInput.value = "";
  prEndDateInput.value = "";
  onPullRequestsFiltersChanged();
}

function clearResolvingTimeFilters() {
  rtStartDateInput.value = "";
  rtEndDateInput.value = "";
  onResolvingTimeFiltersChanged();
}

function clearReposFilters() {
  reposStartDateInput.value = "";
  reposEndDateInput.value = "";
  onReposFiltersChanged();
}

async function init() {
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const { cutDate, branding: nextBranding, areaPaths } = await response.json();
      applyBranding(nextBranding);
      fillAreaPathOptions(areaPaths);
      const today = todayIsoDate();
      if (cutDate) {
        if (startDateInput) {
          startDateInput.min = cutDate;
          startDateInput.value = cutDate;
        }
        if (cmpStartDateInput) {
          cmpStartDateInput.min = cutDate;
          cmpStartDateInput.value = cutDate;
        }
        if (cmpStartDate2Input) cmpStartDate2Input.min = cutDate;
        if (trendStartDateInput) {
          trendStartDateInput.min = cutDate;
          trendStartDateInput.value = cutDate;
        }
        if (reposStartDateInput) {
          reposStartDateInput.min = cutDate;
          reposStartDateInput.value = cutDate;
        }
        if (wiStartDateInput) {
          wiStartDateInput.min = cutDate;
          wiStartDateInput.value = cutDate;
        }
        if (prStartDateInput) {
          prStartDateInput.min = cutDate;
          prStartDateInput.value = cutDate;
        }
        if (rtStartDateInput) {
          rtStartDateInput.min = cutDate;
          rtStartDateInput.value = cutDate;
        }
      }
      if (endDateInput) endDateInput.value = today;
      if (cmpEndDateInput) cmpEndDateInput.value = today;
      if (trendEndDateInput) trendEndDateInput.value = today;
      if (reposEndDateInput) reposEndDateInput.value = today;
      if (wiEndDateInput) wiEndDateInput.value = today;
      if (prEndDateInput) prEndDateInput.value = today;
      if (rtEndDateInput) rtEndDateInput.value = today;
      const lastYear = String(Number(today.slice(0, 4)) - 1);
      if (cmpStartDate2Input) cmpStartDate2Input.value = `${lastYear}-01-01`;
      if (cmpEndDate2Input) cmpEndDate2Input.value = `${lastYear}-12-31`;
    }
  } catch {
    // Fall through: filters simply start empty.
  }

  restorePageDates(currentDashboardId);
  restoreTrendMetric();
  restoreDevMetricsChartFilters();
  restorePullRequestsChartFilters();
  restoreResolvingTimeChartFilters();
  syncTrendAreaPathFilter();
  await reloadCurrentDashboard();
}

function readEmbeddedBranding() {
  const el = document.getElementById("branding-config");
  if (!el?.textContent) return { author: "", product: "" };
  try {
    const parsed = JSON.parse(el.textContent);
    return {
      author: typeof parsed.author === "string" ? parsed.author : "",
      product: typeof parsed.product === "string" ? parsed.product : "",
    };
  } catch {
    return { author: "", product: "" };
  }
}

let branding = readEmbeddedBranding();

function brandMark() {
  return `${branding.author} / ${branding.product}`;
}

function documentTitleFor(dashboardId) {
  const name = DASHBOARDS[dashboardId]?.name || "Dev Metrics";
  return `${branding.product} ${name} by ${branding.author}`;
}

function applyBranding(nextBranding) {
  if (nextBranding?.author) branding.author = nextBranding.author;
  if (nextBranding?.product) branding.product = nextBranding.product;
  const mark = brandMark();
  for (const el of document.querySelectorAll("[data-brand-mark]")) {
    el.textContent = mark;
  }
  document.title = documentTitleFor(currentDashboardId);
}

function bindPage() {
  refreshBtn?.addEventListener("click", refreshData);
  clearFiltersBtn?.addEventListener("click", clearFilters);
  cmpClearFiltersBtn?.addEventListener("click", clearComparisonFilters);
  trendClearFiltersBtn?.addEventListener("click", clearTrendFilters);
  reposClearFiltersBtn?.addEventListener("click", clearReposFilters);
  wiClearFiltersBtn?.addEventListener("click", clearWorkItemsFilters);
  prClearFiltersBtn?.addEventListener("click", clearPullRequestsFilters);
  rtClearFiltersBtn?.addEventListener("click", clearResolvingTimeFilters);
  startDateInput?.addEventListener("change", onFiltersChanged);
  endDateInput?.addEventListener("change", onFiltersChanged);
  areaPathSelect?.addEventListener("change", onFiltersChanged);
  devMetricsYAxisSelect?.addEventListener("change", onDevMetricsChartFiltersChanged);
  devMetricsXAxisSelect?.addEventListener("change", onDevMetricsChartFiltersChanged);
  cmpStartDateInput?.addEventListener("change", onComparisonFiltersChanged);
  cmpEndDateInput?.addEventListener("change", onComparisonFiltersChanged);
  cmpStartDate2Input?.addEventListener("change", onComparisonFiltersChanged);
  cmpEndDate2Input?.addEventListener("change", onComparisonFiltersChanged);
  cmpAreaPathSelect?.addEventListener("change", onComparisonFiltersChanged);
  trendStartDateInput?.addEventListener("change", onTrendFiltersChanged);
  trendEndDateInput?.addEventListener("change", onTrendFiltersChanged);
  trendMetricSelect?.addEventListener("change", onTrendFiltersChanged);
  trendAreaPathSelect?.addEventListener("change", onTrendFiltersChanged);
  reposStartDateInput?.addEventListener("change", onReposFiltersChanged);
  reposEndDateInput?.addEventListener("change", onReposFiltersChanged);
  wiStartDateInput?.addEventListener("change", onWorkItemsFiltersChanged);
  wiEndDateInput?.addEventListener("change", onWorkItemsFiltersChanged);
  wiAreaPathSelect?.addEventListener("change", onWorkItemsFiltersChanged);
  prStartDateInput?.addEventListener("change", onPullRequestsFiltersChanged);
  prEndDateInput?.addEventListener("change", onPullRequestsFiltersChanged);
  prAuthorsSelect?.addEventListener("change", onPullRequestsFiltersChanged);
  prXAxisSelect?.addEventListener("change", onPullRequestsFiltersChanged);
  rtStartDateInput?.addEventListener("change", onResolvingTimeFiltersChanged);
  rtEndDateInput?.addEventListener("change", onResolvingTimeFiltersChanged);
  rtXAxisSelect?.addEventListener("change", onResolvingTimeFiltersChanged);
  rtAreaPathSelect?.addEventListener("change", onResolvingTimeFiltersChanged);

  for (const [key, tab] of Object.entries(wiChartTabs)) {
    tab?.addEventListener("click", () => setWorkItemsChartTab(key));
  }

  for (const [key, tab] of Object.entries(prChartTabs)) {
    tab?.addEventListener("click", () => setPullRequestsChartTab(key));
  }

  tabs.workItems?.addEventListener("click", () => setActiveTab("workItems"));
  tabs.pullRequests?.addEventListener("click", () => setActiveTab("pullRequests"));

  dataAccordion?.addEventListener("toggle", () => {
    if (dataAccordion.open) {
      loadTable(activeTab, { resetPage: false }).catch((error) => {
        setError(error instanceof Error ? error.message : "Failed to load table.");
      });
    }
  });

  for (const kind of ["workItems", "pullRequests"]) {
    const state = tableState[kind];
    state.pageSizeSelect?.addEventListener("change", () => {
      state.pageSize = Number(state.pageSizeSelect.value) || 10;
      loadTable(kind, { resetPage: true }).catch((error) => {
        setError(error instanceof Error ? error.message : "Failed to load table.");
      });
    });
    state.prevBtn?.addEventListener("click", () => {
      if (state.page <= 1) return;
      state.page -= 1;
      loadTable(kind).catch((error) => {
        setError(error instanceof Error ? error.message : "Failed to load table.");
      });
    });
    state.nextBtn?.addEventListener("click", () => {
      if (state.page >= state.totalPages) return;
      state.page += 1;
      loadTable(kind).catch((error) => {
        setError(error instanceof Error ? error.message : "Failed to load table.");
      });
    });
  }

  attachDatePresetMenus();
  attachRangePresetMenus({
    devMetricsClearBtn: clearFiltersBtn,
    comparisonClearBtn: cmpClearFiltersBtn,
    trendClearBtn: trendClearFiltersBtn,
    reposClearBtn: reposClearFiltersBtn,
    workItemsClearBtn: wiClearFiltersBtn,
    pullRequestsClearBtn: prClearFiltersBtn,
    resolvingTimeClearBtn: rtClearFiltersBtn,
    onDevMetricsRange: ({ start, end }) => {
      startDateInput.value = start;
      endDateInput.value = end;
      onFiltersChanged();
    },
    onComparisonRange: ({ start, end, start2, end2 }) => {
      cmpStartDateInput.value = start;
      cmpEndDateInput.value = end;
      cmpStartDate2Input.value = start2;
      cmpEndDate2Input.value = end2;
      onComparisonFiltersChanged();
    },
    onTrendRange: ({ start, end }) => {
      trendStartDateInput.value = start;
      trendEndDateInput.value = end;
      onTrendFiltersChanged();
    },
    onReposRange: ({ start, end }) => {
      reposStartDateInput.value = start;
      reposEndDateInput.value = end;
      onReposFiltersChanged();
    },
    onWorkItemsRange: ({ start, end }) => {
      wiStartDateInput.value = start;
      wiEndDateInput.value = end;
      onWorkItemsFiltersChanged();
    },
    onPullRequestsRange: ({ start, end }) => {
      prStartDateInput.value = start;
      prEndDateInput.value = end;
      onPullRequestsFiltersChanged();
    },
    onResolvingTimeRange: ({ start, end }) => {
      rtStartDateInput.value = start;
      rtEndDateInput.value = end;
      onResolvingTimeFiltersChanged();
    },
  });
}

if (!shouldRedirectLegacyHash) {
  bindPage();
  init().catch((error) => {
    metricsGrid?.classList.remove("is-stale");
    const status = document.querySelector(".status");
    if (status) status.textContent = "Could not load dashboard.";
    const message = error instanceof Error ? error.message : "Load failed.";
    setError(message);
    setCmpError(message);
    setTrendError(message);
    setReposError(message);
    setWorkItemsError(message);
    setPullRequestsError(message);
    setResolvingTimeError(message);
  });
}
