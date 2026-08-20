import { config } from "../config.js";
import { adoFetch, projectPath } from "./adoClient.js";

const PAGE_SIZE = 100;

function authorMatchesConfig(createdBy, allowedAuthors) {
  if (!allowedAuthors.length) return true;
  const candidates = [createdBy?.displayName, createdBy?.uniqueName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return candidates.some((name) => allowedAuthors.includes(name));
}

/**
 * @param {string} repositoryName
 * @param {string} cutDate ISO date YYYY-MM-DD
 * @param {string[]} allowedAuthors
 */
async function fetchPullRequestsForRepo(repositoryName, cutDate, allowedAuthors) {
  const cut = new Date(`${cutDate}T00:00:00.000Z`);
  const results = [];
  let skip = 0;

  // ADO list PRs does not support minTime; page newest-first and stop past cutDate.
  while (true) {
    const data = await adoFetch(
      `${projectPath()}/_apis/git/repositories/${encodeURIComponent(repositoryName)}/pullrequests`,
      {
        query: {
          "searchCriteria.status": "all",
          "$top": PAGE_SIZE,
          "$skip": skip,
        },
      }
    );

    const page = data.value || [];
    if (page.length === 0) {
      break;
    }

    let reachedOlderThanCut = false;

    for (const pr of page) {
      const creationDate = pr.creationDate || null;
      if (!creationDate) continue;

      if (new Date(creationDate) < cut) {
        reachedOlderThanCut = true;
        continue;
      }

      if (!authorMatchesConfig(pr.createdBy, allowedAuthors)) continue;

      results.push({
        id: pr.pullRequestId,
        creationDate,
        repository: repositoryName,
        author: pr.createdBy?.displayName || pr.createdBy?.uniqueName || null,
      });
    }

    // Results are typically newest-first; once a full page is older than cut, stop.
    if (reachedOlderThanCut || page.length < PAGE_SIZE) {
      const allOlder = page.every((pr) => {
        if (!pr.creationDate) return true;
        return new Date(pr.creationDate) < cut;
      });
      if (allOlder || page.length < PAGE_SIZE) {
        break;
      }
    }

    skip += PAGE_SIZE;
  }

  return results;
}

/**
 * Load pull requests created on/after cutDate for configured repositories.
 * When azureDevOps.authors is non-empty, only those authors are kept.
 */
export async function fetchPullRequests() {
  const cutDate = config.cutDate;
  const repositories = config.azureDevOps.repositories || [];
  const allowedAuthors = config.azureDevOps.authors || [];
  const all = [];

  for (const repository of repositories) {
    const prs = await fetchPullRequestsForRepo(repository, cutDate, allowedAuthors);
    all.push(...prs);
  }

  return all;
}
