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

1. Pick a scan scope: full instance, custom apps only, one manual app
   (via Target App or the legacy Manual App List), or a single table
   (Manual — Single Table mode).
2. For each app, try reading `sys_db_object`/`sys_dictionary` directly
   (table names, row counts via `GlideAggregate`, fields, references). If
   the running user lacks access, fall back to `sys_metadata` (script
   includes, business rules, ACLs, UI actions, flows) — no table access
   needed for this path.
3. Optionally hand the gathered facts to a single GenAI call for a
   plain-English summary paragraph.
4. Results land in `x_335329_iscan_result` (one row per app) with a related
   list of table profiles in `x_335329_iscan_table`.
5. **Download Report** exports that data as a real PDF (via the platform
   PDF Generation Utilities plugin, `sn_pdfgeneratorutils`), attached as
   a `sys_attachment` on the same record and opened in a new tab —
   modeled on the Now Assist Readiness Evaluation app's "Download Report"
   feature. It's a form button (`x_335329_iscan.scanner` role required),
   so open an existing Run record or one of its Result records first —
   the button won't appear on an unsaved record or for a user without
   that role. Run form: after "Run Scan". Result form: the first button.

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
- `src/fluent/tests/*.now.ts` + `src/server/tests/*.test.js` — the ATF
  regression suite (25 tests) and the long-running full-scan suite; see
  `tests/README.md` for how to run them and what they cover
- `tests/atf_tests.json` — the older hand-written test plan the suite
  implements

See `DEPLOY.md` for the build/install workflow (`npm run build`,
`npm run deploy`) and instance-dependent things to verify before go-live.
