# Modes (Sub-spec 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend sn-instance-scan's 3 scan modes to 4 — relabel Full/Custom/Manual, add a new "Manual — Single Table" mode — per the approved design at `docs/superpowers/specs/2026-07-21-modes-design.md`.

**Architecture:** Schema additions on `x_335329_iscan_run` (a 4th `scan_mode` choice, two new reference fields), an unscoped `profileTable()` used by all 4 modes, a new orchestrator resolution path for the single-table mode (reusing the existing per-app pipeline when the picked table's owning scope has a `sys_app` record, falling back to a log-only table profile when it doesn't), and a UI Action + UI Policy update to wire the new fields into the form.

**Tech Stack:** ServiceNow SDK (`@servicenow/sdk` 4.8.1) + ServiceNow Fluent (`.now.ts`), plain server-side JS script include bodies, `now-sdk build` for compile validation.

## Global Constraints

- Read-only app: no script may write to a scanned table, only to `x_335329_iscan_*` tables (`CLAUDE.md`).
- No elevated privilege: every table/dictionary query runs under the caller's own access; `canAccessMetadata()` is a deterministic `canRead()` gate checked BEFORE querying, never a try/catch fallback (`CLAUDE.md`).
- `GlideAggregate` for row counts, never `GlideRecord.getRowCount()`.
- No hardcoded sys_ids; instance-specific config goes through `gs.getProperty()`.
- This app has no local unit-test runner — `tests/atf_tests.json` (ATF-style descriptions, run on a real instance) is this project's only test artifact, and `npm run build` (now-sdk's Fluent→instance-artifact compiler) is the only automated local check. Each task's "run the test" step means `npm run build` unless stated otherwise; ATF entries are added/updated as plain-text descriptions, not executed locally.
- `manual_app_list` (legacy multi-app string field) is kept, not removed — see `docs/future-schema-ideas.md`.
- `x_335329_iscan_result.app` stays a mandatory `sys_app` reference — not being relaxed in this sub-spec.

---

### Task 1: Schema — `scan_mode` choice, `target_app`, `target_table`

**Files:**
- Modify: `src/fluent/tables.now.ts:16-90` (the `x_335329_iscan_run` Table definition)

**Interfaces:**
- Produces: `x_335329_iscan_run.scan_mode` choice `single_table` (label "Manual — Single Table"); `x_335329_iscan_run.target_app` (`ReferenceColumn` → `sys_app`); `x_335329_iscan_run.target_table` (`ReferenceColumn` → `sys_db_object`). Later tasks (3, 5) read these by these exact field names via `current.getValue('target_app')` / `current.getValue('target_table')`.

- [ ] **Step 1: Edit the `scan_mode` choice list and add the two reference columns**

In `src/fluent/tables.now.ts`, replace:

```typescript
        scan_mode: ChoiceColumn({
            label: 'Scan Mode',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            choices: {
                full: { label: 'Full', sequence: 0 },
                custom_only: { label: 'Custom Only', sequence: 1 },
                manual: { label: 'Manual', sequence: 2 },
            },
        }),
```

with:

```typescript
        scan_mode: ChoiceColumn({
            label: 'Scan Mode',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            choices: {
                full: { label: 'Full', sequence: 0 },
                custom_only: { label: 'Custom Only', sequence: 1 },
                manual: { label: 'Manual — App', sequence: 2 },
                single_table: { label: 'Manual — Single Table', sequence: 3 },
            },
        }),
```

Then, immediately after the `manual_app_list` column (still inside the `schema` object, before the `activities` column), add:

