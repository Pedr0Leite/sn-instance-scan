/*
 * Script Include: IscanSummaryGenerator
 * Client callable: false
 *
 * Single-shot GenAI summarization — explicitly NOT an AI Agent/ReAct
 * loop. One prompt, one call, one paragraph back.
 */
var IscanSummaryGenerator = Class.create();
IscanSummaryGenerator.prototype = {
	initialize: function() {},

	/**
	 * Builds the full, self-contained architecture briefing for one
	 * scanned app. Must stand alone: a reader (human or LLM) should never
	 * need to open another ServiceNow record to understand it.
	 *
	 * Emits 5 sections in order — app identity, data model, automation
	 * surface, integration points, and a fixed instruction footer.
	 *
	 * @param {Object} runFacts - {appName, appScope, appVendor, appSource,
	 *   scanDate, scanModeUsed, tables[], automation{}, integrations[]}
	 *   tables[] entries carry {name, extends, well_known_base, fields[],
	 *   reference_fields[]}; automation buckets are arrays of {sys_id, name}.
	 * @returns {String}
	 */
	buildPrompt: function(runFacts) {
		var sections = [];

		sections.push(this._sectionIdentity(runFacts));
		// Section b is omitted entirely (not zero-filled) on the fallback
		// path — see _sectionDataModel for why that distinction matters.
		sections.push(this._sectionDataModel(runFacts));
		sections.push(this._sectionAutomation(runFacts));
		sections.push(this._sectionIntegrations(runFacts));
		sections.push(this.INSTRUCTION_FOOTER);

		return sections.join('\n\n');
	},

	/** Section a — app identity, with scan mode stated in plain language. */
	_sectionIdentity: function(runFacts) {
		var lines = ['## 1. Application identity'];
		lines.push('Name: ' + (runFacts.appName || '(unknown)'));
		lines.push('Scope: ' + (runFacts.appScope || '(unknown)'));
		lines.push('Vendor: ' + (runFacts.appVendor || '(none recorded)'));
		lines.push('Source: ' + (runFacts.appSource || '(none recorded)'));
		lines.push('Scan date: ' + (runFacts.scanDate || '(unknown)'));

		if (runFacts.scanModeUsed === 'app_files_fallback') {
			lines.push('Scan mode: app_files_fallback — the scanning user had no ' +
				'read access to table/field metadata for this application. No table or ' +
				'field data was collected. Only the automation metadata below is available, ' +
				'and it was read from Application Files (sys_metadata).');
		} else {
			lines.push('Scan mode: full_access — the scanning user could read table and ' +
				'field metadata, so the data model section below is complete.');
		}

		return lines.join('\n');
	},

	/**
	 * Section b — data model. Deliberately OMITTED (replaced by a single
	 * explanatory line) on the fallback path rather than emitted with
	 * zeros: a reader seeing "0 tables" would wrongly conclude the app has
	 * no data model, when the truth is we had no access to look.
	 */
	_sectionDataModel: function(runFacts) {
		var lines = ['## 2. Data model'];

		if (runFacts.scanModeUsed === 'app_files_fallback') {
			lines.push('Not available. This application was scanned via the Application ' +
				'Files fallback because the scanning user lacked read access to ' +
				'sys_db_object/sys_dictionary for this scope. This means the data model was ' +
				'NOT inspected — it does not mean the application has no tables. Draw no ' +
				'conclusions about the data model from this scan.');
			return lines.join('\n');
		}

		var tables = runFacts.tables || [];
		if (!tables.length) {
			lines.push('This application owns no tables. Table metadata was readable, so ' +
				'this is a confirmed absence, not a gap in access.');
			return lines.join('\n');
		}

		lines.push('Tables owned by this application: ' + tables.length);

		for (var i = 0; i < tables.length; i++) {
			var t = tables[i];
			lines.push('');
			lines.push('### Table: ' + t.name);
			lines.push('- Extends: ' + (t.extends || '(none — base table)'));
			lines.push('- Well-known base: ' + (t.well_known_base || 'none'));
			if (typeof t.row_count === 'number') {
				lines.push('- Row count: ' + t.row_count);
			}

			var fields = t.fields || [];
			if (fields.length) {
				lines.push('- Fields added by this application (' + fields.length + '):');
				for (var f = 0; f < fields.length; f++) {
					lines.push('    - ' + fields[f].name + ' (' + (fields[f].internal_type || 'unknown type') + ')');
				}
			} else {
				lines.push('- Fields added by this application: none');
			}

			var refs = t.reference_fields || [];
			if (refs.length) {
				lines.push('- Outbound references (relationship graph):');
				for (var r = 0; r < refs.length; r++) {
					lines.push('    - ' + t.name + ' -> ' + refs[r]);
				}
			} else {
				lines.push('- Outbound references: none');
			}
		}

		return lines.join('\n');
	},

	/** Section c — automation surface, with NAMES, not just counts. */
	_sectionAutomation: function(runFacts) {
		var lines = ['## 3. Automation surface'];
		var automation = runFacts.automation || {};

		var buckets = [
			{ key: 'business_rules', label: 'Business rules' },
			{ key: 'script_includes', label: 'Script includes' },
			{ key: 'flows', label: 'Flows' },
			{ key: 'acls', label: 'ACLs' },
			{ key: 'ui_actions', label: 'UI actions' }
		];

		for (var b = 0; b < buckets.length; b++) {
			var items = automation[buckets[b].key] || [];
			lines.push('');
			lines.push(buckets[b].label + ' (' + items.length + '):');
			if (!items.length) {
				lines.push('    - none');
				continue;
			}
			for (var i = 0; i < items.length; i++) {
				lines.push('    - ' + (items[i].name || '(unnamed)'));
			}
		}

		return lines.join('\n');
	},

	/** Section d — integration points, name + endpoint where available. */
	_sectionIntegrations: function(runFacts) {
		var lines = ['## 4. Integration points'];
		var integrations = runFacts.integrations || [];

		if (!integrations.length) {
			lines.push('No REST messages or web services reference this scope.');
			return lines.join('\n');
		}

		lines.push('Records referencing this scope: ' + integrations.length);
		for (var i = 0; i < integrations.length; i++) {
			var it = integrations[i];
			var line = '    - [' + (it.type || 'unknown') + '] ' + (it.name || '(unnamed)');
			if (it.endpoint) {
				line += ' — endpoint: ' + it.endpoint;
			}
			lines.push(line);
		}

		return lines.join('\n');
	},

	/**
	 * Section e — fixed instruction footer. Identical text every time (NOT
	 * templated per-app) so the whole block is copy-paste-and-go: the user
	 * shouldn't have to supply their own prompt alongside it.
	 */
	INSTRUCTION_FOOTER: [
		'## 5. What to do with this',
		'',
		'Using only the information above, write a well-documented architecture summary ' +
			'of this ServiceNow application. Cover, in this order:',
		'',
		'1. Purpose — what this application appears to do, inferred from its table names, ' +
			'what those tables extend, and the names of its automation.',
		'2. Data model shape — how many custom tables, how they relate to each other and to ' +
			'platform base tables, and what the reference graph implies about the domain.',
		'3. Integration points — what this application talks to outside itself, if anything.',
		'4. Automation surface — where the behaviour lives (business rules vs. flows vs. ' +
			'script includes) and what that split suggests about how the app was built.',
		'',
		'State your confidence and call out anything you cannot determine from this data. ' +
			'If the data model section says it was not available, treat the data model as ' +
			'UNKNOWN — do not infer that the application has no tables.'
	].join('\n'),

	/**
	 * Generates the summary text via the Generative AI Controller.
	 * Degrades gracefully (returns null) if the capability is unavailable
	 * or disabled — callers must store facts without summary_text in that
	 * case, not fail the whole scan.
	 * @param {Object} runFacts
	 * @returns {String|null}
	 */
	generate: function(runFacts) {
		if (gs.getProperty('x_nold_iscan.genai_enabled', 'true') !== 'true') {
			gs.info('IscanSummaryGenerator.generate: skipped, x_nold_iscan.genai_enabled is false');
			return null;
		}
		if (!this._isGenAIControllerAvailable()) {
			gs.info('IscanSummaryGenerator.generate: skipped, Generative AI Controller API not available on this instance');
			return null;
		}

		// buildPrompt() now returns a full architecture briefing, which for
		// a large app can be far longer than the old terse prompt. The
		// GenAI Controller's real input ceiling is instance- and
		// model-dependent, so it's a property rather than a constant —
		// verify the actual limit on the target instance and tune
		// x_nold_iscan.genai_max_input_chars to match.
		//
		// Only the GenAI *input* is truncated. The persisted llm_context
		// field keeps the full-length text regardless, since that's what
		// the user copies out to an external LLM.
		var prompt = this._truncateForGenAI(this.buildPrompt(runFacts));
		gs.info('IscanSummaryGenerator.generate: invoking Generative AI Controller for app=' + runFacts.appName);

		try {
			// API name/version is instance-dependent on the active Now
			// Assist plugin; verify the exact scripted API against the
			// target instance during build. Kept behind the availability
			// check above so absence never throws.
			var controller = new sn_one_extend.GenerativeAIInvocationAPI();
			var response = controller.execute({
				capability: 'summarization',
				input: prompt
			});
			var output = response ? response.getValue('output') : null;
			gs.info('IscanSummaryGenerator.generate: ' + (output ? 'received summary (' + output.length + ' chars)' : 'no output returned'));
			return output;
		} catch (e) {
			gs.error('IscanSummaryGenerator.generate failed: ' + e.message);
			return null;
		}
	},

	/**
	 * Caps the GenAI Controller input length. Truncates on a line boundary
	 * where possible so the model never receives a half-written fact, and
	 * appends an explicit marker so it knows the briefing was cut short
	 * rather than silently treating a partial list as complete.
	 * @param {String} prompt
	 * @returns {String}
	 */
	_truncateForGenAI: function(prompt) {
		var maxChars = parseInt(gs.getProperty('x_nold_iscan.genai_max_input_chars', '20000'), 10);
		if (isNaN(maxChars) || maxChars <= 0 || prompt.length <= maxChars) {
			return prompt;
		}

		var notice = '\n\n[TRUNCATED: this briefing was shortened to fit the instance GenAI ' +
			'input limit. Some tables, fields, or automation entries are missing below this ' +
			'point. Do not treat the lists above as exhaustive.]';
		var budget = maxChars - notice.length;
		if (budget <= 0) {
			return prompt.substring(0, maxChars);
		}

		var cut = prompt.substring(0, budget);
		var lastNewline = cut.lastIndexOf('\n');
		if (lastNewline > budget * 0.5) {
			cut = cut.substring(0, lastNewline);
		}

		gs.info('IscanSummaryGenerator._truncateForGenAI: prompt truncated from ' +
			prompt.length + ' to ' + (cut.length + notice.length) + ' chars (limit ' + maxChars + ')');
		return cut + notice;
	},

	_isGenAIControllerAvailable: function() {
		return typeof sn_one_extend !== 'undefined' &&
			typeof sn_one_extend.GenerativeAIInvocationAPI !== 'undefined';
	},

	type: 'IscanSummaryGenerator'
};
