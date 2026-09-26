# Counting (Sub-spec 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `IscanAppFilesScanner`'s artifact tally from 5 types to ~22, plus a new "dictionary override" capability on `IscanTableScanner`, per the approved design at `docs/superpowers/specs/2026-07-21-counting-design.md`.

**Architecture:** 15 new artifact types fold into `IscanAppFilesScanner`'s existing single `sys_metadata` query via new `CLASS_BUCKETS` entries (free perf-wise). 7 more need dedicated per-app queries, gated off by default for `full` mode via a new system property. `IscanTableScanner.profileTable()` gains dictionary-override detection by comparing each field's own `sys_scope` against its table's owning scope. `IscanScanOrchestrator` wires all of it onto the existing result/table-profile write path.

**Tech Stack:** ServiceNow SDK (`@servicenow/sdk` 4.8.1) + ServiceNow Fluent (`.now.ts`), plain server-side JS script include bodies, `now-sdk build` for compile validation.

## Global Constraints

- Read-only app: no script may write to a scanned table, only to `x_nold_iscan_*` tables.
- No elevated privilege; `canAccessMetadata()` is a deterministic gate checked BEFORE querying, never a try/catch fallback.
- `GlideAggregate` for row counts, never `GlideRecord.getRowCount()`.
- No hardcoded sys_ids; instance-specific config goes through `gs.getProperty()`.
- No local unit-test runner; `npm run build` is the only automated local check. **Do NOT add ATF test entries for this sub-spec** — per explicit user instruction this session, `tests/atf_tests.json` is not touched by this plan.
- REST/SOAP messages are NOT a new bucket — already covered by the existing `integration_count`/`_findIntegrations()`. Do not add `sys_rest_message`/`sys_web_service` to `CLASS_BUCKETS` (double-count risk).
- Roles, groups, system properties are explicitly excluded from all counting — do not add them anywhere in this plan.
- Several table/field names in this plan are flagged low-confidence (verify against a real instance before/while implementing): `sys_hub_flow.type` field/values, `sysevent_in_email_action`, `pa_dashboards`/`pa_indicators` scope field, `sys_hub_action_type_definition`, `item_option_new`'s variable-set field name. Implement as designed; add a one-line code comment at each flagged spot noting it needs instance verification (do not silently "fix" these based on a guess beyond what's specified here).

---

### Task 1: Schema — 22 result counts, 2 table-profile columns, 1 property

**Files:**
- Modify: `src/fluent/tables.now.ts` (both `x_nold_iscan_result` and `x_nold_iscan_table` Table definitions)
- Modify: `src/fluent/properties.now.ts`

**Interfaces:**
- Produces: 22 new `IntegerColumn`s on `x_nold_iscan_result` (see exact list below); 2 new columns on `x_nold_iscan_table` (`dictionary_override_count`, `dictionary_override_list`); new property `x_nold_iscan.include_extended_counts_on_full_scan`. Later tasks (2-5) read/write these by these exact names.

- [ ] **Step 1: Add 22 `IntegerColumn`s to `x_nold_iscan_result`**

In `src/fluent/tables.now.ts`, inside the `x_nold_iscan_result` Table's `schema` object, immediately after the existing `integration_count: IntegerColumn({...})` column, add:

