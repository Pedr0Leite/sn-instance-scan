/*
 * ATF step script — "Report: HTML content, status flags and recommendations".
 *
 * Asserts what the report SAYS, separately from whether the PDF converts
 * (covered by the PDF test). The HTML builders are called directly so a
 * failure points at the report logic rather than at the platform plugin.
 *
 * Status flags and recommendations are deliberately presence/absence
 * checks with no numeric thresholds — there is no defensible basis for a
 * count cutoff — so both are tested by constructing the exact condition
 * and asserting the flag appears, then asserting it does NOT appear when
 * the condition is absent.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    var generator = new IscanReportGenerator()
    var runSysId = new IscanScanOrchestrator().runScan('manual', [appSysId])

    var run = new GlideRecord('x_335329_iscan_run')
    run.get(runSysId)
    var result = new GlideRecord('x_335329_iscan_result')
    result.addQuery('run', runSysId)
    result.query()
    assertEqual({ name: 'the fixture scan produced a result record', shouldbe: true, value: result.next() })

    // ---- Run report -------------------------------------------------------
    var runHtml = generator._buildRunReportHtml(run)
    assertEqual({ name: 'run report has a title', shouldbe: true, value: runHtml.indexOf('Run Report') !== -1 })
    assertEqual({ name: 'run report states the scan mode', shouldbe: true, value: runHtml.indexOf('Scan mode:') !== -1 })
    assertEqual({ name: 'run report has an Applications table', shouldbe: true, value: runHtml.indexOf('<h2>Applications</h2>') !== -1 })
    // Without this section, a Single Table or Full-fallback run's PDF has
    // no findings text in it at all.
    assertEqual({
        name: 'run report includes the scan findings log',
        shouldbe: true,
        value: runHtml.indexOf('<h2>Scan Findings Log</h2>') !== -1,
    })
    assertEqual({
        name: 'run report links back to the result record',
        shouldbe: true,
        value: runHtml.indexOf('x_335329_iscan_result.do?sys_id=' + result.getUniqueValue()) !== -1,
    })
    assertEqual({
        name: 'run report embeds the per-app detail section',
        shouldbe: true,
        value: runHtml.indexOf('<h2>Application Detail</h2>') !== -1,
    })

    // ---- Result report ----------------------------------------------------
    var resultHtml = generator._buildResultReportHtml(result)
    var expectedSections = [
        '<b>Status:</b>',
        '<h2>Recommendations</h2>',
        '<h2>Artifact inventory</h2>',
        '<h2>Counts only (not per-app components)</h2>',
        '<h2>Tables</h2>',
    ]
    for (var s = 0; s < expectedSections.length; s++) {
        assertEqual({
            name: 'result report contains section: ' + expectedSections[s],
            shouldbe: true,
            value: resultHtml.indexOf(expectedSections[s]) !== -1,
        })
    }
    // The inventory is itemized, not just counted — it re-queries the app
    // files live at report time to get the names.
    assertEqual({
        name: 'artifact inventory names an actual script include',
        shouldbe: true,
        value: resultHtml.indexOf('IscanScanOrchestrator') !== -1,
    })
    assertEqual({
        name: 'tables section lists a profiled table with a link to its record',
        shouldbe: true,
        value: resultHtml.indexOf('x_335329_iscan_run</a>') !== -1,
    })
    assertEqual({
        name: 'tables section renders the dictionary override and inbound reference columns',
        shouldbe: true,
        value: resultHtml.indexOf('<th>Dictionary Overrides</th>') !== -1 && resultHtml.indexOf('<th>Inbound References</th>') !== -1,
    })
    assertEqual({
        name: 'cross-references section is rendered when crossref rows exist',
        shouldbe: true,
        value: resultHtml.indexOf('<h2>Cross-references</h2>') !== -1,
    })

    // ---- Status flags: clean scan -----------------------------------------
    var cleanFlags = generator._computeStatusFlags(result)
    var fallbackWarning = false
    for (var f = 0; f < cleanFlags.length; f++) {
        if (cleanFlags[f].text.indexOf('Application Files fallback') !== -1) {
            fallbackWarning = true
        }
    }
    assertEqual({ name: 'a full-access scan raises no fallback warning', shouldbe: false, value: fallbackWarning })
    assertEqual({
        name: 'no flags renders as the OK icon',
        shouldbe: '✅',
        value: generator._renderStatusIcons([]),
    })
    assertEqual({
        name: 'no flags renders as an OK status line',
        shouldbe: true,
        value: generator._renderStatusDetail([]).indexOf('✅ OK') !== -1,
    })

    // ---- Status flags: fallback scan ---------------------------------------
    // Constructed directly rather than by revoking metadata access, so the
    // flag logic is tested without depending on ACL evaluation.
    var syntheticResult = new GlideRecord('x_335329_iscan_result')
    syntheticResult.initialize()
    syntheticResult.setValue('run', runSysId)
    syntheticResult.setValue('app', appSysId)
    syntheticResult.setValue('scan_mode_used', 'app_files_fallback')
    syntheticResult.setValue('acl_count', 0)
    syntheticResult.setValue('table_count', 0)
    var syntheticSysId = syntheticResult.insert()
    assertEqual({ name: 'synthetic fallback result inserted', shouldbe: true, value: !!syntheticSysId })

    var fallbackResult = new GlideRecord('x_335329_iscan_result')
    fallbackResult.get(syntheticSysId)
    var fallbackFlags = generator._computeStatusFlags(fallbackResult)
    var sawFallbackWarning = false
    for (var ff = 0; ff < fallbackFlags.length; ff++) {
        if (fallbackFlags[ff].type === 'warning' && fallbackFlags[ff].text.indexOf('fallback') !== -1) {
            sawFallbackWarning = true
        }
    }
    assertEqual({ name: 'a fallback scan raises a warning flag', shouldbe: true, value: sawFallbackWarning })
    assertEqual({
        name: 'the warning renders with a warning icon, not the OK icon',
        shouldbe: true,
        value: generator._renderStatusIcons(fallbackFlags).indexOf('✅') === -1,
    })

    var fallbackRecommendations = generator._computeRecommendations(fallbackResult)
    var sawAccessRecommendation = false
    for (var r = 0; r < fallbackRecommendations.length; r++) {
        if (fallbackRecommendations[r].indexOf('sys_db_object/sys_dictionary') !== -1) {
            sawAccessRecommendation = true
        }
    }
    assertEqual({
        name: 'a fallback scan recommends granting metadata read access',
        shouldbe: true,
        value: sawAccessRecommendation,
    })

    // The zero-ACL recommendation must NOT fire for an app with no table
    // profiles: the check is "tables exist AND no ACLs", not "no ACLs".
    var falsePositive = false
    for (var fr = 0; fr < fallbackRecommendations.length; fr++) {
        if (fallbackRecommendations[fr].indexOf('No ACLs are defined') !== -1) {
            falsePositive = true
        }
    }
    assertEqual({ name: 'the zero-ACL recommendation does not fire without tables', shouldbe: false, value: falsePositive })

    // This app has both tables and ACLs, so the real result must not carry
    // that recommendation either.
    var realRecommendations = generator._computeRecommendations(result)
    var wrongAclAdvice = false
    for (var rr = 0; rr < realRecommendations.length; rr++) {
        if (realRecommendations[rr].indexOf('No ACLs are defined') !== -1) {
            wrongAclAdvice = true
        }
    }
    assertEqual({ name: 'an app with ACLs is not told to add ACLs', shouldbe: false, value: wrongAclAdvice })
    assertEqual({
        name: 'an empty recommendation list still renders a section',
        shouldbe: true,
        value: generator._renderRecommendations([]).indexOf('None — no divergence') !== -1,
    })

    stepResult.setOutputMessage(
        'Report content verified: run report ' +
            runHtml.length +
            ' chars, result report ' +
            resultHtml.length +
            ' chars, ' +
            cleanFlags.length +
            ' status flag(s), ' +
            realRecommendations.length +
            ' recommendation(s).'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
