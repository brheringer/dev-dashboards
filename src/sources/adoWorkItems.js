import { config } from "../config.js";
import { adoFetch, projectPath } from "./adoClient.js";

const WORK_ITEM_FIELDS = [
  "System.Id",
  "Microsoft.VSTS.Common.ClosedDate",
  "System.Tags",
  "System.AreaPath",
  "System.IterationPath",
  "Microsoft.VSTS.Scheduling.StoryPoints",
  "System.WorkItemType",
];

const BATCH_SIZE = 200;

function escapeWiqlString(value) {
  return String(value).replace(/'/g, "''");
}

/**
 * Load closed work items since cutDate.
 * Returns normalized records for the local cache.
 */
export async function fetchClosedWorkItems() {
  const project = config.azureDevOps.project;
  const cutDate = config.cutDate;

  const wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.TeamProject] = '${escapeWiqlString(project)}'
        AND [Microsoft.VSTS.Common.ClosedDate] >= '${escapeWiqlString(cutDate)}'
        AND [System.WorkItemType] IN ('User Story', 'Bug', 'Task')
      ORDER BY [Microsoft.VSTS.Common.ClosedDate] ASC
    `.trim(),
  };

  const wiqlResult = await adoFetch(`${projectPath()}/_apis/wit/wiql`, {
    method: "POST",
    body: wiql,
    query: { $top: 20000 },
  });

  const ids = (wiqlResult.workItems || []).map((item) => item.id);
  if (ids.length === 0) {
    return [];
  }

  const workItems = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const details = await adoFetch(`${projectPath()}/_apis/wit/workitems`, {
      query: {
        ids: batch.join(","),
        fields: WORK_ITEM_FIELDS.join(","),
      },
    });

    for (const item of details.value || []) {
      const fields = item.fields || {};
      workItems.push({
        id: item.id,
        closedDate: fields["Microsoft.VSTS.Common.ClosedDate"] || null,
        tags: fields["System.Tags"] || "",
        areaPath: fields["System.AreaPath"] || "",
        iterationPath: fields["System.IterationPath"] || "",
        storyPoints: fields["Microsoft.VSTS.Scheduling.StoryPoints"] ?? null,
        workItemType: fields["System.WorkItemType"] || "",
      });
    }
  }

  return workItems;
}
