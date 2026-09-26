/*
 * Script Include: IscanAppSelector
 * Client callable: false
 *
 * Resolves the app list for the 3 scan modes (full / custom_only / manual).
 */
var IscanAppSelector = Class.create();
IscanAppSelector.prototype = {
	initialize: function() {},

	/**
	 * Full scan — every application in sys_app.
	 * @deprecated kept for callers that want the narrower sys_app-only
	 * behavior; IscanScanOrchestrator's 'full' mode now calls
	 * getFullScanScopes() instead, per the original spec's "every
	 * application/scope on the instance" intent.
	 * @returns {Array} array of sys_app sys_ids
	 */
	getFullScanApps: function() {
		var ids = [];
		var app = new GlideRecord('sys_app');
		app.query();
		while (app.next()) {
			ids.push(app.getUniqueValue());
		}
		gs.info('IscanAppSelector.getFullScanApps: resolved ' + ids.length + ' app(s)');
		return ids;
	},

	/**
	 * True full-instance scan — every scope on the instance, not just
	 * ones with a sys_app record. sys_app is Studio/App Manager's
	 * registry (custom + store-installed apps); most OOB plugin scopes
	 * never get a sys_app record at all, so a sys_app-only scan misses
	 * them entirely. For each sys_scope row: if a sys_app record exists,
	 * it goes through the normal per-app pipeline (returned in appIds);
	 * otherwise its owned tables get the same table-only fallback profile
	 * Single Table mode already uses for OOB tables (returned as flat
	 * table names in tableOnlyTables — no grouping by scope needed, since
	 * IscanScanOrchestrator._scanOneTable() only needs a table name).
	 *
	 * The literal 'global' scope is deliberately excluded from the
	 * fallback: global owns the entire base table set (thousands of
	 * tables), and it isn't a coherent "app" to profile table-by-table —
	 * scanning it would flood run.scan_findings with table-only entries for
	 * platform internals with no corresponding app, which was never the
	 * ask. Every other scope (custom, store, or bare OOB plugin) is
	 * covered by one of the two branches below.
	 * @returns {Object} {appIds: Array, tableOnlyTables: Array}
	 */
	getFullScanScopes: function() {
		var appIds = [];
		var tableOnlyTables = [];

		var scope = new GlideRecord('sys_scope');
		scope.query();
		while (scope.next()) {
			var scopeSysId = scope.getUniqueValue();
			if (scope.getValue('scope') === 'global') {
				continue;
			}

			var app = new GlideRecord('sys_app');
			if (app.get(scopeSysId)) {
				appIds.push(scopeSysId);
				continue;
			}

			var tables = new GlideRecord('sys_db_object');
			tables.addQuery('sys_scope', scopeSysId);
			tables.query();
			while (tables.next()) {
				tableOnlyTables.push(tables.getValue('name'));
			}
		}

		gs.info(
			'IscanAppSelector.getFullScanScopes: resolved ' + appIds.length +
				' app(s) and ' + tableOnlyTables.length +
				' table-only fallback table(s) across scopes with no owning sys_app record'
		);
		return { appIds: appIds, tableOnlyTables: tableOnlyTables };
	},

	/**
	 * Custom-only scan — apps whose scope starts with the configured prefix
	 * AND whose source/vendor indicates internal/private (not store-installed).
	 *
	 * NOTE: verify the actual field/value on the target instance before relying
	 * on this in production. Vancouver+ instances carry a cleaner `source`
	 * value on sys_app; older instances may need the sys_store_app absence
	 * check instead. This filter is kept in this single method so it's easy
	 * to adjust per-instance without touching callers.
	 *
	 * @returns {Array} array of sys_app sys_ids
	 */
	getCustomApps: function() {
		var prefix = gs.getProperty('x_nold_iscan.custom_scope_prefix', 'x_');
		var ids = [];

		var app = new GlideRecord('sys_app');
		app.addQuery('scope', 'STARTSWITH', prefix);
		// Exclude store-installed apps: prefer sys_app.source/vendor when
		// present, fall back to "no matching sys_store_app record" as the
		// internal/private signal.
		app.addQuery('source', '!=', 'store');
		app.query();

		while (app.next()) {
			if (this._isStoreInstalled(app)) {
				gs.info('IscanAppSelector.getCustomApps: excluding store-installed app: ' + app.getValue('name'));
				continue;
			}
			ids.push(app.getUniqueValue());
		}
		gs.info('IscanAppSelector.getCustomApps: resolved ' + ids.length + ' custom app(s) with prefix "' + prefix + '"');
		return ids;
	},

	/**
	 * Manual scan — user-selected sys_app records.
	 * Validates each sys_id is a real sys_app record before returning it.
	 * @param {Array} sysIdArray
	 * @returns {Array} array of valid sys_app sys_ids
	 */
	getManualApps: function(sysIdArray) {
		var ids = [];
		if (!sysIdArray || !sysIdArray.length) {
			return ids;
		}

		for (var i = 0; i < sysIdArray.length; i++) {
			var app = new GlideRecord('sys_app');
			if (app.get(sysIdArray[i]) && app.isValidRecord()) {
				ids.push(app.getUniqueValue());
			} else {
				gs.warn('IscanAppSelector.getManualApps: invalid sys_app sys_id skipped: ' + sysIdArray[i]);
			}
		}
		gs.info('IscanAppSelector.getManualApps: resolved ' + ids.length + ' of ' + sysIdArray.length + ' requested app(s)');
		return ids;
	},

	_isStoreInstalled: function(appGr) {
		var storeApp = new GlideRecord('sys_store_app');
		storeApp.addQuery('scope', appGr.getValue('scope'));
		storeApp.query();
		return storeApp.hasNext();
	},

	type: 'IscanAppSelector'
};
