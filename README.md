# sn-instance-scan

ServiceNow custom scoped application (scope `x_nold_iscan`) that
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
4. Results land in `x_nold_iscan_result` (one row per app) with a related
   list of table profiles in `x_nold_iscan_table`.
5. **Download Report** exports that data as a real PDF (via the platform
   PDF Generation Utilities plugin, `sn_pdfgeneratorutils`), attached as
   a `sys_attachment` on the same record and opened in a new tab —
   modeled on the Now Assist Readiness Evaluation app's "Download Report"
   feature. It's a form button (`x_nold_iscan.scanner` role required),
   so open an existing Run record or one of its Result records first —
   the button won't appear on an unsaved record or for a user without
   that role. Run form: after "Run Scan". Result form: the first button.

## Scan modes

| Mode | Scope | Runs | Who can launch |
|---|---|---|---|
| Full | every app, plus table-only scopes | background worker | admin |
| Custom Only | customer-built apps (store apps excluded) | in the request | scanner role |
| Manual — App | the apps you pick | in the request | scanner role |
| Manual — Single Table | one table (its owning app if it has one) | in the request | scanner role |
| Installed Modules | `sys_plugins`, instance-wide | in the request | scanner role |
| AI Agent Discovery | AI agents, LLM integrations and credentials, instance-wide | in the request | scanner role |
| CMDB & CSDM Health | 49 Get Well Playbook checks against the CMDB, scored against CSDM 5 | background worker | admin |

**Background modes.** Full and CMDB & CSDM Health can run for many minutes —
far longer than a request survives — so they are queued to a worker
(`x_nold_iscan.scan.execute` event + Script Action). The run's status moves
Pending → Running → Complete or Error, and the console's detail view refreshes
itself while it's live. A Full scan can also run the CMDB checks when
`x_nold_iscan.include_cmdb_health_on_full_scan` is on (off by default).

**CMDB & CSDM Health** is a port of the noviq-cmdb-health skill: the read-only
collector, the 49-check catalog and the scorer. Each run writes one row per
check (`x_nold_iscan_cmdb_check`) and a scored summary
(`x_nold_iscan_cmdb_summary`); **Download Report** includes the full scored
section, and **Copy CMDB Health LLM Context** on the summary copies the findings
plus the assessment rules so an LLM can write the narrative and roadmap.
`npm run test:cmdb-parity` proves the scorer matches the upstream Python scorer
on its fixtures.

## Access model

Read-only app: nothing here ever writes to a scanned table, only to its
own `x_nold_iscan_*` tables.

The synchronous modes run every query under the calling user's own access
(no elevated privilege, no `security_admin` assumption). The two background
modes are the deliberate exception: the platform runs Script Actions as
System, not as the user who queued them, so those modes are **admin-only to
launch** — the worker's reads never exceed what the requester could already
see.

Custom scope (`x_nold_iscan`), platform-namespaced — table/role/
property names carry the `x_nold_iscan` prefix to match what the
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
