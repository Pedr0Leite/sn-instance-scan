/*
 * Scripted REST operation: POST /api/x_nold_iscan/iscan_run_scan/run
 *
 * The console (x_nold_iscan_console.do) has no way to press the server-side
 * "Run Scan" UI Action, so it needs its own trigger. This is that trigger, and
 * it is deliberately NOT any of the alternatives:
 *   - a business rule on x_nold_iscan_run insert would DOUBLE-SCAN, because
 *     the UI Action already scans on form submit;
 *   - GlideAjax is banned in UI Pages by the SDK guide, and this app removed
 *     its GlideAjax trigger for the documented silent-empty-answer failure
 *     class (see CLAUDE.md).
 * A scripted REST endpoint fails LOUDLY — a real HTTP status and a real body —
 * which is the property that makes it safe here.
 *
 * This script owns no scan logic. It validates the request at the trust
 * boundary and then calls the SAME public orchestrator entry point the ATF
 * path already uses, runScan(scanMode, appIds, targetTableSysId). It runs as
 * the calling user (no impersonation, no gs.setUser), so the orchestrator's
 * existing ACL-denial handling still applies, and it writes nothing itself.
 *
 * Synchronous by design: a `full` scan of a large instance runs inside this
 * request and could approach the transaction timeout. That is not a new risk —
 * the UI Action is equally synchronous inside the form-submit request — so no
 * async/worker machinery is introduced here.
 */
;(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var VALID_MODES = ['full', 'custom_only', 'manual', 'single_table', 'modules', 'ai_agents']

    function fail(status, message) {
        gs.warn('IscanRunScanApi: rejected request (' + status + '): ' + message)
        response.setStatus(status)
        response.setBody({ error: message })
    }

    var body = {}
    try {
        body = (request.body && request.body.data) || {}
    } catch (parseError) {
        return fail(400, 'Request body must be JSON. ' + parseError.message)
    }

    var scanMode = body.scan_mode ? String(body.scan_mode) : ''
    if (VALID_MODES.indexOf(scanMode) === -1) {
        return fail(400, 'scan_mode must be one of: ' + VALID_MODES.join(', ') + '. Received: "' + scanMode + '".')
    }

    // Mirror RunScanUiAction.server.js: target_app is a List field whose
    // getValue() is a comma-separated sys_id string, so accept either shape.
    var rawAppIds = body.app_ids
    var appIds = []
    if (rawAppIds instanceof Array) {
        appIds = rawAppIds
    } else if (rawAppIds) {
        appIds = String(rawAppIds).split(',')
    }
    appIds = appIds
        .map(function (id) {
            return String(id).trim()
        })
        .filter(function (id) {
            return id !== ''
        })

    var targetTable = body.target_table ? String(body.target_table).trim() : ''

    if (scanMode === 'manual' && appIds.length === 0) {
        return fail(400, 'Manual — App scan mode requires app_ids (one or more sys_app sys_ids).')
    }
    if (scanMode === 'single_table' && !targetTable) {
        return fail(400, 'Manual — Single Table scan mode requires target_table (a sys_db_object sys_id).')
    }

    gs.info('IscanRunScanApi: starting scan, scan_mode=' + scanMode + ', apps=' + appIds.length)
    var runSysId = ''
    try {
        runSysId = new IscanScanOrchestrator().runScan(scanMode, appIds, targetTable)
    } catch (e) {
        gs.error('IscanRunScanApi: scan failed for scan_mode=' + scanMode + ': ' + e.message)
        return fail(500, 'Scan failed: ' + e.message)
    }

    if (!runSysId) {
        return fail(500, 'Scan produced no run record — the calling user may lack create access to x_nold_iscan_run.')
    }

    var run = new GlideRecord('x_nold_iscan_run')
    var status = run.get(runSysId) ? run.getValue('status') : ''
    gs.info('IscanRunScanApi: scan finished, run=' + runSysId + ', status=' + status)

    response.setStatus(201)
    response.setBody({ sys_id: runSysId, status: status, scan_mode: scanMode })
})(request, response)
