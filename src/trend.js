import { toBoundDate, isWithinRange } from "./details.js";
import { aggregateCode, hasSprintBugTag, hasTechDebtTag } from "./metrics.js";
import { isAreaPathOfInterest } from "./config.js";

export const TREND_METRICS = {
  storyPoints: {
    label: "Story points sum",
    kind: "cumulative",
    unit: "points",
    hint: "Accumulated by work-item closed date in the selected range.",
  },
  userStories: {
    label: "User stories count",
    kind: "cumulative",
    unit: "count",
    hint: "Accumulated by work-item closed date in the selected range.",
  },
  techDebts: {
    label: "Tech debt count",
    kind: "cumulative",
    unit: "count",
    hint: "Accumulated by work-item closed date in the selected range.",
  },
  sprintBugs: {
    label: "Sprint bug count",
    kind: "cumulative",
    unit: "count",
    hint: "Closed Bug items tagged sprint-bug, accumulated by closed date in the selected range.",
  },
  usBugs: {
    label: "US bug count",
    kind: "cumulative",
    unit: "count",
    hint: "Closed Bug items without the sprint-bug tag, accumulated by closed date in the selected range.",
  },
  pullRequests: {
    label: "Pull request count",
    kind: "cumulative",
    unit: "count",
    hint: "Accumulated by pull-request creation date in the selected range.",
  },
  linesOfCode: {
    label: "Lines of code sum",
    kind: "level",
    unit: "ncloc",
    hint: "Total ncloc as of each day, using the last SonarCloud analysis on or before that day.",
  },
  coverage: {
    label: "Coverage",
    kind: "level",
    unit: "percent",
    hint: "ncloc-weighted coverage as of each day, using the last SonarCloud analysis on or before that day. This is a level, not an accumulated sum.",
  },
};

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoDay(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function addDays(iso, amount) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function enumerateDays(start, end) {
  if (!start || !end || start > end) return [];
  const days = [];
  let day = start;
  let guard = 0;
  while (day <= end && guard < 4000) {
    days.push(day);
    day = addDays(day, 1);
    guard += 1;
  }
  return days;
}

function earliestDay(dates) {
  const valid = dates.filter(Boolean).sort();
  return valid[0] || null;
}

function roundValue(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (unit === "percent") return Math.round(value * 10) / 10;
  if (unit === "points") return Math.round(value * 100) / 100;
  return value;
}

function trendMetricUsesAreaPath(metricId) {
  const meta = TREND_METRICS[metricId];
  return Boolean(meta) && meta.kind === "cumulative" && metricId !== "pullRequests";
}

function matchesTrendAreaPath(item, areaPath) {
  if (!isAreaPathOfInterest(item.areaPath)) return false;
  if (!areaPath) return true;
  return (item.areaPath || "") === areaPath;
}

function emptyTrend(filters, metricId, meta) {
  return {
    hasData: false,
    fetchedAt: null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    areaPath: trendMetricUsesAreaPath(metricId) ? filters.areaPath || null : null,
    metric: metricId,
    metricLabel: meta.label,
    kind: meta.kind,
    unit: meta.unit,
    hint: meta.hint,
    points: [],
    total: null,
    firstDerivative: null,
    secondDerivative: null,
  };
}

function eventIncrement(metricId, workItem) {
  if (metricId === "userStories") {
    return workItem.workItemType === "User Story" ? 1 : 0;
  }
  if (metricId === "storyPoints") {
    if (workItem.workItemType !== "User Story") return 0;
    const points = Number(workItem.storyPoints);
    return Number.isFinite(points) ? points : 0;
  }
  if (metricId === "sprintBugs") {
    return workItem.workItemType === "Bug" && hasSprintBugTag(workItem.tags) ? 1 : 0;
  }
  if (metricId === "usBugs") {
    return workItem.workItemType === "Bug" && !hasSprintBugTag(workItem.tags) ? 1 : 0;
  }
  if (metricId === "techDebts") {
    return workItem.workItemType === "Task" && hasTechDebtTag(workItem.tags) ? 1 : 0;
  }
  return 0;
}

function cumulativeSeries(items, dateField, incrementFor, days, unit) {
  const byDay = new Map();
  for (const item of items) {
    const day = isoDay(item[dateField]);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) || 0) + incrementFor(item));
  }

  let running = 0;
  return days.map((date) => {
    running += byDay.get(date) || 0;
    return { date, value: roundValue(running, unit) };
  });
}

function codeSeries(projects, days, field) {
  const analysisDates = [];
  const seen = new Set();
  for (const project of projects) {
    for (const point of project.history || []) {
      if (!point.date || seen.has(point.date)) continue;
      seen.add(point.date);
      analysisDates.push(point.date);
    }
  }
  analysisDates.sort((a, b) => new Date(a) - new Date(b));

  const snapshots = analysisDates.map((date) =>
    aggregateCode(projects, new Date(date), { allowSnapshotFallback: true })
  );

  let index = -1;
  return days.map((date) => {
    const end = toBoundDate(date, "end");
    while (
      index + 1 < analysisDates.length &&
      new Date(analysisDates[index + 1]) <= end
    ) {
      index += 1;
    }
    if (index < 0) return { date, value: null };

    const totals = snapshots[index];
    const raw = field === "coverage" ? totals.coverage : totals.ncloc;
    if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) {
      return { date, value: null };
    }
    return {
      date,
      value: field === "coverage" ? roundValue(Number(raw), "percent") : Number(raw),
    };
  });
}