```typescript
        // Primary picker for Manual — App mode. Takes precedence over
        // manual_app_list (the legacy multi-app string field, kept for
        // the programmatic/ATF API) when both are set — see
        // RunScanUiAction.server.js.
        target_app: ReferenceColumn({
            label: 'Target App',
            referenceTable: 'sys_app',
        }),
        // Picker for Manual — Single Table mode. No reference qualifier:
        // this mode's value is being able to point at ANY table,
        // including OOB ones (incident, sys_user) with no owning
        // sys_app record — see IscanScanOrchestrator._resolveSingleTableApp.
        target_table: ReferenceColumn({
            label: 'Target Table',
            referenceTable: 'sys_db_object',
        }),
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 3: Commit**

```bash
git add src/fluent/tables.now.ts
git commit -m "Add single_table scan mode and target_app/target_table fields"
```

---

### Task 2: UI Policy — field visibility by scan mode

**Files:**
- Create: `src/fluent/ui-policies.now.ts`

**Interfaces:**
- Consumes: `x_335329_iscan_run.scan_mode`, `.target_app`, `.target_table` (Task 1).
- Produces: nothing consumed by later tasks — this is presentation-only, additive.

- [ ] **Step 1: Write the two UI Policies**

This app has no UI Policies yet, so this is a new file. Per the platform's documented behavior, UI Policy `conditions` are NOT re-evaluated on UI-Action-driven or programmatic changes — this is why the actual mandatory-field validation for `single_table`/`manual` stays server-side in `RunScanUiAction.server.js` (Task 5). These two policies are cosmetic-only: they hide the picker that isn't relevant to the selected mode so the form doesn't show three unrelated app/table pickers at once.

```typescript
import { UiPolicy, default_view } from '@servicenow/sdk/core'

export const manualAppVisibilityPolicy = UiPolicy({
    $id: Now.ID['manual_app_visibility_policy'],
    table: 'x_335329_iscan_run',
    shortDescription: 'Show Target App only for Manual — App scan mode',
    active: true,
    onLoad: true,
    reverseIfFalse: true,
    conditions: 'scan_mode=manual',
    view: default_view,
    actions: [
        {
            field: 'target_app',
            visible: true,
        },
    ],
})

export const singleTableVisibilityPolicy = UiPolicy({
    $id: Now.ID['single_table_visibility_policy'],
    table: 'x_335329_iscan_run',
    shortDescription: 'Show Target Table only for Manual — Single Table scan mode',
    active: true,
    onLoad: true,
    reverseIfFalse: true,
    conditions: 'scan_mode=single_table',
    view: default_view,
    actions: [
        {
            field: 'target_table',
            visible: true,
        },
    ],
})
```

Two separate policies (rather than one combined policy toggling both fields) because each one's condition and action pair independently — `reverseIfFalse: true` on `manualAppVisibilityPolicy` hides `target_app` whenever `scan_mode != manual` (covering `full`, `custom_only`, AND `single_table` in one rule), and symmetrically for `singleTableVisibilityPolicy`. Combining them into one policy would require a more complex conditions expression for no behavioral gain.

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 3: Commit**

```bash
git add src/fluent/ui-policies.now.ts
git commit -m "Add UI Policy to show target_app/target_table by scan mode"
```

---

### Task 3: `IscanTableScanner.profileTable()` — drop the scope filter

**Files:**
- Modify: `src/server/IscanTableScanner.server.js:62-112`

**Interfaces:**
- Consumes: nothing new.
- Produces: `profileTable(tableName)` — signature loses its 2nd parameter (`appScopeSysId`). Task 4 updates the one caller (`IscanScanOrchestrator._profileOwnedTables`) and adds a new caller (`_scanOneTable`) that relies on this single-argument signature.

- [ ] **Step 1: Update `profileTable` and `_getAppAddedFields`**

In `src/server/IscanTableScanner.server.js`, replace:

```javascript
	/**
	 * Lightweight profile of a single table: row count, app-added fields,
	 * reference fields.
	 * @param {String} tableName
	 * @param {String} appScopeSysId - sys_scope of the app that OWNS this table;
	 *   used to scope the "app-added fields" query. Must be the scanned app's
	 *   scope, NOT gs.getCurrentApplicationId() (that would be this scanner
	 *   app's own scope and match no fields on the scanned table).
	 * @returns {Object} {row_count, fields, reference_fields}
	 */
	profileTable: function(tableName, appScopeSysId) {
		gs.info('IscanTableScanner.profileTable: profiling table=' + tableName + ' scope=' + appScopeSysId);
		var rowCount = this._countRows(tableName);
		var fields = this._getAppAddedFields(tableName, appScopeSysId);
		var referenceFields = [];

		for (var i = 0; i < fields.length; i++) {
			if (fields[i].internal_type === 'reference') {
				referenceFields.push(fields[i].name + '->' + fields[i].reference);
			}
		}

		return {
			row_count: rowCount,
			fields: fields,
			reference_fields: referenceFields
		};
	},
