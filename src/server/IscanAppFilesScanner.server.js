/*
 * Script Include: IscanAppFilesScanner
 * Client callable: false
 *
 * ACL-denial fallback. Yields no row counts / field lists (no table
 * access) — callers must record that explicitly, never omit it silently.
 */
var IscanAppFilesScanner = Class.create();
IscanAppFilesScanner.prototype = {
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
			wf_workflow: 'workflows',
			sys_script_fix: 'fix_scripts',
			sys_processor: 'processors',
			sys_data_policy2: 'data_policies',
			// Table name needs verification against a real instance —
			// see docs/superpowers/specs/2026-07-21-counting-design.md.
			sysevent_in_email_action: 'inbound_email_actions'
		};
	},

	/**
	 * Enumerates an app's script includes, business rules, ACLs, UI
	 * actions, flows, and ~20 more artifact types via a single
	 * sys_metadata query (Group A), plus (when includeExtended is true)
	 * ~7 more artifact types needing their own dedicated queries
	 * (Group B) — see CLASS_BUCKETS and the Group B helper methods below.
	 * @param {String} appScopeSysId
	 * @param {Boolean} [includeExtended] - whether to also run Group B's
	 *   dedicated queries. Defaults to true if omitted.
	 * @returns {Object} one array (or, for choice_count, a Number) per
	 *   artifact type — see the CLASS_BUCKETS values and Group B keys for
	 *   the full list of object keys.
	 */
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
			scripted_rest_resources: [],
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
			service_portal_pages: [],
			service_portal_widgets: [],
			flow_actions: [],
			catalog_variables: [],
			sla_definitions: [],
			ui_pages: [],
			events: [],
			import_sets: [],
			choice_count: 0,
			role_count: 0,
			group_count: 0,
			system_property_count: 0
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
				name: meta.getValue('name') || meta.getValue('sys_name') || '',
				description: meta.getValue('description') || ''
			});
		}

		if (includeExtended) {
			// PA tables may not carry a direct sys_scope field on all instance versions — needs verification.
			result.dashboards = this._scanSimpleScopedTable(appScopeSysId, 'pa_dashboards');
			// PA tables may not carry a direct sys_scope field on all instance versions — needs verification.
			result.pa_indicators = this._scanSimpleScopedTable(appScopeSysId, 'pa_indicators');
			result.service_portals = this._scanSimpleScopedTable(appScopeSysId, 'sp_portal');
			result.service_portal_pages = this._scanSimpleScopedTable(appScopeSysId, 'sp_page');
			result.service_portal_widgets = this._scanSimpleScopedTable(appScopeSysId, 'sp_widget');
			// Table name needs verification against a real instance.
			result.flow_actions = this._scanSimpleScopedTable(appScopeSysId, 'sys_hub_action_type_definition');
			result.catalog_variables = this._scanCatalogVariables(appScopeSysId);
			// Table name needs verification against a real instance —
			// sys_ws_operation may lack a direct `name`, hence the
			// operation_uri fallback baked into _scanSimpleScopedTable.
			result.scripted_rest_resources = this._scanSimpleScopedTable(appScopeSysId, 'sys_ws_operation');
			// SLA definition table name needs verification against a real
			// instance (contract_sla on most versions).
			result.sla_definitions = this._scanSimpleScopedTable(appScopeSysId, 'contract_sla');
			// UI pages: added as a Group B simple-scoped-table scan rather
			// than a CLASS_BUCKETS entry — unconfirmed whether sys_ui_page
			// extends sys_metadata on all instance versions.
			result.ui_pages = this._scanSimpleScopedTable(appScopeSysId, 'sys_ui_page');
			// Events (Event Registrations) and Import Sets — from the
			// original v3 "count everything" list, added later than the
			// rest of Counting. Table names are low-confidence, same as
			// several others above — verify against the real instance:
			// `sysevent_register` (event registration definitions) and
			// `sys_import_set_source` (configured Import Set sources) are
			// the closest stock ServiceNow equivalents, but neither is
			// confirmed to carry a direct `sys_scope` field on every
			// version.
			result.events = this._scanSimpleScopedTable(appScopeSysId, 'sysevent_register');
			result.import_sets = this._scanSimpleScopedTable(appScopeSysId, 'sys_import_set_source');
			result.choice_count = this._countChoices(appScopeSysId);
			// Per the original v3 spec: count roles, groups, and system
			// properties per scope. Count-only (no name list), same
			// precedent as choice_count above.
			result.role_count = this._countScopedRecords(appScopeSysId, 'sys_user_role', 'sys_scope');
			result.group_count = this._countScopedRecords(appScopeSysId, 'sys_user_group', 'sys_scope');
			result.system_property_count = this._countScopedRecords(appScopeSysId, 'sys_properties', 'sys_scope');
		}

		this._logBucketCounts(appScopeSysId, result);
		return result;
	},

	/**
	 * Group B helper: {sys_id, name, description} list for any table that
	 * carries a direct sys_scope field. Covers dashboards, PA indicators,
	 * service portals/pages/widgets, Flow Designer custom action
	 * definitions, Scripted REST resources, SLA definitions, and UI pages
	 * — all share this exact query shape. Falls back to `operation_uri`
	 * for tables (sys_ws_operation) with no `name`/`sys_name` field.
	 * @param {String} appScopeSysId
	 * @param {String} tableName
	 * @returns {Array} [{sys_id, name, description}]
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
				name: gr.getValue('name') || gr.getValue('sys_name') || gr.getValue('operation_uri') || '',
				description: gr.getValue('description') || ''
			});
		}
		return items;
	},

	/**
	 * Group B helper: COUNT-only tally (no name list, same precedent as
	 * _countChoices) for any table whose per-app ownership is a plain
	 * scope field. Guards against a table that doesn't actually carry
	 * that field at all — e.g. sys_user_group has NO sys_scope column on
	 * stock ServiceNow, since groups aren't scoped metadata the way a
	 * role or property can be. Querying a nonexistent field would
	 * otherwise silently drop the condition and count EVERY row instead
	 * of zero — checked via sys_dictionary first so a missing field
	 * returns an honest 0, not a wrong number. Table/field existence
	 * here is flagged low-confidence, same as the other instance-dependent
	 * items already tracked in CLAUDE.md — verify against the real target
	 * instance before relying on group_count in particular.
	 * @param {String} appScopeSysId
	 * @param {String} tableName
	 * @param {String} scopeField
	 * @returns {Number}
	 */
	_countScopedRecords: function(appScopeSysId, tableName, scopeField) {
		var fieldCheck = new GlideRecord('sys_dictionary');
		fieldCheck.addQuery('name', tableName);
		fieldCheck.addQuery('element', scopeField);
		fieldCheck.query();
		if (!fieldCheck.hasNext()) {
			gs.info('IscanAppFilesScanner._countScopedRecords: ' + tableName + '.' + scopeField + ' does not exist on this instance — returning 0');
			return 0;
		}

		var ga = new GlideAggregate(tableName);
		ga.addQuery(scopeField, appScopeSysId);
		ga.addAggregate('COUNT');
		ga.query();
		if (ga.next()) {
			return parseInt(ga.getAggregate('COUNT'), 10) || 0;
		}
		return 0;
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
				name: gr.getValue('name') || '',
				description: gr.getValue('description') || ''
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
				var value = Array.isArray(result[bucket]) ? result[bucket].length : result[bucket];
				parts.push(bucket + '=' + value);
			}
		}
		gs.info('IscanAppFilesScanner.scanApp: appScope=' + appScopeSysId + ' ' + parts.join(' '));
	},

	type: 'IscanAppFilesScanner'
};
