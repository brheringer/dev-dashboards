import { toBoundDate, isWithinRange } from "./details.js";
import { hasSprintBugTag, hasTechDebtTag } from "./metrics.js";
import { isAreaPathOfInterest } from "./config.js";

export const WORK_ITEM_SERIES = [
  { key: "userStories", label: "User Stories" },
  { key: "techDebts", label: "Tech Debts" },
  { key: "usBugs", label: "US Bugs" },
  { key: "sprintBugs", label: "Sprint Bugs" },
];

function emptyTotals() {
  return {
    userStories: 0,
    techDebts: 0,
    usBugs: 0,
    sprintBugs: 0,
  };
}

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

function addMonths(yearMonth, amount) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

function countPoints(keys, buckets) {
  return keys.map((key) => {
    const delta = buckets.get(key) || emptyTotals();
    return {
      date: key.length === 7 ? `${key}-01` : key,
      userStories: delta.userStories,
      techDebts: delta.techDebts,
      usBugs: delta.usBugs,
      sprintBugs: delta.sprintBugs,
    };
  });
}

function accumulatePoints(keys, buckets) {
  const running = emptyTotals();
  return keys.map((key) => {
    const delta = buckets.get(key);
    if (delta) {
      running.userStories += delta.userStories;
      running.techDebts += delta.techDebts;
      running.usBugs += delta.usBugs;
      running.sprintBugs += delta.sprintBugs;
    }
    return {
      date: key.length === 7 ? `${key}-01` : key,
      userStories: running.userStories,
      techDebts: running.techDebts,
      usBugs: running.usBugs,
      sprintBugs: running.sprintBugs,
    };
  });
}

function earliestClosedDay(workItems) {
  const dates = workItems.map((item) => isoDay(item.closedDate)).filter(Boolean).sort();
  return dates[0] || null;
}

export function classifyWorkItem(workItem) {
  if (workItem.workItemType === "User Story") return "userStories";
  if (workItem.workItemType === "Bug" && hasSprintBugTag(workItem.tags)) return "sprintBugs";
  if (workItem.workItemType === "Bug") return "usBugs";
  if (workItem.workItemType === "Task" && hasTechDebtTag(workItem.tags)) return "techDebts";
  return null;
}

function emptyPayload(filters) {
  return {
    hasData: false,
    fetchedAt: null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    areaPath: filters.areaPath || null,
    cutDate: null,
    totals: emptyTotals(),
    points: [],
    monthPoints: [],
    monthCounts: [],
  };
}

function matchesAreaPath(item, areaPath) {
  if (!isAreaPathOfInterest(item.areaPath)) return false;
  if (!areaPath) return true;
  return (item.areaPath || "") === areaPath;
}

/**
 * Totals and accumulated daily counts for the Work Items dashboard.
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, areaPath?: string|null }} [filters]
 */
export function computeWorkItems(cache, filters = {}) {
  if (!cache) {
    return emptyPayload(filters);
  }

  const workItems = cache.workItems || [];
  const areaPath = filters.areaPath || null;
  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate || cache.cutDate || earliestClosedDay(workItems) || endDate;
  const start = toBoundDate(startDate, "start");
  const end = toBoundDate(endDate, "end");
  const days = enumerateDays(startDate, endDate);
  const months = enumerateMonths(startDate, endDate);

  const byDay = new Map();
  const byMonth = new Map();
  const totals = emptyTotals();

  for (const item of workItems) {
    if (!isWithinRange(item.closedDate, start, end)) continue;
    if (!matchesAreaPath(item, areaPath)) continue;
    const series = classifyWorkItem(item);
    if (!series) continue;

    totals[series] += 1;
    const day = isoDay(item.closedDate);
    if (!day) continue;
    const dayBucket = byDay.get(day) || emptyTotals();
    dayBucket[series] += 1;
    byDay.set(day, dayBucket);

    const month = day.slice(0, 7);
    const monthBucket = byMonth.get(month) || emptyTotals();
    monthBucket[series] += 1;
    byMonth.set(month, monthBucket);
  }

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate,
    endDate,
    areaPath,
    cutDate: cache.cutDate || null,
    totals,
    points: accumulatePoints(days, byDay),
    monthPoints: accumulatePoints(months, byMonth),
    monthCounts: countPoints(months, byMonth),
  };
}
