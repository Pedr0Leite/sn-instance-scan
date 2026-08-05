/*
 * ATF step script — "Orchestrator: Manual — Single Table, no-owning-app case".
 *
 * Picking a base-system table (global scope, no sys_app record) has no
 * app to tally against x_335329_iscan_result.app, which is mandatory. The
 * documented behaviour is therefore: profile the one table, write the
 * profile into the run's findings log, and write NO result/table-profile/
 * crossref rows at all. Zero result records here is the correct outcome,
 * not a failure — this test exists so nobody "fixes" it into writing one.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    // sys_user_role: base-system, global scope, small, and referenced by a
    // handful of tables — enough to exercise the inbound-reference path
    // without scanning a high-cardinality table.
    var db = new GlideRecord('sys_db_object')
    db.addQuery('name', 'sys_user_role')
    db.setLimit(1)
    db.query()
    assertEqual({ name: 'sys_db_object record found for sys_user_role', shouldbe: true, value: db.next() })
    var targetTableSysId = db.getUniqueValue()

    // Precondition for this branch: the scope must have no sys_app record.
    var owningApp = new GlideRecord('sys_app')
    var hasOwningApp = !!db.getValue('sys_scope') && owningApp.get(db.getValue('sys_scope'))
    assertEqual({ name: 'the picked base-system table has no owning sys_app record', shouldbe: false, value: hasOwningApp })

    var orchestrator = new IscanScanOrchestrator()
    var runSysId = orchestrator.runScan('single_table', [], targetTableSysId)
    outputs.table = 'x_335329_iscan_run'
    outputs.record_id = runSysId

    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'run record was created', shouldbe: true, value: run.get(runSysId) })
    assertEqual({ name: 'run reached status complete (no error path)', shouldbe: 'complete', value: run.getValue('status') })
    assertEqual({ name: 'no apps were resolved', shouldbe: '0', value: run.getValue('app_count') })
    assertEqual({ name: 'run persisted the picked target table', shouldbe: targetTableSysId, value: run.getValue('target_table') })

    // ---- No result-side records ------------------------------------------
    var results = new GlideRecord('x_335329_iscan_result')
    results.addQuery('run', runSysId)
    results.query()
    assertEqual({ name: 'no result record is written for a table with no owning app', shouldbe: 0, value: results.getRowCount() })

    // ---- The findings log IS the output here ------------------------------
    var findings = run.getValue('scan_findings') || ''
    assertEqual({
        name: 'findings log explains the table has no owning application',
        shouldbe: true,
        value: findings.indexOf('has no owning application') !== -1,
    })
    assertEqual({
        name: 'findings log names the profiled table',
        shouldbe: true,
        value: findings.indexOf('sys_user_role') !== -1,
    })
    assertEqual({ name: 'findings log reports a row count', shouldbe: true, value: findings.indexOf('row(s)') !== -1 })
    assertEqual({ name: 'findings log reports a field count', shouldbe: true, value: findings.indexOf('field(s)') !== -1 })
    assertEqual({
        name: 'findings log reports the reference fields',
        shouldbe: true,
        value: findings.indexOf('reference field(s)') !== -1,
    })
    assertEqual({
        name: 'findings log reports the inbound reference count',
        shouldbe: true,
        value: findings.indexOf('inbound reference(s)') !== -1,
    })
    assertEqual({ name: 'findings log records completion', shouldbe: true, value: findings.indexOf('Scan complete.') !== -1 })

    // ---- Base-system customization detection still runs --------------------
    // The table-only path writes x_335329_iscan_global_customization rows
    // (with a blank `result`) whenever a customer scope has touched the
    // table. Whether any exist is instance-specific, so the shape is what
    // is asserted: any row written must belong to this run, name this
    // table, and carry no result reference.
    var customizations = new GlideRecord('x_335329_iscan_global_customization')
    customizations.addQuery('run', runSysId)
    customizations.query()
    var badRow = ''
    while (customizations.next()) {
        if (customizations.getValue('table_name') !== 'sys_user_role' || customizations.getValue('result')) {
            badRow = customizations.getUniqueValue()
        }
    }
    assertEqual({
        name: 'table-only customization rows name the picked table and carry no result reference',
        shouldbe: '',
        value: badRow,
    })

    stepResult.setOutputMessage(
        'Single Table (base-system) scan complete: run=' +
            runSysId +
            ', 0 result records by design, findings log populated.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
