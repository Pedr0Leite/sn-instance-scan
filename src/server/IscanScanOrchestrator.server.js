/*
 * Script Include: IscanScanOrchestrator
 * Client callable: false — called directly, server-side, from the
 * "Run Scan" UI Action script (RunScanUiAction.server.js), which runs in
 * the same request as the form submit. No GlideAjax involved.
 *
 * Top-level entry point. Creates the run record, resolves the app list,
 * loops apps through the full-access or fallback path, generates an
 * optional GenAI summary, and writes one x_nold_iscan_result row per app.
 */
var IscanScanOrchestrator = Class.create()
IscanScanOrchestrator.prototype = {
    // Must match the sysevent_register record in src/fluent/async-scan.now.ts.
    // Scoped event names are '<scope>.<suffix>' and capped at 40 characters.
    QUEUE_EVENT: 'x_nold_iscan.scan.execute',

    // Modes that run in a worker instead of inside the caller's request. Only
    // the long-running ones: Full walks every table-only scope (3,549 tables on
    // ven09425, 16.5 minutes) and CMDB Health iterates record-by-record
    // up to max_iterate. Every other mode finishes in seconds and stays
    // synchronous - which also keeps the ATF tests valid, since they click
    // Run Scan and assert status=complete immediately (none of them use full).
    ASYNC_MODES: ['full', 'cmdb_health'],

    /**
     * @param {String} scanMode
     * @returns {Boolean} true when this mode is queued rather than run inline
     */
    isAsyncMode: function (scanMode) {
        return this.ASYNC_MODES.indexOf(scanMode) !== -1
    },

    /**
     * Whether the CURRENT user may launch this mode. Async modes are admin-only.
     *
     * Why: the queued work runs in a Script Action, and event handlers run as
     * System - not as the user who queued the event. Evidence (docs corpus):
     * events.md says handlers are dispatched by scheduled jobs reading the
     * queue; r_BuildAScript.md's canonical pattern passes gs.getUserID() as a
     * parameter precisely because the handler does not run as that user;
     * KB0785010 describes Script Actions running as System; and the Fluent
     * ScriptAction API has no run-as field. Letting a scanner-only user queue a
     * Full or CMDB Health scan would therefore let them read, through the
     * x_nold_iscan_* tables their role CAN read, data beyond their own ACLs -
     * including incident / change_request / cmdb_ci display values stored as
     * check samples. That breaks this app's hard "no elevated privilege" rule.
     * Requiring admin to queue means the worker's System reads never exceed
     * what the caller could already see. Synchronous modes are unaffected and
     * keep running under the caller's own access.
     * @param {String} scanMode
     * @returns {Boolean}
     */
    canLaunch: function (scanMode) {
        return !this.isAsyncMode(scanMode) || gs.hasRole('admin')
    },

    initialize: function () {
        this.appSelector = new IscanAppSelector()
        this.tableScanner = new IscanTableScanner()
        this.appFilesScanner = new IscanAppFilesScanner()
        this.summaryGenerator = new IscanSummaryGenerator()
        this.moduleScanner = new IscanModuleScanner()
        this.aiAgentScanner = new IscanAiAgentScanner()
        this.cmdbHealthScanner = new IscanCmdbHealthScanner()
        this.cmdbHealthScorer = new IscanCmdbHealthScorer()
    },

    /**
     * Runs a scan against an already-existing run record (e.g. the one
     * open in the form when "Run Scan" was clicked), updating it in place.
     * @param {String} runSysId - sys_id of an existing x_nold_iscan_run record
     * @param {String} scanMode - 'full' | 'custom_only' | 'manual' | 'single_table' | 'modules' | 'ai_agents' | 'cmdb_health'
     * @param {Array} manualAppList - array of sys_app sys_ids, only used
     *   when scanMode === 'manual'
     * @param {String} [targetTableSysId] - sys_id of a sys_db_object record,
     *   only used when scanMode === 'single_table'
     * @returns {String} sys_id of the run record
     */
    runScanForRecord: function (runSysId, scanMode, manualAppList, targetTableSysId) {
        gs.info('IscanScanOrchestrator.runScanForRecord: run=' + runSysId + ', scan_mode=' + scanMode)
        var run = new GlideRecord('x_nold_iscan_run')
        if (!run.get(runSysId)) {
            gs.error('IscanScanOrchestrator.runScanForRecord: no run record found for sys_id: ' + runSysId)
            throw new Error('No x_nold_iscan_run record found for sys_id: ' + runSysId)
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
     * @param {String} scanMode - 'full' | 'custom_only' | 'manual' | 'single_table' | 'modules' | 'ai_agents' | 'cmdb_health'
     * @param {Array} manualAppList - array of sys_app sys_ids, only used
     *   when scanMode === 'manual'
     * @param {String} [targetTableSysId] - sys_id of a sys_db_object record,
     *   only used when scanMode === 'single_table'
     * @returns {String} sys_id of the created x_nold_iscan_run record
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
     * Queues a scan to run asynchronously in a worker thread, instead of
     * inside the caller's UI or REST transaction.
     *
     * Why async: UI transactions are cancelled at 298s (the "UI Transactions"
     * default quota rule, which exempts only background scripts), and HTTP
     * connections are cut by the load balancer at 5 minutes. A scan that is
     * killed mid-flight can never reach its own catch block, so it stays
     * 'running' forever. A Full scan on ven09425 resolves 3,549
     * table-only tables and ran for 16.5 minutes - it can never finish inside a
     * request. The event is processed by the Script Action in
     * src/fluent/async-scan.now.ts, which calls executeQueuedRun() below.
     *
     * This method does NOT write the run record. Its callers own that write:
     * the UI Action lets the platform's single natural save of `current`
     * persist status='pending' (a second save of the same record in one request
     * is what produced the old "Invalid update" banner), and the REST endpoint
     * creates the record itself. The sysevent row is committed by
     * gs.eventQueue() itself, a few milliseconds before the UI Action's save; a
     * worker that somehow started inside that gap would only see 'pending'
     * shown briefly - _finishRun still writes the terminal status.
     *
     * Parameters travel on the event rather than being re-read from the record,
     * so the target_app / manual_app_list precedence decided by the caller is
     * applied exactly once, in one place.
     * @param {GlideRecord} run - the run record (may be `current`, unsaved yet)
     * @param {String} scanMode
     * @param {Array} manualAppList - sys_app sys_ids (manual mode only)
     * @param {String} [targetTableSysId] - sys_db_object sys_id (single_table only)
     */
    queueScan: function (run, scanMode, manualAppList, targetTableSysId) {
        var params = JSON.stringify({ apps: manualAppList || [], table: targetTableSysId || '' })
        gs.eventQueue(this.QUEUE_EVENT, run, scanMode, params)
        gs.info('IscanScanOrchestrator.queueScan: run=' + run.getUniqueValue() + ' queued, scan_mode=' + scanMode)
    },

    /**
     * Worker-side entry point, called by the Script Action on the queued event.
     * Runs the existing synchronous pipeline unchanged. The catch here covers
     * failures that happen BEFORE a scan's own try/catch is reached (unknown
     * mode in _resolveAppList, a missing record, a write denial on the first
     * update) - without it those would leave the run 'pending' indefinitely.
     * @param {String} runSysId
     * @param {String} scanMode - event parm1
     * @param {String} paramsJson - event parm2, from queueScan()
     */
    executeQueuedRun: function (runSysId, scanMode, paramsJson) {
        gs.info('IscanScanOrchestrator.executeQueuedRun: run=' + runSysId + ', scan_mode=' + scanMode)
        var params = {}
        try {
            params = paramsJson ? JSON.parse(paramsJson) : {}
        } catch (parseError) {
            this._failRun(runSysId, 'Could not read the queued scan parameters: ' + parseError.message)
            return
        }
        try {
            this.runScanForRecord(runSysId, scanMode, params.apps || [], params.table || '')
        } catch (e) {
            gs.error('IscanScanOrchestrator.executeQueuedRun: run=' + runSysId + ' failed before completing: ' + e.message)
            this._failRun(runSysId, e.message)
        }
    },

    /**
     * Marks a run as failed, with the reason in its findings log, when the
     * failure happened outside a scan's own try/catch.
     * @param {String} runSysId
     * @param {String} message
     */
    _failRun: function (runSysId, message) {
        var run = new GlideRecord('x_nold_iscan_run')
        if (!run.get(runSysId)) {
            gs.error('IscanScanOrchestrator._failRun: no run record for sys_id ' + runSysId + ' (' + message + ')')
            return
        }
        this._appendScanFinding(run, 'ERROR: ' + message)
        run.setValue('status', 'error')
        this._finishRun(run)
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
        if (appIdsOrTarget && appIdsOrTarget.modulesOnly) {
            return this._executeModulesRun(run)
        }
        if (appIdsOrTarget && appIdsOrTarget.aiAgentsOnly) {
            return this._executeAiAgentsRun(run)
        }
        if (appIdsOrTarget && appIdsOrTarget.cmdbHealthOnly) {
            return this._executeCmdbHealthRun(run)
        }
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
            // 'pending' with an empty scan_findings log.
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_nold_iscan_run (check the x_nold_iscan.scanner role and its write ACL).'
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
        this._appendScanFinding(
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
                    this._appendScanFinding(
                        run,
                        'Skipping ' + tableOnlyTables.length + ' table-only fallback table(s): caller lacks metadata read access.'
                    )
                }
            }
            // Opt-in CMDB & CSDM Health add-on for Full scans. It is an add-on,
            // so its own failure becomes a finding rather than failing the Full
            // scan. Off by default: it is instance-wide record-by-record work up
            // to max_iterate, on top of an already long scan.
            if (
                run.getValue('scan_mode') === 'full' &&
                gs.getProperty('x_nold_iscan.include_cmdb_health_on_full_scan', 'false') === 'true'
            ) {
                this._appendScanFinding(run, 'Running CMDB & CSDM Health checks (include_cmdb_health_on_full_scan is on)...')
                try {
                    this._appendScanFinding(run, this._cmdbHealthSummaryLine(this._runCmdbHealth(run)))
                } catch (cmdbError) {
                    gs.error('IscanScanOrchestrator._executeRun: CMDB Health add-on failed for run=' + run.getUniqueValue() + ': ' + cmdbError.message)
                    this._appendScanFinding(run, 'CMDB & CSDM Health checks failed: ' + cmdbError.message)
                }
            }
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeRun: run=' + run.getUniqueValue() + ' completed successfully')
            this._appendScanFinding(run, 'Scan complete. ' + this._reportPointerMessage(appIds.length))
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeRun failed: ' + e.message)
            this._appendScanFinding(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        this._finishRun(run)
    },

    /**
     * Single Table mode, no-owning-app case: no x_nold_iscan_result/
     * x_nold_iscan_table row gets written (result.app is a mandatory
     * sys_app reference and there's no sys_app to point it at) — the
     * table's profile goes into the run's scan_findings/comments log only.
     * @param {GlideRecord} run
     * @param {String} tableName
     */
    _executeSingleTableRun: function (run, tableName) {
        run.setValue('app_count', 0)
        run.setValue('status', 'running')
        if (!run.update()) {
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_nold_iscan_run (check the x_nold_iscan.scanner role and its write ACL).'
            )
        }

        gs.info(
            'IscanScanOrchestrator._executeSingleTableRun: run=' +
                run.getUniqueValue() +
                ' table=' +
                tableName +
                ' (no owning sys_app, table-only profile)'
        )
        this._appendScanFinding(
            run,
            'Table "' +
                tableName +
                '" has no owning application — profiling table only, no result record will be created.'
        )

        try {
            this._scanOneTable(run, tableName)
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeSingleTableRun: run=' + run.getUniqueValue() + ' completed')
            this._appendScanFinding(run, 'Scan complete. ' + this._reportPointerMessage(0))
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeSingleTableRun failed: ' + e.message)
            this._appendScanFinding(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        this._finishRun(run)
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
            this._appendScanFinding(
                run,
                'Table "' +
                    tableName +
                    '": metadata access unavailable (caller lacks read access to sys_db_object/sys_dictionary) — cannot profile fields or row count.'
            )
            return
        }

        var profile = this.tableScanner.profileTable(tableName)
        if (profile.cross_scope_denial) {
            this._appendScanFinding(run, profile.cross_scope_denial)
        }
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
        this._appendScanFinding(
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

        this._scanGlobalCustomizations(run, tableName)
    },

    /**
     * Base-system table customization detection — only meaningful for
     * tables with no owning sys_app (findGlobalCustomizations() no-ops
     * otherwise). Only writes an x_nold_iscan_global_customization row
     * when something was actually found, same omit-when-empty precedent
     * as crossref rows.
     * @param {GlideRecord} run
     * @param {String} tableName
     */
    _scanGlobalCustomizations: function (run, tableName) {
        var customizations = this.tableScanner.findGlobalCustomizations(tableName)
        if (!customizations.applicable) {
            return
        }
        if (!customizations.custom_fields.length && !customizations.custom_artifacts.length) {
            return
        }

        this._appendScanFinding(
            run,
            'Table "' +
                tableName +
                '" (base-system): ' +
                customizations.custom_fields.length +
                ' custom field(s), ' +
                customizations.custom_artifacts.length +
                ' custom artifact(s) from customer scope(s).'
        )

        var row = new GlideRecord('x_nold_iscan_global_customization')
        row.initialize()
        row.setValue('run', run.getUniqueValue())
        row.setValue('table_name', tableName)
        row.setValue('custom_field_count', customizations.custom_fields.length)
        row.setValue(
            'custom_field_list',
            customizations.custom_fields.map(function (f) { return f.name + '(' + f.scope + ')' }).join(',')
        )
        row.setValue('custom_artifact_count', customizations.custom_artifacts.length)
        row.setValue(
            'custom_artifact_list',
            customizations.custom_artifacts.map(function (a) { return a.name + '(' + a.type + ')' }).join(',')
        )
        row.insert()
    },

    /**
     * Installed Modules mode: instance-wide, no app/table scoping. No
     * x_nold_iscan_result row gets written (there's no owning app to
     * point one at) — profile rows go straight onto x_nold_iscan_module,
     * run-keyed, same precedent as x_nold_iscan_global_customization's
     * no-owning-app rows. Unlike every per-app mode there is NO ACL-denial
     * fallback path here — a canReadPlugins() denial ends the run in
     * 'error' status with a clear finding, not a silent zero-row 'complete'.
     * @param {GlideRecord} run
     */
    _executeModulesRun: function (run) {
        run.setValue('app_count', 0)
        run.setValue('status', 'running')
        if (!run.update()) {
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_nold_iscan_run (check the x_nold_iscan.scanner role and its write ACL).'
            )
        }

        gs.info('IscanScanOrchestrator._executeModulesRun: run=' + run.getUniqueValue() + ' scanning installed modules')
        this._appendScanFinding(run, 'Scanning installed modules (sys_plugins)...')

        try {
            var canAccess = this.moduleScanner.canReadPlugins()
            if (!canAccess) {
                throw new Error(
                    'Cannot read sys_plugins — the calling user lacks read access to installed plugin metadata (check the x_nold_iscan.scanner role).'
                )
            }

            var modules = this.moduleScanner.scanModules()
            this._writeModuleRows(run.getUniqueValue(), modules)

            var activeCount = 0
            var mismatchCount = 0
            for (var i = 0; i < modules.length; i++) {
                if (modules[i].active_confirmed) { activeCount++ }
                if (modules[i].status_mismatch) { mismatchCount++ }
            }
            this._appendScanFinding(
                run,
                'Found ' + modules.length + ' installed module(s), ' + activeCount + ' active, ' +
                    mismatchCount + ' status mismatch(es).'
            )

            // Instance-wide GenAI summary. No result row exists for
            // modules mode, so the returned paragraph is appended to the
            // run's scan_findings/comments log via the existing dual-write
            // helper instead of a new field. generate() already degrades
            // gracefully (returns null/undefined) when GenAI is
            // unavailable — same skip-if-absent behavior as every other mode.
            var facts = this._buildModuleFacts(modules, activeCount, mismatchCount)
            var summary = this.summaryGenerator.generate(facts)
            if (summary) {
                this._appendScanFinding(run, 'GenAI summary: ' + summary)
            }

            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeModulesRun: run=' + run.getUniqueValue() + ' completed')
            this._appendScanFinding(run, 'Scan complete. ' + this._reportPointerMessage(0))
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeModulesRun failed: ' + e.message)
            this._appendScanFinding(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        this._finishRun(run)
    },

    _writeModuleRows: function (runSysId, modules) {
        for (var i = 0; i < modules.length; i++) {
            var row = new GlideRecord('x_nold_iscan_module')
            row.initialize()
            row.setValue('run', runSysId)
            row.setValue('name', modules[i].name)
            row.setValue('plugin_id', modules[i].plugin_id)
            row.setValue('active_flag', modules[i].active_flag)
            row.setValue('active_confirmed', modules[i].active_confirmed)
            row.setValue('status_mismatch', modules[i].status_mismatch)
            row.insert()
        }
        gs.info('IscanScanOrchestrator._writeModuleRows: run=' + runSysId + ' wrote ' + modules.length + ' module row(s)')
    },

    /**
     * Facts object fed to IscanSummaryGenerator.generate() for the
     * modules-mode summary. Reuses the existing app-scan-shaped
     * buildPrompt() unchanged (per spec: "reuse the existing... pattern,
     * not a new code path") rather than building a dedicated
     * modules-specific prompt template — buildPrompt()'s field access is
     * all `||`-guarded, so empty tables/automation/integrations render as
     * "none" rather than crashing. Known cosmetic tradeoff: the resulting
     * GenAI input reads a bit app-shaped for what is actually a plugin
     * scan (e.g. a "Data model" section saying "owns no tables") — this
     * only affects prompt quality, not pipeline correctness, and no user
     * ever sees the raw input, only the returned summary paragraph.
     * @param {Array} modules
     * @param {Number} activeCount
     * @param {Number} mismatchCount
     * @returns {Object}
     */
    _buildModuleFacts: function (modules, activeCount, mismatchCount) {
        var mismatches = []
        for (var i = 0; i < modules.length; i++) {
            if (modules[i].status_mismatch) {
                mismatches.push(modules[i].name + ' (' + modules[i].plugin_id + ')')
            }
        }
        return {
            appName: 'Installed Modules (instance-wide)',
            appScope: 'n/a — instance-wide, not scoped to an application',
            appVendor: '',
            appSource: '',
            scanDate: new GlideDateTime().getDisplayValue(),
            scanModeUsed: 'full_access',
            tables: [],
            automation: {},
            integrations: [],
            moduleCount: modules.length,
            activeModuleCount: activeCount,
            statusMismatchCount: mismatchCount,
            statusMismatches: mismatches
        }
    },

    /**
     * AI Agent Discovery mode: instance-wide, no app/table scoping — same
     * shape as _executeModulesRun. No x_nold_iscan_result row gets
     * written (there's no owning app to point one at) — findings land
     * straight on x_nold_iscan_ai_agent, run-keyed. Unlike Modules mode,
     * a per-table access gap here is a per-layer finding, not a hard
     * run-level failure — each of IscanAiAgentScanner's 5 layers already
     * reports its own accessGaps rather than gating the whole scan on one
     * table (see IscanAiAgentScanner's class doc comment).
     * @param {GlideRecord} run
     */
    _executeAiAgentsRun: function (run) {
        run.setValue('app_count', 0)
        run.setValue('status', 'running')
        if (!run.update()) {
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_nold_iscan_run (check the x_nold_iscan.scanner role and its write ACL).'
            )
        }

        gs.info('IscanScanOrchestrator._executeAiAgentsRun: run=' + run.getUniqueValue() + ' scanning for AI agents/tools/credentials')
        this._appendScanFinding(run, 'Scanning for AI agents, tools, and LLM integrations...')

        try {
            var native = this.aiAgentScanner.scanNativePlatform()
            var outbound = this.aiAgentScanner.scanOutboundIntegrations()
            var allFindings = native.findings.concat(outbound.findings)
            var allAccessGaps = native.accessGaps.concat(outbound.accessGaps)

            var includeKeywordScan = gs.getProperty('x_nold_iscan.include_ai_agent_keyword_scan', 'false') === 'true'
            if (includeKeywordScan) {
                var scriptScan = this.aiAgentScanner.scanScriptKeywords()
                allFindings = allFindings.concat(scriptScan.findings)
                allAccessGaps = allAccessGaps.concat(scriptScan.accessGaps)
            }

            var flowScan = this.aiAgentScanner.scanFlowDesigner()
            allFindings = allFindings.concat(flowScan.findings)
            allAccessGaps = allAccessGaps.concat(flowScan.accessGaps)

            var configScan = this.aiAgentScanner.scanConfiguration()
            allFindings = allFindings.concat(configScan.findings)
            allAccessGaps = allAccessGaps.concat(configScan.accessGaps)

            this._writeAiAgentRows(run.getUniqueValue(), allFindings)

            var confirmedCount = 0
            for (var i = 0; i < allFindings.length; i++) {
                if (allFindings[i].confidence === 'confirmed') { confirmedCount++ }
            }
            this._appendScanFinding(
                run,
                'Found ' + allFindings.length + ' finding(s): ' + confirmedCount + ' confirmed, ' +
                    (allFindings.length - confirmedCount) + ' needs review.' +
                    (includeKeywordScan
                        ? ''
                        : ' (Script keyword scan skipped — enable x_nold_iscan.include_ai_agent_keyword_scan to include it.)')
            )
            if (allAccessGaps.length) {
                this._appendScanFinding(
                    run,
                    'Could not read the following table(s), coverage is incomplete: ' + allAccessGaps.join(', ') + '.'
                )
            }

            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeAiAgentsRun: run=' + run.getUniqueValue() + ' completed')
            this._appendScanFinding(run, 'Scan complete. ' + this._reportPointerMessage(0))
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeAiAgentsRun failed: ' + e.message)
            this._appendScanFinding(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        this._finishRun(run)
    },

    _writeAiAgentRows: function (runSysId, findings) {
        for (var i = 0; i < findings.length; i++) {
            var row = new GlideRecord('x_nold_iscan_ai_agent')
            row.initialize()
            row.setValue('run', runSysId)
            row.setValue('layer', findings[i].layer)
            row.setValue('name', findings[i].name)
            row.setValue('detail', findings[i].detail)
            row.setValue('source_table', findings[i].source_table)
            row.setValue('confidence', findings[i].confidence)
            row.insert()
        }
        gs.info('IscanScanOrchestrator._writeAiAgentRows: run=' + runSysId + ' wrote ' + findings.length + ' row(s)')
    },

    /**
     * CMDB & CSDM Health mode: instance-wide, no app/table scoping - same shape
     * as _executeAiAgentsRun. No x_nold_iscan_result row (no owning app); the
     * findings land run-keyed on x_nold_iscan_cmdb_check (one row per catalog
     * check) and x_nold_iscan_cmdb_summary (one row). Always queued to the async
     * worker (see ASYNC_MODES), so this runs as System - admin-only to launch.
     * @param {GlideRecord} run
     */
    _executeCmdbHealthRun: function (run) {
        run.setValue('app_count', 0)
        run.setValue('status', 'running')
        if (!run.update()) {
            throw new Error(
                'Cannot write to the scan run record — the calling user lacks write access to x_nold_iscan_run (check the x_nold_iscan.scanner role and its write ACL).'
            )
        }

        gs.info('IscanScanOrchestrator._executeCmdbHealthRun: run=' + run.getUniqueValue() + ' assessing CMDB and CSDM health')
        this._appendScanFinding(run, 'Assessing CMDB and CSDM health against the Get Well Playbooks...')

        try {
            var outcome = this._runCmdbHealth(run)
            this._appendScanFinding(run, this._cmdbHealthSummaryLine(outcome))
            this._appendScanFinding(run, this._cmdbHealthFindingsLog(outcome.scored))
            run.setValue('status', 'complete')
            gs.info('IscanScanOrchestrator._executeCmdbHealthRun: run=' + run.getUniqueValue() + ' completed')
            this._appendScanFinding(
                run,
                'Scan complete. One row per check is on the CMDB Health Check list below, with the score roll-up on the CMDB Health Summary; the scored PDF report is attached to this run.'
            )
        } catch (e) {
            gs.error('IscanScanOrchestrator._executeCmdbHealthRun failed: ' + e.message)
            this._appendScanFinding(run, 'ERROR: ' + e.message)
            run.setValue('status', 'error')
        }

        this._finishRun(run)

        // This mode always runs in the background worker, so the PDF is built
        // here rather than waiting for a Download Report click. After
        // _finishRun so the report reads the terminal status. A failure is a
        // finding, never a change to the run's outcome.
        if (run.getValue('status') === 'complete') {
            var attachmentId = ''
            try {
                attachmentId = new IscanReportGenerator().generateRunReport(run.getUniqueValue())
            } catch (pe) {
                gs.error('IscanScanOrchestrator._executeCmdbHealthRun: PDF failed: ' + pe.message)
            }
            if (!attachmentId) {
                this._appendScanFinding(run, 'PDF report could not be generated automatically - use Download Report (see system log for the cause).')
            }
        }
    },

    /**
     * Log block listing every Fail and Warn check, worst first, with the same
     * measure strings the report uses - so the run log itself shows what needs
     * attention instead of only the score.
     */
    _cmdbHealthFindingsLog: function (scored) {
        var scorer = this.cmdbHealthScorer
        var lines = []
        scored.ordered.forEach(function (r) {
            if (r.status !== 'fail' && r.status !== 'warn') return
            lines.push(
                (r.status === 'fail' ? 'FAIL ' : 'WARN ') + r.id + ' [' + r.check.priority + '] ' + r.check.title +
                ' - ' + scorer.formatMeasure(r.check, r.res, r.pct)
            )
        })
        return lines.length ? 'Findings needing attention (worst first):\n' + lines.join('\n') : 'No failing or warning checks.'
    },

    /**
     * Collect, score and persist CMDB & CSDM Health for one run. Shared by the
     * dedicated mode and the Full-scan add-on.
     *
     * Every one of the 49 catalog checks gets a row on every run. The scanner's
     * own safe() blocks already absorb per-check failures; if the collector
     * itself throws, the checks are still written - all not assessed, with the
     * reason - rather than leaving the run with no check rows at all.
     * @param {GlideRecord} run
     * @returns {Object} {scored, results}
     */
    _runCmdbHealth: function (run) {
        var results
        try {
            results = this.cmdbHealthScanner.collect()
        } catch (e) {
            gs.error('IscanScanOrchestrator._runCmdbHealth: collector failed for run=' + run.getUniqueValue() + ': ' + e.message)
            this._appendScanFinding(run, 'CMDB Health collector failed: ' + e.message + ' - every check is recorded as not assessed.')
            results = { meta: { collector_error: String(e.message || e) }, inventory: [], checks: [], accessGaps: [] }
        }
        var catalog = new IscanCmdbHealthCatalog().get()
        var scored = this.cmdbHealthScorer.score(results, catalog)
        // Run Scan can be clicked again on a finished run. Without this the run
        // would carry two sets of 49 check rows and two summaries, and the
        // report would list every finding twice. Only this app's own rows for
        // this one run are removed (runs in the System worker).
        var tables = ['x_nold_iscan_cmdb_check', 'x_nold_iscan_cmdb_summary']
        for (var t = 0; t < tables.length; t++) {
            var old = new GlideRecord(tables[t])
            old.addQuery('run', run.getUniqueValue())
            old.deleteMultiple()
        }
        this._writeCmdbHealthRows(run.getUniqueValue(), results, scored, catalog)
        return { scored: scored, results: results }
    },

    /**
     * Inserts one x_nold_iscan_cmdb_check row per catalog check (catalog order)
     * and one x_nold_iscan_cmdb_summary row. These are the ONLY writes the CMDB
     * Health feature makes - no CMDB or platform table is ever written.
     */
    _writeCmdbHealthRows: function (runSysId, results, scored, catalog) {
        var failed = 0
        for (var i = 0; i < scored.rows.length; i++) {
            var r = scored.rows[i]
            var chk = r.check
            var res = r.res || {}
            var row = new GlideRecord('x_nold_iscan_cmdb_check')
            row.initialize()
            row.setValue('run', runSysId)
            row.setValue('check_id', chk.id)
            row.setValue('title', chk.title)
            row.setValue('theme', chk.theme)
            row.setValue('priority', chk.priority)
            row.setValue('kind', chk.kind)
            row.setValue('status', r.status)
            if (res.count !== null && res.count !== undefined) row.setValue('count', res.count)
            if (res.total !== null && res.total !== undefined) row.setValue('total', res.total)
            if (r.pct !== null && r.pct !== undefined) row.setValue('pct', r.pct)
            row.setValue('samples', (res.samples || []).map(String).join('\n').substring(0, 4000))
            row.setValue('note', String(res.note || this._cmdbWhy(r.status)).substring(0, 4000))
            row.setValue('kb', (chk.kb || []).join(', '))
            row.setValue('target_table', chk.table)
            row.setValue('issue_query', chk.issue_query)
            row.setValue('recommended_action', chk.action)
            if (!row.insert()) failed++
        }

        var meta = {}
        var srcMeta = results.meta || {}
        for (var k in srcMeta) if (srcMeta.hasOwnProperty(k)) meta[k] = srcMeta[k]
        meta.relationship_density = scored.meta.density

        var sum = new GlideRecord('x_nold_iscan_cmdb_summary')
        sum.initialize()
        sum.setValue('run', runSysId)
        if (scored.overall !== null) sum.setValue('overall_score', scored.overall)
        sum.setValue('checks_scored', scored.checksScored)
        sum.setValue('fail_count', scored.counts.fail)
        sum.setValue('warn_count', scored.counts.warn)
        sum.setValue('pass_count', scored.counts.pass)
        sum.setValue('na_count', scored.counts.n_a)
        sum.setValue('not_assessed_count', scored.counts.not_assessed)
        sum.setValue('theme_scores', JSON.stringify(scored.themes))
        sum.setValue('stage_readiness', JSON.stringify(scored.stages))
        sum.setValue('csdm_population', JSON.stringify(scored.population))
        sum.setValue('inventory', JSON.stringify(results.inventory || []))
        sum.setValue('meta', JSON.stringify(meta))
        sum.setValue('access_gaps', (results.accessGaps || []).join(', '))
        sum.setValue('llm_context', this.cmdbHealthScorer.buildLlmContext(scored, catalog))
        if (!sum.insert()) failed++

        gs.info('IscanScanOrchestrator._writeCmdbHealthRows: run=' + runSysId + ' wrote ' + scored.rows.length + ' check row(s) + 1 summary, ' + failed + ' failed')
        if (failed) {
            // Same pattern as every other write here: fail loudly, never scan
            // silently into rows nobody can see.
            throw new Error(failed + ' CMDB Health row(s) could not be written - check the create ACLs on x_nold_iscan_cmdb_check / x_nold_iscan_cmdb_summary.')
        }
    },

    /** score_results.py's reason text for a check with no collector note. */
    _cmdbWhy: function (status) {
        if (status === 'n_a') return 'no records in population'
        if (status === 'not_assessed') return 'no data provided'
        return ''
    },

    /** One log line summarising a scored CMDB Health run. */
    _cmdbHealthSummaryLine: function (outcome) {
        var sc = outcome.scored
        var c = sc.counts
        var gaps = (outcome.results && outcome.results.accessGaps) || []
        return (
            'CMDB health score: ' + (sc.overall === null ? 'n/a' : sc.overall + '/100') +
            ' (' + sc.checksScored + ' checks scored) - Fail ' + c.fail + ', Warn ' + c.warn + ', Pass ' + c.pass +
            ', N/A ' + c.n_a + ', Not assessed ' + c.not_assessed + '.' +
            (gaps.length ? ' Could not read: ' + gaps.join(', ') + ' - the checks using them are not assessed, not zero.' : '')
        )
    },

    /**
     * Persists a run's terminal state (status + completed) through a FRESH
     * GlideRecord that touches ONLY those two fields.
     *
     * Why not just run.update(): the `run` GlideRecord is reused for the whole
     * scan and carries the ever-growing scan_findings log. Its terminal write
     * used to be the same update() that also flushed that log, so anything that
     * broke that one call - an oversized value, a data policy, an ACL - lost the
     * status with it, and the run stayed 'running' forever with `completed`
     * empty. Observed on ven09425 2026-09-24: a Full run (4 apps + 3,549
     * table-only tables) worked for 16.5 minutes and never reached a terminal
     * state. Decoupling the status write from the log write means a terminal
     * status lands whenever execution gets this far, regardless of the log.
     *
     * The in-memory `run` is kept in step so callers reading it afterwards (the
     * REST response, the UI Action's mirror) see the same values.
     * @param {GlideRecord} run - status already set in memory to complete|error
     */
    _finishRun: function (run) {
        var runSysId = run.getUniqueValue()
        var status = run.getValue('status')
        if (status !== 'complete' && status !== 'error') {
            // Every _execute*Run sets complete or error before calling this.
            // Anything else means a code path forgot to, so record it as a
            // failure rather than leave the run looking live.
            gs.error('IscanScanOrchestrator._finishRun: run=' + runSysId + ' reached finish with status=' + status + ', recording as error')
            status = 'error'
        }
        var completed = new GlideDateTime()
        run.setValue('status', status)
        run.setValue('completed', completed)

        var fin = new GlideRecord('x_nold_iscan_run')
        if (!fin.get(runSysId)) {
            gs.error('IscanScanOrchestrator._finishRun: could not re-fetch run=' + runSysId + ' to record status=' + status)
            return
        }
        fin.setValue('status', status)
        fin.setValue('completed', completed)
        if (!fin.update()) {
            gs.error(
                'IscanScanOrchestrator._finishRun: FAILED to persist status=' + status + ' for run=' + runSysId +
                    ' - the run will still show its previous status. Check the write ACL on x_nold_iscan_run.'
            )
            return
        }
        gs.info('IscanScanOrchestrator._finishRun: run=' + runSysId + ' finished with status=' + status)
    },

    _createRun: function (scanMode, manualAppList) {
        var run = new GlideRecord('x_nold_iscan_run')
        run.initialize()
        run.setValue('scan_mode', scanMode)
        run.setValue('status', 'pending')
        run.setValue('started', new GlideDateTime())
        if (scanMode === 'manual' && manualAppList && manualAppList.length) {
            run.setValue('manual_app_list', manualAppList.join(','))
        }
        var runSysId = run.insert()
        if (!runSysId) {
            throw new Error('Could not create the scan run - the calling user may lack create access to x_nold_iscan_run.')
        }
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
            case 'modules':
                return { modulesOnly: true }
            case 'ai_agents':
                return { aiAgentsOnly: true }
            case 'cmdb_health':
                return { cmdbHealthOnly: true }
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
     * no sys_app to tally against x_nold_iscan_result.app (mandatory,
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
     * Appends a timestamped line to the run's scan_findings log and persists
     * it immediately (independent update from the caller's own run.update())
     * so progress is visible on refresh even if a later app fails.
     *
     * TWO fields are written here on purpose — do not "clean up" either one:
     *   - `scan_findings` (String): the queryable, timestamped running log.
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
     * `scan_findings` needs.
     *
     * The `run` GlideRecord instance is reused across the whole scan (this
     * method is called once per app plus start/end markers, all sharing
     * the same object) — fine for `scan_findings` (a plain field, each
     * update() just overwrites it with the latest full log string), but
     * NOT reliable for a Journal field: repeated set+update on the same
     * long-lived instance can silently fail to register a new journal
     * entry past the first call. So the journal write re-fetches a fresh
     * GlideRecord by sys_id every time, as its own separate update() —
     * that's what actually guarantees one new sys_journal_field entry per
     * call. Do not "simplify" this back to a single shared update() without
     * re-verifying multi-entry journal appends actually work against a
     * real instance.
     *
     * @param {GlideRecord} run
     * @param {String} message
     */
    /**
     * The scan_findings/comments log is a terse per-app PROGRESS log by
     * design (table/business-rule/script-include/flow counts + a
     * customization line) — it was never meant to hold the full v3
     * assessment, and never has. That data is: per-artifact-type counts
     * (~30 fields) on each x_nold_iscan_result record, field/cross-
     * reference data on x_nold_iscan_table/_crossref/
     * _global_customization child records, and the exportable
     * status-flagged + itemized narrative report via the "Download
     * Report" UI Action (IscanReportGenerator). This closing line exists
     * so that's discoverable from the log itself, without prior
     * knowledge of the schema — see docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md.
     * @param {Number} resultRecordCount - how many x_nold_iscan_result
     *   rows this run produced (0 for the table-only fallback path, which
     *   writes no result record).
     * @returns {String}
     */
    _reportPointerMessage: function (resultRecordCount) {
        if (resultRecordCount > 0) {
            return 'Full per-artifact-type counts and field/cross-reference data are on each app\'s Result record below; click Download Report (here or on a Result record) for the exportable status-flagged assessment.'
        }
        return 'Table profile and any base-system customizations found are above in this log; click Download Report for an exportable copy.'
    },

    _appendScanFinding: function (run, message) {
        var line = new GlideDateTime().getDisplayValue() + ' - ' + message
        var existing = run.getValue('scan_findings')
        run.setValue('scan_findings', existing ? existing + '\n' + line : line)
        run.update()

        var journalRun = new GlideRecord('x_nold_iscan_run')
        if (journalRun.get(run.getUniqueValue())) {
            journalRun.setValue('comments', message)
            journalRun.update()
        } else {
            gs.error('IscanScanOrchestrator._appendScanFinding: could not re-fetch run ' + run.getUniqueValue() + ' for journal comments write')
        }
    },

    _scanOneApp: function (run, appSysId) {
        var appGr = new GlideRecord('sys_app')
        if (!appGr.get(appSysId)) {
            gs.error('IscanScanOrchestrator._scanOneApp: sys_app not found for sys_id: ' + appSysId)
            this._appendScanFinding(run, 'ERROR: sys_app not found for sys_id ' + appSysId + ', skipping.')
            return
        }

        gs.info('IscanScanOrchestrator._scanOneApp: scanning app=' + appGr.getValue('name') + ' (' + appSysId + ')')
        this._appendScanFinding(run, 'Scanning app: ' + appGr.getValue('name') + '...')

        var canAccess = this.tableScanner.canAccessMetadata()
        var tables = []
        var scanModeUsed

        // scanApp() returns {sys_id, name} objects per bucket, so it is
        // already the source for BOTH the counts (via .length, exactly as
        // in v1 — do not change this) and the names the v2 briefing needs.
        var scanMode = run.getValue('scan_mode')
        var includeExtended =
            scanMode !== 'full' || gs.getProperty('x_nold_iscan.include_extended_counts_on_full_scan', 'false') === 'true'
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
            service_portal_pages: files.service_portal_pages.length,
            service_portal_widgets: files.service_portal_widgets.length,
            flow_actions: files.flow_actions.length,
            catalog_variables: files.catalog_variables.length,
            scripted_rest_resources: files.scripted_rest_resources.length,
            sla_definitions: files.sla_definitions.length,
            ui_pages: files.ui_pages.length,
            events: files.events.length,
            import_sets: files.import_sets.length,
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
            tables = this._profileOwnedTables(appSysId, run)
        } else {
            scanModeUsed = 'app_files_fallback'
        }

        var integrations = this._findIntegrations(appSysId)
        var integrationCount = integrations.length

        var result = new GlideRecord('x_nold_iscan_result')
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
        result.setValue('service_portal_page_count', automationCounts.service_portal_pages)
        result.setValue('service_portal_widget_count', automationCounts.service_portal_widgets)
        result.setValue('choice_count', automationCounts.choices)
        result.setValue('flow_action_count', automationCounts.flow_actions)
        result.setValue('catalog_variable_count', automationCounts.catalog_variables)
        result.setValue('role_count', automationCounts.roles)
        result.setValue('group_count', automationCounts.groups)
        result.setValue('system_property_count', automationCounts.system_properties)
        result.setValue('scripted_rest_resource_count', automationCounts.scripted_rest_resources)
        result.setValue('sla_definition_count', automationCounts.sla_definitions)
        result.setValue('ui_page_count', automationCounts.ui_pages)
        result.setValue('event_count', automationCounts.events)
        result.setValue('import_set_count', automationCounts.import_sets)
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
                'Could not insert x_nold_iscan_result for app "' +
                    appGr.getValue('name') +
                    '" — the calling user lacks create access (check the x_nold_iscan.scanner role and the result create ACL).'
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
        this._appendScanFinding(
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

        // Reverse-direction global-scope customization check — runs for
        // EVERY app in EVERY scan mode (custom_only, manual, full's
        // per-app branch, single_table's owning-app branch), unlike
        // _scanGlobalCustomizations() which only covers the table-only
        // fallback paths. See IscanTableScanner.findAppCustomizationsOnGlobalTables().
        this._writeAppGlobalCustomizations(run, resultId, appSysId)
    },

    /**
     * Writes one x_nold_iscan_global_customization row per base-system
     * table this app has customized, with `result` set so the Result
     * report can scope its own section to this app.
     * @param {GlideRecord} run
     * @param {String} resultId
     * @param {String} appScopeSysId
     */
    _writeAppGlobalCustomizations: function (run, resultId, appScopeSysId) {
        var findings = this.tableScanner.findAppCustomizationsOnGlobalTables(appScopeSysId)
        if (!findings.length) {
            return
        }

        this._appendScanFinding(
            run,
            'Found customizations on ' + findings.length + ' base-system table(s) from this app.'
        )

        for (var i = 0; i < findings.length; i++) {
            var row = new GlideRecord('x_nold_iscan_global_customization')
            row.initialize()
            row.setValue('run', run.getUniqueValue())
            row.setValue('result', resultId)
            row.setValue('table_name', findings[i].table_name)
            row.setValue('custom_field_count', findings[i].custom_fields.length)
            row.setValue(
                'custom_field_list',
                findings[i].custom_fields.map(function (f) { return f.name }).join(',')
            )
            row.setValue('custom_artifact_count', findings[i].custom_artifacts.length)
            row.setValue(
                'custom_artifact_list',
                findings[i].custom_artifacts.map(function (a) { return a.name + '(' + a.type + ')' }).join(',')
            )
            row.insert()
        }
    },

    /**
     * Discovers this app's tables and profiles each one, folding the
     * profile (row_count, fields, reference_fields) into the table object
     * itself so both the v2 briefing and the table-profile rows can read
     * it without profiling twice.
     * @param {String} appScopeSysId
     * @param {GlideRecord} run - needed to surface a cross-scope-privilege
     *   denial finding (see IscanTableScanner.profileTable's cross_scope_denial)
     * @returns {Array} table objects enriched with profile data
     */
    _profileOwnedTables: function (appScopeSysId, run) {
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
            if (profile.cross_scope_denial) {
                this._appendScanFinding(run, profile.cross_scope_denial)
            }
        }
        return tables
    },

    _writeTableProfiles: function (resultSysId, tables) {
        for (var i = 0; i < tables.length; i++) {
            var tableRow = new GlideRecord('x_nold_iscan_table')
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
     * One x_nold_iscan_crossref row per inbound-referencing field found
     * for a single x_nold_iscan_table row. Same-app references ARE
     * included (referencing_app will equal the app currently being
     * scanned in that case) — filtering intra-app vs. cross-app is a
     * Report sub-spec concern, not a write-time one.
     * @param {String} tableRowId - sys_id of the just-inserted x_nold_iscan_table row
     * @param {Array} inboundReferences - [{referencing_table, referencing_field, referencing_app, referencing_scope}]
     */
    _writeCrossrefRows: function (tableRowId, inboundReferences) {
        for (var i = 0; i < inboundReferences.length; i++) {
            var crossrefRow = new GlideRecord('x_nold_iscan_crossref')
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