```typescript
        // Group A — folded into IscanAppFilesScanner's existing single
        // sys_metadata query via new CLASS_BUCKETS entries (see that
        // file). Free performance-wise: same query, more buckets.
        client_script_count: IntegerColumn({ label: 'Client Script Count', default: 0 }),
        ui_policy_count: IntegerColumn({ label: 'UI Policy Count', default: 0 }),
        scheduled_job_count: IntegerColumn({ label: 'Scheduled Job Count', default: 0 }),
        notification_count: IntegerColumn({ label: 'Notification Count', default: 0 }),
        scripted_rest_api_count: IntegerColumn({ label: 'Scripted REST API Count', default: 0 }),
        transform_map_count: IntegerColumn({ label: 'Transform Map Count', default: 0 }),
        catalog_item_count: IntegerColumn({ label: 'Catalog Item Count', default: 0 }),
        workflow_count: IntegerColumn({ label: 'Workflow Count', default: 0 }),
        subflow_count: IntegerColumn({ label: 'Subflow Count', default: 0 }),
        atf_test_count: IntegerColumn({ label: 'ATF Test Count', default: 0 }),
        report_count: IntegerColumn({ label: 'Report Count', default: 0 }),
        fix_script_count: IntegerColumn({ label: 'Fix Script Count', default: 0 }),
        processor_count: IntegerColumn({ label: 'Processor Count', default: 0 }),
        data_policy_count: IntegerColumn({ label: 'Data Policy Count', default: 0 }),
        inbound_email_action_count: IntegerColumn({ label: 'Inbound Email Action Count', default: 0 }),
        // Group B — dedicated per-app queries, gated off by default for
        // full-instance scans (see x_nold_iscan.include_extended_counts_on_full_scan
        // and IscanScanOrchestrator._scanOneApp). Zero when not run, not
        // "unknown" — a 0 for a mode/property combo that skips Group B
        // is expected, not a bug.
        catalog_variable_count: IntegerColumn({ label: 'Catalog Variable Count', default: 0 }),
        dashboard_count: IntegerColumn({ label: 'Dashboard Count', default: 0 }),
        pa_indicator_count: IntegerColumn({ label: 'PA Indicator Count', default: 0 }),
        service_portal_count: IntegerColumn({ label: 'Service Portal Count', default: 0 }),
        service_portal_widget_count: IntegerColumn({ label: 'Service Portal Widget Count', default: 0 }),
        choice_count: IntegerColumn({ label: 'Choice Count', default: 0 }),
        flow_action_count: IntegerColumn({ label: 'Flow Designer Action Count', default: 0 }),
```

- [ ] **Step 2: Add 2 columns to `x_nold_iscan_table`**

In the same file, inside the `x_nold_iscan_table` Table's `schema` object, immediately after the existing `reference_field_list: StringColumn({...})` column, add:

```typescript
        // Dictionary override: a field on this table whose OWN sys_scope
        // differs from this table's owning scope — i.e. another app
        // added a field to a table it doesn't own. See
        // IscanTableScanner.profileTable()/_getAppAddedFields().
        dictionary_override_count: IntegerColumn({ label: 'Dictionary Override Count', default: 0 }),
        dictionary_override_list: StringColumn({
            label: 'Dictionary Override List',
            maxLength: 4000,
        }),
```

- [ ] **Step 3: Add the new property**

In `src/fluent/properties.now.ts`, after the existing `genaiMaxInputCharsProperty` export, add:

```typescript
export const includeExtendedCountsOnFullScanProperty = Property({
    $id: Now.ID['sn_inst_scan_include_extended_counts_on_full_scan_property'],
    name: 'x_nold_iscan.include_extended_counts_on_full_scan',
    type: 'boolean',
    value: 'false',
    description:
        'When false (default), Group B artifact counts (dashboards, PA indicators, service portals/widgets, choices, Flow Designer actions, catalog variables — see IscanAppFilesScanner) are skipped for scan_mode=full to avoid 7 extra queries per app on a full-instance scan. Custom Only / Manual / Single Table modes always include Group B regardless of this property (their app counts are inherently small). Set true to include Group B in full scans too.',
})
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 5: Commit**

```bash
git add src/fluent/tables.now.ts src/fluent/properties.now.ts
git commit -m "Add Counting sub-spec schema: 22 result counts, 2 table-profile columns, 1 property"
```

---

### Task 2: `IscanAppFilesScanner` — Group A `CLASS_BUCKETS` extension + subflow split

**Files:**
- Modify: `src/server/IscanAppFilesScanner.server.js`

**Interfaces:**
- Produces: `scanApp()`'s returned object gains 15 new array keys (`client_scripts`, `ui_policies`, `scheduled_jobs`, `notifications`, `scripted_rest_apis`, `transform_maps`, `catalog_items`, `workflows`, `subflows`, `atf_tests`, `reports`, `fix_scripts`, `processors`, `data_policies`, `inbound_email_actions`), each an array of `{sys_id, name}` — same shape as the existing 5. Task 5 (`IscanScanOrchestrator`) reads `.length` off each of these.

- [ ] **Step 1: Extend `CLASS_BUCKETS` and the `result` initializer**

In `src/server/IscanAppFilesScanner.server.js`, replace:

```javascript
	initialize: function() {
		this.CLASS_BUCKETS = {
			sys_script_include: 'script_includes',
			sys_script: 'business_rules',
			sys_security_acl: 'acls',
			sys_ui_action: 'ui_actions',
			sys_hub_flow: 'flows'
		};
	},
