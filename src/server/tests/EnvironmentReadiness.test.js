/*
 * ATF step script — "Environment readiness".
 *
 * Pre-flight check that everything this app DEPENDS ON still exists after
 * an upgrade: its own scope record, its 5 tables, its role, its 5 system
 * properties, and the platform PDF Generation Utilities plugin the
 * "Download Report" UI Actions call into.
 *
 * Runs first in the suite on purpose: when the platform dependency is
 * gone, every downstream report test fails for a reason that has nothing
 * to do with this app's own code, and this step says so in one line.
 *
 * Jasmine describe() is NOT used anywhere in this suite: it is only
 * supported in global scope, and these tests ship inside the scoped app
 * (x_335329_iscan). assertEqual() + stepResult is the supported pattern
 * for a scoped ATF server-side script step.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var notes = []

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    var appFound = app.next()
    assertEqual({ name: 'sys_app record exists for scope x_335329_iscan', shouldbe: true, value: appFound })
    outputs.record_id = appFound ? app.getUniqueValue() : ''
    outputs.table = 'sys_app'

    var tables = [
        'x_335329_iscan_run',
        'x_335329_iscan_result',
        'x_335329_iscan_table',
        'x_335329_iscan_crossref',
        'x_335329_iscan_global_customization',
    ]
    for (var t = 0; t < tables.length; t++) {
        assertEqual({
            name: 'table exists and is queryable: ' + tables[t],
            shouldbe: true,
            value: new GlideRecord(tables[t]).isValid(),
        })
    }

    var role = new GlideRecord('sys_user_role')
    role.addQuery('name', 'x_335329_iscan.scanner')
    role.query()
    assertEqual({ name: 'role x_335329_iscan.scanner exists', shouldbe: true, value: role.hasNext() })

    // Every property is read via gs.getProperty() with a default in the
    // app code, so a missing one degrades silently rather than failing —
    // which is exactly why it has to be asserted here instead.
    var properties = [
        'x_335329_iscan.custom_scope_prefix',
        'x_335329_iscan.row_count_timeout_ms',
        'x_335329_iscan.genai_enabled',
        'x_335329_iscan.genai_max_input_chars',
        'x_335329_iscan.include_extended_counts_on_full_scan',
    ]
    for (var p = 0; p < properties.length; p++) {
        var prop = new GlideRecord('sys_properties')
        prop.addQuery('name', properties[p])
        prop.query()
        assertEqual({ name: 'system property exists: ' + properties[p], shouldbe: true, value: prop.hasNext() })
    }

    // Hard dependency: IscanReportGenerator._convertToPdf() calls this
    // API directly. Without the plugin, both "Download Report" buttons
    // fail at runtime with "Report generation failed".
    var pdfAvailable =
        typeof sn_pdfgeneratorutils !== 'undefined' && typeof sn_pdfgeneratorutils.PDFGenerationAPI !== 'undefined'
    assertEqual({
        name: 'PDF Generation Utilities API (sn_pdfgeneratorutils.PDFGenerationAPI) is available',
        shouldbe: true,
        value: pdfAvailable,
    })

    // Soft dependency: only summary_text needs it. llm_context is always
    // written regardless, so this is reported, never asserted.
    var genAiAvailable =
        typeof sn_one_extend !== 'undefined' && typeof sn_one_extend.GenerativeAIInvocationAPI !== 'undefined'
    notes.push('GenAI Controller available: ' + genAiAvailable)
    notes.push('genai_enabled property: ' + gs.getProperty('x_335329_iscan.genai_enabled', '(unset)'))
    notes.push(
        'include_extended_counts_on_full_scan: ' +
            gs.getProperty('x_335329_iscan.include_extended_counts_on_full_scan', '(unset)')
    )

    stepResult.setOutputMessage('Environment ready. ' + notes.join(' | '))
    return true
})(outputs, steps, params, stepResult, assertEqual)
