import { toBoundDate, isWithinRange } from "./details.js";
import { isAreaPathOfInterest } from "./config.js";
import {
  CHART_GRAINS,
  enumerateBuckets,
  bucketKey,
  bucketToChartDate,
  todayIsoDate,
} from "./devMetricsChart.js";

const ACTIVE_STATUS = "Active";
const RESOLVED_STATUS = "Resolved";
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function roundDays(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function earliestStatusDate(rows, status) {
  let earliest = null;
  for (const row of rows) {
    if (row.status !== status || !row.changedAt) continue;
    const time = new Date(row.changedAt).getTime();
    if (Number.isNaN(time)) continue;
    if (earliest === null || time < earliest) {
      earliest = time;
    }
  }
  return earliest;
}

function buildResolvingTimeRecords(cache, areaPath) {
  const workItemsById = new Map();
  for (const workItem of cache.workItems || []) {
    if (!isAreaPathOfInterest(workItem.areaPath)) continue;
    if (areaPath && (workItem.areaPath || "") !== areaPath) continue;
    workItemsById.set(workItem.id, workItem);
  }

  const historyByItem = new Map();
  for (const row of cache.workItemStatusHistory || []) {
    if (!workItemsById.has(row.workItemId)) continue;
    if (!historyByItem.has(row.workItemId)) {
      historyByItem.set(row.workItemId, []);
    }
    historyByItem.get(row.workItemId).push(row);
  }

  const records = [];
  for (const [workItemId, rows] of historyByItem) {
    const firstActiveMs = earliestStatusDate(rows, ACTIVE_STATUS);
    const firstResolvedMs = earliestStatusDate(rows, RESOLVED_STATUS);
    if (firstActiveMs === null || firstResolvedMs === null || firstResolvedMs < firstActiveMs) {
      continue;
    }

    records.push({
      workItemId,
      resolvedDate: new Date(firstResolvedMs).toISOString(),
      resolvingTimeDays: (firstResolvedMs - firstActiveMs) / MS_PER_DAY,
      areaPath: workItemsById.get(workItemId).areaPath || "",
    });
  }

  return records;
}

export function summarizeResolvingTimeRecords(records) {
  const values = records.map((record) => record.resolvingTimeDays).filter(Number.isFinite);
  if (!values.length) {
    return {
      workItemCount: 0,
      averageDays: null,
      medianDays: null,
      minDays: null,
      maxDays: null,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    workItemCount: values.length,
    averageDays: roundDays(total / values.length),
    medianDays: roundDays(median(values)),
    minDays: roundDays(Math.min(...values)),
    maxDays: roundDays(Math.max(...values)),
  };
}

function bucketAverageSeries(records, keys, grain) {
  const byBucket = new Map();
  for (const record of records) {
    const key = bucketKey(record.resolvedDate, grain);
    if (!key) continue;
    if (!byBucket.has(key)) {
      byBucket.set(key, []);
    }
    byBucket.get(key).push(record.resolvingTimeDays);
  }

  return keys.map((key) => {
    const values = byBucket.get(key) || [];
    if (!values.length) {
      return { date: bucketToChartDate(key, grain), value: null };
    }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { date: bucketToChartDate(key, grain), value: roundDays(average) };
  });
}

function earliestResolvedDate(records) {
  const dates = records
    .map((record) => record.resolvedDate?.slice(0, 10))
    .filter(Boolean)
    .sort();
  return dates[0] || null;
}

function scatterSeries(records) {
  return records
    .map((record) => ({
      date: record.resolvedDate?.slice(0, 10) || null,
      value: roundDays(record.resolvingTimeDays),
      workItemId: record.workItemId,
    }))
    .filter((point) => point.date && Number.isFinite(point.value))
    .sort((a, b) => {
      if (a.date === b.date) return Number(a.workItemId) - Number(b.workItemId);
      return a.date < b.date ? -1 : 1;
    });
}

function emptyResult(filters, grain) {
  return {
    hasData: false,
    fetchedAt: null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    areaPath: filters.areaPath || null,
    grain,
    summary: summarizeResolvingTimeRecords([]),
    points: [],
    scatterPoints: [],
    unit: "days",
  };
}

/**
 * Average time from earliest Active to earliest Resolved, bucketed by resolved date.
 *
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, areaPath?: string|null, grain?: string|null }} [filters]
 */
export function computeResolvingTime(cache, filters = {}) {
  const grain = CHART_GRAINS.includes(filters.grain) ? filters.grain : "daily";
  const areaPath = filters.areaPath || null;

  if (!cache?.workItemStatusHistory?.length) {
    return emptyResult(filters, grain);
  }

  const allRecords = buildResolvingTimeRecords(cache, areaPath);
  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate || cache.cutDate || earliestResolvedDate(allRecords) || endDate;
  const start = toBoundDate(startDate, "start");
  const end = toBoundDate(endDate, "end");

  const records = allRecords.filter((record) =>
    isWithinRange(record.resolvedDate, start, end)
  );
  const keys = enumerateBuckets(startDate, endDate, grain);

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate,
    endDate,
    areaPath,
    grain,
    summary: summarizeResolvingTimeRecords(records),
    points: bucketAverageSeries(records, keys, grain),
    scatterPoints: scatterSeries(records),
    unit: "days",
  };
}

/**
 * Average Active → Resolved time for work items resolved in the date range.
 *
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, areaPath?: string|null }} [filters]
 * @returns {number|null}
 */
export function computeResolvingTimeAverage(cache, filters = {}) {
  const areaPath = filters.areaPath || null;
  if (!cache?.workItemStatusHistory?.length) return null;

  const allRecords = buildResolvingTimeRecords(cache, areaPath);
  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate || cache.cutDate || earliestResolvedDate(allRecords) || endDate;
  const start = toBoundDate(startDate, "start");
  const end = toBoundDate(endDate, "end");

  const records = allRecords.filter((record) =>
    isWithinRange(record.resolvedDate, start, end)
  );
  return summarizeResolvingTimeRecords(records).averageDays;
}
