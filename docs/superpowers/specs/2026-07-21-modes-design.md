# Sub-spec 1: Modes — design

Part of the instance-assessment extension to sn-instance-scan, sequenced
as **Modes → Counting → Cross-refs → Report** (see the "Planned:
instance-assessment extension" section of `CLAUDE.md`). This spec covers
Modes only. Rejected alternatives and the reasoning behind each decision
below are logged in `docs/future-schema-ideas.md` — this document states
the decisions themselves; that one states why the roads not taken lost.

## Goal

Redefine the app's scan-scope selection from 3 modes to 4:

- **Full** — every application/scope on the instance. (Already true of
  the existing implementation — `IscanAppSelector.getFullScanApps()`
  already queries all of `sys_app` with no restriction. No change needed
  here.)
- **Custom Apps Only** — relabel of the existing `custom_only` mode. No
  behavior change.
- **Manual — App** — relabel of the existing `manual` mode. Gains a
  primary single-app reference-field picker (`target_app`) alongside the
  existing multi-app `manual_app_list` string field, which is kept for
  the programmatic/ATF API.
- **Manual — Single Table** (new) — user picks one table via a
  reference field (`target_table`); scan targets that table's owning
  app when resolvable, or just that table when it isn't.

## 1. Schema changes (`x_nold_iscan_run`)

- `scan_mode` `ChoiceColumn` gains a 4th value: `single_table` (label
  "Manual — Single Table", sequence 3). `manual`'s label becomes "Manual
  — App".
- New `target_app` — `ReferenceColumn` to `sys_app`, no qualifier.
  Primary picker for Manual — App mode.
- New `target_table` — `ReferenceColumn` to `sys_db_object`, no
  qualifier. Picker for Manual — Single Table mode. No qualifier because
  the mode's whole value is being able to point at any table, including
  OOB ones (`incident`, `sys_user`) — restricting the picker to
  custom-app-owned tables would contradict that.
- `manual_app_list` (existing `StringColumn`, comma-separated sys_ids)
  is kept, unchanged — still how the programmatic/ATF API
  (`runScan('manual', [id1, id2])`) does multi-app scans. When both
  `target_app` and `manual_app_list` are populated, `target_app` wins.

## 2. Orchestrator data flow

### Manual — App precedence (`target_app` vs `manual_app_list`)

Resolved entirely in `RunScanUiAction.server.js`, not in the
orchestrator or `IscanAppSelector` — the UI Action script is the one
place with `current`'s in-memory, not-yet-committed form values, and
it's the existing pattern (`scanMode`/`manualAppListRaw` are already
read there today). `IscanAppSelector.getManualApps()` is untouched: it
still just validates/resolves whatever plain sys_app-id array it's
handed.

```js
var targetAppId = current.getValue('target_app')
var manualAppList = targetAppId
    ? [targetAppId]
    : (manualAppListRaw ? manualAppListRaw.split(',') : [])
```

The existing "manual mode requires a list" guard becomes: abort only
when scan_mode is `manual` AND neither `target_app` nor
`manual_app_list` is set.

`runScan()` (the programmatic/no-form-record path) is unaffected —
`target_app` is UI-only.

### Orchestrator signature change

`runScanForRecord`, `runScan`, and `_resolveAppList` each gain a 4th
positional parameter, `targetTableSysId` (undefined/unused by the 3
existing modes). Chosen over a bigger options-object refactor to keep
this sub-spec's diff small; revisit if a 5th input is ever needed (see
`docs/future-schema-ideas.md`).

### Single Table mode resolution

New `IscanScanOrchestrator._resolveSingleTableApp(targetTableSysId)`,
called from a new `case 'single_table'` in `_resolveAppList`:

```js
_resolveSingleTableApp: function (targetTableSysId) {
    if (!targetTableSysId) {
        throw new Error('single_table scan mode requires target_table to be set.')
    }
    var db = new GlideRecord('sys_db_object')
    if (!db.get(targetTableSysId)) {
        throw new Error('sys_db_object not found for target_table sys_id: ' + targetTableSysId)
    }
    var scopeSysId = db.getValue('sys_scope')
    var app = new GlideRecord('sys_app')
    if (scopeSysId && app.get(scopeSysId)) {
        // Owning scope has a real sys_app record — run the full existing
        // per-app tally, same pipeline as manual mode. The picked table
        // is guaranteed to appear in getOwnedTables(scopeSysId) since
        // it's owned by that same scope.
        return [scopeSysId]
    }
    // No sys_app record for this scope (global/OOB case) — signal the
    // table-only fallback distinctly; see _scanOneTable below.
    return this._singleTableFallback(db)
}
```

This lives on `IscanScanOrchestrator`, not `IscanAppSelector` — unlike
the other 3 modes it doesn't always resolve to a plain `sys_app`-id
array, and `IscanAppSelector`'s contract is strictly "resolve to sys_app
ids." The no-app branch needs a different downstream path entirely (see
below), which is cleanest handled once, where `_scanOneApp`'s per-item
logic already lives.

### No-owning-app fallback: `_scanOneTable`

`_executeRun` branches once at the top on whether resolution produced a
plain app-id array (existing loop, unchanged) or the table-only signal.
In the table-only case, a new `_scanOneTable(run, tableName)` runs
instead of the `_scanOneApp` loop:

- Calls `this.tableScanner.profileTable(tableName)` directly (single
  table, not `getOwnedTables` + loop).
- Skips `_findIntegrations` — that's scope-keyed, meaningless for a bare
  table with no owning app.
