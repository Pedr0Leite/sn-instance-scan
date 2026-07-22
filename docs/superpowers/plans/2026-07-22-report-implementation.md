# Report (Sub-spec 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `IscanReportGenerator`'s Run and Result report HTML with 3 presence/absence status flags and new sections surfacing Counting's extended counts and Cross-refs' dictionary-override/inbound-reference data, per the approved design at `docs/superpowers/specs/2026-07-22-report-design.md`.

**Architecture:** All changes live in `src/server/IscanReportGenerator.server.js`'s two private HTML-building methods (`_buildRunReportHtml`, `_buildResultReportHtml`) plus 4 new small private helpers for flag computation/rendering. No new script include, table, property, or UI Action — `_convertToPdf` and the GlideAjax entry points are untouched.

**Tech Stack:** ServiceNow SDK (`@servicenow/sdk` 4.8.1) + ServiceNow Fluent (`.now.ts`), plain server-side JS script include bodies, `now-sdk build` for compile validation.

## Global Constraints

- Read-only app: no script may write to a scanned table, only to `x_335329_iscan_*` tables. This plan only reads (`GlideRecord`/`GlideAggregate` queries), never writes.
- No numeric-threshold status flags — only the 3 presence/absence checks named below. Do not invent a count-based cutoff anywhere in this plan.
- The 3 status flags are: (1) `scan_mode_used === 'app_files_fallback'` → warning; (2) summed `dictionary_override_count` across the app's `x_335329_iscan_table` rows `> 0` → warning; (3) count of distinct `referencing_app` values (excluding blank, excluding this app's own `sys_app` sys_id) across `x_335329_iscan_crossref` rows tied to this app's tables `> 0` → informational (not a warning).
- No local unit-test runner; `npm run build` is the only automated local check. **Do NOT add ATF test entries for this sub-spec** — `tests/atf_tests.json` is not touched by this plan.
- `x_335329_iscan_crossref.table` is a Reference to `x_335329_iscan_table`, which itself has a `result` Reference to `x_335329_iscan_result` — so `x_335329_iscan_crossref` rows for a given result can be queried with the dot-walked condition `addQuery('table.result', resultSysId)`, no need to first collect table sys_ids into an array.

---

### Task 1: Status flag computation + Run report Status column

**Files:**
- Modify: `src/server/IscanReportGenerator.server.js`

**Interfaces:**
- Produces: `_computeStatusFlags(result)` → `Array` of `{type: 'warning'|'info', text: String}` (empty array = no flags triggered). `_statusIcon(type)` → `String` (single emoji). `_renderStatusIcons(flags)` → `String` (space-joined icons, or `'✅'` if `flags` is empty). `_renderStatusDetail(flags)` → `String` (HTML `<p>`/`<ul>` block, full flag text). Task 2 calls `_computeStatusFlags` and `_renderStatusDetail`; this task's own `_buildRunReportHtml` change calls `_computeStatusFlags` and `_renderStatusIcons`.

- [ ] **Step 1: Add the 4 status-flag helper methods**

In `src/server/IscanReportGenerator.server.js`, immediately after the existing `_convertToPdf` method's closing `},` (right before `_buildRunReportHtml: function(run) {`), add:

