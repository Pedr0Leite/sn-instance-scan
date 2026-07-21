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
	 * actions and flows via a single sys_metadata query, bucketed by
	 * sys_class_name in memory.
	 * @param {String} appScopeSysId
	 * @returns {Object} {script_includes, business_rules, acls, ui_actions, flows}
	 */
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

	type: 'IscanAppFilesScanner'
};
