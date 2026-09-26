/*
 * Script Include: IscanAiAgentScanner
 * Client callable: false
 *
 * AI Agent Discovery scan mode. Instance-wide, no app/table scoping — same
 * shape as IscanModuleScanner (see CLAUDE.md's "Later addition #4").
 *
 * Ported DETECTION STRATEGY/LAYERING from AgentCensus
 * (github.com/BrianMcD47/AgentCensus, an external Python project) — not its
 * code. Layered inventory of AI agents/tools/credentials, each finding
 * tagged confidence 'confirmed' (structural match against a known table/
 * field) or 'needs_review' (keyword/heuristic match). Every layer also
 * reports which candidate tables the scan account couldn't read as a
 * distinct "access gap" list — never silently folded into "0 found" (same
 * "0 isn't a bug, explain why" precedent this app already uses elsewhere).
 *
 * Layer 1 (native_platform) + Layer 2 (custom_shadow / outbound REST) are
 * mandatory — always run, cheap (small tables / one indexed-ish query).
 * Layer 3 (script keyword scan) is gated behind
 * x_nold_iscan.include_ai_agent_keyword_scan (default false) — a CONTAINS
 * query on the `script` field across every row of 4 automation tables,
 * instance-wide, is real per-instance perf cost, same rationale as
 * Counting's include_extended_counts_on_full_scan. Layers 4 (flow_designer)
 * and 5 (credential) always run — name/value lookups on comparatively small
 * tables.
 */
