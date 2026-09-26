# Cross-refs (Sub-spec 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inbound-reference (dependent) discovery to `IscanTableScanner`, persisted as summary columns on `x_nold_iscan_table` plus a new `x_nold_iscan_crossref` child table with one row per referencing field, per the approved design at `docs/superpowers/specs/2026-07-22-crossrefs-design.md`.

**Architecture:** `IscanTableScanner` gains `findInboundReferences(tableName)`, which queries `sys_dictionary` for any field anywhere in the instance whose `reference` points at `tableName`, then resolves each distinct referencing table's owning app (or blank, if none). `IscanScanOrchestrator` wires this into the existing per-app table-profile loop: the count/list summary is written onto each `x_nold_iscan_table` row, and one `x_nold_iscan_crossref` child row is inserted per referencing field.

**Tech Stack:** ServiceNow SDK (`@servicenow/sdk` 4.8.1) + ServiceNow Fluent (`.now.ts`), plain server-side JS script include bodies, `now-sdk build` for compile validation.

## Global Constraints

- Read-only app: no script may write to a scanned table, only to `x_nold_iscan_*` tables.
- No elevated privilege; every query runs under the caller's own access.
- `GlideAggregate` for row/aggregate counts, never `GlideRecord.getRowCount()` — not needed in this plan (no new row counts), but do not introduce one if a step is tempted to.
- The inbound-reference search runs unconditionally in every scan mode, including `full` — no new system property, no gating. Do not add one.
- Same-app inbound references (the referencing table happens to be owned by the same app as the table being profiled) are included, not filtered out at write time.
- No local unit-test runner; `npm run build` is the only automated local check. **Do NOT add ATF test entries for this sub-spec** — `tests/atf_tests.json` is not touched by this plan.
- `x_nold_iscan_crossref.table` is mandatory (Reference → `x_nold_iscan_table`) — rows are only ever written from `_writeTableProfiles`, immediately after the parent `x_nold_iscan_table` row's `insert()` returns its sys_id. No `x_nold_iscan_crossref` rows are written from the Single Table mode's no-owning-app fallback path (`_scanOneTable`), since no `x_nold_iscan_table` row exists there to reference — that path only logs the inbound-reference count to `run.activities`.

---

### Task 1: Schema — 2 table-profile columns, 1 new child table

**Files:**
- Modify: `src/fluent/tables.now.ts`

**Interfaces:**
- Produces: 2 new columns on `x_nold_iscan_table` (`inbound_reference_count`, `inbound_reference_list`); new table `x_nold_iscan_crossref` with columns `table`, `referencing_table`, `referencing_field`, `referencing_app`, `referencing_scope`. Task 3 writes these by these exact names.

- [ ] **Step 1: Add 2 columns to `x_nold_iscan_table`**

In `src/fluent/tables.now.ts`, inside the `x_nold_iscan_table` Table's `schema` object, immediately after the existing `dictionary_override_list: StringColumn({...})` column (the last column in that schema), add:

```typescript
        // Inbound reference: a field on ANY table elsewhere in the
        // instance whose `reference` points AT this table — i.e. who
        // depends on me. Whole-instance search, not limited to apps in
        // the current scan run. See IscanTableScanner.findInboundReferences().
        inbound_reference_count: IntegerColumn({ label: 'Inbound Reference Count', default: 0 }),
        inbound_reference_list: StringColumn({
            label: 'Inbound Reference List',
            maxLength: 4000,
        }),
```

- [ ] **Step 2: Add the new `x_nold_iscan_crossref` table**

In the same file, after the closing `})` of the `x_nold_iscan_table` `Table({...})` call (i.e. as a new top-level export at the end of the file), add:

