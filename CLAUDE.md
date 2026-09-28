# sn-instance-scan

## Communication style (caveman mode)
Short sentences. 3-6 words. No filler. Tools run, results shown, stop.

## Session handoff (PREV_SESSION.md)

This project has automated cross-session handoff, wired via hooks in
`.claude/settings.json` (not memory/CLAUDE.md text, since this needs to
fire on an EVENT):
- **PreCompact hook** (both `auto` and `manual` matchers, `agent` type):
  fires right before this session gets compacted (auto-compact near the
  context limit, or manual `/compact`). Overwrites `PREV_SESSION.md` at
  the repo root with a fresh handoff — clears old content first, doesn't
  append — covering what was done, what's outstanding, what's
  built-but-undeployed/uncommitted, and concrete next steps.
- **SessionStart hook** (`command` type): on every session start —
  including `claude --resume <session-id>` — reads `PREV_SESSION.md` if
  it exists and injects its content as additional context before the
  conversation proceeds. No file means no-op (first session, or nothing
  to hand off yet).

`PREV_SESSION.md` is scratch/transient by design (unlike
`docs/OUTSTANDING_WORK.md`, which is a deliberate, human-curated snapshot) —
it gets overwritten every compaction, so don't treat it as a durable
record; if something in it matters long-term, promote it into
`docs/OUTSTANDING_WORK.md` or this file instead.

ServiceNow **custom scoped** application (scope `x_nold_iscan`,
app name `SN Instance Scan`) that scans an instance
application-by-application and produces a per-app architecture summary,
optionally with a GenAI-written paragraph and a downloadable PDF report.

Built with the **ServiceNow SDK** (`@servicenow/sdk`) and **ServiceNow
Fluent** — metadata is defined as TypeScript (`.now.ts`) under
`src/fluent/`, script bodies are plain JS under `src/server/` and
`src/client-scripts/`, referenced via `Now.include(...)`. `now-sdk init` already
scaffolded `now.config.json` and `package.json`; nothing here has been
pushed to an instance yet. Follow `DEPLOY.md` to build and install.

## Custom scope — namespace prefix is platform-enforced

`now.config.json` has `"scope": "x_nold_iscan"`. This is a **scoped**
app, not global — the platform automatically namespaces every table,
role, and property this scope creates, so there's no collision risk with
other apps the way there would be in global scope. This repo still names
everything with the `x_nold_iscan` prefix explicitly (tables:
`x_nold_iscan_run`, `x_nold_iscan_result`, `x_nold_iscan_table`;
role: `x_nold_iscan.scanner`; properties: `x_nold_iscan.*`) to match
what the platform will actually generate — keep doing this for
consistency if you add a new table/role/property. Script include class
names (`IscanAppSelector`, etc.) don't carry the prefix, but their
`apiName` is always `x_nold_iscan.<ClassName>`.

**"Run Scan" is a server-side UI Action, NOT GlideAjax.** It was
originally built as a GlideAjax call into `IscanScanOrchestrator`, but
that pattern produced an unfixable-looking bug: any of {wrong apiName,
execute-ACL mismatch, `accessibleFrom` misconfiguration} yields an
*identical* symptom — `getXMLAnswer` gets an empty answer, with zero
server-side log output, not even the first line of the target method.
That's indistinguishable from "the request never left the browser" and
is expensive to debug blind. The fix was architectural, not a config
tweak: `runScanUiAction` (`ui-actions.now.ts`) now has `client.isClient:
false` and its script (`RunScanUiAction.server.js`) calls
`IscanScanOrchestrator.runScanForRecord()` directly on `current`, in the
same request as the form submit — no GlideAjax, no execute ACL, no
`clientCallable` flag to get wrong. `IscanScanOrchestrator` is therefore
`clientCallable: false` and does **not** extend `AbstractAjaxProcessor`
at all. Because the platform's own post-script save would otherwise
clobber the run record with pre-scan field values (the orchestrator
persists its own updates via a separate `GlideRecord` query, not by
mutating `current`), the UI Action script calls
`current.setAbortAction(true)` before `action.setRedirectURL(current)`.
Do not revert this to a GlideAjax pattern without a strong reason — if
you do, redo the whole three-point checklist below and expect the same
class of silent-failure bug.

**"Download Report" on the Result table still uses GlideAjax into
`IscanReportGenerator`** (the Run-table version was converted to a
server-side UI Action, same as Run Scan — see below) — that path is
unaffected and still needs all three of the following to line up, or the
client gets an empty answer with no error anywhere:

1. Client calls `new GlideAjax('x_nold_iscan.IscanReportGenerator')`
   — the scope-qualified `apiName`, NOT the bare class name.
2. The SI is `clientCallable: true`, left at the default
   `accessibleFrom: 'package_private'`. Do **not** set `accessibleFrom:
   'public'` — that was tried and reverted. The "Download Report" UI
   Actions, their forms, and this SI are all in `x_nold_iscan`, so
   `package_private` ("callable from the application scope it's within")
   is correct and sufficient. `public` instead makes the platform run a
   `GlidePluginManager.isActive()` check against the caller's scope to
   admit cross-app callers, which fails with `Could not find sys_plugins
   record for x_nold_iscan: no thrown error` for a custom
   in-development app never registered as a store plugin — and GlideAjax
   silently returns nothing. Only reach for `public` if a script include
   genuinely needs to be called from a *different* app's scope.
3. The execute ACL's `name` is also the scope-qualified apiName
   (`x_nold_iscan.IscanReportGenerator`), matching what the platform
   checks for a scoped SI.

Copy this pattern for any *new* GlideAjax entry point — but prefer a
server-side UI Action (like Run Scan) over GlideAjax whenever the caller
is this app's own form and the round trip doesn't need to be
asynchronous; it sidesteps this whole failure class.

**"Download Report" — where the button is, and what it actually produces
(2026-07-22 investigation, confirmed by code trace):** the button is a
plain form action button (`form: { showButton: true }`), not a related
link or list-view action — `showInsert: false, showUpdate: true` on both
UI Actions, so it only renders on an *existing* record, never on an
unsaved one. On `x_nold_iscan_run` it's `order: 200` (after Run Scan
at `order: 100`); on `x_nold_iscan_result` it's `order: 100` (before
Copy LLM Context at `order: 200`) — both require the
`x_nold_iscan.scanner` role, so it won't render at all without it.
`IscanReportGenerator._convertToPdf()` calls the real platform **PDF
Generation Utilities** plugin (`sn_pdfgeneratorutils.PDFGenerationAPI
().convertToPDFWithHeaderFooter(...)`), NOT a Jelly print view — this
produces an actual `sys_attachment` on the same Run/Result record the
button was clicked from, and the client script opens it via
`sys_attachment.do?sys_id=...`, which streams a real binary PDF. Whether
`com.snc.apppdfgenerator` is actually active is the one thing that still
needs confirming against the live instance (see DEPLOY.md's flagged
dependency) — the code path itself has no gap: a missing/inactive plugin
throws inside `_convertToPdf`'s try/catch, which surfaces as "Report
generation failed" client-side plus a `gs.error` line server-side, not a
silent no-op. To restructure the report's sections/ordering: edit the
`parts.push(...)` sequence in `_buildRunReportHtml`/
`_buildResultReportHtml`; to change page size/footer: edit the
`headerFooterInfo` object in `_convertToPdf`. No separate template file
exists — it's hand-built HTML string concatenation.

