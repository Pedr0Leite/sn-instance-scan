/*
 * ATF step script — "IscanAppSelector: all three resolution modes".
 *
 * The app under test is used as its own fixture: x_335329_iscan is a
 * custom-scoped, internally-developed (non-store) app that owns tables,
 * so it is guaranteed to be present on any instance this suite runs on —
 * no seeded demo app to keep in sync.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var selector = new IscanAppSelector()

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    // ---- getCustomApps() ----------------------------------------------
    var prefix = gs.getProperty('x_335329_iscan.custom_scope_prefix', 'x_')
    var customApps = selector.getCustomApps()
    assertEqual({
        name: 'getCustomApps() includes this custom app',
        shouldbe: true,
        value: customApps.indexOf(appSysId) !== -1,
    })

    // Every returned app must satisfy BOTH filters, not just the prefix:
    // store-installed apps carry customer-looking scopes too.
    var offendingPrefix = ''
    var offendingStoreApp = ''
    for (var i = 0; i < customApps.length; i++) {
        var candidate = new GlideRecord('sys_app')
        if (!candidate.get(customApps[i])) {
            continue
        }
        if (candidate.getValue('scope').indexOf(prefix) !== 0) {
            offendingPrefix = candidate.getValue('scope')
        }
        var storeApp = new GlideRecord('sys_store_app')
        storeApp.addQuery('scope', candidate.getValue('scope'))
        storeApp.query()
        if (storeApp.hasNext()) {
            offendingStoreApp = candidate.getValue('scope')
        }
    }
    assertEqual({
        name: 'getCustomApps() returns only scopes starting with the configured prefix',
        shouldbe: '',
        value: offendingPrefix,
    })
    assertEqual({
        name: 'getCustomApps() excludes store-installed apps',
        shouldbe: '',
        value: offendingStoreApp,
    })

    // ---- getManualApps() ----------------------------------------------
    var manual = selector.getManualApps([appSysId, 'deadbeefdeadbeefdeadbeefdeadbeef'])
    assertEqual({ name: 'getManualApps() drops sys_ids that are not real apps', shouldbe: 1, value: manual.length })
    assertEqual({ name: 'getManualApps() keeps the valid app', shouldbe: appSysId, value: manual[0] })
    assertEqual({ name: 'getManualApps([]) returns an empty list', shouldbe: 0, value: selector.getManualApps([]).length })
    assertEqual({
        name: 'getManualApps(null) returns an empty list rather than throwing',
        shouldbe: 0,
        value: selector.getManualApps(null).length,
    })

    // ---- getFullScanScopes() ------------------------------------------
    var full = selector.getFullScanScopes()
    assertEqual({ name: 'getFullScanScopes() returns appIds', shouldbe: true, value: !!full && !!full.appIds })
    assertEqual({
        name: 'getFullScanScopes() returns tableOnlyTables',
        shouldbe: true,
        value: !!full && !!full.tableOnlyTables,
    })
    assertEqual({
        name: 'getFullScanScopes() includes this app in appIds',
        shouldbe: true,
        value: full.appIds.indexOf(appSysId) !== -1,
    })
    // The literal `global` scope is deliberately skipped: it owns the
    // entire base table set, and flooding the findings log with thousands
    // of platform-internal tables was never the ask.
    assertEqual({
        name: 'getFullScanScopes() excludes global-scope tables from the table-only fallback',
        shouldbe: -1,
        value: full.tableOnlyTables.indexOf('incident'),
    })
    assertEqual({
        name: 'getFullScanScopes() does not put this app in the table-only fallback (it has a sys_app record)',
        shouldbe: -1,
        value: full.tableOnlyTables.indexOf('x_335329_iscan_run'),
    })

    // getFullScanApps() is deprecated but still exported; it must keep
    // returning the narrower sys_app-only list for any caller that wants it.
    var legacy = selector.getFullScanApps()
    assertEqual({
        name: 'deprecated getFullScanApps() still resolves sys_app records',
        shouldbe: true,
        value: legacy.indexOf(appSysId) !== -1,
    })

    stepResult.setOutputMessage(
        'custom_only=' +
            customApps.length +
            ' app(s), full=' +
            full.appIds.length +
            ' app(s) + ' +
            full.tableOnlyTables.length +
            ' table-only table(s), legacy full=' +
            legacy.length +
            ' app(s).'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