var IscanAiAgentScanner = Class.create();
IscanAiAgentScanner.prototype = {
	initialize: function() {
		// Confirmed via ServiceNow docs (intelligent-experiences/na-aia-reference.md):
		// the AI Agent Studio / Now Assist AI agents table set. Build Agent
		// trial app tables are NOT included — no confirmed table names were
		// found in the docs corpus for that trial app; skipped rather than
		// guessed (see CLAUDE.md's verify-before-go-live convention).
		this.NATIVE_TABLES = [
			{ table: 'sn_aia_agent', label: 'AI Agent' },
			{ table: 'sn_aia_usecase', label: 'Agentic Workflow (Use Case)' },
			{ table: 'sn_aia_tool', label: 'AI Agent Tool' },
			{ table: 'sn_aia_team', label: 'AI Agent Team' }
		];

		// Hostname fragments for major LLM providers, verified against docs
		// where possible. Substring match against sys_rest_message.rest_endpoint
		// (case-insensitive) — used ONLY for Layer 2's 'confirmed' match, so
		// these are deliberately specific (full-ish hostnames), not bare
		// provider names, to avoid false "confirmed" positives.
		this.LLM_PROVIDER_HOSTNAMES = [
			'openai.com', 'openai.azure.com', 'anthropic.com',
			'bedrock-runtime', 'amazonaws.com/bedrock',
			'generativelanguage.googleapis.com', 'cohere.ai', 'mistral.ai',
			'huggingface.co'
		];

		// Broader provider/library name fragments used for heuristic
		// (needs_review-only) matching in Layers 3-5: script bodies, flow
		// names, property values, credential alias names. Kept separate
		// from LLM_PROVIDER_HOSTNAMES because a bare name like "openai" is
		// too weak to call 'confirmed', but is exactly what shows up in a
		// script body or an alias named "OpenAI_Key".
		this.PROVIDER_KEYWORDS = [
			'openai', 'anthropic', 'claude', 'bedrock', 'generativelanguage',
			'cohere', 'mistral', 'langchain', 'huggingface'
		];
		this.SCRIPT_KEYWORD_TABLES = [
			{ table: 'sys_script', field: 'script', label: 'Business Rule' },
			{ table: 'sys_script_include', field: 'script', label: 'Script Include' },
			{ table: 'sysauto_script', field: 'script', label: 'Scheduled Job' },
			{ table: 'sys_ui_action', field: 'script', label: 'UI Action' }
		];
	},

	/**
	 * Layer 1: native platform AI Agent Studio metadata. Per-table
	 * canRead() gate, checked BEFORE querying — same deterministic
	 * convention as IscanTableScanner.canAccessMetadata()/
	 * IscanModuleScanner.canReadPlugins(), never a try/catch fallback.
	 * isValid()===false (table doesn't exist — plugin not installed) is a
	 * DIFFERENT, expected outcome from canRead()===false (table exists,
	 * scan account denied) — only the latter is an access gap worth
	 * surfacing; a missing table is normal on most instances.
	 * @returns {Object} {findings, accessGaps}
	 */
	scanNativePlatform: function() {
		var findings = [];
		var accessGaps = [];
		for (var i = 0; i < this.NATIVE_TABLES.length; i++) {
			var spec = this.NATIVE_TABLES[i];
			var gr = new GlideRecord(spec.table);
			if (!gr.isValid()) {
				continue;
			}
			if (!gr.canRead()) {
				accessGaps.push(spec.table);
				continue;
			}
			gr.query();
			while (gr.next()) {
				findings.push({
					layer: 'native_platform',
					name: gr.getValue('name') || gr.getValue('sys_name') || spec.label,
					detail: spec.label + ' (' + spec.table + ')',
					source_table: spec.table,
					confidence: 'confirmed'
				});
			}
		}
		gs.info('IscanAiAgentScanner.scanNativePlatform: found ' + findings.length + ' finding(s), ' + accessGaps.length + ' access gap(s)');
		return { findings: findings, accessGaps: accessGaps };
	},

	/**
	 * Layer 2: outbound integration structural match — sys_rest_message
	 * endpoints matched against known LLM provider hostnames. 'confirmed'
	 * confidence: it either structurally matches a known hostname or it
	 * doesn't. Same table/endpoint-field pairing
	 * IscanScanOrchestrator._findIntegrations already reads elsewhere in
	 * this app.
	 * @returns {Object} {findings, accessGaps}
	 */
	scanOutboundIntegrations: function() {
		var findings = [];
		var accessGaps = [];
		var gr = new GlideRecord('sys_rest_message');
		if (!gr.isValid()) {
			return { findings: findings, accessGaps: accessGaps };
		}
		if (!gr.canRead()) {
			accessGaps.push('sys_rest_message');
			return { findings: findings, accessGaps: accessGaps };
		}
		gr.query();
		while (gr.next()) {
			var endpoint = (gr.getValue('rest_endpoint') || '').toLowerCase();
			var matchedHost = this._matchAny(endpoint, this.LLM_PROVIDER_HOSTNAMES);
			if (matchedHost) {
				findings.push({
					layer: 'custom_shadow',
					name: gr.getValue('name') || '(unnamed REST message)',
					detail: 'Outbound REST endpoint matches known LLM provider (' + matchedHost + '): ' + endpoint,
					source_table: 'sys_rest_message',
					confidence: 'confirmed'
				});
			}
		}
		gs.info('IscanAiAgentScanner.scanOutboundIntegrations: found ' + findings.length + ' finding(s)');
		return { findings: findings, accessGaps: accessGaps };
	},

	/**
	 * Layer 3: script keyword scan across Business Rules, Script Includes,
	 * Scheduled Jobs, and UI Actions — gated behind
	 * x_nold_iscan.include_ai_agent_keyword_scan (default false). Real
	 * perf cost: a CONTAINS query on the `script` field across every row
	 * of 4 tables, instance-wide. Always needs_review — a keyword match in
	 * a script body is a heuristic, never structural proof.
	 * @returns {Object} {findings, accessGaps}
	 */
	scanScriptKeywords: function() {
		var findings = [];
		var accessGaps = [];
		for (var t = 0; t < this.SCRIPT_KEYWORD_TABLES.length; t++) {
			var spec = this.SCRIPT_KEYWORD_TABLES[t];
			var gr = new GlideRecord(spec.table);
			if (!gr.isValid()) {
				continue;
			}
			if (!gr.canRead()) {
				accessGaps.push(spec.table);
				continue;
			}
			this._addOrConditions(gr, spec.field, this.PROVIDER_KEYWORDS);
			gr.query();
			while (gr.next()) {
				findings.push({
					layer: 'custom_shadow',
					name: gr.getValue('name') || gr.getValue('sys_name') || '(unnamed)',
					detail: spec.label + ' script body contains an LLM-provider keyword',
					source_table: spec.table,
					confidence: 'needs_review'
				});
			}
		}
		gs.info('IscanAiAgentScanner.scanScriptKeywords: found ' + findings.length + ' finding(s)');
		return { findings: findings, accessGaps: accessGaps };
	},

	/**
	 * Layer 4: Flow Designer flows with LLM-provider-shaped names, plus
	 * installed IntegrationHub action/spoke definitions matching the same
	 * keywords. Table/field names flagged low-confidence per CLAUDE.md's
	 * existing convention (same list as sysevent_register/
	 * sys_import_set_source) — verify against the target instance. Always
	 * needs_review.
	 * @returns {Object} {findings, accessGaps}
	 */
	scanFlowDesigner: function() {
		var findings = [];
		var accessGaps = [];

		var flow = new GlideRecord('sys_hub_flow');
		if (flow.isValid()) {
			if (!flow.canRead()) {
				accessGaps.push('sys_hub_flow');
			} else {
				this._addOrConditions(flow, 'name', this.PROVIDER_KEYWORDS);
				flow.query();
				while (flow.next()) {
					findings.push({
						layer: 'flow_designer',
						name: flow.getValue('name'),
						detail: 'Flow name matches an LLM-provider keyword',
						source_table: 'sys_hub_flow',
						confidence: 'needs_review'
					});
				}
			}
		}

		var actionDef = new GlideRecord('sys_hub_action_type_definition');
		if (actionDef.isValid()) {
			if (!actionDef.canRead()) {
				accessGaps.push('sys_hub_action_type_definition');
			} else {
				this._addOrConditions(actionDef, 'name', this.PROVIDER_KEYWORDS);
				actionDef.query();
				while (actionDef.next()) {
					findings.push({
						layer: 'flow_designer',
						name: actionDef.getValue('name'),
						detail: 'Installed IntegrationHub action/spoke matches an LLM-provider keyword',
						source_table: 'sys_hub_action_type_definition',
						confidence: 'needs_review'
					});
				}
			}
		}

		gs.info('IscanAiAgentScanner.scanFlowDesigner: found ' + findings.length + ' finding(s)');
		return { findings: findings, accessGaps: accessGaps };
	},

	/**
	 * Layer 5: configuration — system properties and Connection & Credential
	 * Aliases whose value/name references an LLM provider. sys_alias_id's
	 * exact table name is UNVERIFIED against the docs corpus (no direct hit
	 * found while researching this) — guarded with isValid() so an instance
	 * without it just yields an empty result, not an error. Always
	 * needs_review.
	 * @returns {Object} {findings, accessGaps}
	 */
	scanConfiguration: function() {
		var findings = [];
		var accessGaps = [];

		var prop = new GlideRecord('sys_properties');
		if (prop.isValid()) {
			if (!prop.canRead()) {
				accessGaps.push('sys_properties');
			} else {
				this._addOrConditions(prop, 'value', this.PROVIDER_KEYWORDS);
				prop.query();
				while (prop.next()) {
					findings.push({
						layer: 'credential',
						name: prop.getValue('name'),
						detail: 'System property value references a known LLM provider',
						source_table: 'sys_properties',
						confidence: 'needs_review'
					});
				}
			}
		}

		// sys_alias_id: Connection & Credential Alias definitions. Table
		// name UNVERIFIED (see doc comment above) — isValid() guard covers it.
		var alias = new GlideRecord('sys_alias_id');
		if (alias.isValid()) {
			if (!alias.canRead()) {
				accessGaps.push('sys_alias_id');
			} else {
				alias.query();
				while (alias.next()) {
					var aliasName = (alias.getValue('name') || '').toLowerCase();
					if (this._matchAny(aliasName, this.PROVIDER_KEYWORDS)) {
						findings.push({
							layer: 'credential',
							name: alias.getValue('name'),
							detail: 'Connection & Credential Alias name references a known LLM provider',
							source_table: 'sys_alias_id',
							confidence: 'needs_review'
						});
					}
				}
			}
		}

		gs.info('IscanAiAgentScanner.scanConfiguration: found ' + findings.length + ' finding(s)');
		return { findings: findings, accessGaps: accessGaps };
	},

	_matchAny: function(textLower, needles) {
		for (var i = 0; i < needles.length; i++) {
			if (textLower.indexOf(needles[i]) !== -1) {
				return needles[i];
			}
		}
		return '';
	},

	_addOrConditions: function(gr, field, needles) {
		var qc = null;
		for (var i = 0; i < needles.length; i++) {
			if (!qc) {
				qc = gr.addQuery(field, 'CONTAINS', needles[i]);
			} else {
				qc.addOrCondition(field, 'CONTAINS', needles[i]);
			}
		}
		return qc;
	},

	type: 'IscanAiAgentScanner'
};
