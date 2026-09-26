# sn-instance-scan

## Communication style (caveman mode)
Short sentences. 3-6 words. No filler. Tools run, results shown, stop.

## Session handoff (PREV_SESSION.md)

This project has automated cross-session handoff, wired via hooks in
`.Codex/settings.json` (not memory/AGENTS.md text, since this needs to
fire on an EVENT):
- **PreCompact hook** (both `auto` and `manual` matchers, `agent` type):
  fires right before this session gets compacted (auto-compact near the
  context limit, or manual `/compact`). Overwrites `PREV_SESSION.md` at
  the repo root with a fresh handoff — clears old content first, doesn't
  append — covering what was done, what's outstanding, what's
  built-but-undeployed/uncommitted, and concrete next steps.
- **SessionStart hook** (`command` type): on every session start —
  including `Codex --resume <session-id>` — reads `PREV_SESSION.md` if
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
  `GlideRecord.getRowCount()`.
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

## /caveman

If the user invokes `/caveman`, switch to ultra-concise mode for the
rest of the session per that skill's instructions (short sentences, no
filler, results before narration). It's a communication-style toggle,
not a change to the engineering conventions above.
