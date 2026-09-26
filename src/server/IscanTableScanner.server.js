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
		// Set by _countRows() when it detects a cross-scope-privilege /
		// Restricted Caller Access denial (see _detectCrossScopePrivDenial),
		// read and cleared by profileTable() right after. Instance state
		// rather than a return-value tuple from _countRows() — keeps
		// _countRows()'s existing Number return type (row count) unchanged
		// for its other, simpler callers.
		this._lastCrossScopeDenial = '';
	},

	// Exact error signature confirmed against ServiceNow docs (KB2291532,
	// KB0831584): "<op> operation on table '<table>' from scope '<scope>'
	// was denied. The application '<scope>' must declare a cross scope
	// access privilege." This is a DIFFERENT failure class from a plain ACL
	// denial (canAccessMetadata()'s gate, checked before querying) — cross-
	// scope privilege is enforced deeper, at query execution time, and
	// surfaces via getLastErrorMessage() after query()/next() rather than a
	// thrown exception (same mechanism as a Data Policy Exception). Substring
	// match, not a regex — cheaper and this is the one stable phrase across
	// every KB example regardless of table/scope/operation named in it.
	CROSS_SCOPE_DENIAL_SIGNATURE: 'must declare a cross scope access privilege',

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
	 * @returns {Object} {row_count, fields, reference_fields, dictionary_overrides, dictionary_override_count, cross_scope_denial}
	 */
	profileTable: function(tableName) {
		gs.info('IscanTableScanner.profileTable: profiling table=' + tableName);
		this._lastCrossScopeDenial = '';
		var rowCount = this._countRows(tableName);
		// _countRows() is the one query site in this app that reads a
		// scanned app's own DATA table (row counts), as opposed to global
		// platform metadata tables (sys_db_object/sys_dictionary/sys_script/
		// etc, queried everywhere else in this file) — metadata tables are
		// not subject to per-app Caller Access Restrictions, but a scanned
		// app's own business table can be. This is the only reachable site
		// for a cross-scope-privilege denial; see CROSS_SCOPE_DENIAL_SIGNATURE.
		var crossScopeDenial = this._lastCrossScopeDenial;
		this._lastCrossScopeDenial = '';
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
			dictionary_override_count: dictionaryOverrides.length,
			// '' when no denial was detected — a distinct, clearly-labeled
			// finding string otherwise (see CROSS_SCOPE_DENIAL_SIGNATURE /
			// _detectCrossScopePrivDenial). Never surfaced as auto-
			// remediation — log + surface only, per the "no elevated
			// privilege" / "read-only" rules this app is built on.
			cross_scope_denial: crossScopeDenial
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
	 * Detects customizations made ON a base-system (global/OOB) table —
	 * the table itself isn't "custom" (no owning sys_app), but parts of it
	 * can be: custom fields (u_/x_ prefixed elements, or a dictionary row
	 * whose sys_scope differs from the table's own), plus any business
	 * rule / client script / UI policy / ACL targeting the table but owned
	 * by a customer scope. No-ops (applicable: false) for a table that DOES
	 * have an owning sys_app — that's a native custom-app table, already
	 * covered by profileTable()'s dictionary_overrides.
	 * @param {String} tableName
	 * @returns {Object} {applicable, custom_fields, custom_artifacts}
	 */
	findGlobalCustomizations: function(tableName) {
		var owningScope = this._getTableOwningScope(tableName);
		var appCheck = new GlideRecord('sys_app');
		if (owningScope && appCheck.get(owningScope)) {
			return { applicable: false, custom_fields: [], custom_artifacts: [] };
		}

		var customFields = [];
		var dict = new GlideRecord('sys_dictionary');
		dict.addQuery('name', tableName);
		dict.addNotNullQuery('element');
		var fieldCond = dict.addQuery('element', 'STARTSWITH', 'u_');
		fieldCond.addOrCondition('element', 'STARTSWITH', 'x_');
		if (owningScope) {
			fieldCond.addOrCondition('sys_scope', '!=', owningScope);
		}
		dict.query();
		while (dict.next()) {
			customFields.push({
				name: dict.getValue('element'),
				internal_type: dict.getValue('internal_type'),
				scope: dict.getValue('sys_scope')
			});
		}

		var customArtifacts = this._findCustomArtifactsForTable(tableName, owningScope);

		gs.info(
			'IscanTableScanner.findGlobalCustomizations: table=' + tableName +
				' custom_fields=' + customFields.length +
				' custom_artifacts=' + customArtifacts.length
		);
		return { applicable: true, custom_fields: customFields, custom_artifacts: customArtifacts };
	},

	/**
	 * Group B-style dedicated queries: business rules, client scripts, UI
	 * policies, and ACLs targeting tableName, owned by a scope other than
	 * the table's own (or global, when the table has no owning scope at
	 * all). ACL matching uses STARTSWITH tableName + '.' too, since
	 * field-level ACLs are named "<table>.<field>".
	 * @param {String} tableName
	 * @param {String} owningScope
	 * @returns {Array} [{sys_id, name, description, type, scope}]
	 */
	_findCustomArtifactsForTable: function(tableName, owningScope) {
		var artifacts = [];
		var specs = [
			{ table: 'sys_script', label: 'business_rule', match: function(gr) { gr.addQuery('collection', tableName); } },
			{ table: 'sys_script_client', label: 'client_script', match: function(gr) { gr.addQuery('table', tableName); } },
			{ table: 'sys_ui_policy', label: 'ui_policy', match: function(gr) { gr.addQuery('table', tableName); } },
			{
				table: 'sys_security_acl',
				label: 'acl',
				match: function(gr) {
					var q = gr.addQuery('name', tableName);
					q.addOrCondition('name', 'STARTSWITH', tableName + '.');
				}
			}
		];

		for (var i = 0; i < specs.length; i++) {
			var gr = new GlideRecord(specs[i].table);
			if (!gr.isValid()) {
				continue;
			}
			specs[i].match(gr);
			gr.addNotNullQuery('sys_scope');
			if (owningScope) {
				gr.addQuery('sys_scope', '!=', owningScope);
			}
			gr.query();
			while (gr.next()) {
				var scope = gr.getValue('sys_scope');
				if (this._isGlobalScope(scope)) {
					continue;
				}
				artifacts.push({
					sys_id: gr.getUniqueValue(),
					name: gr.getValue('name') || gr.getValue('sys_name') || '',
					description: gr.getValue('description') || '',
					type: specs[i].label,
					scope: scope
				});
			}
		}
		return artifacts;
	},

	_isGlobalScope: function(scopeSysId) {
		if (!scopeSysId) {
			return true;
		}
		var scope = new GlideRecord('sys_scope');
		if (scope.get(scopeSysId)) {
			return scope.getValue('scope') === 'global';
		}
		return false;
	},

	/**
	 * Reverse direction of findGlobalCustomizations(): given the app
	 * CURRENTLY being scanned, finds every base-system (global/OOB) table
	 * that THIS app's scope has customized — a field it added, or a
	 * business rule/client script/UI policy/ACL it owns that targets a
	 * table it doesn't own. This is what makes global-scope customization
	 * detection run in every scan mode: custom_only, manual (App), and
	 * full/single_table's owning-app branches all call this per app being
	 * scanned, via IscanScanOrchestrator._scanOneApp — not just the
	 * table-only fallback paths that findGlobalCustomizations() covers.
	 * @param {String} appScopeSysId
	 * @returns {Array} [{table_name, custom_fields, custom_artifacts}]
	 */
	findAppCustomizationsOnGlobalTables: function(appScopeSysId) {
		var byTable = {};

		var dict = new GlideRecord('sys_dictionary');
		dict.addQuery('sys_scope', appScopeSysId);
		dict.addNotNullQuery('element');
		dict.addNotNullQuery('name');
		dict.query();
		while (dict.next()) {
			var fieldTable = dict.getValue('name');
			if (this._getTableOwningScope(fieldTable) === appScopeSysId) {
				continue;
			}
			if (!this._isOobTable(fieldTable)) {
				continue;
			}
			this._ensureTableBucket(byTable, fieldTable).custom_fields.push({
				name: dict.getValue('element'),
				internal_type: dict.getValue('internal_type')
			});
		}

		var specs = [
			{ table: 'sys_script', label: 'business_rule', field: 'collection' },
			{ table: 'sys_script_client', label: 'client_script', field: 'table' },
			{ table: 'sys_ui_policy', label: 'ui_policy', field: 'table' }
		];
		for (var i = 0; i < specs.length; i++) {
			var gr = new GlideRecord(specs[i].table);
			if (!gr.isValid()) {
				continue;
			}
			gr.addQuery('sys_scope', appScopeSysId);
			gr.query();
			while (gr.next()) {
				var targetTable = gr.getValue(specs[i].field);
				this._collectAppArtifact(byTable, targetTable, appScopeSysId, {
					sys_id: gr.getUniqueValue(),
					name: gr.getValue('name') || gr.getValue('sys_name') || '',
					description: gr.getValue('description') || '',
					type: specs[i].label
				});
			}
		}

		// ACLs are keyed separately — sys_security_acl.name stores either
		// "table" or "table.field", so the target table needs splitting.
		var acl = new GlideRecord('sys_security_acl');
		acl.addQuery('sys_scope', appScopeSysId);
		acl.query();
		while (acl.next()) {
			var aclName = acl.getValue('name') || '';
			var aclTable = aclName.split('.')[0];
			this._collectAppArtifact(byTable, aclTable, appScopeSysId, {
				sys_id: acl.getUniqueValue(),
				name: aclName,
				description: acl.getValue('description') || '',
				type: 'acl'
			});
		}

		var results = [];
		for (var t in byTable) {
			if (byTable.hasOwnProperty(t)) {
				results.push({ table_name: t, custom_fields: byTable[t].custom_fields, custom_artifacts: byTable[t].custom_artifacts });
			}
		}
		gs.info('IscanTableScanner.findAppCustomizationsOnGlobalTables: appScope=' + appScopeSysId + ' found customizations on ' + results.length + ' base-system table(s)');
		return results;
	},

	_ensureTableBucket: function(byTable, tableName) {
		if (!byTable[tableName]) {
			byTable[tableName] = { custom_fields: [], custom_artifacts: [] };
		}
		return byTable[tableName];
	},

	_collectAppArtifact: function(byTable, targetTable, appScopeSysId, artifact) {
		if (!targetTable) {
			return;
		}
		if (this._getTableOwningScope(targetTable) === appScopeSysId) {
			return;
		}
		if (!this._isOobTable(targetTable)) {
			return;
		}
		this._ensureTableBucket(byTable, targetTable).custom_artifacts.push(artifact);
	},

	/**
	 * True when tableName has no owning sys_app record — either no
	 * sys_db_object row at all (defensive; shouldn't happen for a real
	 * field/artifact target) or an owning scope with no sys_app.
	 * @param {String} tableName
	 * @returns {Boolean}
	 */
	_isOobTable: function(tableName) {
		var scope = this._getTableOwningScope(tableName);
		if (!scope) {
			return true;
		}
		var app = new GlideRecord('sys_app');
		return !app.get(scope);
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
		this._lastCrossScopeDenial = this._detectCrossScopePrivDenial(ga, tableName);
		if (ga.next()) {
			return parseInt(ga.getAggregate('COUNT'), 10) || 0;
		}
		return 0;
	},

	/**
	 * Narrow, single-purpose check — NOT a blanket try/catch. Called only
	 * right after the one query site (_countRows, via profileTable) that
	 * reads a scanned app's own data table rather than global platform
	 * metadata. Anything other than this one exact signature is left alone
	 * to surface/fail normally, same as before this change existed.
	 * @param {GlideAggregate} gr - just-queried GlideAggregate
	 * @param {String} tableName
	 * @returns {String} descriptive finding, or '' if no denial detected
	 */
	_detectCrossScopePrivDenial: function(gr, tableName) {
		var lastError = gr.getLastErrorMessage ? gr.getLastErrorMessage() : '';
		if (!lastError || lastError.indexOf(this.CROSS_SCOPE_DENIAL_SIGNATURE) === -1) {
			return '';
		}
		var targetScope = this._getTableOwningScope(tableName);
		var targetScopeLabel = targetScope ? this._scopeLabel(targetScope) : 'unknown scope';
		gs.error('IscanTableScanner: cross-scope privilege denied reading table=' + tableName + ': ' + lastError);
		return 'Cross-scope privilege required: x_nold_iscan -> ' + targetScopeLabel + '.' + tableName +
			' — request denied, an admin must approve a Restricted Caller Access record manually. (' + lastError + ')';
	},

	_scopeLabel: function(scopeSysId) {
		var scope = new GlideRecord('sys_scope');
		if (scope.get(scopeSysId)) {
			return scope.getValue('scope') || scope.getValue('name') || scopeSysId;
		}
		return scopeSysId;
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