```javascript
	/**
	 * Computes this app's status flags from data Counting/Cross-refs
	 * already collect — no new queries beyond what's needed here, no
	 * numeric thresholds (see CLAUDE.md/design doc for why: there's no
	 * real basis for picking a count cutoff, so every flag here is a
	 * plain yes/no check).
	 * @param {GlideRecord} result - an x_335329_iscan_result record
	 * @returns {Array} [{type: 'warning'|'info', text: String}]
	 */
	_computeStatusFlags: function(result) {
		var flags = [];

		if (result.getValue('scan_mode_used') === 'app_files_fallback') {
			flags.push({ type: 'warning', text: 'Scanned via Application Files fallback (limited data)' });
		}

		var overrideAgg = new GlideAggregate('x_335329_iscan_table');
		overrideAgg.addQuery('result', result.getUniqueValue());
		overrideAgg.addAggregate('SUM', 'dictionary_override_count');
		overrideAgg.query();
		var overrideCount = 0;
		if (overrideAgg.next()) {
			overrideCount = parseInt(overrideAgg.getAggregate('SUM', 'dictionary_override_count'), 10) || 0;
		}
		if (overrideCount > 0) {
			flags.push({ type: 'warning', text: overrideCount + ' dictionary override(s) detected' });
		}

		var crossref = new GlideRecord('x_335329_iscan_crossref');
		crossref.addQuery('table.result', result.getUniqueValue());
		crossref.addNotNullQuery('referencing_app');
		crossref.addQuery('referencing_app', '!=', result.getValue('app'));
		crossref.query();
		var dependentApps = {};
		while (crossref.next()) {
			dependentApps[crossref.getValue('referencing_app')] = true;
		}
		var dependentCount = Object.keys(dependentApps).length;
		if (dependentCount > 0) {
			flags.push({ type: 'info', text: dependentCount + ' other app(s) depend on this app\'s tables' });
		}

		return flags;
	},

	_statusIcon: function(type) {
		return type === 'warning' ? '⚠️' : 'ℹ️';
	},

	/**
	 * Condensed icon-only rendering for the Run report's per-app table row.
	 * @param {Array} flags - _computeStatusFlags() return value
	 * @returns {String}
	 */
	_renderStatusIcons: function(flags) {
		if (!flags.length) {
			return '✅';
		}
		var icons = [];
		for (var i = 0; i < flags.length; i++) {
			icons.push(this._statusIcon(flags[i].type));
		}
		return icons.join(' ');
	},

	/**
	 * Full flag text for the Result report's Status line.
	 * @param {Array} flags - _computeStatusFlags() return value
	 * @returns {String} HTML
	 */
	_renderStatusDetail: function(flags) {
		if (!flags.length) {
			return '<p><b>Status:</b> ✅ OK</p>';
		}
		var self = this;
		var items = flags.map(function(flag) {
			return '<li>' + self._statusIcon(flag.type) + ' ' + self._esc(flag.text) + '</li>';
		});
		return '<p><b>Status:</b></p><ul>' + items.join('') + '</ul>';
	},

```

- [ ] **Step 2: Add a Status column to the Run report's per-app table**

Replace:

```javascript
		parts.push('<h2>Applications</h2>');
		parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
		parts.push('<tr><th>Application</th><th>Scan Mode Used</th><th>Tables</th>' +
			'<th>Business Rules</th><th>Script Includes</th><th>Flows</th>' +
			'<th>ACLs</th><th>UI Actions</th><th>Integrations</th></tr>');

		var result = new GlideRecord('x_335329_iscan_result');
		result.addQuery('run', run.getUniqueValue());
		result.query();

		while (result.next()) {
			parts.push('<tr>');
			parts.push('<td><a href="' + this._recordUrl('x_335329_iscan_result', result.getUniqueValue()) +
				'">' + this._esc(result.getDisplayValue('app')) + '</a></td>');
			parts.push('<td>' + this._esc(result.getValue('scan_mode_used')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('table_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('business_rule_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('script_include_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('flow_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('acl_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('ui_action_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('integration_count')) + '</td>');
			parts.push('</tr>');
		}
		parts.push('</table>');
```

with:

