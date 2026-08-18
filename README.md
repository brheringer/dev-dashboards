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
| Pull Requests | Azure DevOps | PRs created since cut date in configured repositories |
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
    "repositories": ["repo-a", "repo-b"]
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

- Work items → `closedDate` between start and end (inclusive)
- Pull requests → `creationDate` between start and end (inclusive)
- Lines of code / coverage → last SonarCloud analysis at or before the end date, taken from cached measure history (`api/measures/search_history` since `cutDate`); each card shows the analysis date used
- Lines of code / coverage deltas → change vs the last analysis strictly before the start date (`+12,450 in period`, `+2.3 pp in period`)

Defaults: start = `cutDate` from config/cache, end = today. **Clear dates** removes the range.

## API

- `GET /api/config` — cut date and last refresh timestamp
- `GET /api/metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — aggregated metrics from local cache
- `GET /api/details/work-items?startDate=&endDate=&page=&pageSize=` — paginated work items (10/25/50/100/500)
- `GET /api/details/pull-requests?startDate=&endDate=&page=&pageSize=` — paginated pull requests
- `GET /api/repos?startDate=&endDate=` — pull requests, lines of code, and coverage per repository
- `GET /api/work-items?startDate=&endDate=` — work-item totals and accumulated daily counts by type
- `POST /api/refresh?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — fetch remote data, overwrite cache, return metrics
