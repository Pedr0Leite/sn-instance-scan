/*
 * ATF step script — "Report: PDF generation and attachment".
 *
 * Both "Download Report" buttons end here. The report is converted by the
 * platform PDF Generation Utilities plugin and attached to the record the
 * button was clicked from — so the assertion is a real sys_attachment
 * row, with a PDF content type and a non-zero size, on the right record.
 *
 * A missing/inactive plugin surfaces as an empty return value plus a
 * gs.error, never as a silent no-op; the Environment readiness test
 * checks the plugin separately so a failure here can be told apart from
 * a missing dependency.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })

    var runSysId = new IscanScanOrchestrator().runScan('manual', [app.getUniqueValue()])
    var result = new GlideRecord('x_335329_iscan_result')
    result.addQuery('run', runSysId)
    result.query()
    assertEqual({ name: 'the fixture scan produced a result record', shouldbe: true, value: result.next() })
    var resultSysId = result.getUniqueValue()

    var generator = new IscanReportGenerator()

    function assertAttachment(label, attachmentSysId, table, recordSysId) {
        assertEqual({ name: label + ': an attachment sys_id was returned', shouldbe: true, value: !!attachmentSysId })
        if (!attachmentSysId) {
            return
        }
        var attachment = new GlideRecord('sys_attachment')
        assertEqual({ name: label + ': the attachment record exists', shouldbe: true, value: attachment.get(attachmentSysId) })
        assertEqual({ name: label + ': attached to the right table', shouldbe: table, value: attachment.getValue('table_name') })
        assertEqual({
            name: label + ': attached to the record the button was clicked from',
            shouldbe: recordSysId,
            value: attachment.getValue('table_sys_id'),
        })
        assertEqual({
            name: label + ': the attachment is a PDF',
            shouldbe: true,
            value: (attachment.getValue('content_type') || '').indexOf('pdf') !== -1,
        })
        assertEqual({
            name: label + ': the PDF is not empty',
            shouldbe: true,
            value: (parseInt(attachment.getValue('size_bytes'), 10) || 0) > 0,
        })
        assertEqual({
            name: label + ': the file is named for the record it describes',
            shouldbe: true,
            value: (attachment.getValue('file_name') || '').indexOf('sn-instance-scan') === 0,
        })
    }

    // The Run-table "Download Report" UI Action calls generateRunReport()
    // directly, server-side — exactly as done here.
    assertAttachment('run report', generator.generateRunReport(runSysId), 'x_335329_iscan_run', runSysId)

    // The Result-table button goes through GlideAjax into
    // generateResultReportAjax(), which is a thin wrapper around this.
    assertAttachment('result report', generator.generateResultReport(resultSysId), 'x_335329_iscan_result', resultSysId)

    // ---- Invalid input degrades, never throws ----------------------------
    var threw = false
    var missingRun = ''
    var missingResult = ''
    try {
        missingRun = generator.generateRunReport('deadbeefdeadbeefdeadbeefdeadbeef')
        missingResult = generator.generateResultReport('deadbeefdeadbeefdeadbeefdeadbeef')
    } catch (e) {
        threw = true
    }
    assertEqual({ name: 'an unknown record id does not throw', shouldbe: false, value: threw })
    assertEqual({ name: 'an unknown run id returns an empty attachment id', shouldbe: '', value: missingRun })
    assertEqual({ name: 'an unknown result id returns an empty attachment id', shouldbe: '', value: missingResult })

    stepResult.setOutputMessage('Run and result PDFs generated and attached; unknown ids degraded cleanly.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
