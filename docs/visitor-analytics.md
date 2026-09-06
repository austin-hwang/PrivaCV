# Browser-profile visitor analytics

A random UUID is stored in `privacv-visitor-v2` in localStorage. It is stable across days, tabs, reloads, and browser sessions on the same origin/profile. It is not a hardware/device ID: another browser/profile/device gets a different token, and clearing data or browser eviction resets it. The old daily token is not reused.

The same ID is attached to every new resume-export and manually created application event. The resume and application workspace pages also report visits separately. Public information pages do not report visits. No individual resume/application record IDs or content are transmitted. GPC/DNT, blocked local storage, and desktop builds suppress these identified metrics. Local-AI metrics remain identifier-free.

## Analytics Engine row layout

| Dataset                    | blob1                     | blob2         | blob3                          | blob4      | index1                       |
| -------------------------- | ------------------------- | ------------- | ------------------------------ | ---------- | ---------------------------- |
| `privacv_exports`          | `resume_export`           | export format | visitor ID                     | —          | visitor ID                   |
| `privacv_job_applications` | `job_application_created` | visitor ID    | —                              | —          | visitor ID                   |
| `privacv_visitors`         | `workspace_visitor`       | UTC day       | `resume` or `job_applications` | visitor ID | workspace + `:` + visitor ID |

Every row has `double1 = 1`. Workspace activity is reported once per visible page per UTC day, plus reloads/remounts. The reporting day changes at midnight; the ID does not. Repeated events are expected: count distinct IDs to get unique browsers, and use `SUM(_sample_interval)` for event totals.

## Reporting queries

Unique browsers that exported resumes in the last 30 days:

```sql
SELECT COUNT(DISTINCT index1) AS unique_exporters,
       SUM(_sample_interval) AS exports
FROM privacv_exports
WHERE blob1 = 'resume_export' AND blob3 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY;
```

Unique browsers that created job applications:

```sql
SELECT COUNT(DISTINCT index1) AS unique_application_creators,
       SUM(_sample_interval) AS applications_created
FROM privacv_job_applications
WHERE blob1 = 'job_application_created' AND blob2 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY;
```

Unique visitors per workspace over the same period:

```sql
SELECT blob3 AS workspace, COUNT(DISTINCT index1) AS unique_browsers
FROM privacv_visitors
WHERE blob1 = 'workspace_visitor'
  AND blob3 IN ('resume', 'job_applications')
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY blob3;
```

To chart daily visitors, also select and group by `blob2` (UTC day). Do not sum daily or workspace unique counts as period/site-wide unique users; the same browser can occur in multiple groups. Filters exclude legacy rows that lack persistent IDs. Historical events cannot be assigned IDs retroactively. Unfiltered existing total-event queries continue to include older aggregate-only clients.

## Deployment and access

`wrangler.jsonc` declares all three Analytics Engine bindings. Deploy through the normal Cloudflare workflow to enable collection; local Next.js endpoints are no-ops. No new write secret is required.

Read queries through Cloudflare's account-level Analytics Engine SQL API using an API token with **Account → Account Analytics → Read** permission. Keep it on your computer/server, never in browser code or `NEXT_PUBLIC_*` variables. Submit a query as the POST body to `https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/analytics_engine/sql` with an `Authorization: Bearer API_TOKEN` header.

Counts estimate browser profiles, not authenticated people. Shared browsers, multiple devices, privacy controls, blocked requests, bots, storage resets, and sampling affect accuracy. Clearing local data does not remove already collected Cloudflare records. The persistent token is pseudonymous, not an assertion of complete anonymity. Do not multiply distinct counts by `_sample_interval`.

References: [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/), [distinct counts](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/aggregate-functions/), [sampling/index selection](https://developers.cloudflare.com/analytics/analytics-engine/sampling/).