```javascript
		parts.push('<h2>Applications</h2>');
		parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
		parts.push('<tr><th>Application</th><th>Scan Mode Used</th><th>Tables</th>' +
			'<th>Business Rules</th><th>Script Includes</th><th>Flows</th>' +
			'<th>ACLs</th><th>UI Actions</th><th>Integrations</th><th>Status</th></tr>');

		var result = new GlideRecord('x_335329_iscan_result');
		result.addQuery('run', run.getUniqueValue());
		result.query();

		while (result.next()) {
			parts.push('<tr>');
			parts.push('<td><a href="' + this._recordUrl('x_335329_iscan_result', result.getUniqueValue()) +
				'">' + this._esc(result.getDisplayValue('app')) + '</a></td>');
			parts.push('<td>' + this._esc(result.getValue('scan_mode_used')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('table_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('business_rule_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('script_include_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('flow_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('acl_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('ui_action_count')) + '</td>');
			parts.push('<td>' + this._esc(result.getValue('integration_count')) + '</td>');
			parts.push('<td>' + this._renderStatusIcons(this._computeStatusFlags(result)) + '</td>');
			parts.push('</tr>');
		}
		parts.push('</table>');
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 4: Commit**

```bash
git add src/server/IscanReportGenerator.server.js
git commit -m "Add status flag computation and Run report Status column"
```

---

### Task 2: Result report — Status line, Extended counts, Tables columns, Cross-references section

**Files:**
- Modify: `src/server/IscanReportGenerator.server.js`

**Interfaces:**
- Consumes: `_computeStatusFlags(result)` and `_renderStatusDetail(flags)` (Task 1).

- [ ] **Step 1: Replace `_buildResultReportHtml` in full**

Replace:

```javascript
	_buildResultReportHtml: function(result) {
		var parts = [];
		parts.push('<h1>sn-instance-scan — ' + this._esc(result.getDisplayValue('app')) + '</h1>');
		parts.push('<p><b>Scan date:</b> ' + this._esc(result.getDisplayValue('scan_date')) +
			' &nbsp; <b>Scan mode used:</b> ' + this._esc(result.getValue('scan_mode_used')) + '</p>');
		parts.push('<p><a href="' + this._recordUrl('x_335329_iscan_result', result.getUniqueValue()) +
			'">Open this result record</a> &nbsp; ' +
			'<a href="' + this._recordUrl('sys_app', result.getValue('app')) + '">Open application record</a></p>');

		if (result.getValue('scan_mode_used') === 'app_files_fallback') {
			parts.push('<p><i>This app was scanned via the Application Files fallback — the requesting ' +
				'user lacked metadata read access, so no table-level data (row counts, fields) is available. ' +
				'Only automation counts below come from sys_metadata.</i></p>');
		}

		parts.push('<h2>Automation surface</h2>');
		parts.push('<ul>');
		parts.push('<li>Business rules: ' + this._esc(result.getValue('business_rule_count')) + '</li>');
		parts.push('<li>Script includes: ' + this._esc(result.getValue('script_include_count')) + '</li>');
		parts.push('<li>Flows: ' + this._esc(result.getValue('flow_count')) + '</li>');
		parts.push('<li>ACLs: ' + this._esc(result.getValue('acl_count')) + '</li>');
		parts.push('<li>UI actions: ' + this._esc(result.getValue('ui_action_count')) + '</li>');
		parts.push('<li>Integrations referencing this scope: ' + this._esc(result.getValue('integration_count')) + '</li>');
		parts.push('</ul>');

		if (result.getValue('summary_text')) {
			parts.push('<h2>Architecture summary</h2>');
			parts.push('<div>' + result.getValue('summary_text') + '</div>');
		}

		parts.push('<h2>Tables</h2>');
		var tableRow = new GlideRecord('x_335329_iscan_table');
		tableRow.addQuery('result', result.getUniqueValue());
		tableRow.query();

		if (!tableRow.hasNext()) {
			parts.push('<p><i>No table profiles available (fallback mode, or no owned tables found).</i></p>');
		} else {
			parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
			parts.push('<tr><th>Table</th><th>Extends</th><th>Well-Known Base</th>' +
				'<th>Row Count</th><th>Field Count</th><th>Reference Fields</th></tr>');
			while (tableRow.next()) {
				parts.push('<tr>');
				parts.push('<td><a href="' + this._recordUrl('x_335329_iscan_table', tableRow.getUniqueValue()) +
					'">' + this._esc(tableRow.getValue('table_name')) + '</a></td>');
				parts.push('<td>' + this._esc(tableRow.getValue('extends_table')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('well_known_base')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('row_count')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('field_count')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('reference_field_list')) + '</td>');
				parts.push('</tr>');
			}
			parts.push('</table>');
		}

		return parts.join('\n');
	},
