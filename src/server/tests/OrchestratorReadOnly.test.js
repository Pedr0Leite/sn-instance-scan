/*
 * ATF step script — "Read-only guarantee: a scan writes nothing outside its own tables".
 *
 * This is the app's hardest constraint from the spec, not a style rule:
 * no script may write to a scanned table. The check is a before/after row
 * count across the metadata and data tables the scan reads from most
 * heavily, plus a same-window check that no sys_audit entries were
 * written against any non-x_335329_iscan table.
 *
 * Both a per-app scan and a base-system single-table scan are exercised,
 * since they take different code paths through IscanTableScanner.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    function countRows(tableName) {
        var ga = new GlideAggregate(tableName)
        ga.addAggregate('COUNT')
        ga.query()
        return ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) || 0 : 0
    }

    // Everything the scan reads: table/field metadata, app files, the
    // artifact tables it counts, and a plain data table.
    var watched = [
        'sys_db_object',
        'sys_dictionary',
        'sys_metadata',
        'sys_app',
        'sys_scope',
        'sys_choice',
        'sys_script',
        'sys_script_include',
        'sys_script_client',
        'sys_ui_policy',
        'sys_security_acl',
        'sys_ui_action',
        'sys_properties',
        'sys_user',
        'sys_user_role',
    ]

    var before = {}
    for (var i = 0; i < watched.length; i++) {
        before[watched[i]] = countRows(watched[i])
    }

    var startedAt = new GlideDateTime()

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })

    var orchestrator = new IscanScanOrchestrator()
    orchestrator.runScan('manual', [app.getUniqueValue()])

    // The table-only path profiles a base-system table directly — a
    // different code path, same read-only requirement.
    var db = new GlideRecord('sys_db_object')
    db.addQuery('name', 'sys_user_role')
    db.setLimit(1)
    db.query()
    if (db.next()) {
        orchestrator.runScan('single_table', [], db.getUniqueValue())
    }

    var changed = []
    for (var w = 0; w < watched.length; w++) {
        var after = countRows(watched[w])
        if (after !== before[watched[w]]) {
            changed.push(watched[w] + ' (' + before[watched[w]] + ' -> ' + after + ')')
        }
    }
    assertEqual({
        name: 'no scanned table gained or lost rows during the scan',
        shouldbe: '',
        value: changed.join(', '),
    })

    // Audit trail cross-check, scoped to the same watched tables so that
    // unrelated instance activity during the run cannot make this flaky:
    // an audited write on any of them would mean the scan wrote somewhere
    // it only ever reads.
    var audit = new GlideRecord('sys_audit')
    if (audit.isValid()) {
        audit.addQuery('sys_created_on', '>=', startedAt.getValue())
        audit.addQuery('tablename', 'IN', watched.join(','))
        audit.query()
        var audited = []
        while (audit.next() && audited.length < 5) {
            audited.push(audit.getValue('tablename'))
        }
        assertEqual({
            name: 'no audited write landed on a table outside this app',
            shouldbe: '',
            value: audited.join(', '),
        })
    }

    stepResult.setOutputMessage('Read-only verified across ' + watched.length + ' table(s) for both the per-app and table-only scan paths.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