**Table overflow fix (2026-07-29):** every `<table>` in the report used
browser-default auto column sizing with no wrap, so a long unbreakable
cell value (e.g. a dotted plugin ID like
`com.glide.delete_recovery.partial_undelete` in the Installed Modules
table) pushed total table width past the printable page area and got cut
off at the edge. Fixed once at the CSS level, not per table:
`_reportStyles()` (a `<style>` block prepended once at the top of both
`_buildRunReportHtml()`/`_buildResultReportHtml()`'s output) sets
`table-layout:fixed` + `word-break:break-word` on every table/cell, and
each of the 6 tables in the report now opens with an explicit
`_colgroup([...])` call (percentages summing to 100, sized per table to
its own column count/content shape — e.g. Installed Modules gives Plugin
ID the widest column since that's the long-string one) instead of
leaving column widths to auto-sizing. Cells wrap, they are never
truncated/ellipsized — full plugin IDs and table/field names stay
readable. Page orientation was deliberately left at `PORTRAIT` (not
switched to landscape) — the wrap-based fix resolves the overflow without
needing a wider page; revisit only if a real render still looks
cramped. **Verify at build time** (append to the existing
`sys_app.source`/GenAI API/PDF plugin name list): whether
`sn_pdfgeneratorutils`'s `convertToPDFWithHeaderFooter()` actually
respects `table-layout:fixed`/`<colgroup>` — most HTML-to-PDF renderers
do, but this hasn't been confirmed against a live instance render.

**`global.` qualifier**: `AbstractAjaxProcessor` lives in global scope,
not this app's scope, so any client-callable script include
(`IscanReportGenerator` is the only one now) must extend
`global.AbstractAjaxProcessor`, not bare `AbstractAjaxProcessor` — the
runtime throws `AbstractAjaxProcessor undefined, maybe missing global
qualifier` otherwise (that's ServiceNow's standard cross-scope security
check, see KB0635929). now-sdk 4.8.1's `no-unsupported-node-builtins`
build lint doesn't know about this convention and misflags any bare
`global` identifier as a Node.js global reference, so `IscanReportGenerator.server.js`
carries a `// eslint-disable-next-line no-unsupported-node-builtins`
comment directly above the `global.AbstractAjaxProcessor` line — keep
that comment if you touch that line, and add it again if you introduce
another global-scope class reference anywhere in `src/server/`.
`GlideRecord`/`GlideAggregate`/etc. don't need it — those are native
platform APIs available unprefixed in every scope.

## Spec source of truth

The full spec (build prompt, architecture, test plan) lives in a
separate vault, not in this repo:

`/home/pedro/Documents/Programacao/Github/obsidian-servicenow-docs/Applications/sn-instance-scan/`
- `prompt.md` — the original build prompt / requirements
- `architecture.md` — story-by-story component design, table schema, ACLs, build order
- `test-plan.md` — the ATF-style tests this app must satisfy

That vault predates the switch to now-sdk and uses a different scope
name (`x_snis_iscan`) than this repo actually builds with. Both are
scoped apps — treat the vault as authoritative for *why* something is
built a certain way, but this repo's `x_nold_iscan_*` naming is the
current source of truth for *what things are actually called* — don't
reintroduce the `x_snis_iscan` prefix based on the vault without
checking with the user first.

That vault also contains ~46k ServiceNow official docs and curated notes
(`ServiceNowOfficialDocs/`, `Notion/ServiceNow/`) and a wiki index
(`wiki/index.md`) synthesizing concepts across sources. When building a
new feature for this app that resembles an existing ServiceNow
capability, or when you need exact Fluent API syntax (Table/Column/
ScriptInclude/Acl/Role/Property/UiAction objects), search that vault
first rather than guessing — e.g. `IscanReportGenerator` exists because
the vault's Now Assist Readiness Evaluation docs describe exactly this
"Download Report" pattern, and this repo's entire Fluent structure was
derived from `ServiceNowOfficialDocs/application-development/servicenow-sdk/*.md`.

### Using /obsidian:obsidian-cli against that vault

Use the `obsidian:obsidian-cli` skill when you need to search or read
that vault interactively (it requires Obsidian to be open with that
vault focused):

```bash
obsidian vault="obsidian-servicenow-docs" search query="now assist readiness evaluation"
obsidian read file="now-assist-readiness-evaluation-reference"
```

For one-off lookups where Obsidian isn't open, it's faster to just
`grep -rli "<term>" /home/pedro/Documents/Programacao/Github/obsidian-servicenow-docs --include="*.md"`
directly — the vault is a plain git repo of markdown files, no need to
go through the CLI unless the user is actively working in Obsidian or
wants a note created/appended there.

## Repo layout

- `now.config.json`, `package.json` — now-sdk app config (do not hand-edit
  scope/scopeId without the user's say-so — that's an instance-level identity)
- `src/fluent/tables.now.ts` — `x_nold_iscan_run`, `x_nold_iscan_result`, `x_nold_iscan_table`
- `src/fluent/roles.now.ts`, `properties.now.ts` — the scanner role, the 3 system properties
- `src/fluent/script-includes.now.ts` — registers the 6 script includes, each `Now.include`-ing its body from `src/server/`
- `src/fluent/acls.now.ts` — record ACLs on the 3 tables + the execute ACL for the 1 client-callable script include (`IscanReportGenerator`)
- `src/fluent/ui-actions.now.ts` — "Run Scan" and Run-table "Download
  Report" (both server-side, `Now.include`-ing their scripts from
  `src/server/`) plus Result-table "Download Report" + "Copy LLM Context"
  (client-side, `Now.include`-ing their scripts from `src/client-scripts/`)
- `src/server/*.server.js` — script include bodies: `IscanAppSelector`,
  `IscanTableScanner`, `IscanAppFilesScanner`, `IscanModuleScanner`,
  `IscanSummaryGenerator`,
  `IscanScanOrchestrator` (called directly, server-side, by
  `RunScanUiAction`), `IscanReportGenerator` (GlideAjax entry point for
  the Result-table PDF report; its Run-table report methods are also
  called directly, server-side, by `DownloadRunReportUiAction`), and the
  two server-side UI Action scripts `RunScanUiAction`/
  `DownloadRunReportUiAction`
- `src/client-scripts/*.client.js` — the remaining client-side UI Action
  scripts (Result-table report download, and `CopyLlmContext`) — "Run
  Scan" and Run-table "Download Report" have no client script, see above
- `tests/atf_tests.json` — ATF test definitions (mirrors test-plan.md)
- `DEPLOY.md` — `now-sdk` build/install workflow

## Conventions to preserve when editing this code

- **Read-only app.** No script here may write to a scanned table — only
  to `x_nold_iscan_*` tables. This is a hard constraint from the spec,
  not a style preference.
- **No elevated privilege.** Every query in `IscanTableScanner` runs
  under the caller's own access. `canAccessMetadata()` is a deterministic
  `canRead()` gate checked *before* querying — never convert this to a
  try/catch fallback. `GlideAggregate` for row counts, never
  `GlideRecord.getRowCount()`. **One sanctioned exception (2026-09-26):** the
  two background modes (`full`, `cmdb_health`) run in a Script Action, which
  the platform executes as System — so they are **admin-only to launch**
  (`IscanScanOrchestrator.canLaunch()`), which keeps the worker's reads within
  what the requester could already see. Do not open either mode to the scanner
  role, and do not add a new async mode without the same gate. See "Later
  addition #7".
- **GenAI summary is single-shot**, not an AI Agent/ReAct loop — see
  `IscanSummaryGenerator`. Don't add multi-step reasoning here without
  the user explicitly asking for it.
- **`llm_context` vs `summary_text`** (v2) — `buildPrompt()` produces a
  full 5-section architecture briefing persisted to
  `x_nold_iscan_result.llm_context` on *every* scan; `summary_text` is
  the optional GenAI paragraph. Only `summary_text` depends on the GenAI
  Controller being available — never make `llm_context` conditional on
  it. `generate()` truncates its own input via
  `x_nold_iscan.genai_max_input_chars`; the persisted `llm_context`
  always stays full-length. On the fallback path the data-model section
  is *omitted with an explanation*, never zero-filled — a reader seeing
  "0 tables" would wrongly conclude the app has none.
- **`scan_findings` and `comments` are both written** by
  `_appendScanFinding()`, deliberately. `scan_findings` (String — renamed
  from `activities` 2026-07-22; that name read as the native Activity
  stream, which it is NOT) is the queryable log; `comments` (Journal, via
  `GenericColumn` with `columnType: 'journal_input'`) feeds the native
  Activity formatter, which only renders Journal fields. Use `setValue()`
  — `setJournalEntry()` exists only in the *global* GlideElement API, not
  the scoped one. **The `run` GlideRecord is reused across every
  `_appendScanFinding()` call in one scan** (once per app plus start/end
  markers) — fine for `scan_findings` (plain field, each `update()` just
  overwrites it with the latest full log string) but NOT reliable for the
  `comments` Journal field: repeated set+update on the same long-lived
  instance can silently fail to register new journal entries past the
  first call. `_appendScanFinding()` re-fetches a fresh `GlideRecord` by
  sys_id specifically for the journal write — don't "simplify" that back
  to a single shared `update()` without re-verifying multi-entry journal
  appends against a real instance. Both fields are visible on the run
  form (`comments` + the native Activity formatter, `scan_findings` as a
  plain textarea) — don't remove one thinking the other makes it redundant.
- **Custom-scope filtering must also check source/vendor** — store-installed
  apps get customer-looking scopes too. See `IscanAppSelector.getCustomApps()`.
- **Client-callable script includes need a matching execute ACL** — see
  `acls.now.ts`. If you add another GlideAjax-callable script include,
  add its `client_callable_script_include` ACL too (named with the
  scope-qualified apiName), leave `accessibleFrom` at the default
  `package_private` (NOT `'public'` — see the GlideAjax checklist in the
  "Custom scope" section above for why), and call it by apiName from the
  client. But prefer a server-side UI Action over GlideAjax when the
  caller is this app's own form — see the "Run Scan" note above.
- **Scripts write as the calling user** — the scanner role needs write
  on `x_nold_iscan_run` and create on result/table-profile tables
  (see `acls.now.ts`). The orchestrator throws a descriptive error when
  `update()`/`insert()` come back null (ACL denial) instead of scanning
  silently into nothing; keep that pattern for new writes.
- Instance-version-dependent bits (`sys_app.source` field behavior, the
  exact Generative AI Controller API, the PDF Generation Utilities
  plugin name) are flagged inline in code comments and in `DEPLOY.md` —
  verify against the real target instance before go-live, don't assume.

## Instance-assessment extension (in progress)

Being brainstormed as of 2026-07-21, sequenced as 4 sub-specs: **Modes →
Counting → Cross-refs → Report**. Roads-not-taken and schema
alternatives for each sub-spec are logged in `docs/future-schema-ideas.md`
as they're decided — check there before re-proposing an option that was
already considered and rejected.

**Modes (sub-spec 1 — IMPLEMENTED):**
- `x_nold_iscan_run.scan_mode` gains a 4th value: `single_table`
  (label "Manual — Single Table"), alongside `full`, `custom_only`, and
  `manual` (relabeled "Manual — App").
- New `target_app` (`ReferenceColumn` to `sys_app`, no qualifier) becomes
  the primary picker for Manual mode. The existing `manual_app_list`
  string field is KEPT, not replaced — it's still how the programmatic/
  ATF API (`runScan('manual', [id1, id2])`) does multi-app scans.
  `target_app`, when set, takes precedence over `manual_app_list`.
- New `target_table` (`ReferenceColumn` to `sys_db_object`, no qualifier)
  is the picker for the new `single_table` mode.
- `single_table` mode resolves the picked table's owning scope
  (`sys_db_object.sys_scope`) and, IF that scope has a corresponding
  `sys_app` record, runs the full existing per-app tally against it
  (same pipeline as Manual mode) — the picked table is guaranteed to
  appear in that app's table profile since it's owned by that scope. IF
  the scope has no `sys_app` record (true for `global` and many OOB
  scopes — e.g. picking `incident` or `sys_user`), there's nothing to
  tally against `x_nold_iscan_result.app` (mandatory reference to
  `sys_app`), so it falls back to profiling just that one table.
- `IscanTableScanner.profileTable()`'s field capture is being changed to
  drop its `sys_scope` filter — it will return the table's COMPLETE field
  list (not just fields added by the owning app), which changes
  `field_count`/`reference_field_list` values for ALL 4 modes, not just
  `single_table`. This was a deliberate choice (see
  `docs/future-schema-ideas.md`), not an oversight — it also removes the
  need for a second unscoped field-listing method later, when the
  Cross-refs sub-spec needs the same complete field list instance-wide.
  The `appScopeSysId` parameter is dropped entirely (not kept-but-unused)
  from both `profileTable()` and `_getAppAddedFields()` — the only caller,
  `IscanScanOrchestrator._profileOwnedTables()`, drops the arg from its
  `profileTable()` call but keeps its own `appScopeSysId` param (still
  needed for `getOwnedTables()`).

**Modes (sub-spec 1 — implementation notes):**
- `IscanAppSelector` is untouched by the `target_app`/`manual_app_list`
  precedence logic — that precedence check (target_app wins when set)
  lives entirely in `RunScanUiAction.server.js`, which resolves to a
  plain sys_app-id array before calling the orchestrator exactly like
  today. `runScan()` (the programmatic/ATF path, no form record) is
  unaffected — `target_app` is UI-only.
- `runScanForRecord`/`runScan`/`_resolveAppList` gain a 4th positional
  parameter, `targetTableSysId` (undefined/unused for the other 3
  modes) — chosen over a bigger options-object refactor to keep this
  sub-spec's diff small; revisit if sub-spec 3 (Cross-refs) needs a
  different shape.
- New `IscanScanOrchestrator._resolveSingleTableApp(targetTableSysId)`:
  looks up `sys_db_object.sys_scope` for the picked table, then
  `sys_app.get(scopeSysId)` — if that succeeds, returns `[scopeSysId]`
  and the existing per-app pipeline runs unchanged (the picked table is
  guaranteed to appear in `getOwnedTables()` since it's owned by that
  scope). If there's no `sys_app` record for that scope (true for
  `global` and most OOB scopes), falls back to a new `_scanOneTable(run,
  tableName)` path: profiles just that one table
  (`profileTable(tableName)`, no `_findIntegrations`, no `sys_app`
  lookup at all) and, since `x_nold_iscan_result.app` stays mandatory
  and isn't being relaxed, writes NO `x_nold_iscan_result`/
  `x_nold_iscan_table` row for this case — the profile data (fields,
  row count, references) is written into `run.scan_findings`/`comments`
  only, visible on the run form but not queryable via the result
  tables.