function buildTrendPoints(metricId, meta, cache, start, end, days, areaPath) {
  const workItems = (cache.workItems || []).filter((wi) =>
    matchesTrendAreaPath(wi, areaPath)
  );
  const pullRequests = cache.pullRequests || [];
  const sonar = cache.sonar || [];

  if (metricId === "pullRequests") {
    const items = pullRequests.filter((pr) =>
      isWithinRange(pr.creationDate, start, end)
    );
    return cumulativeSeries(items, "creationDate", () => 1, days, meta.unit);
  }

  if (meta.kind === "cumulative") {
    const items = workItems.filter((wi) => isWithinRange(wi.closedDate, start, end));
    return cumulativeSeries(
      items,
      "closedDate",
      (item) => eventIncrement(metricId, item),
      days,
      meta.unit
    );
  }

  return codeSeries(sonar, days, metricId === "coverage" ? "coverage" : "ncloc");
}

function definedValueRun(points) {
  const start = points.findIndex(
    (point) =>
      point.value !== null &&
      point.value !== undefined &&
      Number.isFinite(Number(point.value))
  );
  if (start < 0) return [];

  const values = [];
  for (let i = start; i < points.length; i += 1) {
    const value = Number(points[i].value);
    if (points[i].value === null || points[i].value === undefined || !Number.isFinite(value)) {
      break;
    }
    values.push(value);
  }
  return values;
}

function roundDerivative(value) {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value * 10) / 10;
  if (abs >= 1) return Math.round(value * 100) / 100;
  return Math.round(value * 10000) / 10000;
}

function solve3x3(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < 3; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivotRow][col])) pivotRow = row;
    }
    [rows[col], rows[pivotRow]] = [rows[pivotRow], rows[col]];
    const pivot = rows[col][col];
    if (Math.abs(pivot) < 1e-12) return null;
    for (let j = col; j < 4; j += 1) rows[col][j] /= pivot;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j < 4; j += 1) rows[row][j] -= factor * rows[col][j];
    }
  }
  return [rows[0][3], rows[1][3], rows[2][3]];
}

function quadraticCoefficients(values) {
  const n = values.length;
  let sumT = 0;
  let sumT2 = 0;
  let sumT3 = 0;
  let sumT4 = 0;
  let sumY = 0;
  let sumTY = 0;
  let sumT2Y = 0;

  for (let t = 0; t < n; t += 1) {
    const t2 = t * t;
    const y = values[t];
    sumT += t;
    sumT2 += t2;
    sumT3 += t2 * t;
    sumT4 += t2 * t2;
    sumY += y;
    sumTY += t * y;
    sumT2Y += t2 * y;
  }

  return solve3x3(
    [
      [n, sumT, sumT2],
      [sumT, sumT2, sumT3],
      [sumT2, sumT3, sumT4],
    ],
    [sumY, sumTY, sumT2Y]
  );
}

/**
 * Discrete derivatives of the plotted daily series.
 * 1st: mean daily change (chord slope).
 * 2nd: constant acceleration of the least-squares quadratic fit (2c in a+bt+ct²).
 */
function computeDerivatives(points) {
  const values = definedValueRun(points);
  if (values.length < 2) {
    return { firstDerivative: null, secondDerivative: null };
  }

  const steps = values.length - 1;
  const firstDerivative = (values[values.length - 1] - values[0]) / steps;
  let secondDerivative = null;
  if (values.length >= 3) {
    const coeffs = quadraticCoefficients(values);
    if (coeffs) secondDerivative = 2 * coeffs[2];
  }

  return {
    firstDerivative: roundDerivative(firstDerivative),
    secondDerivative: roundDerivative(secondDerivative),
  };
}

function collectBoundHintDates(metricId, meta, cache, areaPath) {
  const dates = [];
  if (metricId === "pullRequests") {
    for (const pr of cache.pullRequests || []) dates.push(isoDay(pr.creationDate));
    return dates;
  }
  if (meta.kind === "cumulative") {
    for (const wi of cache.workItems || []) {
      if (!matchesTrendAreaPath(wi, areaPath)) continue;
      dates.push(isoDay(wi.closedDate));
    }
    return dates;
  }
  for (const project of cache.sonar || []) {
    for (const point of project.history || []) dates.push(isoDay(point.date));
  }
  return dates;
}

/**
 * Day-by-day series for the Trend dashboard.
 * Event metrics accumulate within the selected range.
 * LOC and coverage are point-in-time levels from SonarCloud history.
 *
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, metric?: string|null, areaPath?: string|null }} [filters]
 */
export function computeTrend(cache, filters = {}) {
  const metricId = TREND_METRICS[filters.metric] ? filters.metric : "storyPoints";
  const meta = TREND_METRICS[metricId];
  const areaPath = trendMetricUsesAreaPath(metricId) ? filters.areaPath || null : null;

  if (!cache) {
    return emptyTrend(filters, metricId, meta);
  }

  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate ||
    cache.cutDate ||
    earliestDay(collectBoundHintDates(metricId, meta, cache, areaPath)) ||
    endDate;
  const days = enumerateDays(startDate, endDate);
  const points = buildTrendPoints(
    metricId,
    meta,
    cache,
    toBoundDate(startDate, "start"),
    toBoundDate(endDate, "end"),
    days,
    areaPath
  );

  const lastDefined = [...points].reverse().find((point) => point.value !== null);
  const { firstDerivative, secondDerivative } = computeDerivatives(points);
  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate,
    endDate,
    areaPath,
    metric: metricId,
    metricLabel: meta.label,
    kind: meta.kind,
    unit: meta.unit,
    hint: meta.hint,
    points,
    total: lastDefined ? lastDefined.value : null,
    firstDerivative,
    secondDerivative,
  };
}