```

with:

```javascript
	initialize: function() {
		this.CLASS_BUCKETS = {
			sys_script_include: 'script_includes',
			sys_script: 'business_rules',
			sys_security_acl: 'acls',
			sys_ui_action: 'ui_actions',
			sys_hub_flow: 'flows',
			sys_script_client: 'client_scripts',
			sys_ui_policy: 'ui_policies',
			sysauto_script: 'scheduled_jobs',
			sysevent_email_action: 'notifications',
			sys_ws_definition: 'scripted_rest_apis',
			sys_transform_map: 'transform_maps',
			sc_cat_item: 'catalog_items',
			sys_atf_test: 'atf_tests',
			sys_report: 'reports',
			sys_script_fix: 'fix_scripts',
			sys_processor: 'processors',
			sys_data_policy2: 'data_policies',
			// Table name needs verification against a real instance —
			// see docs/superpowers/specs/2026-07-21-counting-design.md.
			sysevent_in_email_action: 'inbound_email_actions'
		};
	},
```

Then replace:

```javascript
	scanApp: function(appScopeSysId) {
		var result = {
			script_includes: [],
			business_rules: [],
			acls: [],
			ui_actions: [],
			flows: []
		};

		var meta = new GlideRecord('sys_metadata');
		meta.addQuery('sys_scope', appScopeSysId);
		meta.query();

		while (meta.next()) {
			var bucket = this.CLASS_BUCKETS[meta.getValue('sys_class_name')];
			if (!bucket) {
				continue;
			}
			result[bucket].push({
				sys_id: meta.getUniqueValue(),
				name: meta.getValue('name') || meta.getValue('sys_name') || ''
			});
		}

		gs.info('IscanAppFilesScanner.scanApp: appScope=' + appScopeSysId +
			' script_includes=' + result.script_includes.length +
			' business_rules=' + result.business_rules.length +
			' acls=' + result.acls.length +
			' ui_actions=' + result.ui_actions.length +
			' flows=' + result.flows.length);
		return result;
	},
```

with:

```javascript
	scanApp: function(appScopeSysId) {
		var result = {
			script_includes: [],
			business_rules: [],
			acls: [],
			ui_actions: [],
			flows: [],
			client_scripts: [],
			ui_policies: [],
			scheduled_jobs: [],
			notifications: [],
			scripted_rest_apis: [],
			transform_maps: [],
			catalog_items: [],
			workflows: [],
			subflows: [],
			atf_tests: [],
			reports: [],
			fix_scripts: [],
			processors: [],
			data_policies: [],
			inbound_email_actions: []
		};

		var meta = new GlideRecord('sys_metadata');
		meta.addQuery('sys_scope', appScopeSysId);
		meta.query();

		while (meta.next()) {
			var bucket = this.CLASS_BUCKETS[meta.getValue('sys_class_name')];
			if (!bucket) {
				continue;
			}
			// sys_hub_flow holds both top-level flows and subflows,
			// distinguished by `type` (field/values need verification
			// against a real instance) — split them into separate
			// buckets here rather than adding a second CLASS_BUCKETS
			// entry for the same table.
			if (bucket === 'flows' && meta.getValue('type') === 'subflow') {
				bucket = 'subflows';
			}
			result[bucket].push({
				sys_id: meta.getUniqueValue(),
				name: meta.getValue('name') || meta.getValue('sys_name') || ''
			});
		}

		this._logBucketCounts(appScopeSysId, result);
		return result;
	},

	/**
	 * Logs one summary line with every bucket's count. Replaces a
	 * hand-written concatenation (unmaintainable once CLASS_BUCKETS grew
	 * past ~20 entries).
	 * @param {String} appScopeSysId
	 * @param {Object} result - the scanApp() return value
	 */
	_logBucketCounts: function(appScopeSysId, result) {
		var parts = [];
		for (var bucket in result) {
			if (result.hasOwnProperty(bucket)) {
				parts.push(bucket + '=' + result[bucket].length);
			}
		}
		gs.info('IscanAppFilesScanner.scanApp: appScope=' + appScopeSysId + ' ' + parts.join(' '));
	},
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 3: Commit**