```

with:

```javascript
	/**
	 * Lightweight profile of a single table: row count, complete field
	 * list, reference fields. Deliberately unscoped (no sys_scope filter)
	 * — returns EVERY field on the table, not just ones added by a
	 * particular owning app, so Manual — Single Table mode (which may
	 * point at an OOB table like incident with no single "owning app")
	 * gets a complete picture. This widens field_count/reference_field_list
	 * for all 4 scan modes, not just Single Table — see CLAUDE.md.
	 * @param {String} tableName
	 * @returns {Object} {row_count, fields, reference_fields}
	 */
	profileTable: function(tableName) {
		gs.info('IscanTableScanner.profileTable: profiling table=' + tableName);
		var rowCount = this._countRows(tableName);
		var fields = this._getAppAddedFields(tableName);
		var referenceFields = [];

		for (var i = 0; i < fields.length; i++) {
			if (fields[i].internal_type === 'reference') {
				referenceFields.push(fields[i].name + '->' + fields[i].reference);
			}
		}

		return {
			row_count: rowCount,
			fields: fields,
			reference_fields: referenceFields
		};
	},
```

Then replace:

```javascript
	_getAppAddedFields: function(tableName, appScopeSysId) {
		var fields = [];
		var dict = new GlideRecord('sys_dictionary');
		dict.addQuery('name', tableName);
		// Scope to the app that owns the table, not this scanner app.
		if (appScopeSysId) {
			dict.addQuery('sys_scope', appScopeSysId);
		}
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
```

with:

```javascript
	/**
	 * Every field on tableName, regardless of which scope added it.
	 * @param {String} tableName
	 * @returns {Array} [{name, internal_type, reference}]
	 */
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
```

(The method name `_getAppAddedFields` no longer literally describes what it returns — left as-is rather than renamed, since renaming a private helper is cosmetic churn with no functional benefit for this task; flag it for a rename if it's confusing when Cross-refs (sub-spec 3) revisits this method.)

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully` (this file isn't Fluent metadata, so `now-sdk build` mainly re-validates the whole project still assembles; a JS syntax error here would still surface as a build failure)

- [ ] **Step 3: Commit**

```bash
git add src/server/IscanTableScanner.server.js
git commit -m "Make profileTable() return every field on a table, not just app-added ones"
```

---

### Task 4: Orchestrator — single-table resolution and scan path

**Files:**
- Modify: `src/server/IscanScanOrchestrator.server.js`

**Interfaces:**
- Consumes: `IscanTableScanner.profileTable(tableName)` (Task 3, single-argument signature), `IscanTableScanner.canAccessMetadata()` (existing).
- Produces: `runScanForRecord(runSysId, scanMode, manualAppList, targetTableSysId)` and `runScan(scanMode, manualAppList, targetTableSysId)` — both gain a 4th parameter, used only when `scanMode === 'single_table'`. Task 5 (`RunScanUiAction.server.js`) calls `runScanForRecord` with this 4th argument. `tests/atf_tests.json` (Task 6) describes calls to `runScan` with this 4th argument.

- [ ] **Step 1: Update `_profileOwnedTables` for the new `profileTable` signature**

In `src/server/IscanScanOrchestrator.server.js`, replace:

```javascript
    _profileOwnedTables: function (appScopeSysId) {
        var tables = this.tableScanner.getOwnedTables(appScopeSysId)
        for (var i = 0; i < tables.length; i++) {
            var profile = this.tableScanner.profileTable(tables[i].name, appScopeSysId)
            tables[i].row_count = profile.row_count
            tables[i].fields = profile.fields
            tables[i].reference_fields = profile.reference_fields
        }
        return tables
    },
```

with:

```javascript
    _profileOwnedTables: function (appScopeSysId) {
        var tables = this.tableScanner.getOwnedTables(appScopeSysId)
        for (var i = 0; i < tables.length; i++) {
            var profile = this.tableScanner.profileTable(tables[i].name)
            tables[i].row_count = profile.row_count
            tables[i].fields = profile.fields
            tables[i].reference_fields = profile.reference_fields
        }
        return tables
    },
```

(`_profileOwnedTables` keeps its own `appScopeSysId` parameter — still needed for `getOwnedTables()` — only the inner `profileTable()` call drops the arg.)

- [ ] **Step 2: Add the `single_table` case to `_resolveAppList` and the resolution helpers**

Replace:

```javascript
    _resolveAppList: function (scanMode, manualAppList) {
        switch (scanMode) {
            case 'full':
                return this.appSelector.getFullScanApps()
            case 'custom_only':
                return this.appSelector.getCustomApps()
            case 'manual':
                return this.appSelector.getManualApps(manualAppList)
            default:
                gs.error('IscanScanOrchestrator._resolveAppList: unknown scan_mode: ' + scanMode)
                throw new Error('Unknown scan_mode: ' + scanMode)
        }
    },
```

with:

```javascript
    _resolveAppList: function (scanMode, manualAppList, targetTableSysId) {
        switch (scanMode) {
            case 'full':
                return this.appSelector.getFullScanApps()
            case 'custom_only':
                return this.appSelector.getCustomApps()
            case 'manual':
                return this.appSelector.getManualApps(manualAppList)
            case 'single_table':
                return this._resolveSingleTableApp(targetTableSysId)
            default:
                gs.error('IscanScanOrchestrator._resolveAppList: unknown scan_mode: ' + scanMode)
                throw new Error('Unknown scan_mode: ' + scanMode)
        }
    },

    /**
     * Resolves Manual — Single Table mode's scan target. If the picked
     * table's owning scope has a real sys_app record, returns a
     * single-element app-id array — same shape as every other mode — and
     * the existing per-app pipeline runs unchanged (the picked table is
     * guaranteed to appear in getOwnedTables() since it's owned by that
     * scope). If the scope has no sys_app record (true for `global` and
     * most OOB scopes — e.g. picking `incident` or `sys_user`), there is
     * no sys_app to tally against x_335329_iscan_result.app (mandatory,
     * not being relaxed), so this returns a table-only descriptor instead
     * — see _singleTableFallback / _executeRun / _scanOneTable.
     * @param {String} targetTableSysId - sys_id of a sys_db_object record
     * @returns {Array|Object} sys_app-id array, OR {tableOnly, tableName}
     */
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
            gs.info(
                'IscanScanOrchestrator._resolveSingleTableApp: table=' +
                    db.getValue('name') +
                    ' owned by app=' +
                    app.getValue('name') +
                    ', running full app tally'
            )
            return [scopeSysId]
        }
        gs.info(
            'IscanScanOrchestrator._resolveSingleTableApp: table=' +
                db.getValue('name') +
                ' has no owning sys_app record, falling back to table-only profile'
        )
        return this._singleTableFallback(db)
    },

    _singleTableFallback: function (dbObjectGr) {
        return { tableOnly: true, tableName: dbObjectGr.getValue('name') }
    },
```

- [ ] **Step 3: Branch `_executeRun` on the resolved target shape, and add the table-only path**

Replace:

```javascript
    _executeRun: function (run, appIds) {
        run.setValue('app_count', appIds.length)
        run.setValue('status', 'running')
        if (!run.update()) {
            // update() returns null/empty when the write is ACL-denied.
            // Fail loudly instead of "scanning" into a record nobody can
            // see change — the classic symptom is status stuck on
            // 'pending' with an empty activities log.
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_335329_iscan_run (check the x_335329_iscan.scanner role and its write ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._executeRun: run=' +
                run.getUniqueValue() +
                ' resolved ' +
                appIds.length +
                ' app(s) for scan_mode=' +
                run.getValue('scan_mode')
        )
        this._appendActivity(
            run,
            'Resolved ' + appIds.length + ' app(s) for scan mode "' + run.getValue('scan_mode') + '".'
        )

        try {
            for (var i = 0; i < appIds.length; i++) {
                this._scanOneApp(run, appIds[i])
            }
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeRun: run=' + run.getUniqueValue() + ' completed successfully')
            this._appendActivity(run, 'Scan complete.')
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeRun failed: ' + e.message)
            this._appendActivity(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        run.setValue('completed', new GlideDateTime())
        run.update()
    },
```

with:

```javascript
    _executeRun: function (run, appIdsOrTarget) {
        if (appIdsOrTarget && appIdsOrTarget.tableOnly) {
            return this._executeSingleTableRun(run, appIdsOrTarget.tableName)
        }
        var appIds = appIdsOrTarget

        run.setValue('app_count', appIds.length)
        run.setValue('status', 'running')
        if (!run.update()) {
            // update() returns null/empty when the write is ACL-denied.
            // Fail loudly instead of "scanning" into a record nobody can
            // see change — the classic symptom is status stuck on
            // 'pending' with an empty activities log.
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_335329_iscan_run (check the x_335329_iscan.scanner role and its write ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._executeRun: run=' +
                run.getUniqueValue() +
                ' resolved ' +
                appIds.length +
                ' app(s) for scan_mode=' +
                run.getValue('scan_mode')
        )
        this._appendActivity(
            run,
            'Resolved ' + appIds.length + ' app(s) for scan mode "' + run.getValue('scan_mode') + '".'
        )

        try {
            for (var i = 0; i < appIds.length; i++) {
                this._scanOneApp(run, appIds[i])
            }
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeRun: run=' + run.getUniqueValue() + ' completed successfully')
            this._appendActivity(run, 'Scan complete.')
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeRun failed: ' + e.message)
            this._appendActivity(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        run.setValue('completed', new GlideDateTime())
        run.update()
    },

    /**
     * Single Table mode, no-owning-app case: no x_335329_iscan_result/
     * x_335329_iscan_table row gets written (result.app is a mandatory
     * sys_app reference and there's no sys_app to point it at) — the
     * table's profile goes into the run's activities/comments log only.
     * @param {GlideRecord} run
     * @param {String} tableName
     */
    _executeSingleTableRun: function (run, tableName) {
        run.setValue('app_count', 0)
        run.setValue('status', 'running')
        if (!run.update()) {
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_335329_iscan_run (check the x_335329_iscan.scanner role and its write ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._executeSingleTableRun: run=' +
                run.getUniqueValue() +
                ' table=' +
                tableName +
                ' (no owning sys_app, table-only profile)'
        )
        this._appendActivity(
            run,
            'Table "' +
                tableName +
                '" has no owning application — profiling table only, no result record will be created.'
        )

        try {
            this._scanOneTable(run, tableName)
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeSingleTableRun: run=' + run.getUniqueValue() + ' completed')
            this._appendActivity(run, 'Scan complete.')
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeSingleTableRun failed: ' + e.message)
            this._appendActivity(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        run.setValue('completed', new GlideDateTime())
        run.update()
    },

    /**
     * Profiles a single table with no owning app context. Same
     * canAccessMetadata() gate as the per-app path — checked BEFORE
     * querying, never a try/catch fallback (see CLAUDE.md conventions).
     * @param {GlideRecord} run
     * @param {String} tableName
     */
    _scanOneTable: function (run, tableName) {
        var canAccess = this.tableScanner.canAccessMetadata()
        if (!canAccess) {
            gs.info(
                'IscanScanOrchestrator._scanOneTable: table=' +
                    tableName +
                    ' — caller lacks sys_db_object/sys_dictionary read access, cannot profile'
            )
            this._appendActivity(
                run,
                'Table "' +
                    tableName +
                    '": metadata access unavailable (caller lacks read access to sys_db_object/sys_dictionary) — cannot profile fields or row count.'
            )
            return
        }

        var profile = this.tableScanner.profileTable(tableName)
        gs.info(
            'IscanScanOrchestrator._scanOneTable: table=' +
                tableName +
                ' row_count=' +
                profile.row_count +
                ' field_count=' +
                profile.fields.length
        )
        this._appendActivity(
            run,
            'Table "' +
                tableName +
                '": ' +
                profile.row_count +
                ' row(s), ' +
                profile.fields.length +
                ' field(s), ' +
                profile.reference_fields.length +
                ' reference field(s): ' +
                (profile.reference_fields.length ? profile.reference_fields.join(', ') : 'none')
        )
    },
```

- [ ] **Step 4: Thread `targetTableSysId` through `runScanForRecord` and `runScan`**

Replace:

```javascript
    runScanForRecord: function (runSysId, scanMode, manualAppList) {
        gs.info('IscanScanOrchestrator.runScanForRecord: run=' + runSysId + ', scan_mode=' + scanMode)
        var run = new GlideRecord('x_335329_iscan_run')
        if (!run.get(runSysId)) {
            gs.error('IscanScanOrchestrator.runScanForRecord: no run record found for sys_id: ' + runSysId)
            throw new Error('No x_335329_iscan_run record found for sys_id: ' + runSysId)
        }

        run.setValue('scan_mode', scanMode)
        if (scanMode === 'manual' && manualAppList && manualAppList.length) {
            run.setValue('manual_app_list', manualAppList.join(','))
        }
        run.setValue('started', new GlideDateTime())

        var appIds = this._resolveAppList(scanMode, manualAppList)
        this._executeRun(run, appIds)

        return run.getUniqueValue()
    },
```

with:

```javascript
    runScanForRecord: function (runSysId, scanMode, manualAppList, targetTableSysId) {
        gs.info('IscanScanOrchestrator.runScanForRecord: run=' + runSysId + ', scan_mode=' + scanMode)
        var run = new GlideRecord('x_335329_iscan_run')
        if (!run.get(runSysId)) {
            gs.error('IscanScanOrchestrator.runScanForRecord: no run record found for sys_id: ' + runSysId)
            throw new Error('No x_335329_iscan_run record found for sys_id: ' + runSysId)
        }

        run.setValue('scan_mode', scanMode)
        if (scanMode === 'manual' && manualAppList && manualAppList.length) {
            run.setValue('manual_app_list', manualAppList.join(','))
        }
        if (scanMode === 'single_table' && targetTableSysId) {
            run.setValue('target_table', targetTableSysId)
        }
        run.setValue('started', new GlideDateTime())

        var target = this._resolveAppList(scanMode, manualAppList, targetTableSysId)
        this._executeRun(run, target)

        return run.getUniqueValue()
    },
```

And replace:

```javascript
    runScan: function (scanMode, manualAppList) {
        gs.info('IscanScanOrchestrator.runScan: scan_mode=' + scanMode)
        var run = this._createRun(scanMode, manualAppList)
        var appIds = this._resolveAppList(scanMode, manualAppList)
        this._executeRun(run, appIds)
        return run.getUniqueValue()
    },
```

with:

```javascript
    runScan: function (scanMode, manualAppList, targetTableSysId) {
        gs.info('IscanScanOrchestrator.runScan: scan_mode=' + scanMode)
        var run = this._createRun(scanMode, manualAppList)
        if (scanMode === 'single_table' && targetTableSysId) {
            run.setValue('target_table', targetTableSysId)
            run.update()
        }
        var target = this._resolveAppList(scanMode, manualAppList, targetTableSysId)
        this._executeRun(run, target)
        return run.getUniqueValue()
    },
```

(`runScan`'s `_createRun` already `insert()`s the record before this point, so `target_table` needs its own `run.update()` here — unlike `runScanForRecord`, where `run` hasn't been persisted since the last fetch and a single later `_executeRun`-path `run.update()` covers it.)

Update the JSDoc comments on both methods (currently list only `'full' | 'custom_only' | 'manual'`) to add `| 'single_table'` and document the new parameter — copy this exact wording:

```javascript
     * @param {String} scanMode - 'full' | 'custom_only' | 'manual' | 'single_table'
     * @param {Array} manualAppList - array of sys_app sys_ids, only used
     *   when scanMode === 'manual'
     * @param {String} [targetTableSysId] - sys_id of a sys_db_object record,
     *   only used when scanMode === 'single_table'
```

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 6: Commit**

```bash
git add src/server/IscanScanOrchestrator.server.js
git commit -m "Add single_table scan mode resolution and table-only scan path"
```

---

### Task 5: `RunScanUiAction.server.js` — read new fields, precedence, validation

**Files:**
- Modify: `src/server/RunScanUiAction.server.js`

**Interfaces:**
- Consumes: `current.getValue('target_app')`, `current.getValue('target_table')` (Task 1); `IscanScanOrchestrator.runScanForRecord(runSysId, scanMode, manualAppList, targetTableSysId)` (Task 4, 4-argument signature).

- [ ] **Step 1: Read the new fields, apply Manual — App precedence, add the Single Table validation, persist submitted values before the abort, and pass the 4th argument through**

Replace the whole file body (keep the header comment) from the `scanMode`/`manualAppListRaw` reads through the end:

```javascript
;(function executeRunScan() {
    gs.info('RunScanUiAction: Run Scan clicked for run=' + current.getUniqueValue())

    var scanMode = current.getValue('scan_mode')
    var manualAppListRaw = current.getValue('manual_app_list')
    var targetAppId = current.getValue('target_app')
    var targetTableId = current.getValue('target_table')

    if (!scanMode) {
        gs.info('RunScanUiAction: aborted, no scan_mode selected')
        gs.addErrorMessage('Select a scan mode before running the scan.')
        current.setAbortAction(true)
        return
    }
    if (scanMode === 'manual' && !targetAppId && !manualAppListRaw) {
        gs.info('RunScanUiAction: aborted, manual mode with no target_app or manual_app_list')
        gs.addErrorMessage('Manual — App scan mode requires Target App or Manual App List to be set.')
        current.setAbortAction(true)
        return
    }
    if (scanMode === 'single_table' && !targetTableId) {
        gs.info('RunScanUiAction: aborted, single_table mode with no target_table')
        gs.addErrorMessage('Manual — Single Table scan mode requires Target Table to be set.')
        current.setAbortAction(true)
        return
    }

    // target_app takes precedence over the legacy manual_app_list field
    // when both are set — see docs/superpowers/specs/2026-07-21-modes-design.md.
    var manualAppList = targetAppId ? [targetAppId] : (manualAppListRaw ? manualAppListRaw.split(',') : [])

    // Persist the submitted form values (scan_mode, target_app,
    // target_table, manual_app_list) BEFORE the orchestrator runs, and
    // before the setAbortAction(true) below. Without this, target_app/
    // target_table would silently revert to blank on reload: the
    // platform's own post-script save is being aborted (so it doesn't
    // clobber the orchestrator's own status/activities updates, made via
    // a separately-fetched GlideRecord), and the orchestrator only ever
    // explicitly re-applies the fields it already knows about
    // (scan_mode, manual_app_list, target_table) onto ITS copy — never
    // target_app, since that's collapsed into manualAppList before the
    // orchestrator ever sees it.
    if (!current.update()) {
        gs.error('RunScanUiAction: failed to save submitted scan_mode/target_app/target_table/manual_app_list')
        gs.addErrorMessage(
            'Could not save the scan request — check write access to x_335329_iscan_run.'
        )
        current.setAbortAction(true)
        return
    }

    gs.info('RunScanUiAction: starting scan, run=' + current.getUniqueValue() + ', scan_mode=' + scanMode)
    try {
        var orchestrator = new IscanScanOrchestrator()
        orchestrator.runScanForRecord(current.getUniqueValue(), scanMode, manualAppList, targetTableId)
        gs.info('RunScanUiAction: scan finished, run=' + current.getUniqueValue())
        gs.addInfoMessage('Scan complete.')
    } catch (e) {
        gs.error('RunScanUiAction: scan failed for run=' + current.getUniqueValue() + ': ' + e.message)
        gs.addErrorMessage('Scan failed: ' + e.message + ' — see the Activities field and system log for details.')
    }

    // runScanForRecord() persists its own updates (status/activities/
    // results) via a separate GlideRecord query inside the orchestrator.
    // `current` here still holds pre-scan status/activities values in
    // memory, so abort the platform's default post-script save to avoid
    // it clobbering what the orchestrator just wrote, then redirect back
    // to show the result.
    current.setAbortAction(true)
    action.setRedirectURL(current)
})()
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 3: Commit**

```bash
git add src/server/RunScanUiAction.server.js
git commit -m "Wire target_app/target_table into the Run Scan UI Action"
```

---

### Task 6: ATF test coverage

**Files:**
- Modify: `tests/atf_tests.json`

**Interfaces:**
- Consumes: `IscanScanOrchestrator.runScan(scanMode, manualAppList, targetTableSysId)` (Task 4).

- [ ] **Step 1: Read the current file's structure**

Run: `cat tests/atf_tests.json | head -20` to confirm the exact JSON shape (`name`, `story`, `precondition`, `steps`, `expected`) before appending — match it exactly.

- [ ] **Step 2: Append 3 new test entries**

Add these 3 objects to the JSON array in `tests/atf_tests.json` (insert before the closing `]`, comma-separated after the last existing entry):

```json
  {
    "name": "Manual — App: target_app takes precedence over manual_app_list",
    "story": "Modes sub-spec: Manual — App precedence",
    "precondition": "Run as a user with the x_335329_iscan.scanner role; two distinct custom apps exist (appA, appB)",
    "steps": [
      "Server-side script step: create an x_335329_iscan_run record with scan_mode='manual', target_app=appA.sys_id, manual_app_list=appB.sys_id",
      "Server-side script step: call IscanScanOrchestrator.runScanForRecord(run.sys_id, 'manual', [appB.sys_id], '') — note manualAppList here simulates what RunScanUiAction.server.js would have already resolved: since target_app is set, it passes [appA.sys_id], not [appB.sys_id]",
      "Query x_335329_iscan_result where run = created run"
    ],
    "expected": "Result set includes appA only, not appB — confirming the UI Action's precedence logic (tested at the orchestrator boundary by passing the already-resolved [appA.sys_id])"
  },
  {
    "name": "Manual — Single Table: table owned by a custom app runs the full app tally",
    "story": "Modes sub-spec: Single Table mode, owning-app case",
    "precondition": "Run as a user with the x_335329_iscan.scanner role and read access to sys_db_object/sys_dictionary; a custom app owns at least one table",
    "steps": [
      "Server-side script step: call IscanScanOrchestrator.runScan('single_table', [], targetTableSysId) where targetTableSysId is the sys_id of a sys_db_object record owned by a custom app",
      "Query x_335329_iscan_result where run = created run",
      "Query x_335329_iscan_table where result = that result record"
    ],
    "expected": "Exactly one x_335329_iscan_result row exists, for the table's owning app; x_335329_iscan_table includes a row for the picked table with row_count, field_count, and reference_field_list populated (field_count reflects ALL fields on the table, not just app-added ones — see IscanTableScanner.profileTable)"
  },
  {
    "name": "Manual — Single Table: OOB table with no owning sys_app falls back to table-only",
    "story": "Modes sub-spec: Single Table mode, no-owning-app case",
    "precondition": "Run as a user with the x_335329_iscan.scanner role and read access to sys_db_object/sys_dictionary; targetTableSysId is the sys_db_object record for 'incident' (or another table whose sys_scope has no corresponding sys_app record)",
    "steps": [
      "Server-side script step: call IscanScanOrchestrator.runScan('single_table', [], targetTableSysId)",
      "Query x_335329_iscan_result where run = created run",
      "Open the run record and inspect the activities field"
    ],
    "expected": "Zero x_335329_iscan_result rows are created for this run; run.status = 'complete'; run.activities contains a line naming the table with its row_count/field_count/reference field list, and a preceding line noting the table has no owning application"
  }
```

- [ ] **Step 3: Verify the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('tests/atf_tests.json', 'utf8')); console.log('valid JSON')"`
Expected: `valid JSON`

- [ ] **Step 4: Commit**

```bash
git add tests/atf_tests.json
git commit -m "Add ATF test descriptions for the 4 scan modes' new behavior"
```

---

### Task 7: Docs sync — mark Modes sub-spec implemented

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `CLAUDE.md`'s "Planned: instance-assessment extension" section**

Change the heading `## Planned: instance-assessment extension (in design)` to `## Instance-assessment extension (in progress)`, and change the sub-heading `**Modes (sub-spec 1, schema decided so far):**` to `**Modes (sub-spec 1 — IMPLEMENTED):**` and the sub-heading `**Modes (sub-spec 1, orchestrator/ACL/UI wiring, decided so far):**` to `**Modes (sub-spec 1 — implementation notes):**`. Leave the body content of both sections as-is (it accurately describes what was built) — this is a status-label change, not a rewrite, since sub-specs 2-4 (Counting, Cross-refs, Report) are still genuinely planned/undesigned.

- [ ] **Step 2: Update `README.md`'s mode description**

Replace:

```markdown
1. Pick a scan scope: full instance, custom apps only, one manual app, or
   (planned) a single table.
```

with:

```markdown
1. Pick a scan scope: full instance, custom apps only, one manual app
   (via Target App or the legacy Manual App List), or a single table
   (Manual — Single Table mode).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Mark Modes sub-spec implemented in docs"
```

---

## Self-review notes

- **Spec coverage**: schema (§1 of design) → Task 1; orchestrator data flow, precedence, signature change, no-owning-app fallback (§2) → Tasks 4, 5; `profileTable()` change (§3) → Task 3; ACL implications (§4) → no code task needed, design doc already concluded no new ACLs are required; UI wiring / UI Policy (§5) → Tasks 2, 5. All 5 design sections have a corresponding task.
- **Target-field persistence gap**: the approved design doc didn't explicitly address whether `target_app`/`target_table` survive the existing `current.setAbortAction(true)` pattern in `RunScanUiAction.server.js`. Tracing it through during planning surfaced a real regression risk (submitted `target_app`/`target_table` values reverting to blank on reload), fixed in Task 5 Step 1 with an explicit `current.update()` before the abort. This is implementation-level detail consistent with the approved design, not a design change.
- **Type/signature consistency**: `profileTable(tableName)` (Task 3) is called with exactly one argument everywhere it's used after this plan — `_profileOwnedTables` (Task 4 Step 1) and the new `_scanOneTable` (Task 4 Step 3). `_resolveAppList`/`runScanForRecord`/`runScan` all consistently gain the same 4th parameter name, `targetTableSysId`, across every task that touches them.
