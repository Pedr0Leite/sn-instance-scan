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
	 * @returns {Object} {row_count, fields, reference_fields}
	 */
	profileTable: function(tableName) {
		gs.info('IscanTableScanner.profileTable: profiling table=' + tableName);
		var rowCount = this._countRows(tableName);
		var fields = this._getAppAddedFields(tableName);
		var referenceFields = [];

		for (var i = 0; i < fields.length; i++) {
			if (fields[i].internal_type === 'reference') {
				referenceFields.push(fields[i].name + '->' + fields[i].reference);
			}
		}

		return {
			row_count: rowCount,
			fields: fields,
			reference_fields: referenceFields
		};
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
	 * Every field on tableName, regardless of which scope added it.
	 * @param {String} tableName
	 * @returns {Array} [{name, internal_type, reference}]
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
				reference: dict.getValue('reference')
			});
		}
		return fields;
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
