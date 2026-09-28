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
 *   - Run report    (x_nold_iscan_run)    -> every app scanned in that run
 *   - Result report (x_nold_iscan_result) -> one scanned app, full detail
 */
var IscanReportGenerator = Class.create();
// Scoped app (x_nold_iscan) referencing the global-scope
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
	 * x_nold_iscan_run. sysparm_run_id = sys_id of the run record.
	 * @returns {String} sys_id of the attached PDF (sys_attachment), or '' on failure
	 */
	generateRunReportAjax: function() {
		var runSysId = this.getParameter('sysparm_run_id');
		return this.generateRunReport(runSysId);
	},

	/**
	 * GlideAjax entry point for the "Download Report" UI Action on
	 * x_nold_iscan_result. sysparm_result_id = sys_id of the result record.
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
		var run = new GlideRecord('x_nold_iscan_run');
		if (!run.get(runSysId)) {
			gs.error('IscanReportGenerator.generateRunReport: no run record found for sys_id: ' + runSysId);
			return '';
		}

		var html = this._buildRunReportHtml(run);
		// No '.pdf' suffix: convertToPDFWithHeaderFooter appends it (files came out '.pdf.pdf').
		var pdfName = 'sn-instance-scan run ' + run.getValue('sys_id');
		var result = this._convertToPdf(html, 'x_nold_iscan_run', runSysId, pdfName);
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
		var result = new GlideRecord('x_nold_iscan_result');
		if (!result.get(resultSysId)) {
			gs.error('IscanReportGenerator.generateResultReport: no result record found for sys_id: ' + resultSysId);
			return '';
		}

		var html = this._buildResultReportHtml(result);
		var appName = new GlideRecord('sys_app');
		appName.get(result.getValue('app'));
		var pdfName = 'sn-instance-scan ' + (appName.getValue('name') || result.getValue('app'));
		var pdfResult = this._convertToPdf(html, 'x_nold_iscan_result', resultSysId, pdfName);
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
	 * @param {GlideRecord} result - an x_nold_iscan_result record
	 * @returns {Array} [{type: 'warning'|'info', text: String}]
	 */
	_computeStatusFlags: function(result) {
		var flags = [];

		if (result.getValue('scan_mode_used') === 'app_files_fallback') {
			flags.push({ type: 'warning', text: 'Scanned via Application Files fallback (limited data)' });
		}

		var overrideAgg = new GlideAggregate('x_nold_iscan_table');
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

		var crossref = new GlideRecord('x_nold_iscan_crossref');
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
	 * @param {GlideRecord} result - an x_nold_iscan_result record
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

		var tableAgg = new GlideAggregate('x_nold_iscan_table');
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

		var overrideAgg = new GlideAggregate('x_nold_iscan_table');
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

		var zeroRowAgg = new GlideAggregate('x_nold_iscan_table');
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

		var customizationAgg = new GlideAggregate('x_nold_iscan_global_customization');
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

	_isTrue: function(value) {
		return value === 'true' || value === '1' || value === true;
	},

	_boolLabel: function(value) {
		return this._isTrue(value) ? 'Yes' : 'No';
	},

	/**
	 * Shared stylesheet for every table in the report. Fixes overflow: a
	 * long unbreakable cell value (e.g. a dotted plugin ID like
	 * "com.glide.delete_recovery.partial_undelete") used to push total
	 * table width past the page's printable area, since browser-default
	 * auto column sizing is content-driven with no wrap. table-layout:fixed
	 * forces columns to honor the <colgroup> widths set per table (see
	 * _colgroup()) instead of expanding to fit content; word-break lets a
	 * long single-token value wrap inside its column instead of overflowing
	 * it. Prepended once per generated HTML document (both report builders
	 * call this at the top) — fix it here once, not per table.
	 * @returns {String} <style> block
	 */
	_reportStyles: function() {
		return '<style>' +
			'table { width:100%; table-layout:fixed; border-collapse:collapse; margin-bottom:10px; }' +
			'th, td { border:1px solid #999; padding:4px 6px; font-size:9px; ' +
			'word-wrap:break-word; overflow-wrap:break-word; word-break:break-word; ' +
			'text-align:left; vertical-align:top; }' +
			'th { background:#eee; font-weight:bold; }' +
			'</style>';
	},

	/**
	 * Explicit per-column widths so table-layout:fixed has something to
	 * honor — without this, table-layout:fixed alone would just split
	 * columns evenly, which is wrong for tables mixing a wide text column
	 * (app/table/plugin name) with several narrow numeric-count columns.
	 * @param {Array} widths - percentages, should sum to 100
	 * @returns {String} <colgroup>
	 */
	_colgroup: function(widths) {
		var cols = widths.map(function(w) { return '<col style="width:' + w + '%">'; });
		return '<colgroup>' + cols.join('') + '</colgroup>';
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
		parts.push(this._reportStyles());
		parts.push('<h1>sn-instance-scan — Run Report</h1>');
		parts.push('<p><b>Scan mode:</b> ' + this._esc(run.getValue('scan_mode')) +
			' &nbsp; <b>Status:</b> ' + this._esc(run.getValue('status')) +
			' &nbsp; <b>Requested by:</b> ' + this._esc(run.getDisplayValue('requested_by')) + '</p>');
		parts.push('<p><b>Started:</b> ' + this._esc(run.getDisplayValue('started')) +
			' &nbsp; <b>Completed:</b> ' + this._esc(run.getDisplayValue('completed')) +
			' &nbsp; <b>Apps scanned:</b> ' + this._esc(run.getValue('app_count')) + '</p>');
		parts.push('<p><a href="' + this._recordUrl('x_nold_iscan_run', run.getUniqueValue()) +
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
		parts.push('<table>');
		parts.push(this._colgroup([20, 12, 8, 9, 9, 8, 7, 8, 8, 11]));
		parts.push('<tr><th>Application</th><th>Scan Mode Used</th><th>Tables</th>' +
			'<th>Business Rules</th><th>Script Includes</th><th>Flows</th>' +
			'<th>ACLs</th><th>UI Actions</th><th>Integrations</th><th>Status</th></tr>');

		var result = new GlideRecord('x_nold_iscan_result');
		result.addQuery('run', run.getUniqueValue());
		result.query();

		while (result.next()) {
			parts.push('<tr>');
			parts.push('<td><a href="' + this._recordUrl('x_nold_iscan_result', result.getUniqueValue()) +
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
		var customization = new GlideRecord('x_nold_iscan_global_customization');
		customization.addQuery('run', run.getUniqueValue());
		customization.addNullQuery('result');
		customization.query();
		if (customization.hasNext()) {
			parts.push('<h2>Customizations on base-system tables (no owning app)</h2>');
			parts.push('<p><i>Tables with no owning application (global/OOB) that a customer scope has ' +
				'customized — the table itself isn\'t custom, but these fields/artifacts on it are. ' +
				'Found while profiling a table directly (Single Table mode, or Full mode\'s table-only ' +
				'fallback scopes) rather than through a specific app\'s own scan.</i></p>');
			parts.push('<table>');
			parts.push(this._colgroup([20, 40, 40]));
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

		// Modules mode (scan_mode='modules', instance-wide, no per-app
		// result rows) — sys_plugins profile written directly against the
		// run, same run-keyed precedent as x_nold_iscan_global_customization's
		// no-owning-app rows above. Rendered whenever any
		// x_nold_iscan_module rows exist for this run (defensive
		// hasNext() gate, mirrors every other section here, rather than
		// branching on scan_mode directly).
		var moduleRow = new GlideRecord('x_nold_iscan_module');
		moduleRow.addQuery('run', run.getUniqueValue());
		moduleRow.query();
		if (moduleRow.hasNext()) {
			parts.push('<h2>Installed Modules</h2>');
			parts.push('<table>');
			// Plugin ID is the long, unbreakable-string column (e.g.
			// "com.glide.delete_recovery.partial_undelete") that overflowed
			// the page before this fix — widest column on purpose.
			parts.push(this._colgroup([23, 40, 13, 13, 11]));
			parts.push('<tr><th>Name</th><th>Plugin ID</th><th>Active (sys_plugins)</th>' +
				'<th>Active (Confirmed)</th><th>Status Mismatch</th></tr>');
			while (moduleRow.next()) {
				parts.push('<tr>');
				parts.push('<td>' + this._esc(moduleRow.getValue('name')) + '</td>');
				parts.push('<td>' + this._esc(moduleRow.getValue('plugin_id')) + '</td>');
				parts.push('<td>' + this._boolLabel(moduleRow.getValue('active_flag')) + '</td>');
				parts.push('<td>' + this._boolLabel(moduleRow.getValue('active_confirmed')) + '</td>');
				parts.push('<td>' + (this._isTrue(moduleRow.getValue('status_mismatch')) ? '⚠️ Yes' : 'No') + '</td>');
				parts.push('</tr>');
			}
			parts.push('</table>');
		}

		// AI Agent Discovery mode (scan_mode='ai_agents', instance-wide, no
		// per-app result rows) — same run-keyed precedent as Installed
		// Modules above. Rendered whenever any x_nold_iscan_ai_agent rows
		// exist for this run. Grouped by layer so native/confirmed findings
		// aren't buried among heuristic ones; confidence gets its own icon
		// column (✅ confirmed vs ❓ needs review) reusing the same
		// icon-column pattern as the Status column elsewhere in this report.
		var aiAgentRow = new GlideRecord('x_nold_iscan_ai_agent');
		aiAgentRow.addQuery('run', run.getUniqueValue());
		aiAgentRow.orderBy('layer');
		aiAgentRow.query();
		if (aiAgentRow.hasNext()) {
			parts.push('<h2>AI Agent Discovery</h2>');
			parts.push('<table>');
			parts.push(this._colgroup([12, 20, 38, 15, 15]));
			parts.push('<tr><th>Layer</th><th>Name</th><th>Detail</th><th>Source Table</th><th>Confidence</th></tr>');
			while (aiAgentRow.next()) {
				var confirmed = aiAgentRow.getValue('confidence') === 'confirmed';
				parts.push('<tr>');
				parts.push('<td>' + this._esc(aiAgentRow.getDisplayValue('layer')) + '</td>');
				parts.push('<td>' + this._esc(aiAgentRow.getValue('name')) + '</td>');
				parts.push('<td>' + this._esc(aiAgentRow.getValue('detail')) + '</td>');
				parts.push('<td>' + this._esc(aiAgentRow.getValue('source_table')) + '</td>');
				parts.push('<td>' + (confirmed ? '✅ Confirmed' : '❓ Needs Review') + '</td>');
				parts.push('</tr>');
			}
			parts.push('</table>');
		}

		// CMDB & CSDM Health (scan_mode='cmdb_health', or a Full scan with
		// include_cmdb_health_on_full_scan on). Run-keyed like the two sections
		// above; rendered whenever this run has a CMDB Health summary row.
		parts.push(this._buildCmdbHealthHtml(run));

		// Full per-app detail, not just the summary row above — every
		// section already built for the individual Result report (status,
		// recommendations, itemized artifact inventory, tables, cross-
		// references, base-system customizations) embedded inline here,
		// one per scanned app. Reuses _buildResultReportHtml() as-is
		// rather than duplicating any of its content — this is the whole
		// "documented in the Instance Scan Result record" ask, sourced
		// from the exact same builder the standalone Result PDF uses.
		var resultDetail = new GlideRecord('x_nold_iscan_result');
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

	/**
	 * "CMDB & CSDM Health" section of the Run report. Follows the upstream
	 * scorer's markdown order (score_results.py main) and report_template.md
	 * sections 3 and 5: header facts, headline score, score by theme, CSDM stage
	 * readiness, CSDM population, findings worst first with playbook KB links,
	 * detail for failing and warning checks, not applicable / not assessed with
	 * reasons, then the top-25 CI inventory.
	 *
	 * The narrative parts of that template (executive interpretation, root-cause
	 * clusters, roadmap waves) are deliberately NOT generated here - they come
	 * from an LLM using the "Copy CMDB Health LLM Context" export.
	 *
	 * Ordering and measure strings reuse IscanCmdbHealthScorer.order() and
	 * formatMeasure() - the same code the parity test proves against the Python
	 * scorer - rather than a second implementation here. pct is recomputed from
	 * count/total instead of read back from the decimal column, so a column
	 * rounding step can never shift a displayed percentage.
	 * @param {GlideRecord} run
	 * @returns {String} HTML, or '' when this run has no CMDB Health data
	 */
	_buildCmdbHealthHtml: function(run) {
		var sum = new GlideRecord('x_nold_iscan_cmdb_summary');
		sum.addQuery('run', run.getUniqueValue());
		sum.query();
		if (!sum.next()) {
			return '';
		}
		var self = this;
		var scorer = new IscanCmdbHealthScorer();
		var catalog = new IscanCmdbHealthCatalog().get();
		var LABEL = IscanCmdbHealthScorer.LABEL;
		var json = function(field, fallback) {
			try { return JSON.parse(sum.getValue(field) || '') || fallback; } catch (e) { return fallback; }
		};
		var num = function(v) { return v === '' || v === null || v === undefined ? null : parseInt(v, 10); };
		var meta = json('meta', {});
		var themes = json('theme_scores', []);
		var stages = json('stage_readiness', []);
		var pop = json('csdm_population', {});
		var inventory = json('inventory', []);
		var byId = {};
		for (var ci = 0; ci < catalog.checks.length; ci++) byId[catalog.checks[ci].id] = catalog.checks[ci];

		var parts = [];
		// Wrapping applies to the WHOLE section, not only table cells. The
		// "Where:" lines carry encoded queries with no spaces
		// (install_status!=7^ORinstall_statusISEMPTY^...), and _reportStyles()
		// only enables word-break on th/td - so those list items ran off the
		// A4 page. Both properties inherit, so one wrapper covers p/li/h4.
		// Same failure class as the 2026-07-29 table overflow fix (CLAUDE.md).
		parts.push('<div style="word-break:break-word;overflow-wrap:anywhere;">');
		parts.push('<h2>CMDB &amp; CSDM Health</h2>');

		// ---- header facts (score_results.py prints these under the title) ----
		var facts = [];
		facts.push('<b>Instance:</b> ' + this._esc(meta.instance || 'n/a') + ' &middot; <b>Build:</b> ' + this._esc(meta.build || 'n/a') +
			' &middot; <b>Generated:</b> ' + this._esc(meta.generated || 'n/a'));
		if (meta.ci_total !== null && meta.ci_total !== undefined) {
			facts.push('<b>CIs:</b> ' + IscanCmdbHealthScorer.commas(meta.ci_total) + ' total, ' +
				IscanCmdbHealthScorer.commas(meta.ci_active || 0) + ' non-retired; <b>relationships:</b> ' +
				IscanCmdbHealthScorer.commas(meta.rel_total || 0));
		}
		if (meta.relationship_density !== null && meta.relationship_density !== undefined) {
			facts.push('<b>Relationship density:</b> ' + Number(meta.relationship_density).toFixed(2) + ' relationships per non-retired CI');
		}
		var maxIterate = meta.config && meta.config.maxIterate;
		if (meta.max_iterate_warning || (maxIterate !== undefined && maxIterate < 50000)) {
			facts.push('<b>Warning:</b> collected with maxIterate=' + this._esc(maxIterate) +
				' - record-by-record checks may be truncated; re-run with the default (200000) for a real assessment.');
		}
		if (meta.custom_class_count !== null && meta.custom_class_count !== undefined) {
			facts.push('<b>CMDB classes:</b> ' + this._esc(meta.cmdb_class_count) + ' (' + this._esc(meta.custom_class_count) + ' custom)');
		}
		if (meta.apps) {
			var df = meta.apps.data_foundations_dashboard;
			facts.push('<b>Data Foundations dashboard installed:</b> ' + (df && df.length ? 'yes' : 'no') +
				'; <b>Service Graph Connectors:</b> ' + ((meta.apps.service_graph_connectors || []).length));
		}
		if (sum.getValue('access_gaps')) {
			facts.push('<b>Not readable from this scope:</b> ' + this._esc(sum.getValue('access_gaps')) +
				' - checks that depend on these tables are recorded as not assessed, not as zero.');
		}
		if (meta.collector_error) {
			facts.push('<b>Collector error:</b> ' + this._esc(meta.collector_error) + ' - every check is recorded as not assessed.');
		}
		parts.push('<p>' + facts.join('<br/>') + '</p>');

		// ---- headline ----
		var overall = num(sum.getValue('overall_score'));
		parts.push('<p><b>Overall health score: ' + (overall === null ? 'n/a' : overall + '/100') + '</b> ' +
			'(weighted High=3, Medium=2, Low=1; ' + this._esc(sum.getValue('checks_scored')) + ' checks scored). ' +
			'Fail: ' + this._esc(sum.getValue('fail_count')) + ' &middot; Warn: ' + this._esc(sum.getValue('warn_count')) +
			' &middot; Pass: ' + this._esc(sum.getValue('pass_count')) + ' &middot; N/A: ' + this._esc(sum.getValue('na_count')) +
			' &middot; Not assessed: ' + this._esc(sum.getValue('not_assessed_count')) + '</p>');

		// ---- score by theme ----
		parts.push('<h3>Score by theme</h3><table>');
		parts.push(this._colgroup([44, 12, 11, 11, 11, 11]));
		parts.push('<tr><th>Theme</th><th>Score</th><th>Fail</th><th>Warn</th><th>Pass</th><th>N/A / not assessed</th></tr>');
		themes.forEach(function(t) {
			parts.push('<tr><td>' + self._esc(t.theme + ' - ' + t.description) + '</td><td>' + (t.score === null ? '-' : t.score) +
				'</td><td>' + t.fail + '</td><td>' + t.warn + '</td><td>' + t.pass + '</td><td>' + t.other + '</td></tr>');
		});
		parts.push('</table>');

		// ---- CSDM stage readiness ----
		parts.push('<h3>CSDM stage readiness</h3>');
		parts.push('<p>Foundation combines the Foundation, Hygiene and Integration themes; later stages use their own checks.</p><table>');
		parts.push(this._colgroup([18, 12, 70]));
		parts.push('<tr><th>Stage</th><th>Score</th><th>Assessment</th></tr>');
		stages.forEach(function(st) {
			parts.push('<tr><td>' + self._esc(st.stage) + '</td><td>' + (st.score === null ? '-' : st.score) + '</td><td>' + self._esc(st.label) + '</td></tr>');
		});
		parts.push('</table>');

		// ---- CSDM population ----
		var popKeys = [];
		for (var pk in pop) if (pop.hasOwnProperty(pk)) popKeys.push(pk);
		if (popKeys.length) {
			parts.push('<h3>CSDM population</h3><table>');
			parts.push(this._colgroup([70, 30]));
			parts.push('<tr><th>Entity</th><th>Records</th></tr>');
			popKeys.forEach(function(k) {
				parts.push('<tr><td>' + self._esc(k.replace(/_/g, ' ')) + '</td><td>' +
					(pop[k] === null || pop[k] === undefined ? 'not collected' : self._esc(pop[k])) + '</td></tr>');
			});
			parts.push('</table>');
		}

		// ---- load the check rows into the scorer's row shape ----
		var rows = [];
		var cr = new GlideRecord('x_nold_iscan_cmdb_check');
		cr.addQuery('run', run.getUniqueValue());
		cr.query();
		while (cr.next()) {
			var check = byId[cr.getValue('check_id')];
			if (!check) continue;
			var res = {
				count: num(cr.getValue('count')),
				total: num(cr.getValue('total')),
				samples: cr.getValue('samples') ? String(cr.getValue('samples')).split('\n') : [],
				note: cr.getValue('note') || '',
			};
			var pct = check.kind === 'pct' && res.count !== null && res.total ? (100.0 * res.count) / res.total : null;
			rows.push({ id: check.id, check: check, res: res, status: cr.getValue('status'), pct: pct });
		}
		var ordered = scorer.order(rows);
		var kbHtml = function(chk) {
			var links = scorer.kbLinks(chk, catalog.kb_url);
			if (!links.length) return 'CSDM best practice';
			return links.map(function(l) { return '<a href="' + self._esc(l.url) + '">' + self._esc(l.kb) + '</a>'; }).join(', ');
		};

		// ---- findings, worst first ----
		parts.push('<h3>Findings (worst first)</h3><table>');
		parts.push(this._colgroup([10, 8, 9, 35, 20, 18]));
		parts.push('<tr><th>Status</th><th>ID</th><th>Priority</th><th>Check</th><th>Measure</th><th>Playbook</th></tr>');
		ordered.forEach(function(r) {
			parts.push('<tr><td>' + LABEL[r.status] + '</td><td>' + self._esc(r.id) + '</td><td>' + self._esc(r.check.priority) +
				'</td><td>' + self._esc(r.check.title) + '</td><td>' + self._esc(scorer.formatMeasure(r.check, r.res, r.pct)) +
				'</td><td>' + kbHtml(r.check) + '</td></tr>');
		});
		parts.push('</table>');

		// ---- detail for failing and warning checks ----
		var failing = ordered.filter(function(r) { return r.status === 'fail' || r.status === 'warn'; });
		if (failing.length) {
			parts.push('<h3>Detail for failing and warning checks</h3>');
			failing.forEach(function(r) {
				var c = r.check;
				parts.push('<h4>' + self._esc(c.id + ' - ' + c.title) + ' (' + LABEL[r.status] + ')</h4><ul>');
				parts.push('<li><b>Measure:</b> ' + self._esc(scorer.formatMeasure(c, r.res, r.pct)) + ' &middot; <b>Priority:</b> ' +
					self._esc(c.priority) + ' &middot; <b>Theme:</b> ' + self._esc(c.theme) + '</li>');
				parts.push('<li><b>Playbook:</b> ' + kbHtml(c) + '</li>');
				parts.push('<li><b>Where:</b> ' + self._esc(c.table) + ' - ' + self._esc(c.issue_query) + '</li>');
				if (r.res.note) parts.push('<li><b>Collector note:</b> ' + self._esc(r.res.note) + '</li>');
				if (r.res.samples.length) parts.push('<li><b>Examples:</b> ' + self._esc(r.res.samples.slice(0, 8).join('; ')) + '</li>');
				parts.push('<li><b>Recommended action:</b> ' + self._esc(c.action) + '</li></ul>');
			});
		}

		// ---- not applicable / not assessed, with reasons ----
		var na = rows.filter(function(r) { return r.status === 'n_a' || r.status === 'not_assessed'; });
		if (na.length) {
			parts.push('<h3>Not applicable / not assessed</h3><ul>');
			na.forEach(function(r) {
				parts.push('<li><b>' + self._esc(r.id) + '</b> ' + self._esc(r.check.title) + ' - ' + LABEL[r.status] + ': ' +
					self._esc(r.res.note || (r.status === 'n_a' ? 'no records in population' : 'no data provided')) + '</li>');
			});
			parts.push('</ul>');
		}

		// ---- CI inventory ----
		if (inventory.length) {
			parts.push('<h3>CI inventory (top classes, non-retired)</h3><table>');
			parts.push(this._colgroup([75, 25]));
			parts.push('<tr><th>Class</th><th>CIs</th></tr>');
			inventory.slice(0, 25).forEach(function(i) {
				parts.push('<tr><td>' + self._esc(i.cls) + '</td><td>' + IscanCmdbHealthScorer.commas(i.n) + '</td></tr>');
			});
			parts.push('</table>');
		}

		parts.push('</div>');
		return parts.join('\n');
	},

	_buildResultReportHtml: function(result) {
		var parts = [];
		parts.push(this._reportStyles());
		parts.push('<h1>sn-instance-scan — ' + this._esc(result.getDisplayValue('app')) + '</h1>');
		parts.push(this._renderStatusDetail(this._computeStatusFlags(result)));
		parts.push('<p><b>Scan date:</b> ' + this._esc(result.getDisplayValue('scan_date')) +
			' &nbsp; <b>Scan mode used:</b> ' + this._esc(result.getValue('scan_mode_used')) + '</p>');
		parts.push('<p><a href="' + this._recordUrl('x_nold_iscan_result', result.getUniqueValue()) +
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

		// The full self-contained architecture briefing, persisted on every
		// scan regardless of GenAI availability (see IscanScanOrchestrator).
		// Plain text (buildPrompt() joins sections with newlines, not markup),
		// so it's rendered the same pre-formatted way as the Run report's
		// Scan Findings Log rather than injected as raw HTML like summary_text.
		if (result.getValue('llm_context')) {
			parts.push('<h2>LLM Context</h2>');
			parts.push('<pre style="white-space:pre-wrap;font-family:monospace;font-size:11px">' +
				this._esc(result.getValue('llm_context')) + '</pre>');
		}

		parts.push('<h2>Tables</h2>');
		var tableRow = new GlideRecord('x_nold_iscan_table');
		tableRow.addQuery('result', result.getUniqueValue());
		tableRow.query();

		if (!tableRow.hasNext()) {
			parts.push('<p><i>No table profiles available (fallback mode, or no owned tables found).</i></p>');
		} else {
			parts.push('<table>');
			parts.push(this._colgroup([15, 12, 10, 8, 8, 27, 10, 10]));
			parts.push('<tr><th>Table</th><th>Extends</th><th>Well-Known Base</th>' +
				'<th>Row Count</th><th>Field Count</th><th>Reference Fields</th>' +
				'<th>Dictionary Overrides</th><th>Inbound References</th></tr>');
			while (tableRow.next()) {
				parts.push('<tr>');
				parts.push('<td><a href="' + this._recordUrl('x_nold_iscan_table', tableRow.getUniqueValue()) +
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
		var appCustomization = new GlideRecord('x_nold_iscan_global_customization');
		appCustomization.addQuery('result', result.getUniqueValue());
		appCustomization.query();
		if (appCustomization.hasNext()) {
			parts.push('<h2>Customizations on base-system tables</h2>');
			parts.push('<p><i>Base-system (global/OOB) tables this app doesn\'t own, but has added custom ' +
				'fields or config artifacts to.</i></p>');
			parts.push('<table>');
			parts.push(this._colgroup([20, 40, 40]));
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

		var crossrefRow = new GlideRecord('x_nold_iscan_crossref');
		crossrefRow.addQuery('table.result', result.getUniqueValue());
		crossrefRow.query();
		if (crossrefRow.hasNext()) {
			parts.push('<h2>Cross-references</h2>');
			parts.push('<table>');
			parts.push(this._colgroup([25, 25, 25, 25]));
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
