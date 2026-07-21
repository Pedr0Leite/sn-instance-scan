# sn-instance-scan

ServiceNow custom scoped application (scope `x_335329_iscan`) that
scans an instance application-by-application and produces a
per-application architecture summary: tables owned, key relationships,
business rules/script includes/flows present, and a plain-English
description of what the application does — plus a downloadable PDF
report per run or per app.

Built with the **ServiceNow SDK** and **ServiceNow Fluent** (`.now.ts`
metadata + plain JS script bodies) — see `DEPLOY.md` for build/install.

Full spec (build prompt, architecture, test plan) lives in a separate
docs vault: `obsidian-servicenow-docs/Applications/sn-instance-scan/`.
See `CLAUDE.md` for how the two repos relate.

## How it works

1. Pick a scan scope: full instance, custom apps only, one manual app, or
   (planned) a single table.
2. For each app, try reading `sys_db_object`/`sys_dictionary` directly
   (table names, row counts via `GlideAggregate`, fields, references). If
   the running user lacks access, fall back to `sys_metadata` (script
   includes, business rules, ACLs, UI actions, flows) — no table access
   needed for this path.
3. Optionally hand the gathered facts to a single GenAI call for a
   plain-English summary paragraph.
4. Results land in `x_335329_iscan_result` (one row per app) with a related
   list of table profiles in `x_335329_iscan_table`.
5. **Download Report** on the run or on any individual result exports
   that data as a PDF, with hyperlinks back to the underlying records —
   modeled on the Now Assist Readiness Evaluation app's "Download Report"
   feature.

Read-only app: nothing here ever writes to a scanned table, only to its
own `x_335329_iscan_*` tables, and every query runs under the calling
user's own access (no elevated privilege, no `security_admin` assumption).

Custom scope (`x_335329_iscan`), platform-namespaced — table/role/
property names carry the `x_335329_iscan` prefix to match what the
platform generates — see `DEPLOY.md`.

## Layout

- `now.config.json`, `package.json` — now-sdk app config
- `src/fluent/*.now.ts` — Fluent metadata: tables, roles, properties,
  script includes, ACLs, UI actions
- `src/server/*.server.js` — script include logic: app selection,
  table/field scanning, metadata fallback, GenAI summary, scan
  orchestration, and PDF report generation
- `src/client-scripts/*.client.js` — "Download Report" and "Copy LLM
  Context" button scripts ("Run Scan" is a server-side UI Action, see
  `src/server/RunScanUiAction.server.js`)
- `tests/atf_tests.json` — the 11 ATF-style tests this app must satisfy

See `DEPLOY.md` for the build/install workflow (`npm run build`,
`npm run deploy`) and instance-dependent things to verify before go-live.
