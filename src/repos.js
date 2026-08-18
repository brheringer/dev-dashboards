import { config } from "./config.js";
import { toBoundDate, isWithinRange } from "./details.js";
import { aggregateCode } from "./metrics.js";

function collectRepoNames(cache) {
  const names = new Set(config.azureDevOps.repositories || []);
  for (const pr of cache.pullRequests || []) {
    if (pr.repository) names.add(pr.repository);
  }
  for (const project of cache.sonar || []) {
    if (project.repository) names.add(project.repository);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Per-repository PR counts and Sonar ncloc/coverage as of the end date.
 *
 * @param {object|null} cache
 * @param {{ startDate?: string|null, endDate?: string|null }} [filters]
 */
export function computeRepoSummaries(cache, filters = {}) {
  if (!cache) {
    return {
      hasData: false,
      fetchedAt: null,
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      repos: [],
    };
  }

  const start = toBoundDate(filters.startDate, "start");
  const end = toBoundDate(filters.endDate, "end");
  const pullRequests = cache.pullRequests || [];
  const sonar = cache.sonar || [];

  const prCounts = new Map();
  for (const pr of pullRequests) {
    if (!isWithinRange(pr.creationDate, start, end)) continue;
    const repo = pr.repository || "Unknown";
    prCounts.set(repo, (prCounts.get(repo) || 0) + 1);
  }

  const sonarByRepo = new Map();
  for (const project of sonar) {
    const repo = project.repository || project.projectKey;
    if (!repo) continue;
    const list = sonarByRepo.get(repo) || [];
    list.push(project);
    sonarByRepo.set(repo, list);
  }

  const repos = collectRepoNames(cache).map((name) => {
    const projects = sonarByRepo.get(name) || [];
    const code = projects.length
      ? aggregateCode(projects, end, { allowSnapshotFallback: true })
      : { ncloc: null, coverage: null, asOf: null };

    return {
      repository: name,
      pullRequests: prCounts.get(name) || 0,
      linesOfCode: projects.length ? code.ncloc : null,
      coverage: code.coverage,
      codeAsOf: code.asOf || null,
    };
  });

  return {
    hasData: true,
    fetchedAt: cache.fetchedAt || null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    repos,
  };
}
