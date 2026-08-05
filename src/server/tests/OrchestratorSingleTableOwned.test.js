/*
 * ATF step script — "Orchestrator: Manual — Single Table, owning-app case".
 *
 * When the picked table's scope HAS a sys_app record, Single Table mode
 * deliberately runs the full per-app tally rather than profiling one
 * table in isolation: the picked table is guaranteed to appear in that
 * app's profile anyway, and the result record stays comparable with every
 * other mode's output.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    // Pick one of this app's own tables via its sys_db_object record —
    // the same thing the target_table reference field stores.
    var db = new GlideRecord('sys_db_object')
    db.addQuery('name', 'x_335329_iscan_result')
    db.setLimit(1)
    db.query()
    assertEqual({ name: 'sys_db_object record found for x_335329_iscan_result', shouldbe: true, value: db.next() })
    var targetTableSysId = db.getUniqueValue()
    assertEqual({
        name: 'the picked table is owned by the fixture app scope',
        shouldbe: appSysId,
        value: db.getValue('sys_scope'),
    })

    var orchestrator = new IscanScanOrchestrator()
    var runSysId = orchestrator.runScan('single_table', [], targetTableSysId)
    outputs.table = 'x_335329_iscan_run'
    outputs.record_id = runSysId

    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'run record was created', shouldbe: true, value: run.get(runSysId) })
    assertEqual({ name: 'run reached status complete', shouldbe: 'complete', value: run.getValue('status') })
    assertEqual({ name: 'run recorded the scan mode', shouldbe: 'single_table', value: run.getValue('scan_mode') })
    assertEqual({
        name: 'run persisted the picked target table',
        shouldbe: targetTableSysId,
        value: run.getValue('target_table'),
    })
    assertEqual({ name: 'the owning app was resolved and scanned', shouldbe: '1', value: run.getValue('app_count') })

    var results = new GlideRecord('x_335329_iscan_result')
    results.addQuery('run', runSysId)
    results.query()
    assertEqual({ name: 'exactly one result record, for the owning app', shouldbe: 1, value: results.getRowCount() })
    assertEqual({ name: 'result record is readable', shouldbe: true, value: results.next() })
    assertEqual({ name: 'result points at the table\'s owning app', shouldbe: appSysId, value: results.getValue('app') })
    assertEqual({
        name: 'the owning-app branch uses the normal full-access pipeline',
        shouldbe: 'full_access',
        value: results.getValue('scan_mode_used'),
    })

    // The picked table must appear in the app's profile — that guarantee
    // is why this branch reuses the per-app pipeline at all.
    var profile = new GlideRecord('x_335329_iscan_table')
    profile.addQuery('result', results.getUniqueValue())
    profile.addQuery('table_name', 'x_335329_iscan_result')
    profile.query()
    assertEqual({ name: 'the picked table was profiled', shouldbe: true, value: profile.next() })
    assertEqual({
        name: 'the picked table\'s profile captured its complete field list',
        shouldbe: true,
        value: (parseInt(profile.getValue('field_count'), 10) || 0) > 0,
    })
    assertEqual({
        name: 'the picked table\'s profile captured its reference fields',
        shouldbe: true,
        value: (profile.getValue('reference_field_list') || '').indexOf('app->sys_app') !== -1,
    })
    assertEqual({
        name: 'the picked table\'s row count was captured',
        shouldbe: 'string',
        value: typeof profile.getValue('row_count'),
    })

    // Full per-app tally, not a single-table profile: every table the app
    // owns is present.
    var allProfiles = new GlideRecord('x_335329_iscan_table')
    allProfiles.addQuery('result', results.getUniqueValue())
    allProfiles.query()
    assertEqual({
        name: 'Single Table mode ran the full per-app tally (all owned tables profiled)',
        shouldbe: 5,
        value: allProfiles.getRowCount(),
    })

    stepResult.setOutputMessage('Single Table (owned) scan complete: run=' + runSysId + ', owning app resolved, 5 table profile(s).')
    return true
})(outputs, steps, params, stepResult, assertEqual)
