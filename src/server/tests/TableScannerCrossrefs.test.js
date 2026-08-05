/*
 * ATF step script — "IscanTableScanner: inbound reference discovery".
 *
 * findInboundReferences() answers "who depends on this table" with a
 * whole-instance sys_dictionary search. This app's own tables form a
 * known reference graph, so they make a deterministic fixture:
 *   x_335329_iscan_result.run   -> x_335329_iscan_run
 *   x_335329_iscan_global_customization.run -> x_335329_iscan_run
 *   x_335329_iscan_crossref.table -> x_335329_iscan_table
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var scanner = new IscanTableScanner()

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    function findEntry(list, table, field) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].referencing_table === table && list[i].referencing_field === field) {
                return list[i]
            }
        }
        return null
    }

    var inbound = scanner.findInboundReferences('x_335329_iscan_run')
    var resultRef = findEntry(inbound, 'x_335329_iscan_result', 'run')
    var globalRef = findEntry(inbound, 'x_335329_iscan_global_customization', 'run')

    assertEqual({
        name: 'findInboundReferences() finds x_335329_iscan_result.run',
        shouldbe: true,
        value: !!resultRef,
    })
    assertEqual({
        name: 'findInboundReferences() finds x_335329_iscan_global_customization.run',
        shouldbe: true,
        value: !!globalRef,
    })
    // Same-app references are deliberately NOT filtered out at scan time —
    // slicing intra-app vs. inter-app is a reporting concern.
    assertEqual({
        name: 'same-app references are kept and resolve to the owning app',
        shouldbe: appSysId,
        value: resultRef ? resultRef.referencing_app : '',
    })
    assertEqual({
        name: 'referencing_scope is populated alongside referencing_app',
        shouldbe: true,
        value: !!(resultRef && resultRef.referencing_scope),
    })

    var tableInbound = scanner.findInboundReferences('x_335329_iscan_table')
    assertEqual({
        name: 'findInboundReferences() finds x_335329_iscan_crossref.table',
        shouldbe: true,
        value: !!findEntry(tableInbound, 'x_335329_iscan_crossref', 'table'),
    })

    // A platform table referenced from base-system tables: at least one
    // referencing table must resolve to a BLANK app, proving the
    // "no owning sys_app" case is handled rather than crashing or
    // inventing an app. Blank here is expected, not a bug.
    var oobInbound = scanner.findInboundReferences('sys_db_object')
    assertEqual({
        name: 'findInboundReferences() finds inbound references to a base-system table',
        shouldbe: true,
        value: oobInbound.length > 0,
    })
    var blankApp = false
    for (var i = 0; i < oobInbound.length; i++) {
        if (!oobInbound[i].referencing_app) {
            blankApp = true
            break
        }
    }
    assertEqual({
        name: 'referencing_app is blank when the referencing table has no owning sys_app',
        shouldbe: true,
        value: blankApp,
    })

    // A table nothing points at must come back empty, not throw.
    assertEqual({
        name: 'findInboundReferences() returns an empty list for an unreferenced table name',
        shouldbe: 0,
        value: scanner.findInboundReferences('x_335329_iscan_no_such_table').length,
    })

    stepResult.setOutputMessage(
        'x_335329_iscan_run has ' +
            inbound.length +
            ' inbound reference(s); x_335329_iscan_table has ' +
            tableInbound.length +
            '; sys_db_object has ' +
            oobInbound.length +
            '.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
