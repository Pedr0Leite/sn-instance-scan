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
		var prefix = gs.getProperty('x_335329_iscan.custom_scope_prefix', 'x_');
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
