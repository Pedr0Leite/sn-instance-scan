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

    // runScanForRecord() persists status/scan_findings/app_count/completed
    // via its own separately-fetched GlideRecord — `current` here still
    // only holds the pre-scan snapshot for those fields. Mirror the
    // now-current DB state onto `current` in memory, then let the
    // platform's OWN single natural save proceed (no setAbortAction, no
    // manual current.update()). This used to call current.update() mid-
    // script (to persist target_app/target_table before they'd otherwise
    // be lost) and THEN setAbortAction(true) — two saves against the same
    // record inside one request, which is exactly what produced the
    // "Invalid update" banner (a sys_mod_count/optimistic-concurrency
    // mismatch the platform trips on itself). Letting exactly one save
    // happen — the platform's default one, with the right data already
    // merged onto `current` — avoids that collision entirely. Journal
    // fields (`comments`) don't need mirroring here: the Activity stream
    // reads from sys_journal_field child records, not from a value held
    // on this in-memory GlideRecord.
    var refreshed = new GlideRecord('x_335329_iscan_run')
    if (refreshed.get(current.getUniqueValue())) {
        current.setValue('status', refreshed.getValue('status'))
        current.setValue('scan_findings', refreshed.getValue('scan_findings'))
        current.setValue('app_count', refreshed.getValue('app_count'))
        current.setValue('started', refreshed.getValue('started'))
        current.setValue('completed', refreshed.getValue('completed'))
    }

    action.setRedirectURL(current)
})()