```

with:

```javascript
	_buildResultReportHtml: function(result) {
		var parts = [];
		parts.push('<h1>sn-instance-scan — ' + this._esc(result.getDisplayValue('app')) + '</h1>');
		parts.push(this._renderStatusDetail(this._computeStatusFlags(result)));
		parts.push('<p><b>Scan date:</b> ' + this._esc(result.getDisplayValue('scan_date')) +
			' &nbsp; <b>Scan mode used:</b> ' + this._esc(result.getValue('scan_mode_used')) + '</p>');
		parts.push('<p><a href="' + this._recordUrl('x_335329_iscan_result', result.getUniqueValue()) +
			'">Open this result record</a> &nbsp; ' +
			'<a href="' + this._recordUrl('sys_app', result.getValue('app')) + '">Open application record</a></p>');

		if (result.getValue('scan_mode_used') === 'app_files_fallback') {
			parts.push('<p><i>This app was scanned via the Application Files fallback — the requesting ' +
				'user lacked metadata read access, so no table-level data (row counts, fields) is available. ' +
				'Only automation counts below come from sys_metadata.</i></p>');
		}

		parts.push('<h2>Automation surface</h2>');
		parts.push('<ul>');
		parts.push('<li>Business rules: ' + this._esc(result.getValue('business_rule_count')) + '</li>');
		parts.push('<li>Script includes: ' + this._esc(result.getValue('script_include_count')) + '</li>');
		parts.push('<li>Flows: ' + this._esc(result.getValue('flow_count')) + '</li>');
		parts.push('<li>ACLs: ' + this._esc(result.getValue('acl_count')) + '</li>');
		parts.push('<li>UI actions: ' + this._esc(result.getValue('ui_action_count')) + '</li>');
		parts.push('<li>Integrations referencing this scope: ' + this._esc(result.getValue('integration_count')) + '</li>');
		parts.push('</ul>');

		var extendedCountFields = [
			{ label: 'Client scripts', field: 'client_script_count' },
			{ label: 'UI policies', field: 'ui_policy_count' },
			{ label: 'Scheduled jobs', field: 'scheduled_job_count' },
			{ label: 'Notifications', field: 'notification_count' },
			{ label: 'Scripted REST APIs', field: 'scripted_rest_api_count' },
			{ label: 'Transform maps', field: 'transform_map_count' },
			{ label: 'Catalog items', field: 'catalog_item_count' },
			{ label: 'Workflows', field: 'workflow_count' },
			{ label: 'Subflows', field: 'subflow_count' },
			{ label: 'ATF tests', field: 'atf_test_count' },
			{ label: 'Reports', field: 'report_count' },
			{ label: 'Fix scripts', field: 'fix_script_count' },
			{ label: 'Processors', field: 'processor_count' },
			{ label: 'Data policies', field: 'data_policy_count' },
			{ label: 'Inbound email actions', field: 'inbound_email_action_count' },
			{ label: 'Dashboards', field: 'dashboard_count' },
			{ label: 'PA indicators', field: 'pa_indicator_count' },
			{ label: 'Service portals', field: 'service_portal_count' },
			{ label: 'Service portal widgets', field: 'service_portal_widget_count' },
			{ label: 'Choices', field: 'choice_count' },
			{ label: 'Flow Designer actions', field: 'flow_action_count' },
			{ label: 'Catalog variables', field: 'catalog_variable_count' }
		];
		var extendedItems = [];
		for (var e = 0; e < extendedCountFields.length; e++) {
			var count = parseInt(result.getValue(extendedCountFields[e].field), 10) || 0;
			if (count > 0) {
				extendedItems.push('<li>' + extendedCountFields[e].label + ': ' + this._esc(count) + '</li>');
			}
		}
		if (extendedItems.length) {
			parts.push('<h2>Extended counts</h2>');
			parts.push('<ul>' + extendedItems.join('') + '</ul>');
		}

		if (result.getValue('summary_text')) {
			parts.push('<h2>Architecture summary</h2>');
			parts.push('<div>' + result.getValue('summary_text') + '</div>');
		}

		parts.push('<h2>Tables</h2>');
		var tableRow = new GlideRecord('x_335329_iscan_table');
		tableRow.addQuery('result', result.getUniqueValue());
		tableRow.query();

		if (!tableRow.hasNext()) {
			parts.push('<p><i>No table profiles available (fallback mode, or no owned tables found).</i></p>');
		} else {
			parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
			parts.push('<tr><th>Table</th><th>Extends</th><th>Well-Known Base</th>' +
				'<th>Row Count</th><th>Field Count</th><th>Reference Fields</th>' +
				'<th>Dictionary Overrides</th><th>Inbound References</th></tr>');
			while (tableRow.next()) {
				parts.push('<tr>');
				parts.push('<td><a href="' + this._recordUrl('x_335329_iscan_table', tableRow.getUniqueValue()) +
					'">' + this._esc(tableRow.getValue('table_name')) + '</a></td>');
				parts.push('<td>' + this._esc(tableRow.getValue('extends_table')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('well_known_base')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('row_count')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('field_count')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('reference_field_list')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('dictionary_override_count')) + '</td>');
				parts.push('<td>' + this._esc(tableRow.getValue('inbound_reference_count')) + '</td>');
				parts.push('</tr>');
			}
			parts.push('</table>');
		}

		var crossrefRow = new GlideRecord('x_335329_iscan_crossref');
		crossrefRow.addQuery('table.result', result.getUniqueValue());
		crossrefRow.query();
		if (crossrefRow.hasNext()) {
			parts.push('<h2>Cross-references</h2>');
			parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
			parts.push('<tr><th>Table</th><th>Referencing Table</th><th>Referencing Field</th><th>Referencing App</th></tr>');
			while (crossrefRow.next()) {
				parts.push('<tr>');
				parts.push('<td>' + this._esc(crossrefRow.getDisplayValue('table')) + '</td>');
				parts.push('<td>' + this._esc(crossrefRow.getValue('referencing_table')) + '</td>');
				parts.push('<td>' + this._esc(crossrefRow.getValue('referencing_field')) + '</td>');
				parts.push('<td>' + this._esc(crossrefRow.getDisplayValue('referencing_app') || 'N/A') + '</td>');
				parts.push('</tr>');
			}
			parts.push('</table>');
		}

		return parts.join('\n');
	},
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `[now-sdk] Build completed successfully`

