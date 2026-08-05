/*
 * ATF step script — "Security: the scanner role alone is enough to run a scan".
 *
 * Runs AFTER a "Create a user" step that grants x_335329_iscan.scanner and
 * impersonates. Scripts in this app run as the calling user with no
 * elevation, so if any ACL in the set is missing the scan silently writes
 * nothing (or throws the orchestrator's descriptive ACL error) — this is
 * the test that catches it.
 *
 * The scan mode actually USED is not asserted to be full_access on
 * purpose: whether a plain non-admin can read sys_db_object/sys_dictionary
 * is an instance-configuration question. Both outcomes are legitimate, so
 * each branch is asserted on its own terms — which also exercises the
 * ACL-denial fallback path whenever the instance is locked down.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    // Guard the premise: an accidentally-admin test user would make every
    // assertion below meaningless.
    assertEqual({ name: 'the impersonated user holds the scanner role', shouldbe: true, value: gs.hasRole('x_335329_iscan.scanner') })
    assertEqual({
        name: 'the impersonated user is NOT an admin (otherwise this proves nothing)',
        shouldbe: false,
        value: gs.getUser().hasRole('admin'),
    })

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'the scanner can read sys_app', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    var runSysId = new IscanScanOrchestrator().runScan('manual', [appSysId])
    assertEqual({ name: 'the scanner could create a run record', shouldbe: true, value: !!runSysId })

    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'the scanner can read the run record back', shouldbe: true, value: run.get(runSysId) })
    // Without the write ACL, status stays 'pending' and the findings log
    // stays empty — the classic symptom of a missing write grant.
    assertEqual({ name: 'the scanner could update the run record (status advanced)', shouldbe: 'complete', value: run.getValue('status') })
    assertEqual({
        name: 'the scanner could write the findings log',
        shouldbe: true,
        value: (run.getValue('scan_findings') || '').length > 0,
    })

    var result = new GlideRecord('x_335329_iscan_result')
    result.addQuery('run', runSysId)
    result.query()
    assertEqual({ name: 'the scanner could create and read a result record', shouldbe: true, value: result.next() })

    var modeUsed = result.getValue('scan_mode_used')
    assertEqual({
        name: 'result records a known scan mode',
        shouldbe: true,
        value: modeUsed === 'full_access' || modeUsed === 'app_files_fallback',
    })

    var profiles = new GlideRecord('x_335329_iscan_table')
    profiles.addQuery('result', result.getUniqueValue())
    profiles.query()
    var context = result.getValue('llm_context') || ''

    if (modeUsed === 'full_access') {
        assertEqual({ name: 'full access: table profiles were created and are readable', shouldbe: true, value: profiles.getRowCount() > 0 })
        assertEqual({
            name: 'full access: the briefing includes the data model',
            shouldbe: true,
            value: context.indexOf('Tables owned by this application:') !== -1,
        })
    } else {
        // ACL-denial fallback: no table data at all, and the briefing must
        // say the data model was not inspected rather than reporting zeros.
        assertEqual({ name: 'fallback: no table profiles are written', shouldbe: 0, value: profiles.getRowCount() })
        assertEqual({ name: 'fallback: automation counts still come from sys_metadata', shouldbe: true, value: (parseInt(result.getValue('script_include_count'), 10) || 0) > 0 })
        assertEqual({
            name: 'fallback: the briefing explains the data model was not inspected',
            shouldbe: true,
            value: context.indexOf('NOT inspected') !== -1,
        })
        assertEqual({
            name: 'fallback: the briefing never zero-fills the table list',
            shouldbe: -1,
            value: context.indexOf('Tables owned by this application: 0'),
        })
    }

    // llm_context is written on every scan regardless of GenAI or scan mode.
    assertEqual({ name: 'llm_context is written in either scan mode', shouldbe: true, value: context.length > 0 })

    // ---- Results are immutable -------------------------------------------
    // There is deliberately no write ACL on x_335329_iscan_result: results
    // are system-generated output.
    assertEqual({ name: 'the scanner cannot write to a result record', shouldbe: false, value: result.canWrite() })
    assertEqual({ name: 'the scanner cannot delete a result record', shouldbe: false, value: result.canDelete() })

    stepResult.setOutputMessage(
        'Scanner-role run succeeded using scan mode "' + modeUsed + '" with ' + profiles.getRowCount() + ' table profile(s).'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
