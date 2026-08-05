/*
 * ATF step script — "Orchestrator: Manual — App, end to end".
 *
 * The reference happy path. Scans this app with itself, then asserts the
 * whole write chain the UI and the report depend on:
 *   run -> result -> table profile -> crossref rows.
 *
 * All records created here are written inside the ATF test's rollback
 * context, so nothing survives the run.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    var orchestrator = new IscanScanOrchestrator()
    var runSysId = orchestrator.runScan('manual', [appSysId])
    assertEqual({ name: 'runScan() returns a run sys_id', shouldbe: true, value: !!runSysId })

    // Hand the run to any later step in this test.
    outputs.table = 'x_335329_iscan_run'
    outputs.record_id = runSysId

    // ---- Run record ------------------------------------------------------
    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'run record was created', shouldbe: true, value: run.get(runSysId) })
    assertEqual({ name: 'run reached status complete', shouldbe: 'complete', value: run.getValue('status') })
    assertEqual({ name: 'run recorded the scan mode', shouldbe: 'manual', value: run.getValue('scan_mode') })
    assertEqual({ name: 'run resolved exactly one app', shouldbe: '1', value: run.getValue('app_count') })
    assertEqual({
        name: 'run persisted the requested app list',
        shouldbe: appSysId,
        value: run.getValue('manual_app_list'),
    })
    assertEqual({ name: 'run recorded a start time', shouldbe: true, value: !!run.getValue('started') })
    assertEqual({ name: 'run recorded a completion time', shouldbe: true, value: !!run.getValue('completed') })
    // The findings log is the user-visible progress trail; its closing
    // line also points at where the real assessment lives.
    var findings = run.getValue('scan_findings') || ''
    assertEqual({ name: 'findings log records the resolved app count', shouldbe: true, value: findings.indexOf('Resolved 1 app(s)') !== -1 })
    assertEqual({ name: 'findings log records completion', shouldbe: true, value: findings.indexOf('Scan complete.') !== -1 })
    assertEqual({
        name: 'findings log points the reader at the result records and the report',
        shouldbe: true,
        value: findings.indexOf('Download Report') !== -1,
    })

    // ---- Result record ----------------------------------------------------
    var results = new GlideRecord('x_335329_iscan_result')
    results.addQuery('run', runSysId)
    results.query()
    var resultCount = results.getRowCount()
    assertEqual({ name: 'exactly one result record was written', shouldbe: 1, value: resultCount })
    assertEqual({ name: 'result record is readable', shouldbe: true, value: results.next() })
    var resultSysId = results.getUniqueValue()

    assertEqual({ name: 'result points at the scanned app', shouldbe: appSysId, value: results.getValue('app') })
    assertEqual({
        name: 'result records the full-access scan mode',
        shouldbe: 'full_access',
        value: results.getValue('scan_mode_used'),
    })
    assertEqual({ name: 'result records a scan date', shouldbe: true, value: !!results.getValue('scan_date') })

    // This app owns 5 tables; the count and the list must agree.
    var tableCount = parseInt(results.getValue('table_count'), 10) || 0
    assertEqual({ name: 'result counts this app\'s 5 tables', shouldbe: 5, value: tableCount })
    var tableList = results.getValue('table_list') || ''
    assertEqual({
        name: 'table_list names the run table',
        shouldbe: true,
        value: tableList.indexOf('x_335329_iscan_run') !== -1,
    })
    assertEqual({
        name: 'table_list entry count matches table_count',
        shouldbe: tableCount,
        value: tableList.split(',').length,
    })

    // Counts are derived from the same scanApp() buckets that produce the
    // names — this guards the v2 refactor that removed the separate
    // GlideAggregate COUNT queries.
    assertEqual({
        name: 'script_include_count covers the 6 known script includes',
        shouldbe: true,
        value: (parseInt(results.getValue('script_include_count'), 10) || 0) >= 6,
    })
    assertEqual({
        name: 'ui_action_count covers the 4 known UI actions',
        shouldbe: true,
        value: (parseInt(results.getValue('ui_action_count'), 10) || 0) >= 4,
    })
    assertEqual({
        name: 'acl_count covers the app\'s ACLs',
        shouldbe: true,
        value: (parseInt(results.getValue('acl_count'), 10) || 0) >= 11,
    })
    assertEqual({
        name: 'ui_policy_count covers the 2 UI policies',
        shouldbe: true,
        value: (parseInt(results.getValue('ui_policy_count'), 10) || 0) >= 2,
    })
    // Manual mode always includes the extended (Group B) counts,
    // regardless of the full-scan gating property.
    assertEqual({
        name: 'Manual mode includes Group B counts (choice_count populated)',
        shouldbe: true,
        value: (parseInt(results.getValue('choice_count'), 10) || 0) > 0,
    })
    // This app defines no REST message or web service.
    assertEqual({ name: 'integration_count is zero for an app with no integrations', shouldbe: '0', value: results.getValue('integration_count') })

    // llm_context is written on EVERY scan, independent of GenAI.
    var context = results.getValue('llm_context') || ''
    assertEqual({ name: 'llm_context was written', shouldbe: true, value: context.length > 0 })
    assertEqual({ name: 'llm_context carries section 1', shouldbe: true, value: context.indexOf('## 1. Application identity') !== -1 })
    assertEqual({ name: 'llm_context carries section 5', shouldbe: true, value: context.indexOf('## 5. What to do with this') !== -1 })
    assertEqual({
        name: 'llm_context reports the full-access scan mode',
        shouldbe: true,
        value: context.indexOf('Scan mode: full_access') !== -1,
    })
    assertEqual({
        name: 'llm_context names one of the scanned tables',
        shouldbe: true,
        value: context.indexOf('### Table: x_335329_iscan_run') !== -1,
    })

    // ---- Table profile rows ------------------------------------------------
    var profiles = new GlideRecord('x_335329_iscan_table')
    profiles.addQuery('result', resultSysId)
    profiles.query()
    assertEqual({ name: 'one table profile row per owned table', shouldbe: 5, value: profiles.getRowCount() })

    var runProfileSysId = ''
    var missingFieldCount = ''
    while (profiles.next()) {
        if ((parseInt(profiles.getValue('field_count'), 10) || 0) <= 0) {
            missingFieldCount = profiles.getValue('table_name')
        }
        if (profiles.getValue('table_name') === 'x_335329_iscan_run') {
            runProfileSysId = profiles.getUniqueValue()
        }
    }
    assertEqual({ name: 'every table profile captured a field count', shouldbe: '', value: missingFieldCount })
    assertEqual({ name: 'the run table was profiled', shouldbe: true, value: !!runProfileSysId })

    var runProfile = new GlideRecord('x_335329_iscan_table')
    runProfile.get(runProfileSysId)
    assertEqual({ name: 'run table profile has no parent table', shouldbe: '', value: runProfile.getValue('extends_table') })
    assertEqual({ name: 'run table profile classifies well_known_base as none', shouldbe: 'none', value: runProfile.getValue('well_known_base') })
    assertEqual({
        name: 'run table profile lists its reference fields',
        shouldbe: true,
        value: (runProfile.getValue('reference_field_list') || '').indexOf('requested_by->sys_user') !== -1,
    })
    // x_335329_iscan_result.run and x_335329_iscan_global_customization.run
    // both point here, so this must be at least 2.
    assertEqual({
        name: 'run table profile counted its inbound references',
        shouldbe: true,
        value: (parseInt(runProfile.getValue('inbound_reference_count'), 10) || 0) >= 2,
    })
    assertEqual({
        name: 'inbound_reference_list entry count matches inbound_reference_count',
        shouldbe: parseInt(runProfile.getValue('inbound_reference_count'), 10) || 0,
        value: (runProfile.getValue('inbound_reference_list') || '').split(',').length,
    })

    // ---- Cross-reference rows -----------------------------------------------
    var crossrefs = new GlideRecord('x_335329_iscan_crossref')
    crossrefs.addQuery('table', runProfileSysId)
    crossrefs.query()
    assertEqual({
        name: 'one crossref row per inbound referencing field',
        shouldbe: parseInt(runProfile.getValue('inbound_reference_count'), 10) || 0,
        value: crossrefs.getRowCount(),
    })
    var badCrossref = ''
    while (crossrefs.next()) {
        if (!crossrefs.getValue('referencing_table') || !crossrefs.getValue('referencing_field')) {
            badCrossref = crossrefs.getUniqueValue()
        }
    }
    assertEqual({ name: 'every crossref row names a referencing table and field', shouldbe: '', value: badCrossref })

    // ---- No spillover -------------------------------------------------------
    var otherResults = new GlideRecord('x_335329_iscan_result')
    otherResults.addQuery('run', runSysId)
    otherResults.addQuery('app', '!=', appSysId)
    otherResults.query()
    assertEqual({ name: 'Manual mode scanned no app other than the one requested', shouldbe: 0, value: otherResults.getRowCount() })

    stepResult.setOutputMessage(
        'Manual scan of x_335329_iscan complete: run=' +
            runSysId +
            ', 1 result, ' +
            tableCount +
            ' table profile(s), llm_context ' +
            context.length +
            ' chars.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