- **Writes no `x_nold_iscan_result`/`x_nold_iscan_table` row** —
  `x_nold_iscan_result.app` stays a mandatory `sys_app` reference and
  is not being relaxed (see `docs/future-schema-ideas.md`), so there's no
  valid destination for a queryable result row in this case. Instead,
  the table's profile (fields, row count, reference fields) is written
  into `run.activities`/`run.comments` via the existing
  `_appendActivity()` — visible on the run form, not queryable via the
  result tables.

This means: picking a table owned by a custom app produces a full,
queryable result exactly like Manual — App mode does today. Picking an
OOB table (e.g. `incident`) produces a log-visible-only profile, by
design — not a bug, not a partial implementation.

## 3. `profileTable()` change

`IscanTableScanner.profileTable()` and `_getAppAddedFields()` drop their
`appScopeSysId` parameter entirely (not kept-but-unused — an unused
parameter here would need its own lint suppression for no benefit, and
would misleadingly imply scope-awareness that no longer exists):

```js
_getAppAddedFields: function(tableName) {
    var fields = [];
    var dict = new GlideRecord('sys_dictionary');
    dict.addQuery('name', tableName);
    dict.addNotNullQuery('element');
    dict.query();
    while (dict.next()) {
        fields.push({
            name: dict.getValue('element'),
            internal_type: dict.getValue('internal_type'),
            reference: dict.getValue('reference')
        });
    }
    return fields;
},

profileTable: function(tableName) {
    gs.info('IscanTableScanner.profileTable: profiling table=' + tableName)
    var rowCount = this._countRows(tableName)
    var fields = this._getAppAddedFields(tableName)
    // ...unchanged reference_fields derivation below
}
```

This returns the table's **complete** field list (not just fields added
by the owning app) — a deliberate change affecting `field_count`/
`reference_field_list` for **all 4 modes**, not just Single Table. It
also removes the need for a second, unscoped field-listing method when
the Cross-refs sub-spec (3) needs the same complete field list
instance-wide.

**Only caller affected**: `IscanScanOrchestrator._profileOwnedTables()`
drops the second argument from its `profileTable()` call
(`this.tableScanner.profileTable(tables[i].name)`), but keeps its own
`appScopeSysId` parameter — still needed for `getOwnedTables()`, which
is unaffected by this change. No other script include touches field
capture directly; `IscanAppFilesScanner`, `IscanSummaryGenerator`, and
`IscanReportGenerator` all consume already-profiled `tables[i].fields`
output, not the scanner internals.

## 4. ACL implications

**No new ACLs needed.** `target_app` and `target_table` are fields on
`x_nold_iscan_run`, already covered end-to-end by the existing
`runReadAcl`/`runWriteAcl`/`runCreateAcl`. Populating either picker
requires OOB read access to `sys_app`/`sys_db_object`, which this app's
existing design principle already covers ("No ACL in this app grants
broader table access than the user already has... rely entirely on OOB
ACLs and the caller's own access" — `acls.now.ts`).

`canAccessMetadata()`'s table-level `canRead()` gate on
`sys_db_object`/`sys_dictionary` is unaffected by dropping the
`sys_scope` filter — it was never scope-conditional. One instance-
dependent risk, not a blocker: if the target instance has row-level ACL
conditions on `sys_dictionary` (uncommon but possible on hardened
instances), the now-unscoped `profileTable()` could silently under-
report fields on tables outside the caller's own scope even though the
table-level gate passes. Flagged for verification against the real
target instance, alongside the other instance-dependent items already
in `CLAUDE.md` (`sys_app.source`, GenAI Controller API, PDF plugin
name).

## 5. UI wiring

### `RunScanUiAction.server.js`

- Reads `target_app` and `target_table` off `current`.
- Applies the Manual — App precedence logic (section 2).
- New validation branch, mirroring the existing manual-mode guard:
  ```js
  if (scanMode === 'single_table' && !targetTableId) {
      gs.addErrorMessage('Single Table scan mode requires Target Table to be set.')
      current.setAbortAction(true)
      return
  }
  ```
- Passes `targetTableId` through as the orchestrator's 4th argument.

### New UI Policy (this app's first)

Visibility-only, symmetric: `target_app` shown only for Manual — App
mode, `target_table` shown only for Manual — Single Table mode, both
hidden for Full/Custom Apps Only.

This is cosmetic/UX only — it does **not** replace the server-side
mandatory-field checks in `RunScanUiAction.server.js`. UI Policy
conditions aren't re-evaluated on UI-Action-driven or programmatic
changes, per the platform's own documented behavior — exactly the paths
this app relies on (the "Run Scan" button itself, and ATF tests). The
server-side checks remain the authoritative validation; the UI Policy
only makes the form less confusing to look at.

### `tables.now.ts`

Add the `single_table` choice and the `target_app`/`target_table`
`ReferenceColumn`s (section 1). No other form-layout changes are load-
bearing for this sub-spec — no related lists, no changes to the
"Download Report" or "Copy LLM Context" UI Actions.

## Risks / things to verify

1. Row-level `sys_dictionary` ACL conditions on the target instance
   could make unscoped field capture under-report for out-of-scope
   tables (section 4) — verify before go-live.
2. `_resolveAppList`'s signature change ripples into
   `runScanForRecord`/`runScan` — `tests/atf_tests.json` call sites
   should be checked (harmless no-op for the 3 existing modes, since the
   4th param is simply unused, but worth an explicit pass when
   implementing).
3. UI Policy visibility can lag behind `scan_mode` if changed via
   something other than direct user interaction on the form (documented
   platform behavior) — acceptable since it's cosmetic-only, but worth
   knowing so a future debugging session doesn't mistake it for a bug.

## Out of scope for this sub-spec

Artifact-type counting expansion, cross-table/cross-app reference
mapping, and the report generator are separate sub-specs (2, 3, 4) and
not designed here.
