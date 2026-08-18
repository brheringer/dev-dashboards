/**
 * Shared date helpers and paginated detail queries from the local cache.
 */

import { isAreaPathOfInterest } from "./config.js";

/**
 * @param {string|null|undefined} value YYYY-MM-DD
 * @param {"start"|"end"} bound
 */
export function toBoundDate(value, bound) {
  if (!value) return null;
  const suffix = bound === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isWithinRange(isoDate, start, end) {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

const ALLOWED_PAGE_SIZES = new Set([10, 25, 50, 100, 500]);

export function parsePagination(query) {
  const pageRaw = Number(query.page);
  const pageSizeRaw = Number(query.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize = ALLOWED_PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : 10;
  return { page, pageSize };
}

function dateValue(isoDate) {
  const time = new Date(isoDate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compareByDateAsc(a, b, field) {
  const diff = dateValue(a[field]) - dateValue(b[field]);
  if (diff !== 0) return diff;
  return Number(a.id) - Number(b.id);
}

function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

/**
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, areaPath?: string|null, page?: number, pageSize?: number }} options
 */
export function getWorkItemsPage(cache, options = {}) {
  const start = toBoundDate(options.startDate, "start");
  const end = toBoundDate(options.endDate, "end");
  const areaPath = options.areaPath || null;
  const { page, pageSize } = parsePagination(options);

  const items = ((cache && cache.workItems) || [])
    .filter(
      (wi) =>
        isAreaPathOfInterest(wi.areaPath) &&
        (!areaPath || (wi.areaPath || "") === areaPath) &&
        isWithinRange(wi.closedDate, start, end)
    )
    .slice()
    .sort((a, b) => compareByDateAsc(a, b, "closedDate"));

  return paginate(items, page, pageSize);
}

/**
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, page?: number, pageSize?: number }} options
 */
export function getPullRequestsPage(cache, options = {}) {
  const start = toBoundDate(options.startDate, "start");
  const end = toBoundDate(options.endDate, "end");
  const { page, pageSize } = parsePagination(options);

  const items = ((cache && cache.pullRequests) || [])
    .filter((pr) => isWithinRange(pr.creationDate, start, end))
    .slice()
    .sort((a, b) => compareByDateAsc(a, b, "creationDate"));

  return paginate(items, page, pageSize);
}
