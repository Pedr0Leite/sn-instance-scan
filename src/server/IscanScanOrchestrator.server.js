/*
 * Script Include: IscanScanOrchestrator
 * Client callable: false — called directly, server-side, from the
 * "Run Scan" UI Action script (RunScanUiAction.server.js), which runs in
 * the same request as the form submit. No GlideAjax involved.
 *
 * Top-level entry point. Creates the run record, resolves the app list,
 * loops apps through the full-access or fallback path, generates an
 * optional GenAI summary, and writes one x_335329_iscan_result row per app.
 */
var IscanScanOrchestrator = Class.create()
IscanScanOrchestrator.prototype = {
    initialize: function () {
        this.appSelector = new IscanAppSelector()
        this.tableScanner = new IscanTableScanner()
        this.appFilesScanner = new IscanAppFilesScanner()
        this.summaryGenerator = new IscanSummaryGenerator()
    },

    /**
     * Runs a scan against an already-existing run record (e.g. the one
     * open in the form when "Run Scan" was clicked), updating it in place.
     * @param {String} runSysId - sys_id of an existing x_335329_iscan_run record
     * @param {String} scanMode - 'full' | 'custom_only' | 'manual' | 'single_table'
     * @param {Array} manualAppList - array of sys_app sys_ids, only used
     *   when scanMode === 'manual'
     * @param {String} [targetTableSysId] - sys_id of a sys_db_object record,
     *   only used when scanMode === 'single_table'
     * @returns {String} sys_id of the run record
     */
    runScanForRecord: function (runSysId, scanMode, manualAppList, targetTableSysId) {
        gs.info('IscanScanOrchestrator.runScanForRecord: run=' + runSysId + ', scan_mode=' + scanMode)
        var run = new GlideRecord('x_335329_iscan_run')
        if (!run.get(runSysId)) {
            gs.error('IscanScanOrchestrator.runScanForRecord: no run record found for sys_id: ' + runSysId)
            throw new Error('No x_335329_iscan_run record found for sys_id: ' + runSysId)
        }

        run.setValue('scan_mode', scanMode)
        if (scanMode === 'manual' && manualAppList && manualAppList.length) {
            run.setValue('manual_app_list', manualAppList.join(','))
        }
        if (scanMode === 'single_table' && targetTableSysId) {
            run.setValue('target_table', targetTableSysId)
        }
        run.setValue('started', new GlideDateTime())

        var target = this._resolveAppList(scanMode, manualAppList, targetTableSysId)
        this._executeRun(run, target)

        return run.getUniqueValue()
    },

    /**
     * Creates a brand-new run record and scans it. Used for programmatic/
     * ATF-style invocation where there's no pre-existing form record to
     * update — see runScanForRecord() for the UI Action path.
     * @param {String} scanMode - 'full' | 'custom_only' | 'manual' | 'single_table'
     * @param {Array} manualAppList - array of sys_app sys_ids, only used
     *   when scanMode === 'manual'
     * @param {String} [targetTableSysId] - sys_id of a sys_db_object record,
     *   only used when scanMode === 'single_table'
     * @returns {String} sys_id of the created x_335329_iscan_run record
     */
    runScan: function (scanMode, manualAppList, targetTableSysId) {
        gs.info('IscanScanOrchestrator.runScan: scan_mode=' + scanMode)
        var run = this._createRun(scanMode, manualAppList)
        if (scanMode === 'single_table' && targetTableSysId) {
            run.setValue('target_table', targetTableSysId)
            run.update()
        }
        var target = this._resolveAppList(scanMode, manualAppList, targetTableSysId)
        this._executeRun(run, target)
        return run.getUniqueValue()
    },

    /**
     * appIdsOrTarget's shape varies by scan mode:
     *   - {tableOnly, tableName} — Single Table mode, no owning sys_app.
     *   - {appIds, tableOnlyTables} — Full mode, via getFullScanScopes():
     *     apps with a real sys_app record PLUS a flat list of tables
     *     belonging to scopes that have none (see that method's doc for
     *     why 'global' itself is excluded from the latter).
     *   - a plain Array — every other mode (custom_only, manual), unchanged.
     */
    _executeRun: function (run, appIdsOrTarget) {
        if (appIdsOrTarget && appIdsOrTarget.tableOnly) {
            return this._executeSingleTableRun(run, appIdsOrTarget.tableName)
        }
        var hasTableOnlyTables = appIdsOrTarget && appIdsOrTarget.tableOnlyTables !== undefined
        var appIds = hasTableOnlyTables ? appIdsOrTarget.appIds : appIdsOrTarget
        var tableOnlyTables = hasTableOnlyTables ? appIdsOrTarget.tableOnlyTables : []

        run.setValue('app_count', appIds.length)
        run.setValue('status', 'running')
        if (!run.update()) {
            // update() returns null/empty when the write is ACL-denied.
            // Fail loudly instead of "scanning" into a record nobody can
            // see change — the classic symptom is status stuck on
            // 'pending' with an empty activities log.
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_335329_iscan_run (check the x_335329_iscan.scanner role and its write ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._executeRun: run=' +
                run.getUniqueValue() +
                ' resolved ' +
                appIds.length +
                ' app(s)' +
                (tableOnlyTables.length ? ' and ' + tableOnlyTables.length + ' table-only fallback table(s)' : '') +
                ' for scan_mode=' +
                run.getValue('scan_mode')
        )
        this._appendActivity(
            run,
            'Resolved ' + appIds.length + ' app(s)' +
                (tableOnlyTables.length ? ' and ' + tableOnlyTables.length + ' table-only fallback table(s) (scopes with no owning sys_app)' : '') +
                ' for scan mode "' + run.getValue('scan_mode') + '".'
        )

        try {
            for (var i = 0; i < appIds.length; i++) {
                this._scanOneApp(run, appIds[i])
            }
            if (tableOnlyTables.length) {
                var canAccess = this.tableScanner.canAccessMetadata()
                if (canAccess) {
                    for (var t = 0; t < tableOnlyTables.length; t++) {
                        this._scanOneTable(run, tableOnlyTables[t])
                    }
                } else {
                    this._appendActivity(
                        run,
                        'Skipping ' + tableOnlyTables.length + ' table-only fallback table(s): caller lacks metadata read access.'
                    )
                }
            }
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeRun: run=' + run.getUniqueValue() + ' completed successfully')
            this._appendActivity(run, 'Scan complete.')
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeRun failed: ' + e.message)
            this._appendActivity(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        run.setValue('completed', new GlideDateTime())
        run.update()
    },

    /**
     * Single Table mode, no-owning-app case: no x_335329_iscan_result/
     * x_335329_iscan_table row gets written (result.app is a mandatory
     * sys_app reference and there's no sys_app to point it at) — the
     * table's profile goes into the run's activities/comments log only.
     * @param {GlideRecord} run
     * @param {String} tableName
     */
    _executeSingleTableRun: function (run, tableName) {
        run.setValue('app_count', 0)
        run.setValue('status', 'running')
        if (!run.update()) {
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_335329_iscan_run (check the x_335329_iscan.scanner role and its write ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._executeSingleTableRun: run=' +
                run.getUniqueValue() +
                ' table=' +
                tableName +
                ' (no owning sys_app, table-only profile)'
        )
        this._appendActivity(
            run,
            'Table "' +
                tableName +
                '" has no owning application — profiling table only, no result record will be created.'
        )

        try {
            this._scanOneTable(run, tableName)
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeSingleTableRun: run=' + run.getUniqueValue() + ' completed')
            this._appendActivity(run, 'Scan complete.')
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeSingleTableRun failed: ' + e.message)
            this._appendActivity(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        run.setValue('completed', new GlideDateTime())
        run.update()
    },

    /**
     * Profiles a single table with no owning app context. Same
     * canAccessMetadata() gate as the per-app path — checked BEFORE
     * querying, never a try/catch fallback (see CLAUDE.md conventions).
     * @param {GlideRecord} run
     * @param {String} tableName
     */
    _scanOneTable: function (run, tableName) {
        var canAccess = this.tableScanner.canAccessMetadata()
        if (!canAccess) {
            gs.info(
                'IscanScanOrchestrator._scanOneTable: table=' +
                    tableName +
                    ' — caller lacks sys_db_object/sys_dictionary read access, cannot profile'
            )
            this._appendActivity(
                run,
                'Table "' +
                    tableName +
                    '": metadata access unavailable (caller lacks read access to sys_db_object/sys_dictionary) — cannot profile fields or row count.'
            )
            return
        }

        var profile = this.tableScanner.profileTable(tableName)
        var inboundReferences = this.tableScanner.findInboundReferences(tableName)
        gs.info(
            'IscanScanOrchestrator._scanOneTable: table=' +
                tableName +
                ' row_count=' +
                profile.row_count +
                ' field_count=' +
                profile.fields.length +
                ' dictionary_override_count=' +
                profile.dictionary_override_count +
                ' inbound_reference_count=' +
                inboundReferences.length
        )
        this._appendActivity(
            run,
            'Table "' +
                tableName +
                '": ' +
                profile.row_count +
                ' row(s), ' +
                profile.fields.length +
                ' field(s), ' +
                profile.reference_fields.length +
                ' reference field(s): ' +
                (profile.reference_fields.length ? profile.reference_fields.join(', ') : 'none') +
                ', ' +
                profile.dictionary_override_count +
                ' dictionary override(s), ' +
                inboundReferences.length +
                ' inbound reference(s).'
        )
    },

    _createRun: function (scanMode, manualAppList) {
        var run = new GlideRecord('x_335329_iscan_run')
        run.initialize()
        run.setValue('scan_mode', scanMode)
        run.setValue('status', 'pending')
        run.setValue('started', new GlideDateTime())
        if (scanMode === 'manual' && manualAppList && manualAppList.length) {
            run.setValue('manual_app_list', manualAppList.join(','))
        }
        var runSysId = run.insert()
        gs.info('IscanScanOrchestrator._createRun: created run=' + runSysId + ', scan_mode=' + scanMode)
        return run
    },

    _resolveAppList: function (scanMode, manualAppList, targetTableSysId) {
        switch (scanMode) {
            case 'full':
                return this.appSelector.getFullScanScopes()
            case 'custom_only':
                return this.appSelector.getCustomApps()
            case 'manual':
                return this.appSelector.getManualApps(manualAppList)
            case 'single_table':
                return this._resolveSingleTableApp(targetTableSysId)
            default:
                gs.error('IscanScanOrchestrator._resolveAppList: unknown scan_mode: ' + scanMode)
                throw new Error('Unknown scan_mode: ' + scanMode)
        }
    },

    /**
     * Resolves Manual — Single Table mode's scan target. If the picked
     * table's owning scope has a real sys_app record, returns a
     * single-element app-id array — same shape as every other mode — and
     * the existing per-app pipeline runs unchanged (the picked table is
     * guaranteed to appear in getOwnedTables() since it's owned by that
     * scope). If the scope has no sys_app record (true for `global` and
     * most OOB scopes — e.g. picking `incident` or `sys_user`), there is
     * no sys_app to tally against x_335329_iscan_result.app (mandatory,
     * not being relaxed), so this returns a table-only descriptor instead
     * — see _singleTableFallback / _executeRun / _scanOneTable.
     * @param {String} targetTableSysId - sys_id of a sys_db_object record
     * @returns {Array|Object} sys_app-id array, OR {tableOnly, tableName}
     */
    _resolveSingleTableApp: function (targetTableSysId) {
        if (!targetTableSysId) {
            throw new Error('single_table scan mode requires target_table to be set.')
        }
        var db = new GlideRecord('sys_db_object')
        if (!db.get(targetTableSysId)) {
            throw new Error('sys_db_object not found for target_table sys_id: ' + targetTableSysId)
        }
        var scopeSysId = db.getValue('sys_scope')
        var app = new GlideRecord('sys_app')
        if (scopeSysId && app.get(scopeSysId)) {
            gs.info(
                'IscanScanOrchestrator._resolveSingleTableApp: table=' +
                    db.getValue('name') +
                    ' owned by app=' +
                    app.getValue('name') +
                    ', running full app tally'
            )
            return [scopeSysId]
        }
        gs.info(
            'IscanScanOrchestrator._resolveSingleTableApp: table=' +
                db.getValue('name') +
                ' has no owning sys_app record, falling back to table-only profile'
        )
        return this._singleTableFallback(db)
    },

    _singleTableFallback: function (dbObjectGr) {
        return { tableOnly: true, tableName: dbObjectGr.getValue('name') }
    },

    /**
     * Appends a timestamped line to the run's activities log and persists
     * it immediately (independent update from the caller's own run.update())
     * so progress is visible on refresh even if a later app fails.
     *
     * TWO fields are written here on purpose — do not "clean up" either one:
     *   - `activities` (String): the queryable, timestamped running log.
     *     Deliberately not a Journal field, so it stays reportable and free
     *     of journal-field ACL complications.
     *   - `comments` (Journal): feeds ServiceNow's native Activity
     *     formatter, which only renders Journal fields. Assigning to a
     *     journal field APPENDS an entry, it does not overwrite, so each
     *     call adds one entry rather than replacing the stream.
     *
     * setValue() is used rather than setJournalEntry() because
     * setJournalEntry() is part of the GLOBAL GlideElement API only — it is
     * absent from the scoped GlideElement API, and this is a scoped app.
     * The platform timestamps and attributes the journal entry itself, so
     * the raw message is passed here without the manual prefix that
     * `activities` needs.
     *
     * @param {GlideRecord} run
     * @param {String} message
     */
    _appendActivity: function (run, message) {
        var line = new GlideDateTime().getDisplayValue() + ' - ' + message
        var existing = run.getValue('activities')
        run.setValue('activities', existing ? existing + '\n' + line : line)
        run.setValue('comments', message)
        run.update()
    },

    _scanOneApp: function (run, appSysId) {
        var appGr = new GlideRecord('sys_app')
        if (!appGr.get(appSysId)) {
            gs.error('IscanScanOrchestrator._scanOneApp: sys_app not found for sys_id: ' + appSysId)
            this._appendActivity(run, 'ERROR: sys_app not found for sys_id ' + appSysId + ', skipping.')
            return
        }

        gs.info('IscanScanOrchestrator._scanOneApp: scanning app=' + appGr.getValue('name') + ' (' + appSysId + ')')
        this._appendActivity(run, 'Scanning app: ' + appGr.getValue('name') + '...')

        var canAccess = this.tableScanner.canAccessMetadata()
        var tables = []
        var scanModeUsed

        // scanApp() returns {sys_id, name} objects per bucket, so it is
        // already the source for BOTH the counts (via .length, exactly as
        // in v1 — do not change this) and the names the v2 briefing needs.
        var scanMode = run.getValue('scan_mode')
        var includeExtended =
            scanMode !== 'full' || gs.getProperty('x_335329_iscan.include_extended_counts_on_full_scan', 'false') === 'true'
        var files = this.appFilesScanner.scanApp(appSysId, includeExtended)
        var automationCounts = {
            business_rules: files.business_rules.length,
            script_includes: files.script_includes.length,
            acls: files.acls.length,
            ui_actions: files.ui_actions.length,
            flows: files.flows.length,
            client_scripts: files.client_scripts.length,
            ui_policies: files.ui_policies.length,
            scheduled_jobs: files.scheduled_jobs.length,
            notifications: files.notifications.length,
            scripted_rest_apis: files.scripted_rest_apis.length,
            transform_maps: files.transform_maps.length,
            catalog_items: files.catalog_items.length,
            workflows: files.workflows.length,
            subflows: files.subflows.length,
            atf_tests: files.atf_tests.length,
            reports: files.reports.length,
            fix_scripts: files.fix_scripts.length,
            processors: files.processors.length,
            data_policies: files.data_policies.length,
            inbound_email_actions: files.inbound_email_actions.length,
            dashboards: files.dashboards.length,
            pa_indicators: files.pa_indicators.length,
            service_portals: files.service_portals.length,
            service_portal_widgets: files.service_portal_widgets.length,
            flow_actions: files.flow_actions.length,
            catalog_variables: files.catalog_variables.length,
            choices: files.choice_count,
            roles: files.role_count,
            groups: files.group_count,
            system_properties: files.system_property_count,
        }

        if (canAccess) {
            scanModeUsed = 'full_access'
            // Profiles are resolved up front (not lazily during the table-row
            // write) because the v2 briefing needs each table's field list and
            // reference graph BEFORE the result row is inserted. The profile is
            // attached to each table object and reused by _writeTableProfiles,
            // so this is one profileTable() call per table, same as v1.
            tables = this._profileOwnedTables(appSysId)
        } else {
            scanModeUsed = 'app_files_fallback'
        }

        var integrations = this._findIntegrations(appSysId)
        var integrationCount = integrations.length

        var result = new GlideRecord('x_335329_iscan_result')
        result.initialize()
        result.setValue('run', run.getUniqueValue())
        result.setValue('app', appSysId)
        result.setValue('scan_date', new GlideDateTime())
        result.setValue('scan_mode_used', scanModeUsed)
        result.setValue('table_count', tables.length)
        result.setValue('business_rule_count', automationCounts.business_rules)
        result.setValue('script_include_count', automationCounts.script_includes)
        result.setValue('flow_count', automationCounts.flows)
        result.setValue('acl_count', automationCounts.acls)
        result.setValue('ui_action_count', automationCounts.ui_actions)
        result.setValue('integration_count', integrationCount)
        result.setValue('client_script_count', automationCounts.client_scripts)
        result.setValue('ui_policy_count', automationCounts.ui_policies)
        result.setValue('scheduled_job_count', automationCounts.scheduled_jobs)
        result.setValue('notification_count', automationCounts.notifications)
        result.setValue('scripted_rest_api_count', automationCounts.scripted_rest_apis)
        result.setValue('transform_map_count', automationCounts.transform_maps)
        result.setValue('catalog_item_count', automationCounts.catalog_items)
        result.setValue('workflow_count', automationCounts.workflows)
        result.setValue('subflow_count', automationCounts.subflows)
        result.setValue('atf_test_count', automationCounts.atf_tests)
        result.setValue('report_count', automationCounts.reports)
        result.setValue('fix_script_count', automationCounts.fix_scripts)
        result.setValue('processor_count', automationCounts.processors)
        result.setValue('data_policy_count', automationCounts.data_policies)
        result.setValue('inbound_email_action_count', automationCounts.inbound_email_actions)
        result.setValue('dashboard_count', automationCounts.dashboards)
        result.setValue('pa_indicator_count', automationCounts.pa_indicators)
        result.setValue('service_portal_count', automationCounts.service_portals)
        result.setValue('service_portal_widget_count', automationCounts.service_portal_widgets)
        result.setValue('choice_count', automationCounts.choices)
        result.setValue('flow_action_count', automationCounts.flow_actions)
        result.setValue('catalog_variable_count', automationCounts.catalog_variables)
        result.setValue('role_count', automationCounts.roles)
        result.setValue('group_count', automationCounts.groups)
        result.setValue('system_property_count', automationCounts.system_properties)
        result.setValue('table_list', this._tableNames(tables).join(','))

        var runFacts = {
            appName: appGr.getValue('name'),
            appScope: appGr.getValue('scope'),
            appVendor: appGr.getValue('vendor'),
            appSource: appGr.getValue('source'),
            scanDate: new GlideDateTime().getDisplayValue(),
            scanModeUsed: scanModeUsed,
            tables: tables,
            automation: files,
            integrations: integrations,
            // Retained for backward compatibility: v1 callers/tests may
            // still read these scalar counts off runFacts.
            businessRuleCount: automationCounts.business_rules,
            scriptIncludeCount: automationCounts.script_includes,
            flowCount: automationCounts.flows,
            integrationCount: integrationCount,
        }

        // llm_context is written on EVERY scan, independent of the GenAI
        // Controller — only summary_text depends on that being available.
        result.setValue('llm_context', this.summaryGenerator.buildPrompt(runFacts))

        var summary = this.summaryGenerator.generate(runFacts)
        if (summary) {
            result.setValue('summary_text', summary)
        }

        var resultId = result.insert()
        if (!resultId) {
            throw new Error(
                'Could not insert x_335329_iscan_result for app "' +
                    appGr.getValue('name') +
                    '" — the calling user lacks create access (check the x_335329_iscan.scanner role and the result create ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._scanOneApp: app=' +
                appGr.getValue('name') +
                ' scan_mode_used=' +
                scanModeUsed +
                ' tables=' +
                tables.length +
                ' business_rules=' +
                automationCounts.business_rules +
                ' script_includes=' +
                automationCounts.script_includes +
                ' flows=' +
                automationCounts.flows +
                ' acls=' +
                automationCounts.acls +
                ' ui_actions=' +
                automationCounts.ui_actions +
                ' integrations=' +
                integrationCount
        )
        this._appendActivity(
            run,
            appGr.getValue('name') +
                ': ' +
                scanModeUsed +
                ', ' +
                tables.length +
                ' table(s), ' +
                automationCounts.business_rules +
                ' business rule(s), ' +
                automationCounts.script_includes +
                ' script include(s), ' +
                automationCounts.flows +
                ' flow(s).'
        )

        if (canAccess) {
            this._writeTableProfiles(resultId, tables)
        }
    },

    /**
     * Discovers this app's tables and profiles each one, folding the
     * profile (row_count, fields, reference_fields) into the table object
     * itself so both the v2 briefing and the table-profile rows can read
     * it without profiling twice.
     * @param {String} appScopeSysId
     * @returns {Array} table objects enriched with profile data
     */
    _profileOwnedTables: function (appScopeSysId) {
        var tables = this.tableScanner.getOwnedTables(appScopeSysId)
        for (var i = 0; i < tables.length; i++) {
            var profile = this.tableScanner.profileTable(tables[i].name)
            tables[i].row_count = profile.row_count
            tables[i].fields = profile.fields
            tables[i].reference_fields = profile.reference_fields
            tables[i].dictionary_overrides = profile.dictionary_overrides
            tables[i].dictionary_override_count = profile.dictionary_override_count
            tables[i].inbound_references = this.tableScanner.findInboundReferences(tables[i].name)
            tables[i].inbound_reference_count = tables[i].inbound_references.length
        }
        return tables
    },

    _writeTableProfiles: function (resultSysId, tables) {
        for (var i = 0; i < tables.length; i++) {
            var tableRow = new GlideRecord('x_335329_iscan_table')
            tableRow.initialize()
            tableRow.setValue('result', resultSysId)
            tableRow.setValue('table_name', tables[i].name)
            tableRow.setValue('extends_table', tables[i].extends)
            tableRow.setValue('well_known_base', tables[i].well_known_base)
            tableRow.setValue('row_count', tables[i].row_count)
            tableRow.setValue('field_count', tables[i].fields.length)
            tableRow.setValue('reference_field_list', tables[i].reference_fields.join(','))
            tableRow.setValue('dictionary_override_count', tables[i].dictionary_override_count)
            tableRow.setValue(
                'dictionary_override_list',
                tables[i].dictionary_overrides.map(function (o) { return o.name + '(' + o.scope + ')' }).join(',')
            )
            tableRow.setValue('inbound_reference_count', tables[i].inbound_reference_count)
            tableRow.setValue(
                'inbound_reference_list',
                tables[i].inbound_references.map(function (r) { return r.referencing_field + '(' + r.referencing_table + ')' }).join(',')
            )
            var tableRowId = tableRow.insert()
            gs.info(
                'IscanScanOrchestrator._writeTableProfiles: table=' +
                    tables[i].name +
                    ' row_count=' +
                    tables[i].row_count +
                    ' field_count=' +
                    tables[i].fields.length +
                    ' dictionary_override_count=' +
                    tables[i].dictionary_override_count +
                    ' inbound_reference_count=' +
                    tables[i].inbound_reference_count
            )
            this._writeCrossrefRows(tableRowId, tables[i].inbound_references)
        }
    },

    /**
     * One x_335329_iscan_crossref row per inbound-referencing field found
     * for a single x_335329_iscan_table row. Same-app references ARE
     * included (referencing_app will equal the app currently being
     * scanned in that case) — filtering intra-app vs. cross-app is a
     * Report sub-spec concern, not a write-time one.
     * @param {String} tableRowId - sys_id of the just-inserted x_335329_iscan_table row
     * @param {Array} inboundReferences - [{referencing_table, referencing_field, referencing_app, referencing_scope}]
     */
    _writeCrossrefRows: function (tableRowId, inboundReferences) {
        for (var i = 0; i < inboundReferences.length; i++) {
            var crossrefRow = new GlideRecord('x_335329_iscan_crossref')
            crossrefRow.initialize()
            crossrefRow.setValue('table', tableRowId)
            crossrefRow.setValue('referencing_table', inboundReferences[i].referencing_table)
            crossrefRow.setValue('referencing_field', inboundReferences[i].referencing_field)
            crossrefRow.setValue('referencing_app', inboundReferences[i].referencing_app)
            crossrefRow.setValue('referencing_scope', inboundReferences[i].referencing_scope)
            crossrefRow.insert()
        }
    },

    /**
     * Finds REST messages / web services referencing this scope, capturing
     * name and endpoint so the v2 briefing can name them rather than just
     * counting them. integration_count is derived from this array's length,
     * so it stays identical to what v1's GlideAggregate COUNT produced.
     *
     * This reads records rather than aggregating because the briefing needs
     * the field values; the result set is inherently small (integration
     * definitions per app), so the row-count perf rule that mandates
     * GlideAggregate for table row counts doesn't apply here.
     *
     * @param {String} appScopeSysId
     * @returns {Array} [{type, name, endpoint}]
     */
    _findIntegrations: function (appScopeSysId) {
        var integrations = []
        var sources = [
            { table: 'sys_rest_message', endpointField: 'rest_endpoint' },
            { table: 'sys_web_service', endpointField: 'wsdl' },
        ]

        for (var s = 0; s < sources.length; s++) {
            var gr = new GlideRecord(sources[s].table)
            if (!gr.isValid()) {
                continue
            }
            gr.addQuery('sys_scope', appScopeSysId)
            gr.query()
            while (gr.next()) {
                integrations.push({
                    type: sources[s].table,
                    name: gr.getValue('name') || '',
                    endpoint: gr.getValue(sources[s].endpointField) || '',
                })
            }
        }

        gs.info(
            'IscanScanOrchestrator._findIntegrations: appScope=' +
                appScopeSysId +
                ' found ' +
                integrations.length +
                ' integration record(s)'
        )
        return integrations
    },

    _tableNames: function (tables) {
        var names = []
        for (var i = 0; i < tables.length; i++) {
            names.push(tables[i].name)
        }
        return names
    },

    type: 'IscanScanOrchestrator',
}