```bash
git add src/server/IscanAppFilesScanner.server.js
git commit -m "Add Group A artifact buckets and subflow split to IscanAppFilesScanner"
```

---

### Task 3: `IscanAppFilesScanner` — Group B dedicated queries

**Files:**
- Modify: `src/server/IscanAppFilesScanner.server.js`

**Interfaces:**
- Consumes: `scanApp(appScopeSysId, includeExtended)` — new 2nd parameter, default `true` if omitted (so any pre-existing caller that doesn't pass it keeps today's behavior). Task 5 passes this explicitly, computed from scan mode + the new property.
- Produces: `scanApp()`'s returned object gains 7 more keys: `dashboards`, `pa_indicators`, `service_portals`, `service_portal_widgets`, `flow_actions`, `catalog_variables` (each `{sys_id, name}` arrays) and `choice_count` (a plain integer, NOT an array — the one exception to the `{sys_id, name}` shape, per the approved design). All 7 keys are present (empty arrays / 0) even when `includeExtended` is `false`, so callers never need an existence check.

- [ ] **Step 1: Add the `includeExtended` parameter and Group B result keys**

Replace the `scanApp` method's signature and result initializer (from Task 2's version) — only the signature line and result object change, the `sys_metadata` loop and `_logBucketCounts` call stay as Task 2 left them:

```javascript
	scanApp: function(appScopeSysId, includeExtended) {
		if (includeExtended === undefined) {
			includeExtended = true;
		}
		var result = {
			script_includes: [],
			business_rules: [],
			acls: [],
			ui_actions: [],
			flows: [],
			client_scripts: [],
			ui_policies: [],
			scheduled_jobs: [],
			notifications: [],
			scripted_rest_apis: [],
			transform_maps: [],
			catalog_items: [],
			workflows: [],
			subflows: [],
			atf_tests: [],
			reports: [],
			fix_scripts: [],
			processors: [],
			data_policies: [],
			inbound_email_actions: [],
			dashboards: [],
			pa_indicators: [],
			service_portals: [],
			service_portal_widgets: [],
			flow_actions: [],
			catalog_variables: [],
			choice_count: 0
		};

		var meta = new GlideRecord('sys_metadata');
		meta.addQuery('sys_scope', appScopeSysId);
		meta.query();

		while (meta.next()) {
			var bucket = this.CLASS_BUCKETS[meta.getValue('sys_class_name')];
			if (!bucket) {
				continue;
			}
			if (bucket === 'flows' && meta.getValue('type') === 'subflow') {
				bucket = 'subflows';
			}
			result[bucket].push({
				sys_id: meta.getUniqueValue(),
				name: meta.getValue('name') || meta.getValue('sys_name') || ''
			});
		}

		if (includeExtended) {
			result.dashboards = this._scanSimpleScopedTable(appScopeSysId, 'pa_dashboards');
			result.pa_indicators = this._scanSimpleScopedTable(appScopeSysId, 'pa_indicators');
			result.service_portals = this._scanSimpleScopedTable(appScopeSysId, 'sp_portal');
			result.service_portal_widgets = this._scanSimpleScopedTable(appScopeSysId, 'sp_widget');
			// Table name needs verification against a real instance.
			result.flow_actions = this._scanSimpleScopedTable(appScopeSysId, 'sys_hub_action_type_definition');
			result.catalog_variables = this._scanCatalogVariables(appScopeSysId);
			result.choice_count = this._countChoices(appScopeSysId);
		}

		this._logBucketCounts(appScopeSysId, result);
		return result;
	},
```

- [ ] **Step 2: Add the 3 new private helper methods**

Immediately after `scanApp`, before `_logBucketCounts`, add:

```javascript
	/**
	 * Group B helper: {sys_id, name} list for any table that carries a
	 * direct sys_scope field. Covers dashboards, PA indicators, service
	 * portals/widgets, and Flow Designer custom action definitions — all
	 * share this exact query shape.
	 * @param {String} appScopeSysId
	 * @param {String} tableName
	 * @returns {Array} [{sys_id, name}]
	 */
	_scanSimpleScopedTable: function(appScopeSysId, tableName) {
		var items = [];
		var gr = new GlideRecord(tableName);
		if (!gr.isValid()) {
			return items;
		}
		gr.addQuery('sys_scope', appScopeSysId);
		gr.query();
		while (gr.next()) {
			items.push({
				sys_id: gr.getUniqueValue(),
				name: gr.getValue('name') || gr.getValue('sys_name') || ''
			});
		}
		return items;
	},

	/**
	 * item_option_new (catalog variables) has no sys_scope of its own —
	 * a variable belongs to an app's scope either directly (cat_item ->
	 * sc_cat_item.sys_scope) or via a shared variable set (variable_set
	 * -> that variable set's own sys_scope). Dot-walk generates the join
	 * server-side in one query.
	 *
	 * KNOWN LIMITATION, not a bug: a variable set shared across multiple
	 * catalog items in the same app could be visited more than once
	 * depending on exact join semantics — acceptable for a rough
	 * architecture tally. variable_set's exact field name/join shape
	 * needs verification against a real instance.
	 * @param {String} appScopeSysId
	 * @returns {Array} [{sys_id, name}]
	 */
	_scanCatalogVariables: function(appScopeSysId) {
		var vars = [];
		var gr = new GlideRecord('item_option_new');
		if (!gr.isValid()) {
			return vars;
		}
		var qc = gr.addQuery('cat_item.sys_scope', appScopeSysId);
		qc.addOrCondition('variable_set.sys_scope', appScopeSysId);
		gr.query();
		while (gr.next()) {
			vars.push({
				sys_id: gr.getUniqueValue(),
				name: gr.getValue('name') || ''
			});
		}
		return vars;
	},

	/**
	 * sys_choice is high-cardinality (one row per choice value per field
	 * per language) even scoped to one app — count-only, no name list,
	 * unlike every other bucket. GlideAggregate, never getRowCount().
	 * @param {String} appScopeSysId
	 * @returns {Number}
	 */
	_countChoices: function(appScopeSysId) {
		var ga = new GlideAggregate('sys_choice');
		ga.addQuery('sys_scope', appScopeSysId);
		ga.addAggregate('COUNT');
		ga.query();
		if (ga.next()) {
			return parseInt(ga.getAggregate('COUNT'), 10) || 0;
		}
		return 0;
	},
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 4: Commit**

```bash
git add src/server/IscanAppFilesScanner.server.js
git commit -m "Add Group B dedicated queries to IscanAppFilesScanner, gated by includeExtended"
```

---

### Task 4: `IscanTableScanner` — dictionary override detection

**Files:**
- Modify: `src/server/IscanTableScanner.server.js`

**Interfaces:**
- Produces: `profileTable(tableName)`'s return value gains `dictionary_overrides` (`[{name, scope}]`) and `dictionary_override_count` (Number). Task 5 (`IscanScanOrchestrator._profileOwnedTables`/`_writeTableProfiles`) reads these two new keys.

- [ ] **Step 1: Add `_getTableOwningScope` and update `_getAppAddedFields` to capture `sys_scope`**

Replace:

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

with:

```javascript
	/**
	 * Every field on tableName, regardless of which scope added it. Also
	 * captures each field's own sys_scope so profileTable() can flag
	 * dictionary overrides (a field whose scope differs from the
	 * table's own owning scope).
	 * @param {String} tableName
	 * @returns {Array} [{name, internal_type, reference, sys_scope}]
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
				reference: dict.getValue('reference'),
				sys_scope: dict.getValue('sys_scope')
			});
		}
		return fields;
	},

	/**
	 * Resolves a table's own owning scope by name. Self-contained rather
	 * than threaded in as a parameter — profileTable() is deliberately
	 * scope-agnostic (see its own doc comment) so it keeps working for
	 * Single Table mode's OOB case; this is the one extra lookup needed
	 * to compare a field's scope against its table's scope.
	 * @param {String} tableName
	 * @returns {String} sys_scope sys_id, or '' if not found
	 */
	_getTableOwningScope: function(tableName) {
		var db = new GlideRecord('sys_db_object');
		db.addQuery('name', tableName);
		db.setLimit(1);
		db.query();
		return db.next() ? db.getValue('sys_scope') : '';
	},
