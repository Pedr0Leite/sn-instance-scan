/*
 * ATF step script — "Security: a user without the scanner role gets nothing".
 *
 * Runs AFTER a "Create a user" step that grants NO roles and impersonates.
 * Every one of this app's tables is gated by a role-based record ACL, so
 * an unroled user must be unable to read scan history or start a scan.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    assertEqual({ name: 'the impersonated user does not hold the scanner role', shouldbe: false, value: gs.hasRole('x_335329_iscan.scanner') })
    assertEqual({ name: 'the impersonated user is not an admin', shouldbe: false, value: gs.getUser().hasRole('admin') })

    var tables = [
        'x_335329_iscan_run',
        'x_335329_iscan_result',
        'x_335329_iscan_table',
        'x_335329_iscan_crossref',
        'x_335329_iscan_global_customization',
    ]
    for (var i = 0; i < tables.length; i++) {
        var gr = new GlideRecord(tables[i])
        assertEqual({ name: 'no read access without the role: ' + tables[i], shouldbe: false, value: gr.canRead() })
        assertEqual({ name: 'no create access without the role: ' + tables[i], shouldbe: false, value: gr.canCreate() })
    }

    // A denied insert returns null rather than throwing, which is exactly
    // why the orchestrator checks the return value and raises a
    // descriptive error instead of scanning into nothing.
    var attempt = new GlideRecord('x_335329_iscan_run')
    attempt.initialize()
    attempt.setValue('scan_mode', 'manual')
    attempt.setValue('status', 'pending')
    var insertedSysId = attempt.insert()
    assertEqual({ name: 'an unroled user cannot insert a run record', shouldbe: true, value: !insertedSysId })

    // Existing scan history must not be readable either.
    var history = new GlideRecord('x_335329_iscan_run')
    history.query()
    assertEqual({ name: 'an unroled user sees no scan history', shouldbe: 0, value: history.getRowCount() })

    stepResult.setOutputMessage('Access correctly denied on all 5 tables for a user with no roles.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
