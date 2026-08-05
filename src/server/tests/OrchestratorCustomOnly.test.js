/*
 * ATF step script — "Orchestrator: Custom Only mode".
 *
 * Custom Only must scan exactly the apps IscanAppSelector.getCustomApps()
 * resolves — custom-scoped AND not store-installed — and nothing else.
 * The two filters are asserted independently here, because a store app
 * with a customer-looking scope passes the prefix check alone.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    var expectedApps = new IscanAppSelector().getCustomApps()
    assertEqual({
        name: 'at least one custom app is resolvable (this app)',
        shouldbe: true,
        value: expectedApps.length >= 1,
    })

    var orchestrator = new IscanScanOrchestrator()
    var runSysId = orchestrator.runScan('custom_only', [])
    outputs.table = 'x_335329_iscan_run'
    outputs.record_id = runSysId

    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'run record was created', shouldbe: true, value: run.get(runSysId) })
    assertEqual({ name: 'run reached status complete', shouldbe: 'complete', value: run.getValue('status') })
    assertEqual({ name: 'run recorded the scan mode', shouldbe: 'custom_only', value: run.getValue('scan_mode') })
    assertEqual({
        name: 'app_count matches the resolved custom app list',
        shouldbe: String(expectedApps.length),
        value: run.getValue('app_count'),
    })

    var results = new GlideRecord('x_335329_iscan_result')
    results.addQuery('run', runSysId)
    results.query()
    assertEqual({
        name: 'one result record per resolved custom app',
        shouldbe: expectedApps.length,
        value: results.getRowCount(),
    })

    var scannedApps = []
    var storeAppScanned = ''
    var nonCustomScanned = ''
    var prefix = gs.getProperty('x_335329_iscan.custom_scope_prefix', 'x_')
    while (results.next()) {
        var scannedAppId = results.getValue('app')
        scannedApps.push(scannedAppId)

        var scanned = new GlideRecord('sys_app')
        if (!scanned.get(scannedAppId)) {
            continue
        }
        if (scanned.getValue('scope').indexOf(prefix) !== 0) {
            nonCustomScanned = scanned.getValue('scope')
        }
        var storeApp = new GlideRecord('sys_store_app')
        storeApp.addQuery('scope', scanned.getValue('scope'))
        storeApp.query()
        if (storeApp.hasNext()) {
            storeAppScanned = scanned.getValue('scope')
        }
    }

    assertEqual({
        name: 'Custom Only scanned this app',
        shouldbe: true,
        value: scannedApps.indexOf(appSysId) !== -1,
    })
    assertEqual({ name: 'Custom Only scanned no non-custom scope', shouldbe: '', value: nonCustomScanned })
    assertEqual({ name: 'Custom Only scanned no store-installed app', shouldbe: '', value: storeAppScanned })

    // Custom Only always includes Group B counts — the gating property
    // only applies to full-instance scans.
    var own = new GlideRecord('x_335329_iscan_result')
    own.addQuery('run', runSysId)
    own.addQuery('app', appSysId)
    own.query()
    if (own.next()) {
        assertEqual({
            name: 'Custom Only includes Group B counts regardless of the full-scan gate',
            shouldbe: true,
            value: (parseInt(own.getValue('choice_count'), 10) || 0) > 0,
        })
        assertEqual({
            name: 'Custom Only used the full-access path',
            shouldbe: 'full_access',
            value: own.getValue('scan_mode_used'),
        })
    }

    stepResult.setOutputMessage('Custom Only scanned ' + scannedApps.length + ' app(s); expected ' + expectedApps.length + '.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