```

- [ ] **Step 2: Update `profileTable` to compute and return dictionary overrides**

Replace:

```javascript
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

with:

```javascript
	profileTable: function(tableName) {
		gs.info('IscanTableScanner.profileTable: profiling table=' + tableName);
		var rowCount = this._countRows(tableName);
		var fields = this._getAppAddedFields(tableName);
		var referenceFields = [];
		var tableOwningScope = this._getTableOwningScope(tableName);
		var dictionaryOverrides = [];

		for (var i = 0; i < fields.length; i++) {
			if (fields[i].internal_type === 'reference') {
				referenceFields.push(fields[i].name + '->' + fields[i].reference);
			}
			if (fields[i].sys_scope && fields[i].sys_scope !== tableOwningScope) {
				dictionaryOverrides.push({ name: fields[i].name, scope: fields[i].sys_scope });
			}
		}

		return {
			row_count: rowCount,
			fields: fields,
			reference_fields: referenceFields,
			dictionary_overrides: dictionaryOverrides,
			dictionary_override_count: dictionaryOverrides.length
		};
	},
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 4: Commit**

```bash
git add src/server/IscanTableScanner.server.js
git commit -m "Add dictionary override detection to IscanTableScanner.profileTable()"
```

---

### Task 5: `IscanScanOrchestrator` — wire Group A/B counts and dictionary overrides

**Files:**
- Modify: `src/server/IscanScanOrchestrator.server.js`

**Interfaces:**
- Consumes: `IscanAppFilesScanner.scanApp(appScopeSysId, includeExtended)` (Task 3), `IscanTableScanner.profileTable(tableName)`'s new `dictionary_overrides`/`dictionary_override_count` keys (Task 4), `gs.getProperty('x_nold_iscan.include_extended_counts_on_full_scan', 'false')` (Task 1).

- [ ] **Step 1: Compute `includeExtended` and pass it to `scanApp`, extend `automationCounts`**

In `_scanOneApp`, replace:

```javascript
        var files = this.appFilesScanner.scanApp(appSysId)
        var automationCounts = {
            business_rules: files.business_rules.length,
            script_includes: files.script_includes.length,
            acls: files.acls.length,
            ui_actions: files.ui_actions.length,
            flows: files.flows.length,
        }
```

with:

```javascript
        var scanMode = run.getValue('scan_mode')
        var includeExtended =
            scanMode !== 'full' || gs.getProperty('x_nold_iscan.include_extended_counts_on_full_scan', 'false') === 'true'
        var files = this.appFilesScanner.scanApp(appSysId, includeExtended)
        var automationCounts = {
            business_rules: files.business_rules.length,
            script_includes: files.script_includes.length,
            acls: files.acls.length,
            ui_actions: files.ui_actions.length,
            flows: files.flows.length,
            client_scripts: files.client_scripts.length,
            ui_policies: files.ui_policies.length,
            scheduled_jobs: files.scheduled_jobs.length,
            notifications: files.notifications.length,
            scripted_rest_apis: files.scripted_rest_apis.length,
            transform_maps: files.transform_maps.length,
            catalog_items: files.catalog_items.length,
            workflows: files.workflows.length,
            subflows: files.subflows.length,
            atf_tests: files.atf_tests.length,
            reports: files.reports.length,
            fix_scripts: files.fix_scripts.length,
            processors: files.processors.length,
            data_policies: files.data_policies.length,
            inbound_email_actions: files.inbound_email_actions.length,
            dashboards: files.dashboards.length,
            pa_indicators: files.pa_indicators.length,
            service_portals: files.service_portals.length,
            service_portal_widgets: files.service_portal_widgets.length,
            flow_actions: files.flow_actions.length,
            catalog_variables: files.catalog_variables.length,
            choices: files.choice_count,
        }
