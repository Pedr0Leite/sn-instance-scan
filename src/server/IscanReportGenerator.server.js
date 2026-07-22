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
	initialize: function() {},

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
			{ label: 'Catalog variables', field: 'catalog_variable_count' },
			{ label: 'Roles', field: 'role_count' },
			{ label: 'Groups', field: 'group_count' },
			{ label: 'System properties', field: 'system_property_count' }
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