- New UI Policy (this app's first) on `x_nold_iscan_run`: symmetric
  visibility toggling — `target_app` shown only for `manual` mode,
  `target_table` shown only for `single_table` mode, both hidden for
  `full`/`custom_only`. This is cosmetic/UX only; it does NOT replace
  the server-side mandatory-field checks in `RunScanUiAction.server.js`
  (a documented UI Policy limitation: conditions aren't re-evaluated on
  UI-Action-driven or programmatic changes — exactly the paths this app
  relies on for the actual button click and ATF tests).
- Flagged risk (not a blocker, verify against target instance): if the
  target instance has row-level ACL conditions on `sys_dictionary`
  (uncommon, but possible on hardened instances), the now-unscoped
  `profileTable()` could silently under-report fields on tables outside
  the caller's own scope even though `canAccessMetadata()`'s table-level
  `canRead()` gate passes — add to the same "verify before go-live" list
  as `sys_app.source`, the GenAI Controller API, and the PDF plugin name.

**Counting (sub-spec 2 — IMPLEMENTED):** full
design at `docs/superpowers/specs/2026-07-21-counting-design.md`. Adds
22 new `IntegerColumn`s to `x_nold_iscan_result` (15 "Group A" types
folded into `IscanAppFilesScanner`'s existing single `sys_metadata`
query via new `CLASS_BUCKETS` entries — free perf-wise; 7 "Group B"
types needing their own dedicated per-app queries — real perf cost,
gated off by default for `full` mode via a new
`x_nold_iscan.include_extended_counts_on_full_scan` property), plus 2
new columns on `x_nold_iscan_table` for a new "dictionary override"
capability on `IscanTableScanner` (a field whose `sys_scope` differs
from its table's owning scope — i.e. another app extended a table it
doesn't own). Roles/groups/system properties are explicitly excluded —
not per-app components. Several table/field names in the design (flow
`type` values, `sysevent_in_email_action`, PA table scope fields,
`sys_hub_action_type_definition`, `item_option_new`'s variable-set join)
are flagged low-confidence and need verification against the real
target instance before/while implementing.

**Cross-refs (sub-spec 3 — IMPLEMENTED):** `IscanTableScanner` gained
`findInboundReferences(tableName)` — a whole-instance `sys_dictionary`
search (`addQuery('reference', tableName)`) for any field, on any table,
that points back at a table this app owns. Unlike Counting's Group B, this
runs unconditionally in every scan mode including `full` — one indexed
query per table, not per app, judged cheap enough to skip a property gate.
Each distinct referencing table's owning app is resolved via the same
`sys_db_object.sys_scope` → `sys_app.get()` two-step Modes already uses for
Single Table mode's OOB case; blank `referencing_app` means the referencing
table has no owning `sys_app` record (`global`/OOB), same "0 isn't a bug"
precedent as Counting. Same-app references (a table referencing another
table owned by the same app) are included, not filtered — the Report
sub-spec can slice inter-app vs. intra-app later without re-scanning.
Persisted as `inbound_reference_count`/`inbound_reference_list` summary
columns on `x_nold_iscan_table` (same shape as `dictionary_override_*`),
plus a new child table `x_nold_iscan_crossref` (one row per referencing
field, including the resolved `referencing_app`) for the Report sub-spec to
query/group/filter. No rows are written to `x_nold_iscan_crossref` from
Single Table mode's no-owning-app fallback path (`_scanOneTable`) — that
path only logs the inbound reference count to `run.scan_findings`, consistent
with how it already handles dictionary overrides.

**Report (sub-spec 4 — IMPLEMENTED):** `IscanReportGenerator`'s existing
Run/Result report HTML builders gained 3 presence/absence status flags —
no numeric thresholds, since there's no real basis for picking a count
cutoff. Warnings: `scan_mode_used === 'app_files_fallback'` (incomplete
data), and summed `dictionary_override_count > 0` across the app's
`x_nold_iscan_table` rows (a real governance signal — another app
modified a table it doesn't own, or this app did). Informational (not a
warning): count of distinct apps with `x_nold_iscan_crossref` rows
pointing at this app's tables (excluding this app itself) — having
dependents isn't inherently bad. The Run report's per-app table gained a
condensed icon-only Status column; the Result report gained a full Status
line, an "Extended counts" section (Counting's ~22 non-Group-A/B-overlap
counts, zero values skipped), 2 new Tables columns (Dictionary Overrides,
Inbound References — both already stored, just not previously rendered),
and a "Cross-references" section (one row per `x_nold_iscan_crossref`
record tied to the app's tables, omitted entirely when there are none). No
new script include, table, property, or UI Action — `_convertToPdf` and
the GlideAjax entry points are unchanged.

**Later addition (2026-07-22):** the Result report's old flat "Automation
surface" + "Extended counts" sections were replaced with a fully itemized
"Artifact inventory" (count line + name/description bullets per artifact,
built via a LIVE `IscanAppFilesScanner.scanApp()` re-query at report time
— no new storage for item lists) covering every artifact type including 4
new ones (Scripted REST resources, SLA definitions, UI pages, Service
Portal pages). Both reports also gained a "Customizations on base-system
tables" section reading the new `x_nold_iscan_global_customization`
table — populated for EVERY scan mode via two write paths: per-app
(`IscanTableScanner.findAppCustomizationsOnGlobalTables`, called for
every app scanned in every mode) and per-table (`findGlobalCustomizations`,
the table-only fallback path only). See
`docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`'s 2026-07-22 entry for an
important clarification: the run's `scan_findings`/`comments` log is a
terse per-app PROGRESS log by design, not the report — the full
assessment lives on the result/table/crossref/global_customization
records and is exported on demand via "Download Report", not printed
inline. Don't mistake a terse log for a wiring bug without checking those
records first.

**Later addition #2 (2026-07-22):** closed the remaining v3 backlog items.
The Run report gained a "Scan Findings Log" section (`run.scan_findings`,
`<pre>`-formatted) — previously the only report content for
`single_table`/Full-fallback scans (no result record exists) was the PDF
attachment itself with no findings text inside it. The Result report
gained a "Recommendations" section (`_computeRecommendations()`/
`_renderRecommendations()`) rendered right after Status, before the
artifact inventory — deterministic presence/absence checks only (no ACLs
on an app with tables, dictionary overrides present, zero-row tables,
base-system customizations present, app-files-fallback scan), no invented
numeric thresholds, same philosophy as `_computeStatusFlags`. Two more
artifact types added throughout the counting/itemization pipeline:
Events (`sysevent_register`) and Import Sets (`sys_import_set_source`) —
both newly added and lowest-confidence of all the flagged table names,
verify first. Also added an explicit related list
(`src/fluent/related-lists.now.ts`): `x_nold_iscan_result` (via `run`)
on the Run form — related lists for a reference field normally
auto-render, but this form's custom `sys_ui_section` was suspected of
suppressing that default (same failure class as the earlier
target_app/target_table bug), so it's now explicit rather than assumed.
On user request, `downloadRunReportUiAction`/`downloadResultReportUiAction`
had `isUi16Compatible`/`isUi11Compatible` both set to `false` —
**this broke the Run-table button**, confirming the accepted risk flagged
above (this file's own `copyLlmContextUiAction` comment already documented
that `isUi16Compatible: false` stops the platform loading the client
script on a UI16 form at all).

**Later addition #3 (2026-07-22): Run-table "Download Report" converted
to server-side, fixing the isUi16Compatible break.** Rather than just
reverting the flag, `downloadRunReportUiAction` was converted to a
server-side UI Action (`isClient: false`, `isUi16Compatible: true`,
`isUi11Compatible: true`) running `src/server/DownloadRunReportUiAction.server.js`
— same architecture as Run Scan, and for the same reason: eliminate the
whole "client script never loads / GlideAjax round trip" failure class
rather than keep patching it. The script instantiates
`IscanReportGenerator` directly and calls `generateRunReport(current.getUniqueValue())`
— NOT `generateRunReportAjax()` or `this.getParameter()` — which is safe
even though the class still extends `global.AbstractAjaxProcessor` (kept
for the Result-table path, see below), since those are the only methods
that touch the request context this script never provides.
`generateRunReport()` itself is UNCHANGED: it still builds the report via
`_buildRunReportHtml()`, converts it via the platform's PDF Generation
Utilities plugin, and attaches the resulting PDF to the
`x_nold_iscan_run` record — that attachment target was already correct
before this change, only the trigger mechanism was broken/fragile. No
`current.update()` in the new script (it never touches the run record's
own fields, only writes an attachment), so there's no "Invalid update"
double-save risk either. `src/client-scripts/DownloadRunReport.client.js`
was deleted (dead code — nothing references it anymore).
`downloadResultReportUiAction` (Result table) was deliberately LEFT as
GlideAjax + client-side, out of scope for this fix — it can get the same
treatment later if the same failure class shows up there.

**Later addition #4 (2026-07-29): "Installed Modules" scan mode +
Manual mode multi-select.** Two independent changes.

*5th scan mode, `modules`* — instance-wide, no app/table scoping, unlike
every other mode. New Script Include `IscanModuleScanner` profiles
`sys_plugins` (deterministic `canReadPlugins()` gate before querying, same
hard convention as `IscanTableScanner.canAccessMetadata()` — never a
try/catch fallback), cross-checking each plugin's stored `active` flag
against a live `new GlidePluginManager().isActive(pluginId)` call and
flagging any disagreement as `status_mismatch`. Results land in a new
child table `x_nold_iscan_module`, keyed directly off `run` (mandatory
`run` reference, no `result` — same shape as
`x_nold_iscan_global_customization`'s no-owning-app rows, not
`x_nold_iscan_table`'s `result`-keyed shape), since there is no owning
app to tally against. `IscanScanOrchestrator._executeModulesRun()` mirrors
`_executeSingleTableRun()`'s update()-guard/try-catch/status shape;
`_resolveAppList()` gained a `case 'modules': return { modulesOnly: true
}` sentinel, same pattern Single Table mode uses. Unlike the per-app
modes, **there is no ACL-denial fallback for modules mode** — a
`canReadPlugins()` denial ends the run in `status = 'error'` with an
explicit `scan_findings` line, not a silent zero-row `'complete'`. The
optional GenAI summary reuses `IscanSummaryGenerator.generate()`
unchanged (same degrade-gracefully-if-unavailable contract every other
mode relies on) — no new field on `x_nold_iscan_run` for it; the
returned paragraph, if any, is appended via the existing
`_appendScanFinding()` dual-write helper instead. Known accepted
tradeoff: `buildPrompt()`'s 5 sections are hardcoded to an app-scan shape,
so the GenAI *input* prompt reads a bit app-shaped for what's actually a
plugin scan (e.g. a "Data model" section saying "owns no tables") — this
only affects prompt quality, not pipeline correctness, and no user ever
sees the raw input, only the returned summary. `src/fluent/related-lists.now.ts`
got an explicit related-list pair for `x_nold_iscan_module` (via
`run`) on the Run form — same requirement as the existing
`x_nold_iscan_result` one, since this app's custom `sys_ui_section`
form layout has already been found to suppress default related-list
rendering. `IscanReportGenerator._buildRunReportHtml()` gained an
"Installed Modules" table section, gated on rows existing for the run
(same `hasNext()`-gated pattern as the global-customization section) —
without it, modules-mode data would never appear in the PDF report,
unlike every other mode's output. New nav entry "New Modules Scan"
(`order: 350`, between "New Manual Scan" and the Browse separator).
**Verify at build time** (append to the existing `sys_app.source`/GenAI
API/PDF plugin name list): exact `sys_plugins.active` string
serialization from `getValue()` on the target instance.

*Manual mode multi-select* — `target_app` changed from `ReferenceColumn`
to `ListColumn` (`referenceTable: 'sys_app'`, `attributes: { no_sort:
true, slushbucket_ref_no_expand: true }` — same shape OOB `task.watch_list`
uses), so a Manual run can target several apps in one go instead of just
one. The entire multi-app plumbing (`IscanAppSelector.getManualApps()`,
`IscanScanOrchestrator`'s array handling end to end) already supported an
array — the only actual gap was the form field only being able to submit
one sys_id. The fix is a single line in `RunScanUiAction.server.js`:
`targetAppId.split(',')` instead of `[targetAppId]`, since a List field's
`getValue()` returns the same comma-separated sys_id string format a
Reference field already returns for one value. Everything else
(`IscanAppSelector`, orchestrator, `manualAppVisibilityPolicy`,
generated form layout) needed zero changes.

**Later addition #5 (2026-08-11): cross-scope-privilege denial surfaced as
a finding, + "AI Agent Discovery" scan mode.** Two independent changes.

*Cross-scope-privilege denial detection* — the user originally asked for
auto-remediation (this app creating/approving the missing
`sys_restricted_caller_access` record on denial); rejected after
investigation, since it would mean writing outside `x_nold_iscan_*`
(breaks the read-only rule) and self-granting elevated cross-scope access
on denial (breaks the "no elevated privilege" rule) — see KB2291532 and
`application-development/set-RCA-level.md`: a denial creates a
`sys_restricted_caller_access` row with status "Requested", and a human
admin is meant to flip it to "Allowed", never the requesting app. Built
LOG + SURFACE ONLY instead. Confirmed exact error signature against the
docs corpus (KB2291532, KB0831584, KB0691402): `"<operation> operation on
table '<table>' from scope '<scope>' was denied. The application
'<scope>' must declare a cross scope access privilege."` — NOT a thrown
exception; it surfaces via `getLastErrorMessage()` after `query()`/
`next()`, same mechanism as a Data Policy Exception, so no try/catch is
needed around the query itself. New
`IscanTableScanner._detectCrossScopePrivDenial(gr, tableName)` (substring
match on the one stable phrase, not a regex) is the single shared
detection point, called only from `_countRows()` — the ONE reachable
query site in this app's whole surface that reads a scanned app's own
DATA table (row counts via `GlideAggregate`) rather than a global platform
metadata table. Every other query site in `IscanTableScanner`/
`IscanScanOrchestrator` (`sys_db_object`, `sys_dictionary`, `sys_script`,
`sys_script_client`, `sys_ui_policy`, `sys_security_acl`, `sys_plugins`,
`sys_rest_message`) reads global/platform config tables, which aren't
subject to per-app Caller Access Restrictions — deliberately NOT wrapped,
per the "narrow, not blanket" constraint. `profileTable()` returns the new
`cross_scope_denial` string (`''` when none) alongside its existing
fields; `IscanScanOrchestrator._profileOwnedTables()` (gained a `run`
param specifically for this) and `_scanOneTable()` both check it and call
the existing `_appendScanFinding()` dual-write helper — no new table, no
new write path, reuses `scan_findings`/`comments` exactly like every other
finding in this app.

*AI Agent Discovery scan mode (`ai_agents`)* — ported the DETECTION
STRATEGY/LAYERING from AgentCensus (github.com/BrianMcD47/AgentCensus, an
external Python project — not its code), built natively following the
`modules` mode template (`IscanModuleScanner`/`x_nold_iscan_module`,
see "Later addition #4" above) exactly: instance-wide, no app/table
scoping, own child table keyed directly to `run` (no `result`), explicit
related-list entry (this app's custom `sys_ui_section` form layout
suppresses default related-list rendering — same requirement as every
other child table), nav module entry (order 375, between Modules at 350
and the Browse separator at 400). New table `x_nold_iscan_ai_agent`:
`run` (mandatory reference), `layer` (choice: `native_platform` /
`custom_shadow` / `flow_designer` / `credential`), `name`, `detail`,
`source_table`, `confidence` (choice: `confirmed` / `needs_review`). New
Script Include `IscanAiAgentScanner` — 5 layers, each returning
`{findings, accessGaps}` so a scan account's inability to read a candidate
table is reported explicitly rather than silently read as "0 agents
found" (same access-transparency philosophy as this app's own "0 isn't a
bug, explain why" precedent) — `accessGaps` is distinct from a table not
existing at all (`isValid()===false`, e.g. AI Agent Studio plugin not
installed on this instance — normal, not a gap) versus existing but denied
(`canRead()===false` — a real gap). Layer 1 (native platform) queries
`sn_aia_agent`/`sn_aia_usecase`/`sn_aia_tool`/`sn_aia_team` — table names
confirmed against the docs corpus
(`intelligent-experiences/na-aia-reference.md`); Build Agent trial app
tables were NOT included, no confirmed table names found for that trial
app in the corpus. Layer 2 (outbound integration) matches
`sys_rest_message.rest_endpoint` against a hostname list for major LLM
providers (openai.com, openai.azure.com, anthropic.com, bedrock-runtime,
generativelanguage.googleapis.com, cohere.ai, mistral.ai, huggingface.co)
— `confirmed` confidence, since these are full-ish hostnames rather than
bare provider names. Layer 3 (script keyword scan across
`sys_script`/`sys_script_include`/`sysauto_script`/`sys_ui_action` script
bodies) is the only layer gated behind a property,
`x_nold_iscan.include_ai_agent_keyword_scan` (default `false`) — same
precedent as Counting's `include_extended_counts_on_full_scan`: a
`CONTAINS` query on a script-body field across every row of 4 tables,
instance-wide, is real per-instance perf cost, unlike every other layer's
small/name-indexed lookups. Layers 4 (Flow Designer — `sys_hub_flow` names
+ `sys_hub_action_type_definition` for installed IntegrationHub LLM
spokes) and 5 (configuration — `sys_properties` values +
`sys_alias_id` Connection & Credential Alias names) always run. `layer`
3-5 matches are always `needs_review` (heuristic name/keyword matching,
never structural proof) — only Layers 1 and 2 can produce `confirmed`.
`sys_alias_id`'s exact table name is UNVERIFIED against the docs corpus
(no direct hit found) — guarded with `isValid()` so an instance without it
just yields an empty result, not an error; add to the existing
verify-before-go-live list (`sys_app.source`, GenAI Controller API, PDF
plugin name, `sys_plugins.active` serialization) alongside the other
low-confidence table names (`sys_hub_flow`/`sys_hub_action_type_definition`,
same flagged-uncertainty class as Counting's `sysevent_register`/
`sys_import_set_source`). `_executeAiAgentsRun()` mirrors
`_executeModulesRun()`'s shape (update()-guard, try/catch, status shape),
but does NOT share its hard "no ACL-fallback, denial = run status error"
policy — a layer's `accessGaps` are per-table findings appended to the log,
not a run-level failure, since AI Agent Discovery is inherently a
best-effort multi-layer sweep rather than a single deterministic gate like
`sys_plugins`. No GenAI summary for this mode (not requested, keeps the
diff smaller — `modules` mode's GenAI reuse was an explicit spec ask for
that mode specifically, not a required precedent for every future
instance-wide mode). `IscanReportGenerator._buildRunReportHtml()` gained
an "AI Agent Discovery" section, gated on `hasNext()` for
`x_nold_iscan_ai_agent`, grouped by layer, with a confidence icon column
(✅ confirmed vs ❓ needs review) — same insertion point and
`hasNext()`-gated pattern as the Installed Modules section immediately
above it.

## /caveman

If the user invokes `/caveman`, switch to ultra-concise mode for the
rest of the session per that skill's instructions (short sentences, no
filler, results before narration). It's a communication-style toggle,
not a change to the engineering conventions above.

**Later addition #6 (2026-08-28): Instance Scan Console UI Page — this app's
first UI Page.** Endpoint `x_nold_iscan_console.do` (`src/fluent/ui-pages/console.now.ts`,
`direct: true`, `html` imported from the build output of `src/client/index.html`
— NOT `Now.include`, which is what every other script body in this repo uses;
UI Pages are the one exception, per the SDK's own ui-page guide). React 18.2.0
+ `@servicenow/react-components`, NOT Jelly — new deps `react`/`react-dom`
`18.2.0`, `@servicenow/react-components` `^0.1.0` (caret required by the guide),
devDep `@types/react` `18.3.12`. No webpack/vite/babel config exists or should
ever be added: `now-sdk build` bundles `src/client/**` into
`sys_ux_lib_asset` records automatically.

*Routing* — SPA over `URLSearchParams`, four views: `?view=dashboard` (default,
metric tiles + recent runs), `?view=runs`, `?view=results`, and
`?view=detail&id=<sys_id>&table=<table>`. The `table` param is an extension over
the guide's plain `?view=detail&id=` because two different tables
(`x_nold_iscan_run`, `x_nold_iscan_result`) feed the same detail view.
`src/client/utils/nav.ts` holds the whole router (~35 lines): `getViewFromUrl`,
`buildPath`, and `setPageTitle`, which does the mandatory Polaris iframe check
(`window.self !== window.top` → `CustomEvent.fireTop('magellanNavigator.permalink.set')`,
else `document.title`). Browser back/forward works via a `popstate` listener in
`app.tsx`. Never hash routing, never `window.location.reload()`.

*Read-only by design, like the rest of the app.* The detail view is
`RecordProvider isReadOnly={true}` + `FormColumnLayout` with NO `FormActionBar`,
so the page opens no write path at all — not even into `x_nold_iscan_*`.
Consequently there is no dirty-state tracking and no unsaved-changes `Modal`:
the guide mandates those only for views that create or edit. Every write stays
where it already was — the platform form's UI Actions (Run Scan, Download
Report), reachable from the detail view's "Open in platform form" `TextLink`,
and `onNewActionClicked` (which `NowRecordListConnected` requires unless
`hideHeader`) navigates to `/x_nold_iscan_run.do?sys_id=-1` rather than
building a create view. If you ever add an editable view here, dirty state via
`useRecord().form.isDirty` becomes mandatory.

*Components* (docs under `node_modules/@servicenow/react-components/docs/` —
read them before using any of these; prop names are NOT standard React, e.g.
text is a `label` prop, events are `onXxxSet`/`onClicked` with data in
`event.detail.payload`): `NowRecordListConnected` (all three record lists — never
a manual `fetch` + `.map()` + `<table>`; it has no `query` prop, filtering/sorting
is done by passing an encoded query as the React `key`), `RecordProvider` +
`FormColumnLayout` (there is no `RecordField` component), `Card`, `Button`,
`Heading`, `Alert`, `Loader`, `TextLink`. Only the dashboard's roll-up numbers
need direct API calls — `src/client/services/MetricsService.ts` hits
`/api/now/stats/<table>?sysparm_count=true` (plus one `sysparm_group_by=status`
call for the runs-by-status tiles) with `X-UserToken: window.g_ck` and
`sysparm_display_value=all`. `src/client/utils/fields.ts` carries the
`display()`/`value()` helpers for that response shape.

*Dark-mode contrast is architectural, not cosmetic.* `src/client/app.css`
contains ZERO hardcoded colors — the whole reason dark mode breaks is hardcoded
hex. Every color is a Horizon design token wrapped in `rgb()`/`rgba()` with a
chained `var()` fallback, because each token carries both a light and a dark
value and the theme system swaps them. A `--snx-*` alias layer on `:root` maps
component-specific (never generic) aliases onto those tokens. The three
inversion gotchas the theming guide calls out are all handled: surfaces use
`--now-container-card--background-color` (NOT `--now-container--color`); the side
nav uses `content-tree` tokens (NOT `navigation-sidebar`); status pill text uses
`--now-indicator_label--{variant}--color` (note the `_label` subcategory), not
the base indicator color. Severity naming is always `positive`/`critical`/
`warning`/`info` — never "success"/"error". Interactive elements are all platform
`Button` components, so their base/hover/active/focus-visible/disabled states and
focus rings come from Horizon rather than hand-rolled CSS. Spacing uses the tight
end of the scale (`--now-static-space--sm`/`--md` inside, `--lg`/`--xl` between
sections) for a dense dashboard rhythm; layout is relative-unit only, responsive
at 768px, and wide platform lists scroll inside `.iscan-panel`'s own
`overflow-x: auto` rather than the page body. Motion is a 320ms opacity/transform
fade on tiles, disabled under `prefers-reduced-motion`. The ui-ux-pro-max skill's
suggested glassmorphism/Google-Fonts-CDN/GSAP/hardcoded-`#0F172A` direction was
deliberately NOT implemented — CDNs and external script sources are forbidden in
UI Pages and hardcoded colors are exactly the dark-mode bug being avoided; only
its density/hierarchy/accessibility guidance was applied.

*Navigator entry* — `consoleModule` in `src/fluent/navigation.now.ts`,
`link_type: 'DIRECT'` with `query: 'x_nold_iscan_console.do'` (a UI Page module
uses DIRECT + `query`, not LIST/`name`), `order: 50` so it sits above every "New
<mode> Scan" module: the console is now the app's front door.

*Blank-page bug, fixed 2026-08-28 — do not reintroduce.* The first build of this
page rendered completely blank with `Uncaught SyntaxError: expected expression,
got '>'` at `x_nold_iscan_console.do:89`. Cause: `src/client/index.html`
followed the SDK ui-page guide's template literally, including the
`//` + CDATA-open / `//` + CDATA-close comment pair wrapped around the inline
Array.from polyfill. Those guards are correct for a hand-written Jelly page, but
now-sdk **already wraps the entire `html` field in its own CDATA section** at
build time. A CDATA close sequence cannot legally appear inside CDATA, so the
build split ours across two sections; the browser unwrapped that back into a
stray `>` alone on a line, which is a hard parse error. The inline script died,
React never bootstrapped, and the `formFetcherBehavior.js` "can't access property
actionHandlers" error was downstream fallout, not a separate bug. Fix was to
delete both guard comments — the SDK's outer CDATA already keeps the `&&` and `<`
operators in that polyfill literal (verified in the generated
`dist/app/update/sys_ui_page_*.xml`: exactly 1 CDATA section, 0 split-escapes).
When touching `index.html`, re-check that generated XML rather than trusting the
guide's template. Two console errors seen alongside this were unrelated platform
noise and are expected: Firefox's `InstallTrigger is deprecated`, and
`Requested sysProp : com.snc.pdf.generation.accessibility does not exist`.

*14 `sys_choice` duplicate-definition warnings, fixed 2026-08-30.* Every build
printed `Record "sys_choice.<id>" is defined 2 times ... 1. generated/keys.ts
(delete) 2. tables.now.ts`. `src/fluent/generated/keys.ts` held 14 stale
`deleted: true` tombstones whose `key` (name/element/value) matched choices that
are still LIVE in `tables.now.ts` — `x_nold_iscan_run.scan_mode` (full,
custom_only, manual, single_table), `.status` (pending/running/complete/error),
`x_nold_iscan_result.scan_mode_used` (full_access, app_files_fallback), and
`x_nold_iscan_table.well_known_base` (task, cmdb_ci, other, none). So the
project simultaneously said "delete this record" and "create this record"; the
warning's own "the last entry from each conflict will take precedence" means an
unlucky ordering could have deleted live choices off the instance — a real
hazard, not cosmetic noise. Fix was deleting those 14 tombstone entries from
`keys.ts`. Confirmed afterwards that the build does NOT regenerate them (0
`sys_choice` tombstones remain) and that the 14 `deleted: true` entries still in
the file are unrelated and legitimate (`sys_ui_element` ×9 from form-layout
churn, plus `sys_security_acl`, `sys_security_acl_role`,
`sys_user_role_contains`, `sys_documentation`, `sys_dictionary`) — the matching
count of 14 is coincidence. If these warnings ever return, check whether a
tombstone's `key` still matches a live definition before deleting it; a
tombstone for a genuinely removed choice is correct and must stay.

*Glass restyle (2026-08-30).* Reworked `app.css` to a frosted-glass surface
treatment on user request, WITHOUT breaking the token-only rule — still zero
hardcoded colors. The glass surfaces reuse the exact same Horizon tokens as the
solid ones, just with an alpha channel (`rgba(var(--token), a)`), so dark mode
keeps inverting on its own. Alpha is deliberately high (0.62–0.78, versus the
0.1–0.2 typical of decorative glassmorphism) because text sits directly on
these panels and must clear WCAG AA 4.5:1 in both themes — **do not lower it**.
`.iscan-shell` gained two very low-alpha radial token washes; without something
tinted behind them the blur is invisible on a flat background. Metric tiles are
platform `<now-card>` web components whose surface lives in a shadow root this
stylesheet cannot reach, so they are glassed via the only two levers that cross
that boundary: `backdrop-filter`/`box-shadow` apply to the host element, and
custom properties inherit through the shadow boundary, so
`--now-container-card--background-color-alpha` is lowered on the host rather
than any color being hardcoded — if a platform version ignores that alpha token
the card just stays opaque on a blurred host (muted, not broken). Status pills
stay fully opaque on purpose: they encode meaning and the
`indicator`/`indicator_label` pair is contrast-checked as a SOLID pair, so
translucency would put their contrast at the mercy of whatever sits behind them.
Two fallbacks both revert to the original solid surfaces: `@supports not
(backdrop-filter)` (unblurred translucency is just washed-out text) and
`@media (prefers-reduced-transparency: reduce)`. Hover lift is transform +
box-shadow only, disabled under `prefers-reduced-motion`.

*Scan-result detail "record not found", fixed 2026-08-30.* Clicking a row in
the Scan results list opened a detail view that reported record not found.
Cause: `NowRecordListConnected`'s ROW_CLICKED event fires on **"the first link
in a row"**, so when the first column is a reference field the link points at
the REFERENCED record, and the payload's top-level `sys_id`/`table` can describe
that record rather than the row's own. The results list's first column is `app`,
a reference to `sys_app` — so the console navigated to a `sys_app` sys_id while
asking for it in `x_nold_iscan_result`. The runs list was unaffected because
its first column (`scan_mode`) is a choice, not a link. Note the component's own
doc contradicts itself here: the prose says to use `payload.sys_id`/
`payload.table`, while the `RowClickedPayload` interface in the same file also
carries `record_id`/`recordTable` **and** a `row.sys_id.value`. The row object is
the row's own record, so the fix is a single shared helper,
`rowRecordId(payload)` in `src/client/utils/fields.ts`, preferring
`row.sys_id.value` and falling back to `record_id` then `sys_id`. All three list
click handlers (2 in `app.tsx`, 1 in `Dashboard.tsx`) route through it — keep it
that way, per-caller extraction is how this got in. `RecordDetail` also now
renders an explicit "No record selected" `Alert` when it receives an empty
sysId, instead of handing `RecordProvider` a blank id and showing a bare
platform error with no way back.

*Liquid Glass pass (2026-08-30), replacing the all-over glass above.* The
ui-ux-pro-max DB's `liquid-glass` entry is explicit that the material is for
"navigation and controls", applied **sparingly**, with "content on a separate
layer" — and its accessibility profile is `risk:conditional` requiring
`contrast-text-4.5`. Glassing every surface (the previous pass) put dense
platform-list text at the mercy of whatever sat behind it. So the architecture
is now split: **chrome is glass, content is clear.** `.iscan-nav` is the single
signature surface — adaptive translucent fill, `blur(20px) saturate(1.7)`, a
lensing edge built from paired inset box-shadows (bright top, shaded bottom),
and a specular sweep via `::before` — while `.iscan-panel` went back to the
SOLID surface token, because that is what holds the record lists and forms.
Metric tiles keep a restrained glass. Specular/lens highlights derive from
`--now-color_background--primary`, so they read as a bright highlight in light
mode and a soft lift in dark mode rather than a fixed white that would glare on
a dark theme — deliberate, do not swap it for a literal white. Chrome uses a
doubled radius (`--snx-radius-chrome`) for the squircle feel; content keeps the
platform container radius. The file is now ordered tokens → chrome → content →
status → motion → fallbacks, with chrome and content styled by SEPARATE
selectors instead of one shared rule plus overrides — the previous version had
`.iscan-panel` in a grouped glass rule and then re-declared its background
later, exactly the specificity trap the frontend-design skill warns about.
Added along the way: an explicit `:focus-visible` outline (a subtle ring washes
out on a translucent pane), and `font-variant-numeric: tabular-nums` on tile
values so the metric row does not jitter as counts change.

*Console v2 (2026-08-30): one-click scan launcher, per-result dashboard, flex
tiles.* Four changes to the console, plus this app's first Scripted REST API.

*Scan launcher — new Scripted REST endpoint.* `POST /api/x_nold_iscan/iscan_run_scan/run`
(`src/fluent/rest-apis.now.ts`, unversioned, `serviceId: 'iscan_run_scan'`,
`path: '/run'`), script body in `src/server/IscanRunScanApi.server.js` via
`Now.include(...)` like every other server script here. A UI Page cannot press
the server-side "Run Scan" UI Action, so the console needed its own trigger, and
the two obvious alternatives were both rejected on the same grounds this repo
already documents: a **business rule** on `x_nold_iscan_run` insert would
DOUBLE-SCAN (the UI Action already scans on form submit, so every form-created
run would scan twice), and **GlideAjax** is banned in UI Pages by the SDK guide
and is the exact silent-empty-answer failure class this app removed. A scripted
REST resource fails LOUDLY — real HTTP status, real body — which is the property
that makes it safe. The script owns NO scan logic: it validates `scan_mode`
against the six real `scan_mode` ChoiceColumn values (rejecting anything else
with HTTP 400), normalizes optional `app_ids` (array or comma-separated string,
mirroring `RunScanUiAction.server.js`'s `target_app` split) and `target_table`,
then calls the existing public `IscanScanOrchestrator.runScan(scanMode, appIds,
targetTableSysId)` — the same entry point the ATF/programmatic path uses. No new
orchestrator method, no duplicated orchestrator logic, no `src/server/*` scanner
edits. It runs as the CALLING USER (no `gs.setUser`, no impersonation), so the
orchestrator's own `update()`-guard ACL-denial errors still surface, and it
writes nothing itself. Returns `{sys_id, status, scan_mode}` with HTTP 201.
**Role gate:** a single new `rest_endpoint` / `execute` ACL in `acls.now.ts`
(`runScanApiExecuteAcl`, name `x_nold_iscan_run_scan_api`, roles
`[scannerRole]`, `securityAttribute: 'user_is_authenticated'`), referenced from
BOTH the API and the route via `enforceAcl`. **No other ACL was needed** — every
table the endpoint reaches through the orchestrator is already covered by the
existing record ACLs, evaluated as the calling user. **Known, accepted, not to
be "fixed" with async machinery:** the call is SYNCHRONOUS, so a `full`-mode scan
of a large instance runs inside the request and could approach the transaction
timeout. That is not a new risk — the UI Action is equally synchronous inside
the form-submit request.

Console side: `src/client/services/ScanService.ts` (`startScan`, POSTs with
`X-UserToken: window.g_ck`, reads `{result}` / bare-body / `{error:{message}}`
response shapes) and `src/client/components/ScanLauncher.tsx` on the Scan Runs
tab. **Four modes are one-click** (`full`, `custom_only`, `modules`,
`ai_agents`) — button disabled and relabelled "— scanning…" while in flight,
success routes to that run's detail view through the console's own
`navigate()`, failure renders a `critical` `Alert` (never a silent no-op).
**`manual` and `single_table` deep-link instead**, to
`/x_nold_iscan_run.do?sys_id=-1&sysparm_query=scan_mode=<mode>` (the same
`link_type: 'NEW'` + `query` shape this app's navigator modules already use):
they cannot run without an app/table, and the pickers for those — a `sys_app`
slushbucket, a `sys_db_object` reference — already exist on the platform form.
Their button copy says "— pick target on form" so the split is unambiguous.

*Scan results tab — the list was CORRECT as written; do not "fix" it again.*
All six columns (`app,run,scan_mode_used,table_count,business_rule_count,acl_count`)
verified against `tables.now.ts`, and the read ACLs mirror the runs table
exactly. The real explanation for an empty tab is data, not code: **Installed
Modules and AI Agent Discovery runs write NO `x_nold_iscan_result` rows** (their
findings hang off the run via `x_nold_iscan_module` / `x_nold_iscan_ai_agent`),
and neither does Manual — Single Table on a table with no owning `sys_app`. A
`.iscan-hint` line above the list now says so. The one thing that WAS wrong: the
`key="ORDERBYDESCsys_created_on"` on every list. `NowRecordListConnected` has no
query/order prop at all — its wrapper forwards only `table`/`listTitle`/`limit`/
`view`/`columns`/`hide*` to the custom element (verified in
`node_modules/@servicenow/react-components/dist/NowRecordListConnected.js`) — so
that string was an ordinary React key doing nothing, and this file's earlier
claim that filtering/sorting is done "by passing an encoded query as the React
key" is WRONG. It has been removed. Ordering comes from the table's list layout
(`sys_ui_list`, auto-generated at build into `dist/app/update/`), not from a prop.

*Dashboard — pick one scan result.* The instance-wide "Scan state" tile row is
unchanged. Below it, `ResultDashboard.tsx` + `ResultSummary.tsx` +
`src/client/services/ResultsService.ts` (same conventions as `MetricsService`:
`X-UserToken`, `sysparm_display_value=all`, `display()`/`value()` from
`utils/fields.ts`). The picker is a platform `Select` with `search="contains"`,
not an embedded record list — one value out of a flat list, one row tall, and a
second list would compete with the recent-runs list directly below it. Selection
is routed as **`?view=dashboard&result=<sys_id>`**: `nav.ts`'s `ViewState` gained
`resultId`, `buildPath` a 4th `resultId` param, so the choice is linkable and
back/forward moves between results. The chosen result's 41 count fields render as
the same equal-size tiles, **zero values skipped** (same rule as the PDF report),
sorted descending. Tile labels are DERIVED from the field name
(`business_rule_count` → "Business rule") rather than a 41-entry label map, which
could only ever drift from the schema. `summary_text` and `llm_context` are text
blocks, not tiles: the summary inline (with an explicit note when empty — it is
optional and degrades to nothing without the GenAI Controller), `llm_context`
behind a `Collapse` toggle with `white-space: pre-wrap` + a max height, so it
wraps and scrolls inside itself and never scrolls the page body. Read-only
throughout — the dashboard displays, it never writes.

*Tiles are now flexbox, all the same size.* `.iscan-tiles` went from
`display: grid` to `display: flex; flex-wrap: wrap; align-items: stretch`.
Equal WIDTH comes from an identical `flex: 1 1 12rem` on every `> li` — same
basis, same grow — so a tile is never sized by its own content and the last row
lines up with the ones above; equal HEIGHT from `align-items: stretch` plus the
card (`flex: 1 1 auto`) and `.iscan-tile` (`block-size: 100%`) filling the item.
`min-inline-size: 0` on the item is what actually lets a long label wrap instead
of stretching the box — flex items default to `min-width: auto` and would
otherwise refuse to shrink below their content. Status pills get
`margin-block-start: auto` so they align across a row. The 768px breakpoint drops
the basis to `9rem` (basis only, never the grow factor) so two tiles still share
a phone row. `.iscan-panel` became a `flex` column with a `gap`, so a panel can
stack heading/hint/action-row/list on one rhythm without per-child margins. New
classes `.iscan-hint`, `.iscan-text`, `.iscan-text--pre`, `.iscan-actions` — all
token-only, zero hardcoded colors, chrome and content still on separate
selectors, and the three guards (`@supports not (backdrop-filter)`,
`prefers-reduced-transparency`, `prefers-reduced-motion`) untouched and still
covering everything.

*One more dedup:* the three near-identical `NowRecordListConnected` blocks (runs
tab, results tab, dashboard recent-runs) collapsed into
`src/client/components/ListPanel.tsx`. That keeps `rowRecordId()` as the single
click-payload extraction point — per-caller extraction is what produced the
"record not found" bug, and three copies of the JSX is how it drifted.

*Console v3 (2026-08-30): own preview modal, grouped result tiles, in-flight scan
feedback.* The platform's own row "i" preview on `NowRecordListConnected` is **not
ours to resize, and no amount of CSS will change that** — the React wrapper
documents zero size-related props and forwards nothing extra to the underlying
element, and that element ships as an EXTERNAL uxasset
(`import '@servicenow/now-record-list-connected' assert { external: 'uxasset' }`
in `dist/NowRecordListConnected.js`), so there is no local source in the package
in which to find a `::part()` or custom-property size hook. `::part()` only
reaches a shadow root whose host exposes parts deliberately; a guessed part name
fails **silently**, which is why this needed evidence rather than an attempt.
So the console renders its OWN preview instead: `ListPanel` gained a `preview`
prop (set only on the Scan results tab), and a row click there opens
`src/client/components/RecordPreviewModal.tsx` — a platform `Modal` with
`size="custom"` + `customSize={{width:'min(1100px,92vw)', height:'min(850px,88vh)'}}`
(both are plain CSS value strings; the component clamps width to 100vw and
height to 90vh), `contentFullWidth`, and the same read-only
`RecordProvider` + `FormColumnLayout` pair the full-page detail view uses. Its
footer's "Open full record" routes through the SAME `onOpen`/`rowRecordId()` path
as a non-preview list, so there is still exactly one click-payload extraction
point. Escape/dismiss come from `Modal`'s own `onOpenedSet`. Do not reintroduce a
second extraction site here — that is the bug this file already documents twice.

*Result tiles are grouped, not a flat sorted list.* `src/client/utils/countCategories.ts`
maps the result table's `*_count` fields into 8 categories (Data model,
Automation, Flow & process, Integration, Catalog & portal, Security & access,
Reporting & analytics, Testing & configuration) with an `'Other'` catch-all. It
is **membership only, never a label map** — labels stay derived from the field
name (`business_rule_count` → "Business rule"), and a field this list forgets
about still renders under "Other" rather than disappearing. All 39 entries were
cross-checked against `tables.now.ts` (zero invented names); the 6 remaining
`*_count` fields in the schema live on OTHER tables (`app_count` on the run,
`field_count`/`row_count`/`dictionary_override_count`/`inbound_reference_count`
on `x_nold_iscan_table`, `custom_artifact_count` on
`x_nold_iscan_global_customization`), so result-table coverage is complete.
Zero-valued counts are still skipped, same rule as the PDF report.

*Scan in-flight feedback.* `ScanLauncher` now renders an `info` `Alert` ("do not
navigate away"), a `Loader`, and a visually-hidden `role="status"`/`aria-live`
span while the synchronous REST call is outstanding — the buttons alone only
changed their own label, which a screen reader never announces because focus
does not move. `Loader`'s `size` accepts only `'md' | 'lg'` (`'sm'` is a build-time
type error, TS2322 — it was, and was fixed). Two new token-only classes:
`.iscan-visually-hidden` (clip-path, NOT `display:none` — a hidden element is not
announced at all) and `.iscan-preview-body` (scrolls the form inside the modal).
`app.css` still has zero hardcoded colors and all three guards intact.
**Verified at build time:** `npm run build` clean, 0 warnings, 0 `sys_choice`
duplicate-definition conflicts, generated `sys_ui_page_*.xml` has exactly 1 CDATA
section and 0 split-escapes. **NOT verified — no instance was available:** the
modal's real rendered size, `FormColumnLayout` behaviour inside a `Modal`, dark-mode
contrast of the glass rail, and forced-colors rendering.

*Console v3, part 2 (2026-08-30): app frame, wayfinding, grouped dashboard,
empty state.* The rest of the overhaul the first pass never reached.
`.iscan-header` became glass chrome using the SAME token/lensing/specular pattern
as `.iscan-nav`, on its OWN selector — chrome and content remain styled by
separate selectors, and `.iscan-panel` is still the SOLID surface token, since it
holds the record lists and forms. All three fallback guards
(`@supports not (backdrop-filter)`, `prefers-reduced-transparency`,
`prefers-reduced-motion`) were extended to cover `.iscan-header` and its
`::before` alongside `.iscan-nav` — if you add another glass surface, add it to
all three or it will render as unblurred translucency (washed-out text), which is
worse than no effect at all.

Wayfinding now comes from the frame, not only the nav's active item: a
`Breadcrumbs` trail plus a per-view subtitle driven by a `VIEW_META` map in
`app.tsx`. `SideNav` gained real `<ul>/<li>` semantics and `aria-current="page"`;
because the list is now its own element, the mobile flex-row collapse moved from
`.iscan-nav` onto `.iscan-nav__list` — keep it there. `RecordDetail` gained a
breadcrumb trail and a heading, and its Back button now names its destination
("Back to Scan Runs"/"Scan Results") because `app.tsx`'s `onBack` routes to the
record's OWN list tab rather than always returning to the dashboard.

The dashboard's 10 metric tiles are split into two headed groups ("Run activity",
"Coverage & findings"), the same grouping pattern `ResultSummary` uses for the
per-result counts. The Scan Results tab's plain grey hint paragraph became a real
empty-state block (`.iscan-empty-note`) pairing an `Illustration` with the
explanation — that tab being empty is usually CORRECT (modules/ai_agents runs, and
single-table runs on a table with no owning app, write no result rows), so it must
read as an explanation rather than as a fault.

Two components used here for the first time, both docs-checked: `Breadcrumbs` and
`Illustration` (`illustration` is REQUIRED, `size`/`alt` optional).
**Verified at build time:** build clean, 0 errors/0 warnings; `app.css` hex count
0; `sys_choice` entries in `generated/keys.ts` still 22 with 0 `deleted: true`
tombstones; every `iscan-*` class used in TSX defined in `app.css`; generated
`sys_ui_page_*.xml` has exactly 1 CDATA section and 0 split-escapes.
**NOT verified — no instance, no dev server:** actual browser rendering, real
dark-mode contrast, focus-ring visibility on the new glass header, and whether
`Breadcrumbs`/`Illustration` render as expected inside the UI Page iframe.

*Console v4 (2026-08-30): custom-rendered lists and tiles — the platform
components were the reason it looked like a platform form.* Root cause of two
failed visual passes: EVERY `@servicenow/react-components` component is an
external uxasset web component with its own shadow root (`external: 'uxasset'`
imports in `dist/*.js`). `app.css` cannot reach inside any of them. Since
`NowRecordListConnected` and the `Card` tiles were the dominant visual mass of
every screen, styling only the shell/nav/gaps left ~90% of the pixels rendering
as stock platform chrome. **The lesson generalises: on this page, anything whose
appearance actually matters has to be our own markup.**

`NowRecordListConnected` is GONE, replaced by `src/client/components/RecordTable.tsx`
+ `src/client/services/TableService.ts` — a real `<table>` fed by direct
`/api/now/table/<table>` calls. Unlike the component, the Table API DOES support
querying and ordering (`sysparm_query=ORDERBY(DESC)<field>`, `sysparm_fields`,
`sysparm_limit`/`sysparm_offset`), so this is strictly more capable, not a
downgrade — the earlier note that the component had no query/order prop is why
this was possible. Accessibility is hand-built and must stay: `<caption>` (visually
hidden), `scope="col"`, `aria-sort` toggling on sortable headers, a real `<button>`
per row as the open control. Paging uses `X-Total-Count` when present and degrades
to range-only display when absent (**unverified on the target instance**).
`ListPanel.tsx` is deleted, and with it `rowRecordId()` — no caller remained.
**Accepted trade-off:** custom lists lose platform personalization, the column
chooser and the native list context menu; mitigated by our own sort/paging plus an
"Open in platform list" link on every table. Revisit only if someone actually wants
list personalization here — this is a read-only review console.

`Card`-based metric tiles became a plain `.iscan-tile` div, which finally makes
them stylable (the old `--now-container-card--background-color-alpha` trick
existed only because the card's surface was behind a shadow boundary — that hack
is gone with it).

reactbits.dev supplied the visual direction; **nothing was pasted**, because most
of its components import gsap/framer-motion/three/ogl and no npm dependency can be
added to this page. Ported dependency-free, token-only: tile tilt + cursor-follow
glow (`MetricTile` sets `--iscan-tilt-x/y`/`--iscan-glow-x/y` via
`ref.current.style.setProperty` on mousemove — **deliberately not React state, so a
mousemove never triggers a re-render**), staggered tile entrance, a slow aurora
drift on the nav rail's specular sweep, and count-up numbers
(`utils/useCountUp.ts`, which checks `matchMedia('(prefers-reduced-motion: reduce)')`
and jumps straight to the final value). All three guards were updated to the new
DOM: `.iscan-tile` replaces the old `.iscan-tiles now-card` target in the
`@supports not (backdrop-filter)` and `prefers-reduced-transparency` blocks, and
`prefers-reduced-motion` now also covers the tilt, glow, aurora and row
transitions. If you add another effect, add it to that block too.

Still platform components, deliberately: `RecordProvider`/`FormColumnLayout`
(record detail, and inside the preview modal — reimplementing a whole platform form
is not worth it), `Modal`, and the small chrome controls (`Button`, `Alert`,
`Heading`, `Select`, `Collapse`, `TextLink`, `Breadcrumbs`, `Loader`,
`Illustration`).
**Verified at build time:** build clean, 0 errors/0 warnings; hex count 0; no new
npm dependency; no forbidden import; the only non-GET fetch in `src/client/` is
still `ScanService`'s existing POST; `sys_choice` entries still 22 with 0
tombstones; generated `sys_ui_page_*.xml` has 1 CDATA section, 0 split-escapes.
**NOT verified — no instance, no dev server:** rendered appearance, real contrast
measurement, and whether `X-Total-Count` is present on the target instance's Table
API responses.

*Console v5 (2026-09-24): the page was vertically centred, and there is now a way to SEE the UI.*

**A local render harness exists — use it before changing any CSS here.** Every
prior visual pass on this page was done blind, which is why obvious layout faults
survived four rounds. The harness renders the REAL built bundle offline: serve
`dist/static` over `python3 -m http.server`, point the page's script tag at the
built `main.jsdbx`, and stub `window.g_ck` + `window.fetch` so the Table/stats
APIs return realistic rows. Screenshot it headless with the Chrome under
`~/.cache/puppeteer/` (playwright-core + `executablePath`; `file://` does NOT work
— ES modules are CORS-blocked on that scheme, it must be http). Full recipe in the
session scratchpad's `HARNESS.md`. Its limits: light theme by default, no Polaris
iframe, and Google Fonts blocked offline so Sora/Work Sans fall back to system
faces (sizes and weights are still accurate).

**Root cause of the "everything is pushed down / rail is a floating pill" bug.**
`.iscan-shell` is a two-row grid (header, then nav+main) with `min-block-size:
100%`. It had no `align-content`, which resolves to `stretch`, so the leftover
viewport height was distributed BETWEEN the two rows — the header row ballooned,
the whole page read as vertically centred with ~260px of dead space under the
title, and the rail could never reach full height. Fixed with three declarations
that must stay together: `grid-template-rows: auto minmax(0, 1fr)`,
`align-content: start`, and `align-items: stretch` (the last is what makes the
rail full-height rather than content-height). `.iscan-nav__footer` keeps
`margin-block-start: auto` to pin the theme toggle to the bottom of that rail.

**Tiles are `repeat(auto-fit, minmax(12rem, 1fr))`, and `auto-fill` is wrong here.**
`auto-fill` keeps the empty trailing tracks it creates, so the 4-tile "Run
activity" row filled only the first 4 of ~8 tracks and stopped dead mid-page while
the 6-tile row stopped short too. `auto-fit` collapses the empties so every row is
full-bleed. Accepted trade-off, deliberate: a 4-tile row and a 6-tile row no
longer share column positions, but each row divides evenly across the full width,
which reads as intentional where a half-empty row does not.

Also this pass: `.iscan-dash-split` went `align-items: start` → `stretch` (the
result-detail panel was shrinking to its own sparse content while its sibling card
stayed tall, so the two looked unrelated); `ResultDashboard` gained a real
empty state for the no-result-picked case; heading/group-label rhythm loosened;
`.iscan-main > *:last-child { flex: 1 1 auto }` plus `overflow-y: auto` on
`.iscan-table-scroll` so the last block fills the viewport and long tables scroll
inside their card; and `.iscan-shell`'s radial wash gained `background-repeat:
no-repeat` — it was tiling, and the fade-to-transparent hitting its own next tile
is what drew the hard rectangular seam behind the tile rows.

Confirmed from the docs corpus (sn-rag, `api-reference/server-api-reference/
PolarisUIScopedAPI.md`): "A direct UI page doesn't include the common HTML page
template and **must include all CSS and JavaScript that you want to use in the
page**." This page is `direct: true`, which is why the inline-CSS `prebuild` step
is the correct architecture and not a workaround.


**Later addition #7 (2026-09-26): runs stuck in "running", async execution, and
the CMDB & CSDM Health scan mode.**

*Why runs stayed "running" forever.* The only run on ven09425 after the
scope rename (`f7da38d9…`, `full`) resolved **4 apps + 3,549 table-only fallback
tables**, kept writing for **16.5 minutes**, and never reached `complete` or
`error` — `completed` empty. Its `scan_findings` text froze 18 seconds in while
`sys_updated_on` kept advancing. Two independent weaknesses explain it, and the
fix covers both without needing to prove which fired:
1. **The terminal status write was coupled to the log write.** `status=complete`
   rode on the same long-lived `run` GlideRecord that carries the ever-growing
   `scan_findings` log, so anything breaking that one `update()` lost the status
   too. `IscanScanOrchestrator._finishRun()` now persists `status` + `completed`
   through a FRESH GlideRecord touching only those two fields, in all four
   `_execute*Run` methods. (Note: `scan_findings`' dictionary `max_length` is
   8000 yet that run stored 24,959 characters — the limit is NOT enforced on
   write, so do not assume truncation there.)
2. **A 16-minute scan ran inside a request.** UI transactions are cancelled at
   298s (`c_DefaultQuotaRules.md`: the "UI Transactions" rule exempts only
   background scripts; KB0867099 gives the 298s default) and the load balancer
   drops connections at 5 minutes. A killed transaction never reaches its own
   `catch`.

*Async execution — only for long modes.* `ASYNC_MODES = ['full', 'cmdb_health']`.
The Run Scan UI Action and the REST endpoint call `queueScan()`, which fires
`x_nold_iscan.scan.execute` (registered in `src/fluent/async-scan.now.ts` —
scoped events need BOTH `suffix` and `event_name`, max 40 chars) and returns at
once; the Script Action (`ExecuteQueuedScanScriptAction.server.js`, **`active:
true` explicitly — it defaults to false**) calls `executeQueuedRun()`, which
runs the unchanged synchronous `runScanForRecord()`. Parameters travel on the
event (`parm1` = mode, `parm2` = JSON), so the UI Action's target_app precedence
is still decided in one place. States are now honest: `pending` (queued) →
`running` (worker started) → `complete`/`error`; `executeQueuedRun()`'s catch
covers failures before a scan's own try/catch (unknown mode, missing record). The
UI Action does NOT write the record itself — it sets `status='pending'` on
`current` and lets the platform's single natural save commit it together with
the event (a second save in one request is what caused the old "Invalid update").
The REST endpoint returns **202** for queued modes and 201 for the rest.
**Every other mode stays synchronous — deliberately.** The ATF tests click Run
Scan and assert `status=complete` immediately; none use `full`, so async for
`full`/`cmdb_health` only needs zero test changes. `runScan()` (the
programmatic/ATF entry point) is still fully synchronous for every mode.
The console's detail view (`RecordFields.tsx`) polls every 5s while a run is
`pending`/`running` and stops at a terminal status, so a queued run visibly
progresses instead of looking stuck.

*The Script Action runs as System — hence admin-only.* Evidence from the docs
corpus (convergent, not one explicit sentence): `events.md` (handlers are
dispatched by scheduled jobs reading the queue), `r_BuildAScript.md` (the
canonical pattern passes `gs.getUserID()` as a parameter because the handler
does not run as that user), KB0785010 (Script Actions run as System), and the
Fluent `ScriptAction` API has no run-as field. Letting a scanner-only user queue
these modes would let them read, via `x_nold_iscan_*` tables their role CAN read,
data beyond their own ACLs — including incident/change/CI display values stored
as CMDB check samples. `canLaunch()` rejects non-admins in both entry points (UI
Action: error message + abort; REST: **403**). The new nav module is `roles:
['admin']`. Scanner-role users can still READ the resulting rows.

*CMDB & CSDM Health (`cmdb_health`, sequence 6).* Port of noviq-cmdb-health
(skill v1.1.0). Instance-wide, run-keyed, no `result` — the `ai_agents`
template. Three script includes, all generated or parity-tested:
- **`IscanCmdbHealthCatalog`** — the 49-check catalog as a JS literal,
  GENERATED by `scripts/gen-cmdb-catalog.py` from `check_catalog.json`. Do not
  hand-edit; the parity test deep-equals it against the upstream JSON.
- **`IscanCmdbHealthScanner`** — GENERATED by `scripts/gen-cmdb-scanner.py`,
  which splices the collector's 49 check bodies (lines 142–760) **verbatim** and
  applies 11 named, match-count-asserted patches for scoped execution. Change the
  generator's patch list, never the output. Scoped changes: CFG → the
  `x_nold_iscan.cmdb_health.*` properties (snapshotted into `meta.config`);
  `TableUtils` → `GlideTableHierarchy` (scoped; `getAllExtensions()` includes the
  base per `c_GlideTableHierarchyScopedAPI.md`); returns the object instead of
  `gs.print`; `addHaving()` only when it works — it is in the GLOBAL
  `c_GlideAggregateAPI.md` but has **no match in `c_GlideAggregateScopedAPI.md`**,
  so FD-03/CI-10 fall back to filtering `COUNT > 1` in the loop; the
  `service_offering` id sets are now capped at `max_iterate` (the collector left
  them unbounded). **Access handling:** `collect()` shadows `GlideRecord` and
  `GlideAggregate` with guarded factories (the real constructors are captured in
  `initialize()` because a `var` in `collect()` is hoisted over the whole
  function), so all ~30 direct construction sites in the spliced bodies get a
  `canRead()` gate without editing one check body; `count()`/`samples()` also
  check `getLastErrorMessage()` for the cross-scope-denial signature reused from
  `IscanTableScanner`. A denial becomes `NOT ASSESSED: access denied to <table>`
  and is listed in `accessGaps` — never a zero count. **There is NO
  `sys_scope_privilege` auto-creation** (the porting prompt assumed one existed;
  it does not, and "Later addition #5" deliberately rejected building it).
- **`IscanCmdbHealthScorer`** — port of `score_results.py`. **Pure JS, no Glide
  calls — keep it that way**: it is what lets `tests/cmdb-health-scorer.parity.mjs`
  run the real SI file under Node. Two Python semantics the port depends on:
  `round()` is banker's rounding (`pyRound`), and `format(x, '.1f')` rounds exact
  binary ties to even (`fixedN`). The first `fixed1` detected ties via `x * 10`,
  which turns 12.35 (really 12.3499…) into a false tie at exactly 123.5 — the
  parity test caught it. Ties are now detected from `toFixed(20)`'s exact digits.

*Parity test* — `npm run test:cmdb-parity` (Node only, no instance, no new
dependency; NOT an ATF test). Fixtures, the reference `score_results.py` and the
catalog are snapshotted in `tests/fixtures/cmdb-health/`; `golden.json` comes
from running the REAL Python scorer end to end (`scripts/gen-cmdb-golden.py`
parses its markdown — it never re-implements scoring). 34 checks: the literal
acceptance numbers (67 / 17 / 65; 35 / 42 / 36 scored), every per-check status,
worst-first order, measure strings, theme scores, stage labels incl. the anchor
override, unknown IDs, and the full markdown report **byte for byte**.

*Tables* — `x_nold_iscan_cmdb_check` (one row per catalog check per run, all 49
always, `status` = `fail|warn|pass|n_a|not_assessed`) and
`x_nold_iscan_cmdb_summary` (one row per run: score, counts, theme/stage/
population/inventory/meta as JSON text in StringColumns, `access_gaps`,
`llm_context`). Read/create ACLs for the scanner role; explicit related lists on
the Run form (positions 3 and 4) because its custom `sys_ui_section` suppresses
defaults. Properties: `cmdb_health.stale_days` 90, `.ticket_window_days` 90,
`.sample_size` 5, `.max_iterate` 200000, `.expected_ba_as_rel` `Consumes::Consumed
by`, `.system_users` `fresh,system,glide.maint,maint`, plus
`include_cmdb_health_on_full_scan` (false). Full-scan inclusion is an add-on: its
own failure is logged as a finding and does NOT fail the Full scan.

*Report* — `IscanReportGenerator._buildCmdbHealthHtml()` renders in the scorer's
markdown order and reuses the scorer's `order()`/`formatMeasure()`/`kbLinks()`
(one implementation, parity-tested); `pct` is recomputed from count/total so a
decimal-column rounding step can never shift a displayed figure. The whole
section sits in a `word-break`/`overflow-wrap` wrapper: the "Where:" lines carry
unspaced encoded queries and `_reportStyles()` only wraps inside table cells —
they ran off A4 until that (same class as the 2026-07-29 table fix). Narrative
(executive interpretation, root-cause clusters, roadmap waves) is deliberately
not generated.

*LLM export* — "Copy CMDB Health LLM Context" is a CLIENT-side action on the
**CMDB Health Summary** form, reusing `CopyLlmContext.client.js` unchanged (both
tables call the field `llm_context`). Not on the Run form: that form has a custom
`sys_ui_section`, so a new field would not render and `g_form.getValue()` would
return ''. A server-side action can't write the clipboard at all. The context is
built at scan time: a task brief + `report_template.md` + SKILL.md's Interpret /
Recommend / Deliver / Expert judgments / Safety sections, copied verbatim, then
`toMarkdown()` (byte-identical to the Python scorer).

*Heuristics carried over from SKILL.md — label them as such in any output:*
RL-01 / RL-03 (custom vs. modified relationship types) and CI-05 (relabelled
status choices) rely on creator names (`system_users`) and a base-name list —
confirm against a PDI of the same family before remediating; the fixture
`demo_instance_results.json` itself shows RL-03 not assessed as a v1.0 heuristic
false positive. RL-09's expected Business App → App Service type is ambiguous
(`Consumes::Consumed by` per KB0831503, `Uses::Used by` in the CSDM 5 figure) —
report the distribution, don't mass-change.

**Verify before go-live** (append to the existing list): Script Actions really
run as System on the target release; dot-walked encoded queries from scope
(`parent.sys_class_nameIN…`, `model_id.sys_class_name!=…`,
`cmdb_ci.sys_class_nameIN…`, `parent.sys_idISEMPTY`); whether scoped
`addHaving()` works (the fallback covers it either way); `gs.getProperty` of the
global `instance_name`/`glide.buildtag` from scope (meta only, degrades to '');
and **collector parity** — run the original `cmdb_health_collector.js` in
Scripts - Background (global) and the new mode on the same data, then compare
check IDs, counts and statuses (a difference is acceptable only as
`not_assessed` with a reason).

**Console v6 (2026-09-28): right-side "New scan" drawer + Mosaic-direction
visual pass.** Two independent changes, zero logic touched outside them.

*New-scan drawer.* Clicking "+ New" anywhere in the console (Dashboard's
recent-runs list, the Scan Runs and Scan Results tables) used to hard-navigate
to `/x_nold_iscan_run.do?sys_id=-1`. It now opens
`src/client/components/NewScanPanel.tsx`, a right-side slide-in panel built on
the existing `Dialog.tsx` (new `variant="drawer"` prop — same focus-trap/Esc/
backdrop-click/restore-focus behaviour Dialog already had, just a different
panel shape: full height, pinned to the right edge, `iscan-drawer-in` slide
animation guarded by `prefers-reduced-motion`). The panel picks a scan mode
from 7 radio tiles (one-line description each; Full and CMDB & CSDM Health
carry a "background · admin only" badge, wording lifted from ScanLauncher's
own note — the SERVER still decides sync/queued/403, this is purely honest
labelling) and, for Manual — App / Manual — Single Table, a debounced
typeahead (`TableService.searchRecords`, new — `nameLIKE`/`labelLIKE` against
`sys_app`/`sys_db_object`, OR-joined via `^OR` when given several like-fields)
with multi-select chips (apps) or a single chip (table). Client-side
validation mirrors `IscanRunScanApi.server.js`'s own checks (manual needs
≥1 app, single_table needs a table) so a bad request never reaches the
network — the server still re-validates. Submission calls the EXACT same
`ScanService.startScan(mode, appIds, targetTable)` ScanLauncher already used;
nothing about the REST payload, response handling, toast wording, or
navigate-to-the-new-run's-detail-view behaviour changed — `app.tsx`'s
`newRun` callback just flips `newScanOpen` state instead of setting
`window.location.href`. ScanLauncher's one-click buttons and its "pick target
on form" deep-links were left exactly as they were (nothing they could do
before is now unreachable) — the drawer is an additional, more integrated
path to the same endpoint, and the drawer itself keeps an "Open platform form
instead" link for parity. No file under `src/server` or `src/fluent` changed.

*Mosaic-direction visual pass.* Inspiration was cruip.com/mosaic (grouped
sidebar nav, slim header, dense clean cards, indigo accent) — ported as
layout/spacing/hierarchy direction, no code copied, no new dependency, no CDN
(the existing Google Fonts `<link>` in index.html is still the only external
resource). Three concrete changes: (1) `SideNav.tsx` rebuilt around grouped
sections (Overview / Scans / Governance) with a collapse-to-icon-only toggle,
replacing the old single-sliding-pill active-indicator (`ITEM_STEP`, a
hardcoded pixel-step calculation that assumed a flat item list — grouping
breaks that assumption, so the indicator is now a plain per-item background +
left accent bar that stays correct regardless of how many group labels sit
above an item). Collapse state is mirrored onto
`document.documentElement`'s `data-nav-collapsed` attribute (same pattern
`utils/theme.ts` already uses for `data-theme`) so the shell's grid column
width (`--iscan-nav-width`, 230px expanded / 72px collapsed) can react without
threading state through `app.tsx`; persisted to `localStorage`
(`iscan-nav-collapsed`), wrapped in try/catch like the theme toggle. (2) The
decorative aurora wash/blobs (`.iscan-shell`'s background gradient,
`.iscan-main::before/::after`) had their opacity roughly halved — Mosaic's own
look is closer to flat/clean than the previous glass-heavy treatment, and
this keeps the existing oklch token architecture, dark mode, and every
accessibility guard intact rather than ripping out the material system. (3)
New drawer/mode-tile/chip/search-result styles added following the same
rules as everything else in `app.css`: zero hardcoded colors (every color a
`--snx-*` token), `.iscan-modetile` transition covered in the
`prefers-reduced-motion` block, drawer animation covered in the same block
plus its own `@keyframes`. The `--snx-*` two-theme oklch palette itself
(hue 265, already indigo/violet) was NOT re-hued — it already matched the
brief's "soft indigo/violet accent" direction, so re-deriving a new palette
would have been change for its own sake.

*Verified with a local render harness* (the built bundle served over
`python3 -m http.server`, `window.g_ck`/`window.fetch` stubbed with
realistic row shapes for `/api/now/table/*`, `/api/now/stats/*`, and the
scan-run POST endpoint; screenshotted headless via `playwright-core` +
the Chrome under `~/.cache/puppeteer/`, harness files under
`/tmp/claude-1000/iscan-harness`, not the repo): dashboard, scan runs, and
scan results at 1440×900 and 400×850 in both light and dark
(`data-theme` set directly, not via the toggle button — the "Light mode"
label text in the dark screenshots is a harness artifact of that shortcut,
not an app bug), plus the new-scan drawer with Manual — App selected at
1440×900 light. All render correctly: grouped/collapsible sidebar, dense
tables scrolling inside their own container (never the page body) down to
400px wide, dark-mode contrast holding, drawer sliding in with working
mode-tile selection and client-side validation. `npm run build` is clean (0
errors/0 warnings, TypeScript type check passes); the generated
`sys_ui_page_*.xml` still has exactly 1 CDATA section and 0 split-escapes.
**Not verified — no real ServiceNow instance available:** the sys_app/
sys_db_object typeahead against real data (stubbed in the harness), the
actual POST response shapes for `queued`/`error` states inside the drawer's
toast wording, and rendering inside the real Polaris iframe (the harness
serves the page standalone, not inside `x_nold_iscan_console.do`'s actual
UI Page frame).

*Console v6 follow-up (2026-09-28): the base-element reset had been zeroing
component padding.* `.iscan-shell nav/section/header/...{padding:0}` has
specificity (0,1,1), which beats every single-class rule (`.iscan-nav`,
`.iscan-panel`, 0,1,0) - so the rail and every panel rendered with NO inner
padding, in every version before this. The reset is now wrapped in `:where()`
(zero specificity). Keep it that way; if a component's padding "does nothing",
check for element-qualified selectors first. The rail is also capped at
`calc(100vh - 6.5rem)` so its footer (collapse + theme toggle) stays in view,
and the Collapse button is hidden under 768px. Harness gotcha: the harness
serves its OWN copy of `app.css` - re-copy it after every CSS edit, or the
screenshots show stale styles (the v6 agent's first shots did).

**Console v6, full Mosaic pass (2026-09-28): the whole shell, not just the
sidebar.** Second request from the user after the drawer + partial pass above
landed — this covers the rest of cruip.com/mosaic's direction. Zero logic
changed; no `src/server`/`src/fluent` edits; no new npm dependency; no CDN.

*Shell restructure — one brand, one header.* The rail previously duplicated
its own "Instance Scan Console" brand as a second, large page-level `<h1>` in
a separate header row spanning both grid columns above everything. Now
`.iscan-nav` is explicitly placed `grid-column: 1; grid-row: 1 / -1` in
`app.css`, so it runs the FULL height of the page from the very top (brand at
its own top, nothing above it) — CSS Grid places explicitly-positioned items
first regardless of DOM order, then auto-places the rest into whatever cells
remain, so `.iscan-header`/`.iscan-main` need no matching declaration of their
own; they simply land in the one remaining column. `app.tsx`'s header is now
a slim bar: breadcrumb + a small per-view `<h1 class="iscan-header__title">`
(19px, not 28px) + one-line description on the left, "+ New" and the theme
toggle on the right. The theme toggle moved out of `SideNav`'s footer
entirely into a new self-contained `ThemeToggle` component
(`components/ui.tsx`, owns its own `useTheme()` call) so it renders in the
header instead — `SideNav.tsx` no longer imports `useTheme` at all, and its
footer now holds only the collapse button. At the 768px breakpoint,
`.iscan-nav`'s span is cancelled back to `grid-column/row: auto` — a
single-column grid would otherwise force the rail across both explicit rows
and push header/main into new implicit rows below it, instead of the plain
top-to-bottom stack that breakpoint wants.

*KPI tiles gained a real proportion bar, not a fake trend.* `MetricTile`
takes an optional `proportion` (0..1), rendered as a thin `.iscan-tile__bar`
track + coloured fill under the number. Wired up ONLY on `Dashboard.tsx`'s 4
"Run activity" tiles (Complete/In flight/Errored, each against `metrics.runs`
as the total) — the one place this app has a real total to compare a count
against. Deliberately NOT added to `ResultSummary`'s 41 per-result count
tiles: there is no meaningful "total" to divide any one of those counts by,
and no stored time series anywhere in this schema to draw an actual
sparkline from — inventing one would violate the "don't fabricate trends"
constraint. If a real historical series is ever stored, a sparkline can reuse
the same `.iscan-tile__bar` slot; until then a proportion-of-total bar is the
honest version of the same idea.

*Tables, Mosaic density.* `RecordTable.tsx` gained `isNumericField()` (any
field ending in `_count` — a naming convention already true of every numeric
column in this schema, not a hand-maintained list) applied as
`.iscan-table__num` (right-align + tabular figures) to both the header cell
and body cells; `app.css` added a tinted header band
(`--snx-color-surface-alt` behind `thead th`, not just muted text) and zebra
striping (`tbody tr:nth-child(even)`, placed before the existing `:hover` rule
so hover still wins at equal specificity — same technique the file already
uses elsewhere for cascade ordering). Status is unchanged: it was already a
coloured pill via `statusField`/`statusSeverity`, including the pulsing dot on
Running (`.iscan-status--info::before`) — that already satisfied the "animated
status dot for Running" ask from the first pass. Mode/app/table columns stay
plain text or a real link, per the brief.

*Card header row.* `.iscan-panel__toolbar` (already the title+actions row on
every panel/table/detail view — no JSX changed) gained a bottom hairline plus
a touch more bottom margin, so the header reads as visually separated from the
card body; a second toolbar in the same panel (RecordTable's pagination
footer) gets a top hairline instead via `.iscan-panel__toolbar ~
.iscan-panel__toolbar`, so it reads as a footer, not another header. Panel
padding itself grew from `--snx-space-inner` (0.75rem, still used for
internal row/gap spacing everywhere) to a dedicated 1.25rem card padding, only
on `.iscan-panel` — Mosaic's own cards give the edge more room than a list
row needs.

*Scan launcher, detail view, preview modal, toasts — already the same
language, no JSX touched.* `ScanLauncher.tsx`'s one-click buttons and
secondary form-deep-link buttons already used `.iscan-btn--primary`/
`--secondary`; `RecordDetail`/`RecordFields`/`RecordPreviewModal`/`toast.tsx`
already rendered through the same `.iscan-panel`/`.iscan-fields`/
`.iscan-dialog`/`.iscan-toast` classes app.css owns. The "bring to the same
visual language" ask for these was therefore a CSS-only exercise (card
padding, header-row hairline, table density) that reached them automatically
— confirmed in the run-detail and toast screenshots without editing those
components.

*Motion, ported dependency-free.* Three additions, all guarded under
`prefers-reduced-motion`: (1) `ui.tsx`'s new `Skeleton` component — a
reactbits-style shimmer (`background-position` sweep on a gradient, no
library) with `lines` bars at decreasing widths, replacing `RecordTable`'s
loading-state `Spinner` (its per-row `Spinner` uses elsewhere are unchanged —
this is only the "a whole list is loading" case); reduced motion leaves the
bars visible but static. (2) `.iscan-btn:active` gets a `scale(0.97)` press
"squash", a uiverse-style button-feedback pattern ported as a plain
transform; disabled under reduced motion via the existing `.iscan-btn`
transition-none rule (already present from the first pass). (3) The KPI
proportion bar's fill transitions its width in on mount/update
(`inline-size` 480ms ease-out); reduced motion drops straight to the final
width. Card hover-lift (tiles) and the drawer's slide-in were both already
built and guarded in the first pass — nothing new needed there.

*Verified* by rebuilding (`npm run build`: 0 errors/0 warnings, TypeScript
clean) and re-syncing the harness's OWN copies of `app.css`/`main.jsdbx` into
`/tmp/claude-1000/iscan-harness/static/` before reshooting (see the
follow-up note above — this bit the first v6 pass). Generated
`sys_ui_page_*.xml`: still exactly 1 CDATA, 0 split-escapes. 19 screenshots
at 1440×900 and 400×850, light and dark, covering dashboard/runs/results/
detail/new-panel (new-panel: desktop light+dark and mobile, per spec) — all
in `/tmp/claude-1000/iscan-harness/shots/`. One harness fidelity fix along
the way: the stub's `RUNS` fixture originally gave `status` the SAME string
for both `value` and `display_value` ('Complete' instead of
`{value:'complete', display_value:'Complete'}`), which silently defeated
`runStatusSeverity()`'s lookup and rendered plain text instead of a pill in
the screenshots — fixed in the harness fixture only, `severity.ts` itself was
never the bug. **Not verified — no real instance:** actual sys_app/
sys_db_object typeahead results, and rendering inside the real Polaris
iframe.