- [ ] **Step 3: Commit**

```bash
git add src/server/IscanReportGenerator.server.js
git commit -m "Add Extended counts, Tables columns, and Cross-references sections to Result report"
```

---

### Task 3: Docs sync — mark Report sub-spec implemented

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a Report sub-heading to `CLAUDE.md`'s "Instance-assessment extension" section**

In `CLAUDE.md`, immediately after the existing `**Cross-refs (sub-spec 3 — IMPLEMENTED):**` section's closing sentence (before the `## /caveman` heading, or whatever section currently follows Cross-refs), add:

```markdown
**Report (sub-spec 4 — IMPLEMENTED):** `IscanReportGenerator`'s existing
Run/Result report HTML builders gained 3 presence/absence status flags —
no numeric thresholds, since there's no real basis for picking a count
cutoff. Warnings: `scan_mode_used === 'app_files_fallback'` (incomplete
data), and summed `dictionary_override_count > 0` across the app's
`x_335329_iscan_table` rows (a real governance signal — another app
modified a table it doesn't own, or this app did). Informational (not a
warning): count of distinct apps with `x_335329_iscan_crossref` rows
pointing at this app's tables (excluding this app itself) — having
dependents isn't inherently bad. The Run report's per-app table gained a
condensed icon-only Status column; the Result report gained a full Status
line, an "Extended counts" section (Counting's ~22 non-Group-A/B-overlap
counts, zero values skipped), 2 new Tables columns (Dictionary Overrides,
Inbound References — both already stored, just not previously rendered),
and a "Cross-references" section (one row per `x_335329_iscan_crossref`
record tied to the app's tables, omitted entirely when there are none). No
new script include, table, property, or UI Action — `_convertToPdf` and
the GlideAjax entry points are unchanged.
```

- [ ] **Step 2: Update the status file to mark all 4 sub-specs done**

In `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`, change the
`## Sub-spec 4: Report — NOT STARTED` heading to `## Sub-spec 4: Report — DONE`
and replace its body with:

```markdown
Spec: `docs/superpowers/specs/2026-07-22-report-design.md`
Plan: `docs/superpowers/plans/2026-07-22-report-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 3 tasks complete, merged to main
directly — no branch was used). No numeric-threshold flags were added, per
the design's explicit rejection of invented cutoffs.

## All 4 sub-specs complete

Modes → Counting → Cross-refs → Report have all shipped to `main`. Recall
before any go-live: 5 table/field names flagged low-confidence during
Counting still need verification against a real instance (see CLAUDE.md's
Counting section and that design doc's Risks section).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md
git commit -m "Mark Report sub-spec implemented in docs"
```

---

## Self-review notes

- **Spec coverage**: design's "Status flags" section → Task 1 (computation) + Task 1/2 (rendering in both reports); "Run report changes" → Task 1 Step 2; "Result report changes" (Status line, Extended counts, Tables columns, Cross-references) → Task 2 Step 1; doc-sync convention → Task 3. All design sections have a corresponding task.
- **Type/signature consistency**: `_computeStatusFlags(result)` (Task 1) is called identically by both `_buildRunReportHtml` (Task 1) and `_buildResultReportHtml` (Task 2) with a single `result` GlideRecord argument. `_renderStatusIcons`/`_renderStatusDetail` each consume the same `[{type, text}]` shape `_computeStatusFlags` produces — no mismatch between what Task 1 returns and what Task 1/2 render.
- **No ATF changes**: confirmed no task in this plan touches `tests/atf_tests.json`, per the global constraint.
- **No new queries duplicated**: Task 2's Cross-references section and Task 1's dependent-app-count flag both query `x_335329_iscan_crossref` but for different purposes (one needs distinct apps only, the other needs every row rendered) — each uses its own `addQuery('table.result', ...)` call; this is an accepted, intentional duplication (two different result shapes needed), not a bug to fix.
