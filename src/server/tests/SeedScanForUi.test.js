/*
 * ATF step script — UI test fixture.
 *
 * Runs a Manual — App scan of this app and hands the resulting RESULT
 * record's sys_id to later steps via the step's output variables, so the
 * UI steps can open a real, fully-populated result form without depending
 * on whatever scan history happens to exist on the instance.
 *
 * Runs before any impersonation step, so it executes as the test user.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })

    var runSysId = new IscanScanOrchestrator().runScan('manual', [app.getUniqueValue()])

    var result = new GlideRecord('x_335329_iscan_result')
    result.addQuery('run', runSysId)
    result.setLimit(1)
    result.query()
    assertEqual({ name: 'the fixture scan produced a result record', shouldbe: true, value: result.next() })
    assertEqual({
        name: 'the fixture result has an llm_context to copy',
        shouldbe: true,
        value: (result.getValue('llm_context') || '').length > 0,
    })

    outputs.table = 'x_335329_iscan_result'
    outputs.record_id = result.getUniqueValue()

    stepResult.setOutputMessage('Seeded run=' + runSysId + ', result=' + result.getUniqueValue() + ' for the UI steps.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
