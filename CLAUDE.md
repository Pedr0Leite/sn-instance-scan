# sn-instance-scan

ServiceNow **custom scoped** application (scope `x_335329_iscan`,
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

`now.config.json` has `"scope": "x_335329_iscan"`. This is a **scoped**
app, not global — the platform automatically namespaces every table,
role, and property this scope creates, so there's no collision risk with
other apps the way there would be in global scope. This repo still names
everything with the `x_335329_iscan` prefix explicitly (tables:
`x_335329_iscan_run`, `x_335329_iscan_result`, `x_335329_iscan_table`;
role: `x_335329_iscan.scanner`; properties: `x_335329_iscan.*`) to match
what the platform will actually generate — keep doing this for
consistency if you add a new table/role/property. Script include class
names (`IscanAppSelector`, etc.) don't carry the prefix, but their
`apiName` is always `x_335329_iscan.<ClassName>`.

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

**"Download Report" still uses GlideAjax into `IscanReportGenerator`** —
that path is unaffected and still needs all three of the following to
line up, or the client gets an empty answer with no error anywhere:

1. Client calls `new GlideAjax('x_335329_iscan.IscanReportGenerator')`
   — the scope-qualified `apiName`, NOT the bare class name.
2. The SI is `clientCallable: true`, left at the default
   `accessibleFrom: 'package_private'`. Do **not** set `accessibleFrom:
   'public'` — that was tried and reverted. The "Download Report" UI
   Actions, their forms, and this SI are all in `x_335329_iscan`, so
   `package_private` ("callable from the application scope it's within")
   is correct and sufficient. `public` instead makes the platform run a
   `GlidePluginManager.isActive()` check against the caller's scope to
   admit cross-app callers, which fails with `Could not find sys_plugins
   record for x_335329_iscan: no thrown error` for a custom
   in-development app never registered as a store plugin — and GlideAjax
   silently returns nothing. Only reach for `public` if a script include
   genuinely needs to be called from a *different* app's scope.
3. The execute ACL's `name` is also the scope-qualified apiName
   (`x_335329_iscan.IscanReportGenerator`), matching what the platform
   checks for a scoped SI.

Copy this pattern for any *new* GlideAjax entry point — but prefer a
server-side UI Action (like Run Scan) over GlideAjax whenever the caller
is this app's own form and the round trip doesn't need to be
asynchronous; it sidesteps this whole failure class.

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
built a certain way, but this repo's `x_335329_iscan_*` naming is the
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
- `src/fluent/tables.now.ts` — `x_335329_iscan_run`, `x_335329_iscan_result`, `x_335329_iscan_table`
- `src/fluent/roles.now.ts`, `properties.now.ts` — the scanner role, the 3 system properties
- `src/fluent/script-includes.now.ts` — registers the 6 script includes, each `Now.include`-ing its body from `src/server/`
- `src/fluent/acls.now.ts` — record ACLs on the 3 tables + the execute ACL for the 1 client-callable script include (`IscanReportGenerator`)
- `src/fluent/ui-actions.now.ts` — "Run Scan" (server-side, `Now.include`-ing `src/server/RunScanUiAction.server.js`) and 2x "Download Report" + "Copy LLM Context" (client-side, `Now.include`-ing their scripts from `src/client-scripts/`)
- `src/server/*.server.js` — script include bodies: `IscanAppSelector`, `IscanTableScanner`, `IscanAppFilesScanner`, `IscanSummaryGenerator`, `IscanScanOrchestrator` (called directly, server-side, by `RunScanUiAction`), `IscanReportGenerator` (GlideAjax entry point for PDF reports), and `RunScanUiAction` (the "Run Scan" UI Action's server-side script body)
- `src/client-scripts/*.client.js` — the client-side UI Action scripts
  (2x report download, and `CopyLlmContext`) — "Run Scan" has no client script, see above
- `tests/atf_tests.json` — ATF test definitions (mirrors test-plan.md)
- `DEPLOY.md` — `now-sdk` build/install workflow

## Conventions to preserve when editing this code

- **Read-only app.** No script here may write to a scanned table — only
  to `x_335329_iscan_*` tables. This is a hard constraint from the spec,
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
  `x_335329_iscan_result.llm_context` on *every* scan; `summary_text` is
  the optional GenAI paragraph. Only `summary_text` depends on the GenAI
  Controller being available — never make `llm_context` conditional on
  it. `generate()` truncates its own input via
  `x_335329_iscan.genai_max_input_chars`; the persisted `llm_context`
  always stays full-length. On the fallback path the data-model section
  is *omitted with an explanation*, never zero-filled — a reader seeing
  "0 tables" would wrongly conclude the app has none.
- **`activities` and `comments` are both written** by
  `_appendActivity()`, deliberately. `activities` (String) is the
  queryable log; `comments` (Journal, via `GenericColumn` with
  `columnType: 'journal_input'`) feeds the native Activity formatter,
  which only renders Journal fields. Use `setValue()` — `setJournalEntry()`
  exists only in the *global* GlideElement API, not the scoped one.
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
  on `x_335329_iscan_run` and create on result/table-profile tables
  (see `acls.now.ts`). The orchestrator throws a descriptive error when
  `update()`/`insert()` come back null (ACL denial) instead of scanning
  silently into nothing; keep that pattern for new writes.
- Instance-version-dependent bits (`sys_app.source` field behavior, the
  exact Generative AI Controller API, the PDF Generation Utilities
  plugin name) are flagged inline in code comments and in `DEPLOY.md` —
  verify against the real target instance before go-live, don't assume.

## Planned: instance-assessment extension (in design)

Being brainstormed as of 2026-07-21, sequenced as 4 sub-specs: **Modes →
Counting → Cross-refs → Report**. Roads-not-taken and schema
alternatives for each sub-spec are logged in `docs/future-schema-ideas.md`
as they're decided — check there before re-proposing an option that was
already considered and rejected.

**Modes (sub-spec 1, schema decided so far):**
- `x_335329_iscan_run.scan_mode` gains a 4th value: `single_table`
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
  tally against `x_335329_iscan_result.app` (mandatory reference to
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

**Modes (sub-spec 1, orchestrator/ACL/UI wiring, decided so far):**
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
  lookup at all) and, since `x_335329_iscan_result.app` stays mandatory
  and isn't being relaxed, writes NO `x_335329_iscan_result`/
  `x_335329_iscan_table` row for this case — the profile data (fields,
  row count, references) is written into `run.activities`/`comments`
  only, visible on the run form but not queryable via the result
  tables.
- New UI Policy (this app's first) on `x_335329_iscan_run`: symmetric
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

## /caveman

If the user invokes `/caveman`, switch to ultra-concise mode for the
rest of the session per that skill's instructions (short sentences, no
filler, results before narration). It's a communication-style toggle,
not a change to the engineering conventions above.
