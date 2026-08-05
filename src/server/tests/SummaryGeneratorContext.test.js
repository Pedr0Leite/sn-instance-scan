/*
 * ATF step script — "IscanSummaryGenerator.buildPrompt(): the 5-section briefing".
 *
 * llm_context must stand alone: a reader (human or LLM) should never need
 * to open another ServiceNow record to understand it. The section
 * headings and their ORDER are part of that contract — the "Copy LLM
 * Context" flow and every downstream prompt depend on them.
 *
 * buildPrompt() is called with a hand-built runFacts object rather than a
 * real scan, so the assertions can be exact instead of instance-dependent.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var generator = new IscanSummaryGenerator()

    var runFacts = {
        appName: 'ATF Fixture App',
        appScope: 'x_atf_fixture',
        appVendor: 'ATF',
        appSource: '',
        scanDate: '2026-01-01 00:00:00',
        scanModeUsed: 'full_access',
        tables: [
            {
                name: 'x_atf_fixture_widget',
                extends: 'task',
                well_known_base: 'task',
                row_count: 42,
                fields: [
                    { name: 'widget_name', internal_type: 'string' },
                    { name: 'owner', internal_type: 'reference' },
                ],
                reference_fields: ['owner->sys_user'],
            },
        ],
        automation: {
            business_rules: [{ sys_id: '1', name: 'Fixture BR' }],
            script_includes: [{ sys_id: '2', name: 'FixtureUtils' }],
            flows: [],
            acls: [{ sys_id: '3', name: 'x_atf_fixture_widget' }],
            ui_actions: [],
        },
        integrations: [{ type: 'sys_rest_message', name: 'Fixture REST', endpoint: 'https://example.invalid/api' }],
    }

    var context = generator.buildPrompt(runFacts)
    assertEqual({ name: 'buildPrompt() returns a non-empty string', shouldbe: true, value: !!context && context.length > 0 })

    // ---- Sections present, in order -------------------------------------
    var headings = [
        '## 1. Application identity',
        '## 2. Data model',
        '## 3. Automation surface',
        '## 4. Integration points',
        '## 5. What to do with this',
    ]
    var previousIndex = -1
    for (var h = 0; h < headings.length; h++) {
        var index = context.indexOf(headings[h])
        assertEqual({ name: 'section present: ' + headings[h], shouldbe: true, value: index !== -1 })
        assertEqual({ name: 'section in order: ' + headings[h], shouldbe: true, value: index > previousIndex })
        previousIndex = index
    }

    // ---- Section 1 ------------------------------------------------------
    assertEqual({ name: 'identity states the app name', shouldbe: true, value: context.indexOf('Name: ATF Fixture App') !== -1 })
    assertEqual({ name: 'identity states the scope', shouldbe: true, value: context.indexOf('Scope: x_atf_fixture') !== -1 })
    assertEqual({
        name: 'identity states scan mode full_access in plain language',
        shouldbe: true,
        value: context.indexOf('Scan mode: full_access') !== -1,
    })
    // Blank facts must be labelled, never rendered as an empty value.
    assertEqual({ name: 'missing source is labelled, not blank', shouldbe: true, value: context.indexOf('Source: (none recorded)') !== -1 })

    // ---- Section 2 ------------------------------------------------------
    assertEqual({ name: 'data model states the table count', shouldbe: true, value: context.indexOf('Tables owned by this application: 1') !== -1 })
    assertEqual({ name: 'data model names the table', shouldbe: true, value: context.indexOf('### Table: x_atf_fixture_widget') !== -1 })
    assertEqual({ name: 'data model states what the table extends', shouldbe: true, value: context.indexOf('- Extends: task') !== -1 })
    assertEqual({ name: 'data model states the well-known base', shouldbe: true, value: context.indexOf('- Well-known base: task') !== -1 })
    assertEqual({ name: 'data model states the row count', shouldbe: true, value: context.indexOf('- Row count: 42') !== -1 })
    assertEqual({
        name: 'data model lists fields as "name (type)"',
        shouldbe: true,
        value: context.indexOf('widget_name (string)') !== -1,
    })
    assertEqual({
        name: 'data model renders the outbound reference graph',
        shouldbe: true,
        value: context.indexOf('x_atf_fixture_widget -> owner->sys_user') !== -1,
    })

    // ---- Section 3: names, not only counts ------------------------------
    assertEqual({ name: 'automation names business rules', shouldbe: true, value: context.indexOf('Fixture BR') !== -1 })
    assertEqual({ name: 'automation names script includes', shouldbe: true, value: context.indexOf('FixtureUtils') !== -1 })
    assertEqual({
        name: 'bucket header count matches the number of named items',
        shouldbe: true,
        value: context.indexOf('Business rules (1):') !== -1,
    })
    // An empty bucket must say "none" rather than being omitted, so the
    // reader can tell "checked, found nothing" from "not checked".
    assertEqual({ name: 'empty bucket is reported as none', shouldbe: true, value: context.indexOf('Flows (0):') !== -1 })

    // ---- Section 4 ------------------------------------------------------
    assertEqual({ name: 'integrations name the record', shouldbe: true, value: context.indexOf('Fixture REST') !== -1 })
    assertEqual({
        name: 'integrations include the endpoint',
        shouldbe: true,
        value: context.indexOf('https://example.invalid/api') !== -1,
    })

    // ---- Section 5: fixed footer ----------------------------------------
    // The footer is identical every time on purpose: the whole block is
    // meant to be copy-paste-and-go, with no prompt of the user's own.
    assertEqual({
        name: 'footer instructs the reader what to produce',
        shouldbe: true,
        value: context.indexOf('write a well-documented architecture summary') !== -1,
    })
    assertEqual({
        name: 'footer warns against inferring "no tables" from an unavailable data model',
        shouldbe: true,
        value: context.indexOf('do not infer that the application has no tables') !== -1,
    })

    // An app with no tables, scanned WITH access, is a confirmed absence —
    // materially different from the fallback path's "not inspected".
    runFacts.tables = []
    var emptyContext = generator.buildPrompt(runFacts)
    assertEqual({
        name: 'zero tables under full access is stated as a confirmed absence',
        shouldbe: true,
        value: emptyContext.indexOf('confirmed absence') !== -1,
    })

    stepResult.setOutputMessage('llm_context built: ' + context.length + ' chars, 5 sections verified in order.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
