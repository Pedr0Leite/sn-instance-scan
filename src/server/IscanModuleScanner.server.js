/*
 * Script Include: IscanModuleScanner
 * Client callable: false
 *
 * Installed Modules scan mode. Instance-wide, no app/table scoping —
 * unlike every other scanner in this app. Runs entirely under the calling
 * user's own access. Scanner gathers, orchestrator writes — same
 * separation IscanTableScanner uses.
 */
var IscanModuleScanner = Class.create();
IscanModuleScanner.prototype = {
	initialize: function() {},

	/**
	 * Deterministic gate: can the caller read sys_plugins at all? Must be
	 * checked BEFORE querying — same convention as
	 * IscanTableScanner.canAccessMetadata(), never a try/catch fallback.
	 * There is no ACL-denial fallback path for modules mode (unlike the
	 * per-app modes' Application Files fallback) — denial must surface
	 * clearly, not silently produce a zero-row scan.
	 * @returns {boolean}
	 */
	canReadPlugins: function() {
		var canAccess = new GlideRecord('sys_plugins').canRead();
		gs.info('IscanModuleScanner.canReadPlugins: ' + canAccess);
		return canAccess;
	},

	/**
	 * Profiles every installed plugin: sys_plugins' own stored active
	 * flag, cross-checked against GlidePluginManager's live isActive()
	 * result rather than trusted alone (can disagree mid-activation or on
	 * a stale cache). GlidePluginManager is a standard scoped-available
	 * global API, same category as GlideRecord — no `global.` qualifier
	 * needed (unlike AbstractAjaxProcessor).
	 *
	 * VERIFY BEFORE GO-LIVE (same list as sys_app.source, the GenAI
	 * Controller API, and the PDF plugin name — see CLAUDE.md): exact
	 * getValue() serialization of sys_plugins.active on the target
	 * instance. Assumed 'true'/'1' string, matching this app's existing
	 * boolean-as-string comparisons elsewhere.
	 *
	 * @returns {Array} [{name, plugin_id, active_flag, active_confirmed, status_mismatch}]
	 */
	scanModules: function() {
		gs.info('IscanModuleScanner.scanModules: profiling installed plugins');
		var modules = [];
		var pluginManager = new GlidePluginManager();
		var gr = new GlideRecord('sys_plugins');
		gr.query();
		while (gr.next()) {
			var pluginId = gr.getValue('source');
			var rawActive = gr.getValue('active');
			var activeFlag = rawActive === 'true' || rawActive === '1' || rawActive === true;

			var activeConfirmed = false;
			try {
				activeConfirmed = !!pluginManager.isActive(pluginId);
			} catch (e) {
				gs.error('IscanModuleScanner.scanModules: isActive failed for ' + pluginId + ': ' + e.message);
			}

			modules.push({
				name: gr.getValue('name'),
				plugin_id: pluginId,
				active_flag: activeFlag,
				active_confirmed: activeConfirmed,
				status_mismatch: activeFlag !== activeConfirmed
			});
		}
		gs.info('IscanModuleScanner.scanModules: found ' + modules.length + ' plugin(s)');
		return modules;
	},

	type: 'IscanModuleScanner'
};
