import { adoFetch, projectPath } from "./adoClient.js";

const REVISION_PAGE_SIZE = 200;
const CONCURRENCY = 15;

/**
 * Run async work over items with a fixed concurrency limit.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Extract status-change rows from a work item's revisions.
 * Emits one row whenever System.State changes (including the initial state).
 * @param {number} workItemId
 * @param {object[]} revisions
 */
function statusChangesFromRevisions(workItemId, revisions) {
  const changes = [];
  let previousState = null;

  for (const revision of revisions) {
    const fields = revision.fields || {};
    const status = fields["System.State"];
    if (!status || status === previousState) continue;

    previousState = status;
    changes.push({
      workItemId,
      status,
      changedAt:
        fields["Microsoft.VSTS.Common.StateChangeDate"] ||
        fields["System.ChangedDate"] ||
        null,
    });
  }

  return changes;
}

/**
 * Load all revisions for one work item (paginated).
 * @param {number} workItemId
 */
async function fetchRevisions(workItemId) {
  const revisions = [];
  let skip = 0;

  while (true) {
    const data = await adoFetch(
      `${projectPath()}/_apis/wit/workitems/${workItemId}/revisions`,
      {
        query: {
          $top: REVISION_PAGE_SIZE,
          $skip: skip,
        },
      }
    );

    const page = data.value || [];
    if (page.length === 0) break;

    revisions.push(...page);

    if (page.length < REVISION_PAGE_SIZE) break;
    skip += REVISION_PAGE_SIZE;
  }

  return revisions;
}

/**
 * Load status-change history for the given work item IDs.
 * Returns normalized rows: { workItemId, status, changedAt }.
 * @param {number[]} workItemIds
 */
export async function fetchWorkItemStatusHistory(workItemIds) {
  const ids = Array.isArray(workItemIds) ? workItemIds.filter(Boolean) : [];
  if (ids.length === 0) return [];

  let completed = 0;
  const logEvery = Math.max(100, Math.floor(ids.length / 20));

  const perItem = await mapPool(ids, CONCURRENCY, async (workItemId) => {
    const revisions = await fetchRevisions(workItemId);
    const changes = statusChangesFromRevisions(workItemId, revisions);
    completed += 1;
    if (completed === 1 || completed === ids.length || completed % logEvery === 0) {
      console.log(
        `Work item status history: ${completed}/${ids.length} items`
      );
    }
    return changes;
  });

  return perItem.flat();
}
