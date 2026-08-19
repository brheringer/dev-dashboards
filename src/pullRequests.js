import { toBoundDate, isWithinRange } from "./details.js";
import {
  CHART_GRAINS,
  bucketKey,
  bucketToChartDate,
  enumerateBuckets,
  isoDay,
  todayIsoDate,
} from "./devMetricsChart.js";

const AUTHOR_COLORS = [
  "#3dba7a",
  "#e0b25a",
  "#5aa8e0",
  "#e07a5a",
  "#9b7adb",
  "#d45a9b",
  "#5ad4c4",
  "#c45a5a",
  "#8bc34a",
  "#ff9800",
  "#607d8b",
  "#795548",
  "#673ab7",
  "#009688",
  "#f44336",
  "#2196f3",
];

function normalizeAuthor(author) {
  const name = typeof author === "string" ? author.trim() : "";
  return name || "Unknown";
}

function authorKey(name, usedKeys) {
  let base =
    normalizeAuthor(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "unknown";
  let key = base;
  let suffix = 1;
  while (usedKeys.has(key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

function emptyPayload(filters) {
  return {
    hasData: false,
    fetchedAt: null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    grain: filters.grain || "daily",
    authors: filters.authors || null,
    series: [],
    totals: {},
    points: [],
    total: 0,
    availableAuthors: [],
  };
}

function earliestCreationDay(pullRequests) {
  const dates = pullRequests.map((pr) => isoDay(pr.creationDate)).filter(Boolean).sort();
  return dates[0] || null;
}

function listAvailableAuthors(pullRequests, start, end) {
  const authors = new Set();
  for (const pr of pullRequests) {
    if (!isWithinRange(pr.creationDate, start, end)) continue;
    authors.add(normalizeAuthor(pr.author));
  }
  return [...authors].sort((a, b) => a.localeCompare(b));
}

/**
 * Pull request counts bucketed by creation date and author.
 *
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, authors?: string[]|null, grain?: string|null }} [filters]
 */
export function computePullRequests(cache, filters = {}) {
  if (!cache) {
    return emptyPayload(filters);
  }

  const grain = CHART_GRAINS.includes(filters.grain) ? filters.grain : "daily";
  const selectedAuthors = filters.authors?.length
    ? new Set(filters.authors.map(normalizeAuthor))
    : null;
  const pullRequests = cache.pullRequests || [];
  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate || cache.cutDate || earliestCreationDay(pullRequests) || endDate;
  const start = toBoundDate(startDate, "start");
  const end = toBoundDate(endDate, "end");
  const availableAuthors = listAvailableAuthors(pullRequests, start, end);

  const filtered = pullRequests.filter((pr) => {
    if (!isWithinRange(pr.creationDate, start, end)) return false;
    const author = normalizeAuthor(pr.author);
    if (selectedAuthors && !selectedAuthors.has(author)) return false;
    return true;
  });

  const authorTotals = new Map();
  for (const pr of filtered) {
    const author = normalizeAuthor(pr.author);
    authorTotals.set(author, (authorTotals.get(author) || 0) + 1);
  }

  const sortedAuthors = [...authorTotals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const usedKeys = new Set();
  const series = sortedAuthors.map((label, index) => ({
    key: authorKey(label, usedKeys),
    label,
    color: AUTHOR_COLORS[index % AUTHOR_COLORS.length],
  }));
  const labelToKey = new Map(series.map((item) => [item.label, item.key]));
  const totals = Object.fromEntries(series.map((item) => [item.key, authorTotals.get(item.label) || 0]));

  const keys = enumerateBuckets(startDate, endDate, grain);
  const byBucket = new Map();

  for (const pr of filtered) {
    const bucket = bucketKey(pr.creationDate, grain);
    if (!bucket) continue;
    const seriesKey = labelToKey.get(normalizeAuthor(pr.author));
    if (!seriesKey) continue;
    const row = byBucket.get(bucket) || {};
    row[seriesKey] = (row[seriesKey] || 0) + 1;
    byBucket.set(bucket, row);
  }

  const points = keys.map((key) => {
    const row = byBucket.get(key) || {};
    const point = { date: bucketToChartDate(key, grain) };
    for (const item of series) {
      point[item.key] = row[item.key] || 0;
    }
    return point;
  });

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate,
    endDate,
    grain,
    authors: selectedAuthors ? [...selectedAuthors] : null,
    series,
    totals,
    points,
    total: filtered.length,
    availableAuthors,
  };
}
