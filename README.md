# brheringer Dev Dashboards

Small Node.js app that loads delivery metrics from **Azure DevOps** and **SonarCloud**, stores them in a local cache, and renders a simple dashboard. Data is only refreshed when you click **Refresh data**.

## Metrics

| Metric | Source | Rule |
|--------|--------|------|
| User Stories | Azure DevOps | Closed work items of type `User Story` since cut date |
| Story Points | Azure DevOps | Sum of story points on those user stories |
| Sprint Bugs | Azure DevOps | Closed `Bug` items tagged `sprint-bug` since cut date |
| US Bugs | Azure DevOps | Closed `Bug` items without the `sprint-bug` tag since cut date |
| Tech Debts | Azure DevOps | Closed `Task` items tagged `tech-debt` since cut date |
| Pull Requests | Azure DevOps | PRs created since cut date in configured repositories (optionally limited to `authors`) |
| Lines of Code | SonarCloud | Sum of `ncloc` across configured projects |
| Coverage | SonarCloud | `ncloc`-weighted average of `coverage` |

## Prerequisites

- Node.js 18+
- Azure DevOps PAT with at least:
  - **Work Items** → Read
  - **Code** → Read
- SonarCloud user token with access to the configured projects

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill in secrets:

```bash
cp .env.example .env
```

```env
ADO_PAT=your-azure-devops-pat
SONAR_TOKEN=your-sonarcloud-token
```

3. Copy config template and fill in org/project settings:

```bash
cp config.json.example config.json
```

```json
{
  "branding": {
    "author": "brheringer",
    "product": "org"
  },
  "azureDevOps": {
    "organization": "your-org",
    "project": "your-project",
    "repositories": ["repo-a", "repo-b"],
    "areaPathsOfInterest": ["Project\\Team A", "Project\\Team B"],
    "authors": ["Alice Example", "Bob Example"]
  },
  "sonarCloud": {
    "organization": "your-sonar-org",
    "projects": [
      { "key": "org_repo-a", "repository": "repo-a" },
      { "key": "org_repo-b", "repository": "repo-b" }
    ]
  },
  "cutDate": "2024-01-01"
}
```

`branding.author` and `branding.product` are shown in the sidebar and page headers as `author / product`. `cutDate` is global: work items use closed date ≥ cut date; PRs use creation date ≥ cut date.

`azureDevOps.areaPathsOfInterest` limits which work items are loaded and counted. On **Refresh data**, Azure DevOps is queried only for closed items whose `System.AreaPath` equals one of the listed paths (JSON uses `\\` for each backslash in the area path). All dashboards then use that subset. An empty list (or omitting the field) loads every matching work item in the project. The Work Items page dropdown is built from this list; **All area paths** means every configured path, and a specific value further filters the charts. After editing the list, restart the server and click **Refresh data**.

`azureDevOps.authors` limits which pull requests are loaded and counted. On **Refresh data**, only PRs whose creator `displayName` or `uniqueName` matches an entry in the list are kept in the cache. All dashboards that use PR counts then see that subset. An empty list (or omitting the field) loads every PR in the configured repositories since `cutDate`. The Pull Requests page author filter is built from authors present in the cache (after this config filter). After editing the list, restart the server and click **Refresh data**.

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Optional watch mode:

```bash
npm run dev
```

## Workflow

1. First open: dashboard shows “no data” until you click **Refresh data**.
2. Refresh calls Azure DevOps + SonarCloud and writes [`data/cache.json`](data/cache.json).
3. Later opens reuse the cache (no API calls).
4. Click **Refresh data** again whenever you want a new snapshot.

## Date filters

The dashboard recalculates every metric **from local cache** (no remote call):

- Work items → `closedDate` between start and end (inclusive); Work Items dashboard can also filter by a single `areaPathsOfInterest` value
- Pull requests → `creationDate` between start and end (inclusive); already limited to `azureDevOps.authors` if configured; the Pull Requests dashboard can further filter by selected authors
- Lines of code / coverage → last SonarCloud analysis at or before the end date, taken from cached measure history (`api/measures/search_history` since `cutDate`); each card shows the analysis date used
- Lines of code / coverage deltas → change vs the last analysis strictly before the start date (`+12,450 in period`, `+2.3 pp in period`)

Defaults: start = `cutDate` from config/cache, end = today. **Clear dates** removes the range.
