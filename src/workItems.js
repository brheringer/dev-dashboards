import { toBoundDate, isWithinRange } from "./details.js";
import { hasSprintBugTag, hasTechDebtTag } from "./metrics.js";

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
    cutDate: null,
    totals: emptyTotals(),
    points: [],
  };
}

/**
 * Totals and accumulated daily counts for the Work Items dashboard.
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null }} [filters]
 */
export function computeWorkItems(cache, filters = {}) {
  if (!cache) {
    return emptyPayload(filters);
  }

  const workItems = cache.workItems || [];
  const endDate = filters.endDate || todayIsoDate();
  const startDate =
    filters.startDate || cache.cutDate || earliestClosedDay(workItems) || endDate;
  const start = toBoundDate(startDate, "start");
  const end = toBoundDate(endDate, "end");
  const days = enumerateDays(startDate, endDate);

  const byDay = new Map();
  const totals = emptyTotals();

  for (const item of workItems) {
    if (!isWithinRange(item.closedDate, start, end)) continue;
    const series = classifyWorkItem(item);
    if (!series) continue;

    totals[series] += 1;
    const day = isoDay(item.closedDate);
    if (!day) continue;
    const bucket = byDay.get(day) || emptyTotals();
    bucket[series] += 1;
    byDay.set(day, bucket);
  }

  const running = emptyTotals();
  const points = days.map((date) => {
    const delta = byDay.get(date);
    if (delta) {
      running.userStories += delta.userStories;
      running.techDebts += delta.techDebts;
      running.usBugs += delta.usBugs;
      running.sprintBugs += delta.sprintBugs;
    }
    return {
      date,
      userStories: running.userStories,
      techDebts: running.techDebts,
      usBugs: running.usBugs,
      sprintBugs: running.sprintBugs,
    };
  });

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate,
    endDate,
    cutDate: cache.cutDate || null,
    totals,
    points,
  };
}
