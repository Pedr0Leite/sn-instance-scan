/*
 * ATF step script — "IscanSummaryGenerator: fallback briefing + GenAI degradation".
 *
 * Two independent guarantees, both easy to break by "tidying up":
 *   1. On the app_files_fallback path the data-model section is OMITTED
 *      WITH AN EXPLANATION, never zero-filled. A reader seeing
 *      "0 tables" would wrongly conclude the app has none, when the truth
 *      is nobody was allowed to look.
 *   2. generate() degrades to null when GenAI is off or absent — it never
 *      throws, and it never takes llm_context down with it.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var generator = new IscanSummaryGenerator()

    var fallbackFacts = {
        appName: 'ATF Fixture App',
        appScope: 'x_atf_fixture',
        appVendor: '',
        appSource: '',
        scanDate: '2026-01-01 00:00:00',
        scanModeUsed: 'app_files_fallback',
        tables: [],
        automation: {
            business_rules: [{ sys_id: '1', name: 'Fixture BR' }],
            script_includes: [],
            flows: [],
            acls: [],
            ui_actions: [],
        },
        integrations: [],
    }

    var context = generator.buildPrompt(fallbackFacts)

    assertEqual({
        name: 'fallback briefing states the scan mode in section 1',
        shouldbe: true,
        value: context.indexOf('Scan mode: app_files_fallback') !== -1,
    })
    assertEqual({
        name: 'fallback data model says "Not available"',
        shouldbe: true,
        value: context.indexOf('Not available') !== -1,
    })
    assertEqual({
        name: 'fallback data model explains the data model was NOT inspected',
        shouldbe: true,
        value: context.indexOf('NOT inspected') !== -1,
    })
    assertEqual({
        name: 'fallback data model explicitly warns against concluding the app has no tables',
        shouldbe: true,
        value: context.indexOf('it does not mean the application has no tables') !== -1,
    })
    // The critical negative: no zero-filled table list anywhere.
    assertEqual({
        name: 'fallback briefing never emits a zero-filled table count',
        shouldbe: -1,
        value: context.indexOf('Tables owned by this application: 0'),
    })
    assertEqual({
        name: 'fallback briefing does not claim a confirmed absence of tables',
        shouldbe: -1,
        value: context.indexOf('confirmed absence'),
    })
    // Automation IS available on the fallback path (it comes from
    // sys_metadata, not from table metadata), so it must still be listed.
    assertEqual({
        name: 'fallback briefing still lists the automation surface it could read',
        shouldbe: true,
        value: context.indexOf('Fixture BR') !== -1,
    })

    // ---- generate(): graceful degradation --------------------------------
    var originalSetting = gs.getProperty('x_335329_iscan.genai_enabled', 'true')
    try {
        gs.setProperty('x_335329_iscan.genai_enabled', 'false')
        var offResult = generator.generate(fallbackFacts)
        assertEqual({
            name: 'generate() returns null when genai_enabled is false',
            shouldbe: true,
            value: offResult === null || offResult === undefined || offResult === '',
        })
    } finally {
        gs.setProperty('x_335329_iscan.genai_enabled', originalSetting)
    }

    // With the switch back on, generate() must still not throw whether or
    // not the Generative AI Controller exists on this instance.
    var genAiAvailable =
        typeof sn_one_extend !== 'undefined' && typeof sn_one_extend.GenerativeAIInvocationAPI !== 'undefined'
    var threw = false
    var liveResult = null
    try {
        liveResult = generator.generate(fallbackFacts)
    } catch (e) {
        threw = true
    }
    assertEqual({ name: 'generate() never throws, regardless of GenAI availability', shouldbe: false, value: threw })
    if (!genAiAvailable) {
        assertEqual({
            name: 'generate() returns null when the GenAI Controller API is absent',
            shouldbe: true,
            value: liveResult === null || liveResult === undefined || liveResult === '',
        })
    }

    // ---- Input truncation -------------------------------------------------
    // Only the GenAI *input* is capped; the persisted llm_context always
    // stays full length. Verified via the private helper so the assertion
    // does not depend on an actual model call.
    var originalCap = gs.getProperty('x_335329_iscan.genai_max_input_chars', '20000')
    try {
        gs.setProperty('x_335329_iscan.genai_max_input_chars', '500')
        var long = generator.buildPrompt({
            appName: 'Long App',
            scanModeUsed: 'full_access',
            tables: [],
            automation: {},
            integrations: [],
        })
        var truncated = generator._truncateForGenAI(long + new Array(2000).join('x'))
        assertEqual({ name: 'truncated input respects the configured cap', shouldbe: true, value: truncated.length <= 500 })
        assertEqual({
            name: 'truncated input is marked as truncated so nothing reads as exhaustive',
            shouldbe: true,
            value: truncated.indexOf('TRUNCATED') !== -1,
        })
    } finally {
        gs.setProperty('x_335329_iscan.genai_max_input_chars', originalCap)
    }

    stepResult.setOutputMessage(
        'Fallback briefing verified (' +
            context.length +
            ' chars). GenAI Controller available: ' +
            genAiAvailable +
            '.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