```typescript
export const x_nold_iscan_crossref = Table({
    name: 'x_nold_iscan_crossref',
    label: 'Instance Scan Cross-Reference',
    display: 'referencing_table',
    schema: {
        table: ReferenceColumn({
            label: 'Table',
            referenceTable: 'x_nold_iscan_table',
            mandatory: true,
        }),
        referencing_table: StringColumn({ label: 'Referencing Table', maxLength: 80 }),
        referencing_field: StringColumn({ label: 'Referencing Field', maxLength: 80 }),
        // Blank when the referencing table's owning scope has no sys_app
        // record (global/OOB referencing tables) — a blank reference
        // here is expected, not a bug, same precedent as Counting's
        // Group B zero-counts.
        referencing_app: ReferenceColumn({
            label: 'Referencing App',
            referenceTable: 'sys_app',
        }),
        referencing_scope: StringColumn({ label: 'Referencing Scope', maxLength: 32 }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'table',
        },
    ],
})
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 4: Commit**

```bash
git add src/fluent/tables.now.ts
git commit -m "Add Cross-refs schema: table-profile inbound columns + x_nold_iscan_crossref"
```

---

### Task 2: `IscanTableScanner` — inbound reference discovery

**Files:**
- Modify: `src/server/IscanTableScanner.server.js`

**Interfaces:**
- Consumes: `this._getTableOwningScope(tableName)` (already exists on this class, added by Counting sub-spec — resolves a table's `sys_db_object.sys_scope`, or `''` if not found).
- Produces: `findInboundReferences(tableName)` → `Array` of `{referencing_table, referencing_field, referencing_app, referencing_scope}`. Task 3 (`IscanScanOrchestrator`) calls this by this exact name and reads all 4 keys off each entry.

- [ ] **Step 1: Add `findInboundReferences` and its private helper `_resolveTableApp`**

In `src/server/IscanTableScanner.server.js`, immediately after the existing `profileTable` method's closing `},` (right before the `_countRows` method), add:

```javascript
	/**
	 * Whole-instance search: every field, on ANY table, whose `reference`
	 * points at tableName — i.e. who depends on this table. Not limited
	 * to apps in the current scan run; deliberately unconditional in
	 * every scan mode (one indexed sys_dictionary query per table, not
	 * per app — cheap enough that it isn't gated like Counting's Group B).
	 * @param {String} tableName
	 * @returns {Array} [{referencing_table, referencing_field, referencing_app, referencing_scope}]
	 */
	findInboundReferences: function(tableName) {
		var inbound = [];
		var appCache = {};
		var dict = new GlideRecord('sys_dictionary');
		dict.addQuery('reference', tableName);
		dict.addNotNullQuery('element');
		dict.query();

		while (dict.next()) {
			var referencingTable = dict.getValue('name');
			if (!appCache.hasOwnProperty(referencingTable)) {
				appCache[referencingTable] = this._resolveTableApp(referencingTable);
			}
			var resolved = appCache[referencingTable];
			inbound.push({
				referencing_table: referencingTable,
				referencing_field: dict.getValue('element'),
				referencing_app: resolved.app,
				referencing_scope: resolved.scope
			});
		}

		gs.info('IscanTableScanner.findInboundReferences: table=' + tableName + ' found ' + inbound.length + ' inbound reference(s)');
		return inbound;
	},

	/**
	 * Resolves a table's owning app, if any. Same two-step lookup
	 * (sys_db_object.sys_scope -> sys_app.get(scope)) already used by
	 * IscanScanOrchestrator._resolveSingleTableApp for Single Table
	 * mode's OOB case — duplicated here rather than shared, since that
	 * orchestrator method's job is resolving the SCAN TARGET's app,
	 * while this one resolves an arbitrary REFERENCING table's app
	 * found during a dictionary search; different callers, same shape.
	 * @param {String} tableName
	 * @returns {Object} {app, scope} - app is '' when no sys_app record exists for the scope
	 */
	_resolveTableApp: function(tableName) {
		var scope = this._getTableOwningScope(tableName);
		var appSysId = '';
		if (scope) {
			var app = new GlideRecord('sys_app');
			if (app.get(scope)) {
				appSysId = app.getUniqueValue();
			}
		}
		return { app: appSysId, scope: scope };
	},

```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 3: Commit**

```bash
git add src/server/IscanTableScanner.server.js
git commit -m "Add inbound reference discovery to IscanTableScanner"
```

---

### Task 3: `IscanScanOrchestrator` — wire inbound references into the scan pipeline

**Files:**
- Modify: `src/server/IscanScanOrchestrator.server.js`

**Interfaces:**
- Consumes: `IscanTableScanner.findInboundReferences(tableName)` (Task 2) → `[{referencing_table, referencing_field, referencing_app, referencing_scope}]`.

- [ ] **Step 1: Fold inbound references onto each table object in `_profileOwnedTables`**

Replace:

```javascript
    _profileOwnedTables: function (appScopeSysId) {
        var tables = this.tableScanner.getOwnedTables(appScopeSysId)
        for (var i = 0; i < tables.length; i++) {
            var profile = this.tableScanner.profileTable(tables[i].name)
            tables[i].row_count = profile.row_count
            tables[i].fields = profile.fields
            tables[i].reference_fields = profile.reference_fields
            tables[i].dictionary_overrides = profile.dictionary_overrides
            tables[i].dictionary_override_count = profile.dictionary_override_count
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
            tables[i].dictionary_overrides = profile.dictionary_overrides
            tables[i].dictionary_override_count = profile.dictionary_override_count
            tables[i].inbound_references = this.tableScanner.findInboundReferences(tables[i].name)
            tables[i].inbound_reference_count = tables[i].inbound_references.length
        }
        return tables
    },
