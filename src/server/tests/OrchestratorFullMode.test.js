/*
 * ATF step script — "Orchestrator: Full mode (whole instance)".
 *
 * LONG RUNNING. Full mode walks every sys_scope on the instance: apps
 * with a sys_app record go through the per-app pipeline, and every table
 * belonging to a scope WITHOUT one gets the table-only profile. On a
 * populated instance that is minutes, not seconds — which is why this
 * test lives in its own suite rather than the regression suite.
 *
 * Group B counts are gated OFF by default for full mode (7 extra queries
 * per app); that gate is asserted here rather than assumed.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var selector = new IscanAppSelector()
    var expected = selector.getFullScanScopes()

    var runSysId = new IscanScanOrchestrator().runScan('full', [])
    outputs.table = 'x_335329_iscan_run'
    outputs.record_id = runSysId

    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'run record was created', shouldbe: true, value: run.get(runSysId) })
    assertEqual({ name: 'the full scan completed without error', shouldbe: 'complete', value: run.getValue('status') })
    assertEqual({ name: 'run recorded the scan mode', shouldbe: 'full', value: run.getValue('scan_mode') })
    assertEqual({
        name: 'app_count matches the resolved scope list',
        shouldbe: String(expected.appIds.length),
        value: run.getValue('app_count'),
    })

    var results = new GlideRecord('x_335329_iscan_result')
    results.addQuery('run', runSysId)
    results.query()
    assertEqual({
        name: 'one result record per app-backed scope',
        shouldbe: expected.appIds.length,
        value: results.getRowCount(),
    })

    var findings = run.getValue('scan_findings') || ''
    if (expected.tableOnlyTables.length) {
        assertEqual({
            name: 'the findings log accounts for the table-only fallback scopes',
            shouldbe: true,
            value: findings.indexOf('table-only fallback table(s)') !== -1,
        })
    }
    assertEqual({ name: 'the findings log records completion', shouldbe: true, value: findings.indexOf('Scan complete.') !== -1 })

    // ---- Group B gating ---------------------------------------------------
    // With the property false (the default), full mode must skip the
    // extended per-app queries: their counts stay 0 even for an app that
    // demonstrably has choices when scanned in Manual mode.
    var gate = gs.getProperty('x_335329_iscan.include_extended_counts_on_full_scan', 'false')
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    if (app.next()) {
        var own = new GlideRecord('x_335329_iscan_result')
        own.addQuery('run', runSysId)
        own.addQuery('app', app.getUniqueValue())
        own.query()
        if (own.next()) {
            if (gate !== 'true') {
                assertEqual({
                    name: 'full mode skips Group B counts while the gating property is false',
                    shouldbe: '0',
                    value: own.getValue('choice_count'),
                })
            }
            // Group A is never gated.
            assertEqual({
                name: 'full mode still collects Group A counts',
                shouldbe: true,
                value: (parseInt(own.getValue('script_include_count'), 10) || 0) >= 6,
            })
        }
    }

    stepResult.setOutputMessage(
        'Full scan: ' +
            expected.appIds.length +
            ' app(s) + ' +
            expected.tableOnlyTables.length +
            ' table-only table(s), started ' +
            run.getValue('started') +
            ', completed ' +
            run.getValue('completed') +
            '.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
