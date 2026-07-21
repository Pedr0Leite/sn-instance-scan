/*
 * UI Action script: "Run Scan" (x_335329_iscan_run)
 * Server-side (client.isClient: false) — runs in the same request as the
 * form submit, calling IscanScanOrchestrator directly. No GlideAjax, no
 * execute ACL, no client-callable script include involved: this removes
 * the entire class of "empty answer, no server log" failures that a
 * GlideAjax-based trigger is prone to (bad api_name, execute ACL denial,
 * accessibleFrom misconfiguration). Every step below always reaches the
 * system log.
 *
 * `current` here is the run record with the submitted form values already
 * applied in memory (not yet persisted) — same as a "before" business
 * rule. IscanScanOrchestrator.runScanForRecord() takes scanMode and
 * manualAppList as explicit parameters rather than reading them off a
 * fresh query for exactly this reason: a fresh GlideRecord.get() would
 * only see what's already committed to the database.
 */
;(function executeRunScan() {
    gs.info('RunScanUiAction: Run Scan clicked for run=' + current.getUniqueValue())

    var scanMode = current.getValue('scan_mode')
    var manualAppListRaw = current.getValue('manual_app_list')
    var targetAppId = current.getValue('target_app')
    var targetTableId = current.getValue('target_table')

    if (!scanMode) {
        gs.info('RunScanUiAction: aborted, no scan_mode selected')
        gs.addErrorMessage('Select a scan mode before running the scan.')
        current.setAbortAction(true)
        return
    }
    if (scanMode === 'manual' && !targetAppId && !manualAppListRaw) {
        gs.info('RunScanUiAction: aborted, manual mode with no target_app or manual_app_list')
        gs.addErrorMessage('Manual — App scan mode requires Target App or Manual App List to be set.')
        current.setAbortAction(true)
        return
    }
    if (scanMode === 'single_table' && !targetTableId) {
        gs.info('RunScanUiAction: aborted, single_table mode with no target_table')
        gs.addErrorMessage('Manual — Single Table scan mode requires Target Table to be set.')
        current.setAbortAction(true)
        return
    }

    // target_app takes precedence over the legacy manual_app_list field
    // when both are set — see docs/superpowers/specs/2026-07-21-modes-design.md.
    var manualAppList = targetAppId ? [targetAppId] : (manualAppListRaw ? manualAppListRaw.split(',') : [])

    // Persist the submitted form values (scan_mode, target_app,
    // target_table, manual_app_list) BEFORE the orchestrator runs, and
    // before the setAbortAction(true) below. Without this, target_app/
    // target_table would silently revert to blank on reload: the
    // platform's own post-script save is being aborted (so it doesn't
    // clobber the orchestrator's own status/activities updates, made via
    // a separately-fetched GlideRecord), and the orchestrator only ever
    // explicitly re-applies the fields it already knows about
    // (scan_mode, manual_app_list, target_table) onto ITS copy — never
    // target_app, since that's collapsed into manualAppList before the
    // orchestrator ever sees it.
    if (!current.update()) {
        gs.error('RunScanUiAction: failed to save submitted scan_mode/target_app/target_table/manual_app_list')
        gs.addErrorMessage(
            'Could not save the scan request — check write access to x_335329_iscan_run.'
        )
        current.setAbortAction(true)
        return
    }

    gs.info('RunScanUiAction: starting scan, run=' + current.getUniqueValue() + ', scan_mode=' + scanMode)
    try {
        var orchestrator = new IscanScanOrchestrator()
        orchestrator.runScanForRecord(current.getUniqueValue(), scanMode, manualAppList, targetTableId)
        gs.info('RunScanUiAction: scan finished, run=' + current.getUniqueValue())
        gs.addInfoMessage('Scan complete.')
    } catch (e) {
        gs.error('RunScanUiAction: scan failed for run=' + current.getUniqueValue() + ': ' + e.message)
        gs.addErrorMessage('Scan failed: ' + e.message + ' — see the Activities field and system log for details.')
    }

    // runScanForRecord() persists its own updates (status/activities/
    // results) via a separate GlideRecord query inside the orchestrator.
    // `current` here still holds pre-scan status/activities values in
    // memory, so abort the platform's default post-script save to avoid
    // it clobbering what the orchestrator just wrote, then redirect back
    // to show the result.
    current.setAbortAction(true)
    action.setRedirectURL(current)
})()