```

- [ ] **Step 2: Write the 2 new columns and insert `x_nold_iscan_crossref` rows in `_writeTableProfiles`**

Replace:

```javascript
    _writeTableProfiles: function (resultSysId, tables) {
        for (var i = 0; i < tables.length; i++) {
            var tableRow = new GlideRecord('x_nold_iscan_table')
            tableRow.initialize()
            tableRow.setValue('result', resultSysId)
            tableRow.setValue('table_name', tables[i].name)
            tableRow.setValue('extends_table', tables[i].extends)
            tableRow.setValue('well_known_base', tables[i].well_known_base)
            tableRow.setValue('row_count', tables[i].row_count)
            tableRow.setValue('field_count', tables[i].fields.length)
            tableRow.setValue('reference_field_list', tables[i].reference_fields.join(','))
            tableRow.setValue('dictionary_override_count', tables[i].dictionary_override_count)
            tableRow.setValue(
                'dictionary_override_list',
                tables[i].dictionary_overrides.map(function (o) { return o.name + '(' + o.scope + ')' }).join(',')
            )
            tableRow.insert()
            gs.info(
                'IscanScanOrchestrator._writeTableProfiles: table=' +
                    tables[i].name +
                    ' row_count=' +
                    tables[i].row_count +
                    ' field_count=' +
                    tables[i].fields.length +
                    ' dictionary_override_count=' +
                    tables[i].dictionary_override_count
            )
        }
    },
```

with:

```javascript
    _writeTableProfiles: function (resultSysId, tables) {
        for (var i = 0; i < tables.length; i++) {
            var tableRow = new GlideRecord('x_nold_iscan_table')
            tableRow.initialize()
            tableRow.setValue('result', resultSysId)
            tableRow.setValue('table_name', tables[i].name)
            tableRow.setValue('extends_table', tables[i].extends)
            tableRow.setValue('well_known_base', tables[i].well_known_base)
            tableRow.setValue('row_count', tables[i].row_count)
            tableRow.setValue('field_count', tables[i].fields.length)
            tableRow.setValue('reference_field_list', tables[i].reference_fields.join(','))
            tableRow.setValue('dictionary_override_count', tables[i].dictionary_override_count)
            tableRow.setValue(
                'dictionary_override_list',
                tables[i].dictionary_overrides.map(function (o) { return o.name + '(' + o.scope + ')' }).join(',')
            )
            tableRow.setValue('inbound_reference_count', tables[i].inbound_reference_count)
            tableRow.setValue(
                'inbound_reference_list',
                tables[i].inbound_references.map(function (r) { return r.referencing_field + '(' + r.referencing_table + ')' }).join(',')
            )
            var tableRowId = tableRow.insert()
            gs.info(
                'IscanScanOrchestrator._writeTableProfiles: table=' +
                    tables[i].name +
                    ' row_count=' +
                    tables[i].row_count +
                    ' field_count=' +
                    tables[i].fields.length +
                    ' dictionary_override_count=' +
                    tables[i].dictionary_override_count +
                    ' inbound_reference_count=' +
                    tables[i].inbound_reference_count
            )
            this._writeCrossrefRows(tableRowId, tables[i].inbound_references)
        }
    },

    /**
     * One x_nold_iscan_crossref row per inbound-referencing field found
     * for a single x_nold_iscan_table row. Same-app references ARE
     * included (referencing_app will equal the app currently being
     * scanned in that case) — filtering intra-app vs. cross-app is a
     * Report sub-spec concern, not a write-time one.
     * @param {String} tableRowId - sys_id of the just-inserted x_nold_iscan_table row
     * @param {Array} inboundReferences - [{referencing_table, referencing_field, referencing_app, referencing_scope}]
     */
    _writeCrossrefRows: function (tableRowId, inboundReferences) {
        for (var i = 0; i < inboundReferences.length; i++) {
            var crossrefRow = new GlideRecord('x_nold_iscan_crossref')
            crossrefRow.initialize()
            crossrefRow.setValue('table', tableRowId)
            crossrefRow.setValue('referencing_table', inboundReferences[i].referencing_table)
            crossrefRow.setValue('referencing_field', inboundReferences[i].referencing_field)
            crossrefRow.setValue('referencing_app', inboundReferences[i].referencing_app)
            crossrefRow.setValue('referencing_scope', inboundReferences[i].referencing_scope)
            crossrefRow.insert()
        }
    },
