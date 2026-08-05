/*
 * ATF step script — "Orchestrator: error and edge-case handling".
 *
 * The orchestrator's contract is that bad INPUT throws a descriptive
 * error (the caller is wrong and should hear about it), while a scan that
 * merely finds nothing completes normally with zero results (nothing is
 * wrong; there is just nothing there). Conflating the two is the failure
 * mode this test guards.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var orchestrator = new IscanScanOrchestrator()

    function captureThrow(fn) {
        try {
            fn()
            return ''
        } catch (e) {
            return e.message || 'error'
        }
    }

    // ---- Bad input throws, with a message that names the problem --------
    var unknownMode = captureThrow(function () {
        orchestrator.runScan('not_a_mode', [])
    })
    assertEqual({ name: 'an unknown scan mode throws', shouldbe: true, value: unknownMode.length > 0 })
    assertEqual({
        name: 'the unknown-scan-mode error names the offending mode',
        shouldbe: true,
        value: unknownMode.indexOf('not_a_mode') !== -1,
    })

    var noTarget = captureThrow(function () {
        orchestrator.runScan('single_table', [])
    })
    assertEqual({ name: 'Single Table mode without a target table throws', shouldbe: true, value: noTarget.length > 0 })
    assertEqual({
        name: 'the missing-target error tells the caller what to set',
        shouldbe: true,
        value: noTarget.indexOf('target_table') !== -1,
    })

    var badTarget = captureThrow(function () {
        orchestrator.runScan('single_table', [], 'deadbeefdeadbeefdeadbeefdeadbeef')
    })
    assertEqual({ name: 'Single Table mode with an unknown table sys_id throws', shouldbe: true, value: badTarget.length > 0 })
    assertEqual({
        name: 'the unknown-table error names sys_db_object',
        shouldbe: true,
        value: badTarget.indexOf('sys_db_object') !== -1,
    })

    var missingRun = captureThrow(function () {
        orchestrator.runScanForRecord('deadbeefdeadbeefdeadbeefdeadbeef', 'manual', [])
    })
    assertEqual({
        name: 'runScanForRecord() throws when the run record does not exist',
        shouldbe: true,
        value: missingRun.length > 0,
    })

    // ---- "Found nothing" is not an error --------------------------------
    // Manual mode with only invalid app sys_ids resolves to an empty list.
    // The run must still complete: nothing failed, there was just nothing
    // to scan.
    var emptyRunSysId = orchestrator.runScan('manual', ['deadbeefdeadbeefdeadbeefdeadbeef'])
    var emptyRun = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'a run record is still created', shouldbe: true, value: emptyRun.get(emptyRunSysId) })
    assertEqual({ name: 'an empty app list completes rather than erroring', shouldbe: 'complete', value: emptyRun.getValue('status') })
    assertEqual({ name: 'an empty app list resolves zero apps', shouldbe: '0', value: emptyRun.getValue('app_count') })

    var emptyResults = new GlideRecord('x_335329_iscan_result')
    emptyResults.addQuery('run', emptyRunSysId)
    emptyResults.query()
    assertEqual({ name: 'no result records are written for an empty app list', shouldbe: 0, value: emptyResults.getRowCount() })

    // A sys_app sys_id that vanishes mid-scan is logged and skipped, not
    // fatal: the loop continues with the remaining apps.
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    if (app.next()) {
        var run = new GlideRecord('x_335329_iscan_run')
        run.initialize()
        run.setValue('scan_mode', 'manual')
        run.setValue('status', 'pending')
        var runSysId = run.insert()
        // _executeRun is called with a hand-built list containing one real
        // app and one that does not exist.
        var mixed = captureThrow(function () {
            orchestrator._executeRun(run, [app.getUniqueValue(), 'deadbeefdeadbeefdeadbeefdeadbeef'])
        })
        assertEqual({ name: 'a missing app inside the list does not abort the run', shouldbe: '', value: mixed })

        var reloaded = new GlideRecord('x_335329_iscan_run')
        reloaded.get(runSysId)
        assertEqual({ name: 'the run still completes', shouldbe: 'complete', value: reloaded.getValue('status') })
        assertEqual({
            name: 'the findings log records the skipped app',
            shouldbe: true,
            value: (reloaded.getValue('scan_findings') || '').indexOf('sys_app not found') !== -1,
        })

        var partial = new GlideRecord('x_335329_iscan_result')
        partial.addQuery('run', runSysId)
        partial.query()
        assertEqual({ name: 'the valid app in the list was still scanned', shouldbe: 1, value: partial.getRowCount() })
    }

    stepResult.setOutputMessage('Error handling verified: 4 throwing inputs, 2 non-error empty/partial outcomes.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
