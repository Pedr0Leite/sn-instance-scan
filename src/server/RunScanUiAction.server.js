/*
 * UI Action script: "Run Scan" (x_nold_iscan_run)
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
    // target_app is now a List field (multi-select slushbucket), so
    // getValue() returns a comma-separated sys_id string the same way
    // manual_app_list already does — split it the same way.
    var manualAppList = targetAppId ? targetAppId.split(',') : (manualAppListRaw ? manualAppListRaw.split(',') : [])

    var orchestrator = new IscanScanOrchestrator()

    // Long-running modes (full, cmdb_health) are queued to a worker rather than
    // run inside this request - see IscanScanOrchestrator.queueScan() for why.
    // `current` is NOT written here beyond setting fields in memory: the
    // platform's single natural save below persists status='pending' together
    // with the form's own values, and the queued event only becomes visible to
    // the worker once that save commits. The worker moves it to 'running' when
    // it picks the run up, then 'complete' or 'error'.
    if (!orchestrator.canLaunch(scanMode)) {
        gs.info('RunScanUiAction: aborted, scan_mode=' + scanMode + ' requires admin, user=' + gs.getUserName())
        gs.addErrorMessage(
            'Only an administrator can run this scan mode. It runs in the background with full read access, so it is ' +
                'restricted to users who already have that access.'
        )
        current.setAbortAction(true)
        return
    }

    if (orchestrator.isAsyncMode(scanMode)) {
        // A second click while a worker has the run would start a second
        // worker writing into the same record. 'pending' alone does NOT mean
        // queued: it is the column DEFAULT, so every brand-new run starts as
        // pending - only a run with `started` set was actually queued. A run
        // still pending 10 minutes after queuing was never picked up (the
        // worker moves it to running within seconds), so it may be re-queued.
        // Same for a 'running' run older than 2 hours.
        // No setAbortAction here: aborting a form update is what shows the
        // platform's "Invalid update" banner; the natural save of an
        // unchanged record is harmless.
        var liveStatus = current.getValue('status')
        var startedAt = current.getValue('started')
        var queuedAgoMs = startedAt ? new GlideDateTime().getNumericValue() - new GlideDateTime(startedAt).getNumericValue() : -1
        var workerOwnsRun =
            startedAt &&
            ((liveStatus === 'pending' && queuedAgoMs < 10 * 60 * 1000) ||
                // 2h is far past the longest scan seen (16.5 min); older
                // 'running' runs were killed before the async fix and never
                // finished.
                (liveStatus === 'running' && queuedAgoMs < 2 * 60 * 60 * 1000))
        if (workerOwnsRun) {
            gs.addErrorMessage('This run is already ' + liveStatus + ' in the background. Wait for it to finish, or create a new run.')
            action.setRedirectURL(current)
            return
        }
        current.setValue('status', 'pending')
        current.setValue('started', new GlideDateTime())
        orchestrator.queueScan(current, scanMode, manualAppList, targetTableId)
        gs.info('RunScanUiAction: queued run=' + current.getUniqueValue() + ', scan_mode=' + scanMode)
        gs.addInfoMessage(
            'Scan queued. It runs in the background and can take several minutes on a large instance - ' +
                'the Status field moves from Pending to Running to Complete. Refresh to see progress.'
        )
        action.setRedirectURL(current)
        return
    }

    gs.info('RunScanUiAction: starting scan, run=' + current.getUniqueValue() + ', scan_mode=' + scanMode)
    try {
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
    var refreshed = new GlideRecord('x_nold_iscan_run')
    if (refreshed.get(current.getUniqueValue())) {
        current.setValue('status', refreshed.getValue('status'))
        current.setValue('scan_findings', refreshed.getValue('scan_findings'))
        current.setValue('app_count', refreshed.getValue('app_count'))
        current.setValue('started', refreshed.getValue('started'))
        current.setValue('completed', refreshed.getValue('completed'))
    }

    action.setRedirectURL(current)
})()
