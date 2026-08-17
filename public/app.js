const refreshBtn = document.getElementById("refreshBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const statusEl = document.getElementById("status");
const emptyState = document.getElementById("emptyState");
const metricsGrid = document.getElementById("metricsGrid");
const errorEl = document.getElementById("error");
const dataAccordion = document.getElementById("dataAccordion");

const fields = {
  userStories: document.getElementById("userStories"),
  storyPoints: document.getElementById("storyPoints"),
  bugs: document.getElementById("bugs"),
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

const cmpRefreshBtn = document.getElementById("cmpRefreshBtn");
const cmpClearFiltersBtn = document.getElementById("cmpClearFiltersBtn");
const cmpStartDateInput = document.getElementById("cmpStartDate");
const cmpEndDateInput = document.getElementById("cmpEndDate");
const cmpStartDate2Input = document.getElementById("cmpStartDate2");
const cmpEndDate2Input = document.getElementById("cmpEndDate2");
const cmpStatusEl = document.getElementById("cmpStatus");
const cmpEmptyState = document.getElementById("cmpEmptyState");
const cmpMetricsGrid = document.getElementById("cmpMetricsGrid");
const cmpErrorEl = document.getElementById("cmpError");

function metricSet(prefix) {
  return {
    userStories: document.getElementById(`${prefix}-userStories`),
    storyPoints: document.getElementById(`${prefix}-storyPoints`),
    bugs: document.getElementById(`${prefix}-bugs`),
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

let latestComparisonRequestId = 0;
let latestRequestId = 0;
let activeTab = "workItems";

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

function getFilters() {
  return {
    startDate: startDateInput.value || null,
    endDate: endDateInput.value || null,
  };
}

function getComparisonPeriod(index) {
  if (index === 2) {
    return {
      startDate: cmpStartDate2Input.value || null,
      endDate: cmpEndDate2Input.value || null,
    };
  }
  return {
    startDate: cmpStartDateInput.value || null,
    endDate: cmpEndDateInput.value || null,
  };
}

function buildQuery(extra = {}, filters = getFilters()) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function setError(message) {
  if (!message) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function setRefreshing(isRefreshing) {
  refreshBtn.disabled = isRefreshing;
  refreshBtn.textContent = isRefreshing ? "Refreshing…" : "Refresh data";
  cmpRefreshBtn.disabled = isRefreshing;
  cmpRefreshBtn.textContent = isRefreshing ? "Refreshing…" : "Refresh data";
}

function fillMetricSet(set, metrics) {
  set.userStories.textContent = formatNumber(metrics.userStories);
  set.storyPoints.textContent = formatNumber(metrics.storyPoints);
  set.bugs.textContent = formatNumber(metrics.bugs);
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
  fillMetricSet(
    {
      userStories: fields.userStories,
      storyPoints: fields.storyPoints,
      bugs: fields.bugs,
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

  statusEl.textContent = `Last refreshed: ${formatDateTime(metrics.fetchedAt)} · Filtered ${rangeLabel(metrics)}`;
}

function setCmpError(message) {
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
  fillMetricSet(comparisonSets.period1, period1);
  fillMetricSet(comparisonSets.period2, period2);

  const fetchedAt = period1.fetchedAt || period2.fetchedAt;
  cmpStatusEl.textContent = `Last refreshed: ${formatDateTime(fetchedAt)} · Period 1 ${rangeLabel(period1)} · Period 2 ${rangeLabel(period2)}`;
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
      '<tr><td colspan="3" class="table-empty">No pull requests in this date range.</td></tr>';
    return;
  }

  state.body.innerHTML = items
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(formatDateTime(item.creationDate))}</td>
        <td>${escapeHtml(item.repository || "—")}</td>
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
  if (!dataAccordion.open) return;

  const state = tableState[kind];
  if (resetPage) state.page = 1;

  const requestId = ++state.requestId;
  state.body.innerHTML =
    `<tr><td colspan="${kind === "workItems" ? 7 : 3}" class="table-empty">Loading…</td></tr>`;

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
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    panels[key].classList.toggle("hidden", !selected);
    panels[key].hidden = !selected;
  }

  if (dataAccordion.open) {
    loadTable(kind).catch((error) => {
      setError(error instanceof Error ? error.message : "Failed to load table.");
    });
  }
}

function reloadOpenTables({ resetPage = true } = {}) {
  if (!dataAccordion.open) {
    tableState.workItems.loaded = false;
    tableState.pullRequests.loaded = false;
    return;
  }

  loadTable(activeTab, { resetPage }).catch((error) => {
    setError(error instanceof Error ? error.message : "Failed to load table.");
  });
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

  renderComparison(data1.metrics, data2.metrics);
}

async function applyFilters() {
  const requestId = ++latestRequestId;
  setError("");
  metricsGrid.classList.add("is-stale");

  const response = await fetch(`/api/metrics${buildQuery()}`);
  if (!response.ok) {
    throw new Error("Failed to load metrics from cache.");
  }

  const data = await response.json();
  if (requestId !== latestRequestId) {
    return;
  }

  renderMetrics(data.metrics);
  reloadOpenTables({ resetPage: true });

  if (data.refreshing) {
    setRefreshing(true);
    statusEl.textContent = "Refresh in progress…";
    cmpStatusEl.textContent = "Refresh in progress…";
  }
}

async function refreshData() {
  setRefreshing(true);
  setError("");
  setCmpError("");
  statusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";
  cmpStatusEl.textContent = "Refreshing from Azure DevOps and SonarCloud…";

  try {
    const response = await fetch(`/api/refresh${buildQuery()}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Refresh failed.");
    }
    latestRequestId += 1;
    renderMetrics(data.metrics);
    reloadOpenTables({ resetPage: true });
    await applyComparisonFilters();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed.";
    setError(message);
    setCmpError(message);
  } finally {
    setRefreshing(false);
  }
}

function onFiltersChanged() {
  applyFilters().catch((error) => {
    metricsGrid.classList.remove("is-stale");
    setError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
}

function onComparisonFiltersChanged() {
  applyComparisonFilters().catch((error) => {
    cmpMetricsGrid.classList.remove("is-stale");
    setCmpError(error instanceof Error ? error.message : "Failed to apply filters.");
  });
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

async function init() {
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const { cutDate } = await response.json();
      const today = todayIsoDate();
      if (cutDate) {
        startDateInput.min = cutDate;
        startDateInput.value = cutDate;
        cmpStartDateInput.min = cutDate;
        cmpStartDate2Input.min = cutDate;
        cmpStartDateInput.value = cutDate;
      }
      endDateInput.value = today;
      cmpEndDateInput.value = today;
      const lastYear = String(Number(today.slice(0, 4)) - 1);
      cmpStartDate2Input.value = `${lastYear}-01-01`;
      cmpEndDate2Input.value = `${lastYear}-12-31`;
    }
  } catch {
    // Fall through: filters simply start empty.
  }

  await Promise.all([applyFilters(), applyComparisonFilters()]);
}

refreshBtn.addEventListener("click", refreshData);
cmpRefreshBtn.addEventListener("click", refreshData);
clearFiltersBtn.addEventListener("click", clearFilters);
cmpClearFiltersBtn.addEventListener("click", clearComparisonFilters);
startDateInput.addEventListener("change", onFiltersChanged);
endDateInput.addEventListener("change", onFiltersChanged);
cmpStartDateInput.addEventListener("change", onComparisonFiltersChanged);
cmpEndDateInput.addEventListener("change", onComparisonFiltersChanged);
cmpStartDate2Input.addEventListener("change", onComparisonFiltersChanged);
cmpEndDate2Input.addEventListener("change", onComparisonFiltersChanged);

tabs.workItems.addEventListener("click", () => setActiveTab("workItems"));
tabs.pullRequests.addEventListener("click", () => setActiveTab("pullRequests"));

dataAccordion.addEventListener("toggle", () => {
  if (dataAccordion.open) {
    loadTable(activeTab, { resetPage: false }).catch((error) => {
      setError(error instanceof Error ? error.message : "Failed to load table.");
    });
  }
});

for (const kind of ["workItems", "pullRequests"]) {
  const state = tableState[kind];
  state.pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(state.pageSizeSelect.value) || 10;
    loadTable(kind, { resetPage: true }).catch((error) => {
      setError(error instanceof Error ? error.message : "Failed to load table.");
    });
  });
  state.prevBtn.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadTable(kind).catch((error) => {
      setError(error instanceof Error ? error.message : "Failed to load table.");
    });
  });
  state.nextBtn.addEventListener("click", () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    loadTable(kind).catch((error) => {
      setError(error instanceof Error ? error.message : "Failed to load table.");
    });
  });
}

const DASHBOARDS = {
  "dev-metrics": {
    title: "Klir Dev Metrics by Heringer",
    view: document.getElementById("dashboard-dev-metrics"),
  },
  comparison: {
    title: "Klir Comparison by Heringer",
    view: document.getElementById("dashboard-comparison"),
  },
};

const navLinks = document.querySelectorAll(".nav-link[data-dashboard]");

function showDashboard(id) {
  const requested = id === "overview" ? "comparison" : id;
  const dashboardId = DASHBOARDS[requested] ? requested : "dev-metrics";
  const dashboard = DASHBOARDS[dashboardId];

  for (const [key, entry] of Object.entries(DASHBOARDS)) {
    const isActive = key === dashboardId;
    entry.view.classList.toggle("hidden", !isActive);
  }

  for (const link of navLinks) {
    link.classList.toggle("active", link.dataset.dashboard === dashboardId);
  }

  document.title = dashboard.title;
  if (window.location.hash !== `#${dashboardId}`) {
    window.location.hash = dashboardId;
  }
}

for (const link of navLinks) {
  link.addEventListener("click", () => {
    showDashboard(link.dataset.dashboard);
  });
}

window.addEventListener("hashchange", () => {
  showDashboard(window.location.hash.replace(/^#/, ""));
});

showDashboard(window.location.hash.replace(/^#/, "") || "dev-metrics");

init().catch((error) => {
  metricsGrid.classList.remove("is-stale");
  statusEl.textContent = "Could not load dashboard.";
  setError(error instanceof Error ? error.message : "Load failed.");
});
