import { toBoundDate, isWithinRange } from "./details.js";
import { hasSprintBugTag, hasTechDebtTag } from "./metrics.js";
import { isAreaPathOfInterest } from "./config.js";

export const CHART_METRICS = {
  storyPoints: { label: "Story Points", unit: "points" },
  userStories: { label: "User Stories", unit: "count" },
  techDebts: { label: "Tech Debts", unit: "count" },
  sprintBugs: { label: "Sprint Bugs", unit: "count" },
  usBugs: { label: "US Bugs", unit: "count" },
  pullRequests: { label: "Pull Requests", unit: "count" },
};

export const CHART_GRAINS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

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

function addMonths(yearMonth, amount) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function weekStart(isoDayValue) {
  const date = new Date(`${isoDayValue}T00:00:00.000Z`);
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function quarterKey(isoDayValue) {
  const year = isoDayValue.slice(0, 4);
  const month = Number(isoDayValue.slice(5, 7));
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}

function quarterStart(key) {
  const [year, quarterPart] = key.split("-Q");
  const quarter = Number(quarterPart);
  const month = (quarter - 1) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function addQuarters(key, amount) {
  const [yearPart, quarterPart] = key.split("-Q");
  let year = Number(yearPart);
  let quarter = Number(quarterPart) + amount;
  while (quarter > 4) {
    quarter -= 4;
    year += 1;
  }
  while (quarter < 1) {
    quarter += 4;
    year -= 1;
  }
  return `${year}-Q${quarter}`;
}

function bucketKey(isoDate, grain) {
  const day = isoDay(isoDate);
  if (!day) return null;
  if (grain === "daily") return day;
  if (grain === "weekly") return weekStart(day);
  if (grain === "monthly") return day.slice(0, 7);
  if (grain === "quarterly") return quarterKey(day);
  if (grain === "yearly") return day.slice(0, 4);
  return day;
}

function bucketToChartDate(key, grain) {
  if (grain === "daily" || grain === "weekly") return key;
  if (grain === "monthly") return `${key}-01`;
  if (grain === "quarterly") return quarterStart(key);
  if (grain === "yearly") return `${key}-01-01`;
  return key;
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

function enumerateWeeks(start, end) {
  if (!start || !end || start > end) return [];
  const weeks = [];
  let week = weekStart(start);
  const endWeek = weekStart(end);
  let guard = 0;
  while (week <= endWeek && guard < 600) {
    weeks.push(week);
    week = addDays(week, 7);
    guard += 1;
  }
  return weeks;
}

function enumerateMonths(start, end) {
  if (!start || !end || start > end) return [];
  const months = [];
  let month = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  let guard = 0;
  while (month <= endMonth && guard < 240) {
    months.push(month);
    month = addMonths(month, 1);
    guard += 1;
  }
  return months;
}

function enumerateQuarters(start, end) {
  if (!start || !end || start > end) return [];
  const quarters = [];
  let quarter = quarterKey(start);
  const endQuarter = quarterKey(end);
  let guard = 0;
  while (quarter <= endQuarter && guard < 80) {
    quarters.push(quarter);
    quarter = addQuarters(quarter, 1);
    guard += 1;
  }
  return quarters;
}

function enumerateYears(start, end) {
  if (!start || !end || start > end) return [];
  const years = [];
  let year = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  while (year <= endYear) {
    years.push(String(year));
    year += 1;
  }
  return years;
}

function enumerateBuckets(start, end, grain) {
  if (grain === "weekly") return enumerateWeeks(start, end);
  if (grain === "monthly") return enumerateMonths(start, end);
  if (grain === "quarterly") return enumerateQuarters(start, end);
  if (grain === "yearly") return enumerateYears(start, end);
  return enumerateDays(start, end);
}

function roundValue(value, unit) {
  if (!Number.isFinite(value)) return 0;
  if (unit === "points") return Math.round(value * 100) / 100;
  return value;
}

function chartMetricUsesAreaPath(metricId) {
  return metricId !== "pullRequests";
}

function matchesAreaPath(item, areaPath) {
  if (!isAreaPathOfInterest(item.areaPath)) return false;
  if (!areaPath) return true;
  return (item.areaPath || "") === areaPath;
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

function bucketSeries(items, dateField, incrementFor, keys, grain, unit) {
  const byBucket = new Map();
  for (const item of items) {
    const key = bucketKey(item[dateField], grain);
    if (!key) continue;
    byBucket.set(key, (byBucket.get(key) || 0) + incrementFor(item));
  }

  return keys.map((key) => ({
    date: bucketToChartDate(key, grain),
    value: roundValue(byBucket.get(key) || 0, unit),
  }));
}

function earliestHintDate(metricId, cache, areaPath) {
  const dates = [];
  if (metricId === "pullRequests") {
    for (const pr of cache.pullRequests || []) dates.push(isoDay(pr.creationDate));
    return dates.filter(Boolean).sort()[0] || null;
  }
  for (const wi of cache.workItems || []) {
    if (!matchesAreaPath(wi, areaPath)) continue;
    dates.push(isoDay(wi.closedDate));
  }
  return dates.filter(Boolean).sort()[0] || null;
}

function emptyChart(filters, metricId, meta, grain) {
  return {
    hasData: false,
    fetchedAt: null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    areaPath: chartMetricUsesAreaPath(metricId) ? filters.areaPath || null : null,
    metric: metricId,
    metricLabel: meta.label,
    grain,
    unit: meta.unit,
    points: [],
    total: 0,
  };
}

/**
 * Bucketed counts for the Dev Metrics column chart.
 * Work items use closed date; pull requests use creation date.
 *
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, areaPath?: string|null, metric?: string|null, grain?: string|null }} [filters]
 */
export function computeDevMetricsChart(cache, filters = {}) {
  const metricId = CHART_METRICS[filters.metric] ? filters.metric : "storyPoints";
  const meta = CHART_METRICS[metricId];
  const grain = CHART_GRAINS.includes(filters.grain) ? filters.grain : "daily";
  const areaPath = chartMetricUsesAreaPath(metricId) ? filters.areaPath || null : null;

  if (!cache) {
    return emptyChart(filters, metricId, meta, grain);
  }

  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate ||
    cache.cutDate ||
    earliestHintDate(metricId, cache, areaPath) ||
    endDate;
  const start = toBoundDate(startDate, "start");
  const end = toBoundDate(endDate, "end");
  const keys = enumerateBuckets(startDate, endDate, grain);

  let points;
  if (metricId === "pullRequests") {
    const items = (cache.pullRequests || []).filter((pr) =>
      isWithinRange(pr.creationDate, start, end)
    );
    points = bucketSeries(items, "creationDate", () => 1, keys, grain, meta.unit);
  } else {
    const items = (cache.workItems || []).filter(
      (wi) => matchesAreaPath(wi, areaPath) && isWithinRange(wi.closedDate, start, end)
    );
    points = bucketSeries(
      items,
      "closedDate",
      (item) => eventIncrement(metricId, item),
      keys,
      grain,
      meta.unit
    );
  }

  const total = roundValue(
    points.reduce((sum, point) => sum + (Number(point.value) || 0), 0),
    meta.unit
  );

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate,
    endDate,
    areaPath,
    metric: metricId,
    metricLabel: meta.label,
    grain,
    unit: meta.unit,
    points,
    total,
  };
}
