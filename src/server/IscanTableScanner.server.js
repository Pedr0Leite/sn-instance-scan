/*
 * Script Include: IscanTableScanner
 * Client callable: false
 *
 * Primary (full-access) path. Runs entirely under the calling user's own
 * access — no elevated privilege, grants nothing new.
 */
var IscanTableScanner = Class.create();
IscanTableScanner.prototype = {
	initialize: function() {
		this.WELL_KNOWN_BASES = ['task', 'cmdb_ci'];
		this.MAX_SUPERCLASS_DEPTH = 3;
	},

	/**
	 * Deterministic gate: can the caller read table/field metadata at all?
	 * Must be checked BEFORE attempting the primary path — this is not a
	 * try/catch fallback.
	 * @returns {boolean}
	 */
	canAccessMetadata: function() {
		var canAccess = new GlideRecord('sys_db_object').canRead() &&
			new GlideRecord('sys_dictionary').canRead();
		gs.info('IscanTableScanner.canAccessMetadata: ' + canAccess);
		return canAccess;
	},

	/**
	 * Enumerates tables owned by an application scope.
	 * @param {String} appScopeSysId - sys_id of the sys_scope record
	 * @returns {Array} array of {name, extends, well_known_base}
	 */
	getOwnedTables: function(appScopeSysId) {
		var tables = [];
		var db = new GlideRecord('sys_db_object');
		db.addQuery('sys_scope', appScopeSysId);
		db.query();

		while (db.next()) {
			var name = db.getValue('name');
			var extendsTable = this._resolveSuperClassChain(db, this.MAX_SUPERCLASS_DEPTH);
			tables.push({
				name: name,
				extends: extendsTable,
				well_known_base: this._classifyWellKnownBase(extendsTable)
			});
		}
		gs.info('IscanTableScanner.getOwnedTables: appScope=' + appScopeSysId + ' found ' + tables.length + ' table(s)');
		return tables;
	},

	/**
	 * Lightweight profile of a single table: row count, complete field
	 * list, reference fields. Deliberately unscoped (no sys_scope filter)
	 * — returns EVERY field on the table, not just ones added by a
	 * particular owning app, so Manual — Single Table mode (which may
	 * point at an OOB table like incident with no single "owning app")
	 * gets a complete picture. This widens field_count/reference_field_list
	 * for all 4 scan modes, not just Single Table — see CLAUDE.md.
	 * @param {String} tableName
	 * @returns {Object} {row_count, fields, reference_fields, dictionary_overrides, dictionary_override_count}
	 */
	profileTable: function(tableName) {
		gs.info('IscanTableScanner.profileTable: profiling table=' + tableName);
		var rowCount = this._countRows(tableName);
		var fields = this._getAppAddedFields(tableName);
		var referenceFields = [];
		var tableOwningScope = this._getTableOwningScope(tableName);
		var dictionaryOverrides = [];

		for (var i = 0; i < fields.length; i++) {
			if (fields[i].internal_type === 'reference') {
				referenceFields.push(fields[i].name + '->' + fields[i].reference);
			}
			if (tableOwningScope && fields[i].sys_scope && fields[i].sys_scope !== tableOwningScope) {
				dictionaryOverrides.push({ name: fields[i].name, scope: fields[i].sys_scope });
			}
		}

		return {
			row_count: rowCount,
			fields: fields,
			reference_fields: referenceFields,
			dictionary_overrides: dictionaryOverrides,
			dictionary_override_count: dictionaryOverrides.length
		};
	},

	/**
	 * Whole-instance search: every field, on ANY table, whose `reference`
	 * points at tableName — i.e. who depends on this table. Not limited
	 * to apps in the current scan run; deliberately unconditional in
	 * every scan mode (one indexed sys_dictionary query per table, not
	 * per app — cheap enough that it isn't gated like Counting's Group B).
	 * @param {String} tableName
	 * @returns {Array} [{referencing_table, referencing_field, referencing_app, referencing_scope}]
	 */
	findInboundReferences: function(tableName) {
		var inbound = [];
		var appCache = {};
		var dict = new GlideRecord('sys_dictionary');
		dict.addQuery('reference', tableName);
		dict.addNotNullQuery('element');
		dict.query();

		while (dict.next()) {
			var referencingTable = dict.getValue('name');
			if (!appCache.hasOwnProperty(referencingTable)) {
				appCache[referencingTable] = this._resolveTableApp(referencingTable);
			}
			var resolved = appCache[referencingTable];
			inbound.push({
				referencing_table: referencingTable,
				referencing_field: dict.getValue('element'),
				referencing_app: resolved.app,
				referencing_scope: resolved.scope
			});
		}

		gs.info('IscanTableScanner.findInboundReferences: table=' + tableName + ' found ' + inbound.length + ' inbound reference(s)');
		return inbound;
	},

	/**
	 * Resolves a table's owning app, if any. Same two-step lookup
	 * (sys_db_object.sys_scope -> sys_app.get(scope)) already used by
	 * IscanScanOrchestrator._resolveSingleTableApp for Single Table
	 * mode's OOB case — duplicated here rather than shared, since that
	 * orchestrator method's job is resolving the SCAN TARGET's app,
	 * while this one resolves an arbitrary REFERENCING table's app
	 * found during a dictionary search; different callers, same shape.
	 * @param {String} tableName
	 * @returns {Object} {app, scope} - app is '' when no sys_app record exists for the scope
	 */
	_resolveTableApp: function(tableName) {
		var scope = this._getTableOwningScope(tableName);
		var appSysId = '';
		if (scope) {
			var app = new GlideRecord('sys_app');
			if (app.get(scope)) {
				appSysId = app.getUniqueValue();
			}
		}
		return { app: appSysId, scope: scope };
	},

	_countRows: function(tableName) {
		// GlideAggregate COUNT, never GlideRecord.getRowCount() — cheaper
		// even though it's still a full index scan on very large tables.
		var ga = new GlideAggregate(tableName);
		ga.addAggregate('COUNT');
		ga.query();
		if (ga.next()) {
			return parseInt(ga.getAggregate('COUNT'), 10) || 0;
		}
		return 0;
	},

	/**
	 * Every field on tableName, regardless of which scope added it. Also
	 * captures each field's own sys_scope so profileTable() can flag
	 * dictionary overrides (a field whose scope differs from the
	 * table's own owning scope).
	 * @param {String} tableName
	 * @returns {Array} [{name, internal_type, reference, sys_scope}]
	 */
	_getAppAddedFields: function(tableName) {
		var fields = [];
		var dict = new GlideRecord('sys_dictionary');
		dict.addQuery('name', tableName);
		dict.addNotNullQuery('element');
		dict.query();

		while (dict.next()) {
			fields.push({
				name: dict.getValue('element'),
				internal_type: dict.getValue('internal_type'),
				reference: dict.getValue('reference'),
				sys_scope: dict.getValue('sys_scope')
			});
		}
		return fields;
	},

	/**
	 * Resolves a table's own owning scope by name. Self-contained rather
	 * than threaded in as a parameter — profileTable() is deliberately
	 * scope-agnostic (see its own doc comment) so it keeps working for
	 * Single Table mode's OOB case; this is the one extra lookup needed
	 * to compare a field's scope against its table's scope.
	 * @param {String} tableName
	 * @returns {String} sys_scope sys_id, or '' if not found
	 */
	_getTableOwningScope: function(tableName) {
		var db = new GlideRecord('sys_db_object');
		db.addQuery('name', tableName);
		db.setLimit(1);
		db.query();
		return db.next() ? db.getValue('sys_scope') : '';
	},

	_resolveSuperClassChain: function(dbObjectGr, maxDepth) {
		var chain = [];
		var current = dbObjectGr;
		var depth = 0;

		while (current && current.getValue('super_class') && depth < maxDepth) {
			var parent = new GlideRecord('sys_db_object');
			if (!parent.get(current.getValue('super_class'))) {
				break;
			}
			chain.push(parent.getValue('name'));
			current = parent;
			depth++;
		}

		return chain.length ? chain[chain.length - 1] : '';
	},

	_classifyWellKnownBase: function(extendsTable) {
		if (!extendsTable) {
			return 'none';
		}
		if (this.WELL_KNOWN_BASES.indexOf(extendsTable) !== -1) {
			return extendsTable;
		}
		return 'other';
	},

	type: 'IscanTableScanner'
};