```

- [ ] **Step 2: Write the 22 new columns onto the result record**

Immediately after the existing `result.setValue('integration_count', integrationCount)` line, add:

```javascript
        result.setValue('client_script_count', automationCounts.client_scripts)
        result.setValue('ui_policy_count', automationCounts.ui_policies)
        result.setValue('scheduled_job_count', automationCounts.scheduled_jobs)
        result.setValue('notification_count', automationCounts.notifications)
        result.setValue('scripted_rest_api_count', automationCounts.scripted_rest_apis)
        result.setValue('transform_map_count', automationCounts.transform_maps)
        result.setValue('catalog_item_count', automationCounts.catalog_items)
        result.setValue('workflow_count', automationCounts.workflows)
        result.setValue('subflow_count', automationCounts.subflows)
        result.setValue('atf_test_count', automationCounts.atf_tests)
        result.setValue('report_count', automationCounts.reports)
        result.setValue('fix_script_count', automationCounts.fix_scripts)
        result.setValue('processor_count', automationCounts.processors)
        result.setValue('data_policy_count', automationCounts.data_policies)
        result.setValue('inbound_email_action_count', automationCounts.inbound_email_actions)
        result.setValue('dashboard_count', automationCounts.dashboards)
        result.setValue('pa_indicator_count', automationCounts.pa_indicators)
        result.setValue('service_portal_count', automationCounts.service_portals)
        result.setValue('service_portal_widget_count', automationCounts.service_portal_widgets)
        result.setValue('choice_count', automationCounts.choices)
        result.setValue('flow_action_count', automationCounts.flow_actions)
        result.setValue('catalog_variable_count', automationCounts.catalog_variables)
```

(Keep every existing `result.setValue(...)` line before and after this block exactly as-is — this only adds new lines, in the same spot the plan's design doc's §1 schema list appears in, for readability.)

- [ ] **Step 3: Fold dictionary overrides onto each table object in `_profileOwnedTables`**

Replace:

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
        }
        return tables
    },
```

- [ ] **Step 4: Write the 2 new columns in `_writeTableProfiles`**

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
            tableRow.insert()
            gs.info(
                'IscanScanOrchestrator._writeTableProfiles: table=' +
                    tables[i].name +
                    ' row_count=' +
                    tables[i].row_count +
                    ' field_count=' +
                    tables[i].fields.length
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

- [ ] **Step 5: Mention override count in `_scanOneTable`'s log line (Single Table mode's no-owning-app path)**

Replace:

```javascript
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

with:

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

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 7: Commit**

```bash
git add src/server/IscanScanOrchestrator.server.js
git commit -m "Wire Group A/B artifact counts and dictionary overrides into the scan pipeline"
```

---

### Task 6: Docs sync — mark Counting sub-spec implemented

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `CLAUDE.md`'s Counting heading**

Change `**Counting (sub-spec 2 — design approved, not yet implemented):**` to `**Counting (sub-spec 2 — IMPLEMENTED):**`. Leave the body content as-is (it accurately describes what was built).

- [ ] **Step 2: Update the status file**

In `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`, change the `## Sub-spec 2: Counting — IN PROGRESS (brainstorming)` heading to `## Sub-spec 2: Counting — DONE` and add one line underneath pointing to this plan file and its spec, matching the format of the "Sub-spec 1: Modes — DONE" section above it.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md
git commit -m "Mark Counting sub-spec implemented in docs"
```

---

## Self-review notes

- **Spec coverage**: §1 schema → Task 1; §2 Group A → Task 2; §3 Group B → Task 3; §4 dictionary overrides → Task 4; wiring across all of §2-4 into the existing scan pipeline → Task 5. All 4 design sections have a corresponding task.
- **Type/signature consistency**: `scanApp(appScopeSysId, includeExtended)` is called with 2 arguments only in Task 5 (the only caller). `profileTable(tableName)`'s new return keys (`dictionary_overrides`, `dictionary_override_count`) are consumed only in `_profileOwnedTables` (Task 5) — `_scanOneTable`'s existing call already reads `profile.dictionary_override_count` after Task 5 Step 5, consistent with Task 4's new return shape.
- **No ATF changes**: confirmed no task in this plan touches `tests/atf_tests.json`, per the global constraint.
