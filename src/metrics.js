import { isAreaPathOfInterest } from "./config.js";

const TECH_DEBT_TAG = "tech-debt";
const SPRINT_BUG_TAG = "sprint-bug";

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags)
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

function hasTag(tags, expected) {
  return parseTags(tags).some((tag) => tag.toLowerCase() === expected);
}

export function hasTechDebtTag(tags) {
  return hasTag(tags, TECH_DEBT_TAG);
}

export function hasSprintBugTag(tags) {
  return hasTag(tags, SPRINT_BUG_TAG);
}

/**
 * @param {string|null|undefined} value YYYY-MM-DD
 * @param {"start"|"end"} bound
 */
function toBoundDate(value, bound) {
  if (!value) return null;
  const suffix = bound === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinRange(isoDate, start, end) {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function emptyCodeTotals() {
  return { ncloc: 0, coverage: null, asOf: null, hasCoverage: false };
}

/**
 * Latest ncloc/coverage a project had at or before `bound` (Date), using cached history.
 * Falls back to the current snapshot when history is unavailable and bound is null.
 */
function measuresAsOf(project, bound, { allowSnapshotFallback = true } = {}) {
  const history = Array.isArray(project.history) ? project.history : [];

  if (history.length === 0) {
    if (!allowSnapshotFallback || bound) {
      return { ncloc: null, coverage: null, asOf: null };
    }
    return {
      ncloc: Number(project.ncloc) || 0,
      coverage: Number.isFinite(Number(project.coverage)) ? Number(project.coverage) : null,
      asOf: null,
    };
  }

  let ncloc = null;
  let coverage = null;
  let asOf = null;

  for (const point of history) {
    const pointDate = new Date(point.date);
    if (Number.isNaN(pointDate.getTime())) continue;
    if (bound && pointDate > bound) continue;

    if (Number.isFinite(Number(point.ncloc))) ncloc = Number(point.ncloc);
    if (Number.isFinite(Number(point.coverage))) coverage = Number(point.coverage);
    asOf = point.date;
  }

  return { ncloc, coverage, asOf };
}

export function aggregateCode(projects, bound, options) {
  let totalNcloc = 0;
  let weightedCoverage = 0;
  let coveredNcloc = 0;
  let codeAsOf = null;
  let anyNcloc = false;

  for (const project of projects) {
    const { ncloc, coverage, asOf } = measuresAsOf(project, bound, options);
    if (ncloc === null) continue;

    anyNcloc = true;
    totalNcloc += ncloc;
    if (coverage !== null && ncloc > 0) {
      weightedCoverage += coverage * ncloc;
      coveredNcloc += ncloc;
    }
    if (asOf && (!codeAsOf || new Date(asOf) > new Date(codeAsOf))) {
      codeAsOf = asOf;
    }
  }

  if (!anyNcloc) {
    return emptyCodeTotals();
  }

  return {
    ncloc: totalNcloc,
    coverage:
      coveredNcloc > 0 ? Math.round((weightedCoverage / coveredNcloc) * 10) / 10 : null,
    asOf: codeAsOf,
    hasCoverage: coveredNcloc > 0,
  };
}

function matchesSelectedAreaPath(item, areaPath) {
  if (!isAreaPathOfInterest(item.areaPath)) return false;
  if (!areaPath) return true;
  return (item.areaPath || "") === areaPath;
}

/**
 * Aggregate dashboard metrics from a local cache payload.
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null, areaPath?: string|null }} [filters]
 */
export function computeMetrics(cache, filters = {}) {
  const areaPath = filters.areaPath || null;
  if (!cache) {
    return {
      hasData: false,
      fetchedAt: null,
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      areaPath,
      cutDate: null,
      userStories: 0,
      storyPoints: 0,
      sprintBugs: 0,
      usBugs: 0,
      techDebts: 0,
      pullRequests: 0,
      linesOfCode: 0,
      linesOfCodeDelta: null,
      coverage: null,
      coverageDelta: null,
      codeAsOf: null,
      codeBaselineAsOf: null,
    };
  }

  const start = toBoundDate(filters.startDate, "start");
  const end = toBoundDate(filters.endDate, "end");

  const workItems = (cache.workItems || []).filter(
    (wi) => matchesSelectedAreaPath(wi, areaPath) && isWithinRange(wi.closedDate, start, end)
  );
  const pullRequests = (cache.pullRequests || []).filter((pr) =>
    isWithinRange(pr.creationDate, start, end)
  );
  const sonar = cache.sonar || [];

  const userStories = workItems.filter((wi) => wi.workItemType === "User Story");
  const sprintBugs = workItems.filter(
    (wi) => wi.workItemType === "Bug" && hasSprintBugTag(wi.tags)
  );
  const usBugs = workItems.filter(
    (wi) => wi.workItemType === "Bug" && !hasSprintBugTag(wi.tags)
  );
  const techDebts = workItems.filter(
    (wi) => wi.workItemType === "Task" && hasTechDebtTag(wi.tags)
  );

  const storyPoints = userStories.reduce((sum, wi) => {
    const points = Number(wi.storyPoints);
    return sum + (Number.isFinite(points) ? points : 0);
  }, 0);

  // End-of-period absolute values.
  const atEnd = aggregateCode(sonar, end, { allowSnapshotFallback: true });

  // Baseline = last analysis strictly before the start date (period delta).
  // Without a start date there is no meaningful period increment.
  const baselineBound = start
    ? new Date(start.getTime() - 1)
    : null;
  const atStart = baselineBound
    ? aggregateCode(sonar, baselineBound, { allowSnapshotFallback: false })
    : emptyCodeTotals();

  let linesOfCodeDelta = null;
  let coverageDelta = null;

  if (filters.startDate && atStart.ncloc > 0) {
    linesOfCodeDelta = atEnd.ncloc - atStart.ncloc;
  }

  if (
    filters.startDate &&
    atStart.coverage !== null &&
    atEnd.coverage !== null
  ) {
    coverageDelta = Math.round((atEnd.coverage - atStart.coverage) * 10) / 10;
  }

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    areaPath,
    cutDate: cache.cutDate || null,
    userStories: userStories.length,
    storyPoints: Math.round(storyPoints * 100) / 100,
    sprintBugs: sprintBugs.length,
    usBugs: usBugs.length,
    techDebts: techDebts.length,
    pullRequests: pullRequests.length,
    linesOfCode: atEnd.ncloc,
    linesOfCodeDelta,
    coverage: atEnd.coverage,
    coverageDelta,
    codeAsOf: atEnd.asOf,
    codeBaselineAsOf: atStart.asOf,
  };
}
