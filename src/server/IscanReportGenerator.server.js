/*
 * Script Include: IscanReportGenerator
 * Client callable: true (GlideAjax entry point for the "Download Report"
 * UI Actions)
 *
 * Mirrors the Now Assist Readiness Evaluation "Download Report" pattern:
 * build an HTML write-up with hyperlinks back to the underlying records,
 * convert it to PDF via the platform PDF Generation Utilities plugin, and
 * attach it to the record the user downloaded it from. Selecting a link
 * in the PDF opens that record/table in a separate browser tab, same as
 * NARE's exported assessment PDFs.
 *
 * Two report scopes, same as NARE's Summary vs. individual assessment:
 *   - Run report    (x_335329_iscan_run)    -> every app scanned in that run
 *   - Result report (x_335329_iscan_result) -> one scanned app, full detail
 */
var IscanReportGenerator = Class.create();
// Scoped app (x_335329_iscan) referencing the global-scope
// AbstractAjaxProcessor — the "global." qualifier is required at runtime
// (see IscanScanOrchestrator.server.js for the full explanation); the
// disable comment silences now-sdk's lint, which otherwise mistakes this
// for a Node.js global reference.
// eslint-disable-next-line no-unsupported-node-builtins
IscanReportGenerator.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {
	initialize: function() {
		this.appFilesScanner = new IscanAppFilesScanner();
	},

	// label + files-bucket-key pairs for every itemizable artifact type.
	// choice_count/role_count/group_count/system_property_count are
	// deliberately excluded — count-only per the original Counting
	// sub-spec (roles/groups/properties aren't per-app components), and
	// scanApp() never collects name lists for them.
	ARTIFACT_TYPES: [
		{ label: 'Script includes', key: 'script_includes' },
		{ label: 'Business rules', key: 'business_rules' },
		{ label: 'ACLs', key: 'acls' },
		{ label: 'UI actions', key: 'ui_actions' },
		{ label: 'Flows', key: 'flows' },
		{ label: 'Subflows', key: 'subflows' },
		{ label: 'Flow Designer actions', key: 'flow_actions' },
		{ label: 'Client scripts', key: 'client_scripts' },
		{ label: 'UI policies', key: 'ui_policies' },
		{ label: 'Scheduled jobs', key: 'scheduled_jobs' },
		{ label: 'Inbound email actions', key: 'inbound_email_actions' },
		{ label: 'Scripted REST APIs', key: 'scripted_rest_apis' },
		{ label: 'Scripted REST resources', key: 'scripted_rest_resources' },
		{ label: 'Notifications', key: 'notifications' },
		{ label: 'SLA definitions', key: 'sla_definitions' },
		{ label: 'UI pages', key: 'ui_pages' },
		{ label: 'Transform maps', key: 'transform_maps' },
		{ label: 'Catalog items', key: 'catalog_items' },
		{ label: 'Catalog variables', key: 'catalog_variables' },
		{ label: 'Workflows', key: 'workflows' },
		{ label: 'ATF tests', key: 'atf_tests' },
		{ label: 'Reports', key: 'reports' },
		{ label: 'Fix scripts', key: 'fix_scripts' },
		{ label: 'Processors', key: 'processors' },
		{ label: 'Data policies', key: 'data_policies' },
		{ label: 'Dashboards', key: 'dashboards' },
		{ label: 'PA indicators', key: 'pa_indicators' },
		{ label: 'Service portals', key: 'service_portals' },
		{ label: 'Service portal pages', key: 'service_portal_pages' },
		{ label: 'Service portal widgets', key: 'service_portal_widgets' },
		{ label: 'Events', key: 'events' },
		{ label: 'Import sets', key: 'import_sets' }
	],

	/**
	 * GlideAjax entry point for the "Download Report" UI Action on
	 * x_335329_iscan_run. sysparm_run_id = sys_id of the run record.
	 * @returns {String} sys_id of the attached PDF (sys_attachment), or '' on failure
	 */
	generateRunReportAjax: function() {
		var runSysId = this.getParameter('sysparm_run_id');
		return this.generateRunReport(runSysId);
	},

	/**
	 * GlideAjax entry point for the "Download Report" UI Action on
	 * x_335329_iscan_result. sysparm_result_id = sys_id of the result record.
	 * @returns {String} sys_id of the attached PDF (sys_attachment), or '' on failure
	 */
	generateResultReportAjax: function() {
		var resultSysId = this.getParameter('sysparm_result_id');
		return this.generateResultReport(resultSysId);
	},

	/**
	 * Builds and attaches the full-run report (all scanned apps).
	 * @param {String} runSysId
	 * @returns {String} attachment sys_id, or '' on failure
	 */
	generateRunReport: function(runSysId) {
		gs.info('IscanReportGenerator.generateRunReport: run=' + runSysId);
		var run = new GlideRecord('x_335329_iscan_run');
		if (!run.get(runSysId)) {
			gs.error('IscanReportGenerator.generateRunReport: no run record found for sys_id: ' + runSysId);
			return '';
		}

		var html = this._buildRunReportHtml(run);
		var pdfName = 'sn-instance-scan run ' + run.getValue('sys_id') + '.pdf';
		var result = this._convertToPdf(html, 'x_335329_iscan_run', runSysId, pdfName);
		gs.info('IscanReportGenerator.generateRunReport: status=' + result.status);
		return result.status === 'success' ? result.attachment_id : '';
	},

	/**
	 * Builds and attaches a single-app report.
	 * @param {String} resultSysId
	 * @returns {String} attachment sys_id, or '' on failure
	 */
	generateResultReport: function(resultSysId) {
		gs.info('IscanReportGenerator.generateResultReport: result=' + resultSysId);
		var result = new GlideRecord('x_335329_iscan_result');
		if (!result.get(resultSysId)) {
			gs.error('IscanReportGenerator.generateResultReport: no result record found for sys_id: ' + resultSysId);
			return '';
		}

		var html = this._buildResultReportHtml(result);
		var appName = new GlideRecord('sys_app');
		appName.get(result.getValue('app'));
		var pdfName = 'sn-instance-scan ' + (appName.getValue('name') || result.getValue('app')) + '.pdf';
		var pdfResult = this._convertToPdf(html, 'x_335329_iscan_result', resultSysId, pdfName);
		gs.info('IscanReportGenerator.generateResultReport: status=' + pdfResult.status);
		return pdfResult.status === 'success' ? pdfResult.attachment_id : '';
	},

	_convertToPdf: function(html, targetTable, targetSysId, pdfName) {
		var headerFooterInfo = {
			PageSize: 'A4',
			PageOrientation: 'PORTRAIT',
			GeneratePageNumber: 'true',
			FooterText: 'sn-instance-scan — generated ' + new GlideDateTime().getDisplayValue(),
			FooterTextAlignment: 'BOTTOM_CENTER'
		};

		try {
			var pdfApi = new sn_pdfgeneratorutils.PDFGenerationAPI();
			return pdfApi.convertToPDFWithHeaderFooter(html, targetTable, targetSysId, pdfName, headerFooterInfo);
		} catch (e) {
			gs.error('IscanReportGenerator: PDF conversion failed: ' + e.message);
			return { status: 'failure', message: e.message };
		}
	},

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

	/**
	 * Deterministic, presence/absence-only recommendations — distinct from
	 * _computeStatusFlags (which says what's true about the scan);
	 * these say what to DO about it. No invented numeric thresholds, same
	 * philosophy as the rest of the Report sub-spec — every check here is
	 * a plain "is this present or not," not a judgment call about how
	 * much is "too much." This is the part of the v3 spec asking for
	 * "recommendations flagged wherever config diverges from OOB / best
	 * practice" — previously the report only had status flags and counts,
	 * no actionable guidance.
	 * @param {GlideRecord} result - an x_335329_iscan_result record
	 * @returns {Array} [{text: String}]
	 */
	_computeRecommendations: function(result) {
		var recommendations = [];

		if (result.getValue('scan_mode_used') === 'app_files_fallback') {
			recommendations.push(
				'This scan ran via the Application Files fallback (no table/field data). Grant the ' +
					'scanning user read access to sys_db_object/sys_dictionary for a complete assessment.'
			);
		}

		var tableAgg = new GlideAggregate('x_335329_iscan_table');
		tableAgg.addQuery('result', result.getUniqueValue());
		tableAgg.addAggregate('COUNT');
		tableAgg.query();
		var tableCount = 0;
		if (tableAgg.next()) {
			tableCount = parseInt(tableAgg.getAggregate('COUNT'), 10) || 0;
		}

		if (tableCount > 0 && (parseInt(result.getValue('acl_count'), 10) || 0) === 0) {
			recommendations.push(
				'No ACLs are defined on this app\'s ' + tableCount + ' table(s) — access control is ' +
					'relying entirely on default/inherited platform ACLs. Consider adding explicit table-level ACLs.'
			);
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
			recommendations.push(
				'Review the ' + overrideCount + ' dictionary override(s) on this app\'s tables — a field ' +
					'was added by a different scope than the table\'s owner, which is a common source of ' +
					'confusion during upgrades.'
			);
		}

		var zeroRowAgg = new GlideAggregate('x_335329_iscan_table');
		zeroRowAgg.addQuery('result', result.getUniqueValue());
		zeroRowAgg.addQuery('row_count', 0);
		zeroRowAgg.addAggregate('COUNT');
		zeroRowAgg.query();
		var zeroRowCount = 0;
		if (zeroRowAgg.next()) {
			zeroRowCount = parseInt(zeroRowAgg.getAggregate('COUNT'), 10) || 0;
		}
		if (zeroRowCount > 0 && tableCount > 0) {
			recommendations.push(
				zeroRowCount + ' of this app\'s ' + tableCount + ' table(s) currently have zero rows — ' +
					'confirm they are actively used before relying on this app\'s data model in downstream work.'
			);
		}

		var customizationAgg = new GlideAggregate('x_335329_iscan_global_customization');
		customizationAgg.addQuery('result', result.getUniqueValue());
		customizationAgg.addAggregate('COUNT');
		customizationAgg.query();
		var customizationCount = 0;
		if (customizationAgg.next()) {
			customizationCount = parseInt(customizationAgg.getAggregate('COUNT'), 10) || 0;
		}
		if (customizationCount > 0) {
			recommendations.push(
				'This app customizes ' + customizationCount + ' base-system (global/OOB) table(s) it doesn\'t ' +
					'own — document these customizations before any platform upgrade, since OOB table changes ' +
					'can silently conflict with vendor updates.'
			);
		}

		return recommendations;
	},

	/**
	 * @param {Array} recommendations - _computeRecommendations() return value
	 * @returns {String} HTML
	 */
	_renderRecommendations: function(recommendations) {
		if (!recommendations.length) {
			return '<h2>Recommendations</h2><p>None — no divergence from expected configuration detected.</p>';
		}
		var self = this;
		var items = recommendations.map(function(text) {
			return '<li>' + self._esc(text) + '</li>';
		});
		return '<h2>Recommendations</h2><ul>' + items.join('') + '</ul>';
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

	_buildRunReportHtml: function(run) {
		var parts = [];
		parts.push('<h1>sn-instance-scan — Run Report</h1>');
		parts.push('<p><b>Scan mode:</b> ' + this._esc(run.getValue('scan_mode')) +
			' &nbsp; <b>Status:</b> ' + this._esc(run.getValue('status')) +
			' &nbsp; <b>Requested by:</b> ' + this._esc(run.getDisplayValue('requested_by')) + '</p>');
		parts.push('<p><b>Started:</b> ' + this._esc(run.getDisplayValue('started')) +
			' &nbsp; <b>Completed:</b> ' + this._esc(run.getDisplayValue('completed')) +
			' &nbsp; <b>Apps scanned:</b> ' + this._esc(run.getValue('app_count')) + '</p>');
		parts.push('<p><a href="' + this._recordUrl('x_335329_iscan_run', run.getUniqueValue()) +
			'">Open this scan run</a></p>');

		// The run's own progress log — the one thing this report was
		// missing that made a Single Table / Full-fallback run's PDF look
		// empty (no result records exist for those paths, so this is the
		// only place their findings show up at all). Always rendered when
		// present, for every scan mode, not just the fallback ones.
		var scanFindings = run.getValue('scan_findings');
		if (scanFindings) {
			parts.push('<h2>Scan Findings Log</h2>');
			parts.push('<pre style="white-space:pre-wrap;font-family:monospace;font-size:11px">' +
				this._esc(scanFindings) + '</pre>');
		}

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

		// Scoped to result=empty — these are the table-only fallback rows
		// (no app to attach a result to). Per-app findings (result set)
		// are rendered on each app's own Result report instead, see
		// _buildResultReportHtml.
		var customization = new GlideRecord('x_335329_iscan_global_customization');
		customization.addQuery('run', run.getUniqueValue());
		customization.addNullQuery('result');
		customization.query();
		if (customization.hasNext()) {
			parts.push('<h2>Customizations on base-system tables (no owning app)</h2>');
			parts.push('<p><i>Tables with no owning application (global/OOB) that a customer scope has ' +
				'customized — the table itself isn\'t custom, but these fields/artifacts on it are. ' +
				'Found while profiling a table directly (Single Table mode, or Full mode\'s table-only ' +
				'fallback scopes) rather than through a specific app\'s own scan.</i></p>');
			parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
			parts.push('<tr><th>Table</th><th>Custom Fields</th><th>Custom Artifacts</th></tr>');
			while (customization.next()) {
				parts.push('<tr>');
				parts.push('<td>' + this._esc(customization.getValue('table_name')) + '</td>');
				parts.push('<td>' + this._esc(customization.getValue('custom_field_count')) + ': ' +
					this._esc(customization.getValue('custom_field_list')) + '</td>');
				parts.push('<td>' + this._esc(customization.getValue('custom_artifact_count')) + ': ' +
					this._esc(customization.getValue('custom_artifact_list')) + '</td>');
				parts.push('</tr>');
			}
			parts.push('</table>');
		}

		// Full per-app detail, not just the summary row above — every
		// section already built for the individual Result report (status,
		// recommendations, itemized artifact inventory, tables, cross-
		// references, base-system customizations) embedded inline here,
		// one per scanned app. Reuses _buildResultReportHtml() as-is
		// rather than duplicating any of its content — this is the whole
		// "documented in the Instance Scan Result record" ask, sourced
		// from the exact same builder the standalone Result PDF uses.
		var resultDetail = new GlideRecord('x_335329_iscan_result');
		resultDetail.addQuery('run', run.getUniqueValue());
		resultDetail.query();
		if (resultDetail.hasNext()) {
			parts.push('<h2>Application Detail</h2>');
			while (resultDetail.next()) {
				parts.push('<div style="page-break-before:always;border-top:3px double #333;margin-top:24px;padding-top:12px;">');
				parts.push(this._buildResultReportHtml(resultDetail));
				parts.push('</div>');
			}
		}

		return parts.join('\n');
	},

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

		// Placed right after Status, before the artifact inventory — this
		// is the report's readiness-assessment section (the "recommend
		// wherever config diverges from OOB/best practice" part of the
		// v3 spec), so it needs to be prominent, not buried at the end.
		parts.push(this._renderRecommendations(this._computeRecommendations(result)));

		// Live re-query rather than reading stored *_count columns — those
		// are counts only, and an itemized report needs the underlying
		// name/description lists, which aren't persisted anywhere (see
		// IscanAppFilesScanner.scanApp()). Runs under the caller's own
		// access, same as every other query in this app.
		var files = this.appFilesScanner.scanApp(result.getValue('app'), true);
		var integrations = this._findIntegrations(result.getValue('app'));

		parts.push('<h2>Artifact inventory</h2>');
		parts.push('<ul>');
		parts.push(this._renderItemizedType('Integrations', integrations));
		for (var t = 0; t < this.ARTIFACT_TYPES.length; t++) {
			parts.push(this._renderItemizedType(this.ARTIFACT_TYPES[t].label, files[this.ARTIFACT_TYPES[t].key]));
		}
		parts.push('</ul>');

		parts.push('<h2>Counts only (not per-app components)</h2>');
		parts.push('<ul>');
		parts.push('<li>Choices: ' + this._esc(files.choice_count) + '</li>');
		parts.push('<li>Roles: ' + this._esc(files.role_count) + '</li>');
		parts.push('<li>Groups: ' + this._esc(files.group_count) + '</li>');
		parts.push('<li>System properties: ' + this._esc(files.system_property_count) + '</li>');
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

		// This app's own global-scope customizations — base-system tables
		// it doesn't own but has added fields/artifacts to. Runs in every
		// scan mode (see IscanTableScanner.findAppCustomizationsOnGlobalTables()),
		// so this section can appear on any Result report, not just
		// Single Table / Full-fallback runs.
		var appCustomization = new GlideRecord('x_335329_iscan_global_customization');
		appCustomization.addQuery('result', result.getUniqueValue());
		appCustomization.query();
		if (appCustomization.hasNext()) {
			parts.push('<h2>Customizations on base-system tables</h2>');
			parts.push('<p><i>Base-system (global/OOB) tables this app doesn\'t own, but has added custom ' +
				'fields or config artifacts to.</i></p>');
			parts.push('<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">');
			parts.push('<tr><th>Table</th><th>Custom Fields</th><th>Custom Artifacts</th></tr>');
			while (appCustomization.next()) {
				parts.push('<tr>');
				parts.push('<td>' + this._esc(appCustomization.getValue('table_name')) + '</td>');
				parts.push('<td>' + this._esc(appCustomization.getValue('custom_field_count')) + ': ' +
					this._esc(appCustomization.getValue('custom_field_list')) + '</td>');
				parts.push('<td>' + this._esc(appCustomization.getValue('custom_artifact_count')) + ': ' +
					this._esc(appCustomization.getValue('custom_artifact_list')) + '</td>');
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

	/**
	 * Renders one artifact type's summary count line, followed by a
	 * per-item bullet list (name + description, blank when the item has
	 * no description) — the count line is kept even when items follow, so
	 * the report's first line per type still reads as a quick scan.
	 * @param {String} label
	 * @param {Array} items - [{name, description}]
	 * @returns {String} HTML
	 */
	_renderItemizedType: function(label, items) {
		items = items || [];
		var out = '<li>' + this._esc(label) + ': ' + items.length + '</li>';
		if (items.length) {
			var rows = [];
			for (var i = 0; i < items.length; i++) {
				var name = items[i].name || '(unnamed)';
				var desc = items[i].description ? ' — ' + this._esc(items[i].description) : '';
				rows.push('<li>' + this._esc(name) + desc + '</li>');
			}
			out += '<ul>' + rows.join('') + '</ul>';
		}
		return out;
	},

	/**
	 * Duplicated from IscanScanOrchestrator._findIntegrations() rather than
	 * shared — different script include, and this app's convention is to
	 * keep each script include self-contained rather than introduce a new
	 * cross-include dependency for one small read-only helper.
	 * @param {String} appScopeSysId
	 * @returns {Array} [{name, description}]
	 */
	_findIntegrations: function(appScopeSysId) {
		var integrations = [];
		var sources = [
			{ table: 'sys_rest_message', endpointField: 'rest_endpoint' },
			{ table: 'sys_web_service', endpointField: 'wsdl' }
		];
		for (var s = 0; s < sources.length; s++) {
			var gr = new GlideRecord(sources[s].table);
			if (!gr.isValid()) {
				continue;
			}
			gr.addQuery('sys_scope', appScopeSysId);
			gr.query();
			while (gr.next()) {
				integrations.push({
					name: (gr.getValue('name') || '') + ' (' + sources[s].table + ')',
					description: gr.getValue(sources[s].endpointField) || ''
				});
			}
		}
		return integrations;
	},

	_recordUrl: function(table, sysId) {
		return gs.getProperty('glide.servlet.uri') + table + '.do?sys_id=' + sysId;
	},

	_esc: function(value) {
		if (value === null || value === undefined) {
			return '';
		}
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	},

	type: 'IscanReportGenerator'
});
