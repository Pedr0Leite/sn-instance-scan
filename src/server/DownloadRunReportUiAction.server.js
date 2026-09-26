/*
 * UI Action script: "Download Report" (x_nold_iscan_run)
 * Server-side (client.isClient: false) — runs in the same request as the
 * form submit, calling IscanReportGenerator directly. No GlideAjax, no
 * execute ACL, no client-callable round trip involved: this replaces the
 * previous GlideAjax + client-side "open sys_attachment.do in a new tab"
 * flow with a single server-side action, same pattern as RunScanUiAction
 * replacing the original GlideAjax-based scan trigger.
 *
 * IscanReportGenerator still extends global.AbstractAjaxProcessor (its
 * Result-report GlideAjax entry points, generateResultReportAjax, remain
 * client-callable and unaffected by this change). Instantiating it here
 * with `new IscanReportGenerator()` and calling generateRunReport()
 * directly — never generateRunReportAjax() or this.getParameter() — is
 * safe: those are the only methods that touch AbstractAjaxProcessor's
 * request context, and this script never calls them.
 *
 * generateRunReport() (unchanged, in IscanReportGenerator.server.js)
 * builds the report HTML, converts it via the platform's PDF Generation
 * Utilities plugin, and attaches the resulting PDF directly to the
 * x_nold_iscan_run record whose sys_id it's given — already the
 * correct attachment target before this change; only the trigger
 * mechanism (GlideAjax vs. direct server call) is what's being fixed
 * here.
 */
;(function generateAndAttachRunReport() {
    gs.info('DownloadRunReportUiAction: Download Report clicked for run=' + current.getUniqueValue())

    try {
        var reportGenerator = new IscanReportGenerator()
        var attachmentSysId = reportGenerator.generateRunReport(current.getUniqueValue())
        if (attachmentSysId) {
            gs.info('DownloadRunReportUiAction: report generated, attachment=' + attachmentSysId)
            gs.addInfoMessage('Report generated and attached to this run record.')
        } else {
            gs.error('DownloadRunReportUiAction: generateRunReport returned no attachment sys_id for run=' + current.getUniqueValue())
            gs.addErrorMessage('Report generation failed — see the system log for details.')
        }
    } catch (e) {
        gs.error('DownloadRunReportUiAction: report generation failed for run=' + current.getUniqueValue() + ': ' + e.message)
        gs.addErrorMessage('Report generation failed: ' + e.message)
    }

    // No current.update() here — this action never modifies the run
    // record's own fields, only writes an attachment against it, so
    // there's no "Invalid update" double-save risk (see
    // RunScanUiAction.server.js's comment for that failure class).
    // setRedirectURL reloads the form so the new attachment is visible
    // in the Attachments list immediately.
    action.setRedirectURL(current)
})()
