import { UiAction } from '@servicenow/sdk/core'
import { scannerRole } from './roles.now'

export const runScanUiAction = UiAction({
    $id: Now.ID['run_scan_ui_action'],
    table: 'x_nold_iscan_run',
    name: 'Run Scan',
    actionName: 'run_scan',
    active: true,
    showInsert: false,
    showUpdate: true,
    hint: 'Scan the resolved apps in the background and write one result record per app.',
    roles: [scannerRole],
    order: 100,
    form: {
        showButton: true,
    },
    client: {
        // Server-side UI action: the script runs directly on `current`
        // (the run record) in the same request as the form submit — no
        // GlideAjax, no execute ACL, no client-callable script include.
        // See RunScanUiAction.server.js for why this replaced the earlier
        // GlideAjax-based trigger.
        isClient: false,
        isUi16Compatible: true,
        isUi11Compatible: true,
    },
    script: Now.include('../server/RunScanUiAction.server.js'),
    messages: [],
})

export const downloadRunReportUiAction = UiAction({
    $id: Now.ID['download_run_report_ui_action'],
    table: 'x_nold_iscan_run',
    name: 'Download Report',
    actionName: 'download_run_report',
    active: true,
    showInsert: false,
    showUpdate: true,
    hint: 'Generate a PDF report for this scan run (every scanned app) and attach it directly to this record.',
    roles: [scannerRole],
    order: 200,
    form: {
        showButton: true,
    },
    client: {
        // Server-side UI action, same pattern as Run Scan above: runs
        // directly on `current` in the same request as the form submit
        // — no GlideAjax, no client-side "open sys_attachment.do in a
        // new tab" step. This replaced the previous client-side version
        // (which had isUi16Compatible: false, silently breaking client
        // script loading on UI16 forms — see git history) specifically
        // to eliminate that whole failure class, not just patch it.
        // See DownloadRunReportUiAction.server.js.
        isClient: false,
        isUi16Compatible: true,
        isUi11Compatible: true,
    },
    script: Now.include('../server/DownloadRunReportUiAction.server.js'),
    messages: [],
})

export const copyLlmContextUiAction = UiAction({
    $id: Now.ID['copy_llm_context_ui_action'],
    table: 'x_nold_iscan_result',
    name: 'Copy LLM Context',
    actionName: 'copy_llm_context',
    active: true,
    showInsert: false,
    showUpdate: true,
    hint: 'Copy this application’s full architecture briefing to the clipboard, ready to paste into any LLM.',
    roles: [scannerRole],
    order: 200,
    form: {
        showButton: true,
    },
    client: {
        // isUi16Compatible MUST be true — with it false the platform never
        // loads the client script on a UI16 form and the button silently
        // does nothing. See the Run Scan action above.
        isClient: true,
        isUi16Compatible: true,
        onClick: 'copyLlmContext()',
    },
    script: Now.include('../client-scripts/CopyLlmContext.client.js'),
    messages: [],
})

export const downloadResultReportUiAction = UiAction({
    $id: Now.ID['download_result_report_ui_action'],
    table: 'x_nold_iscan_result',
    name: 'Download Report',
    actionName: 'download_result_report',
    active: true,
    showInsert: false,
    showUpdate: true,
    hint: 'Export full detail for this scanned application as a PDF, with hyperlinks back to its table profiles.',
    roles: [scannerRole],
    order: 100,
    form: {
        showButton: true,
    },
    client: {
        isClient: true,
        // Same rationale/accepted risk as downloadRunReportUiAction above.
        isUi16Compatible: false,
        isUi11Compatible: false,
        onClick: 'downloadResultReport()',
    },
    script: Now.include('../client-scripts/DownloadResultReport.client.js'),
    messages: [],
})