```

- [ ] **Step 3: Mention inbound reference count in `_scanOneTable`'s log line (Single Table mode's no-owning-app path)**

Replace:

```javascript
        var profile = this.tableScanner.profileTable(tableName)
        gs.info(
            'IscanScanOrchestrator._scanOneTable: table=' +
                tableName +
                ' row_count=' +
                profile.row_count +
                ' field_count=' +
                profile.fields.length +
                ' dictionary_override_count=' +
                profile.dictionary_override_count
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
                (profile.reference_fields.length ? profile.reference_fields.join(', ') : 'none') +
                ', ' +
                profile.dictionary_override_count +
                ' dictionary override(s).'
        )
    },
```

with:

```javascript
        var profile = this.tableScanner.profileTable(tableName)
        var inboundReferences = this.tableScanner.findInboundReferences(tableName)
        gs.info(
            'IscanScanOrchestrator._scanOneTable: table=' +
                tableName +
                ' row_count=' +
                profile.row_count +
                ' field_count=' +
                profile.fields.length +
                ' dictionary_override_count=' +
                profile.dictionary_override_count +
                ' inbound_reference_count=' +
                inboundReferences.length
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
                (profile.reference_fields.length ? profile.reference_fields.join(', ') : 'none') +
                ', ' +
                profile.dictionary_override_count +
                ' dictionary override(s), ' +
                inboundReferences.length +
                ' inbound reference(s).'
        )
    },
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 5: Commit**

```bash
git add src/server/IscanScanOrchestrator.server.js
git commit -m "Wire inbound reference discovery into the scan pipeline"
```

---

### Task 4: Docs sync — mark Cross-refs sub-spec implemented

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a Cross-refs sub-heading to `CLAUDE.md`'s "Instance-assessment extension" section**

In `CLAUDE.md`, immediately after the existing `**Counting (sub-spec 2 — IMPLEMENTED):**` section's closing paragraph (before the `## /caveman` heading, or before whatever section currently follows Counting), add:

```markdown
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
path only logs the inbound reference count to `run.activities`, consistent
with how it already handles dictionary overrides.
```

- [ ] **Step 2: Update the status file**

In `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`, change the `## Sub-spec 3: Cross-refs — NOT STARTED` heading to `## Sub-spec 3: Cross-refs — DONE` and replace its body with:

```markdown
Spec: `docs/superpowers/specs/2026-07-22-crossrefs-design.md`
Plan: `docs/superpowers/plans/2026-07-22-crossrefs-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 4 tasks complete, merged to main
directly — no branch was used). Inbound-reference discovery is
whole-instance and ungated (no new property), unlike Counting's Group B —
see CLAUDE.md's Cross-refs section for why that was judged safe.
```

Also update the "Sub-spec 4: Report — NOT STARTED" section's hint paragraph to mention the new `x_nold_iscan_crossref` table is now available as a building block, alongside the existing mention of `IscanReportGenerator`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md
git commit -m "Mark Cross-refs sub-spec implemented in docs"
```

---

## Self-review notes

- **Spec coverage**: design's "New method" section → Task 2; "Schema changes" section → Task 1; "Orchestrator wiring" section → Task 3; the doc-sync convention established by Modes/Counting → Task 4. All design sections have a corresponding task.
- **Type/signature consistency**: `findInboundReferences(tableName)` (Task 2) is called with the same single-argument signature by both call sites added in Task 3 (`_profileOwnedTables` and `_scanOneTable`). The returned array's 4 keys (`referencing_table`, `referencing_field`, `referencing_app`, `referencing_scope`) are read identically in both `_writeCrossrefRows` and the `_scanOneTable` log line (which only reads `.length`, not the per-entry keys). `_getTableOwningScope` (Counting sub-spec, already exists) is reused as-is by Task 2's `_resolveTableApp`, not redefined.
- **No ATF changes**: confirmed no task in this plan touches `tests/atf_tests.json`, per the global constraint.
