/*
 * Script Action: "Execute queued Instance Scan"
 * Event: x_nold_iscan.scan.execute (fired by IscanScanOrchestrator.queueScan)
 *
 * Runs a long-running scan (full, cmdb_health) in a worker thread instead of
 * inside the UI or REST request that asked for it. `current` is the run record
 * the event was queued against; parm1 is the scan mode and parm2 the JSON
 * parameters queueScan() serialised.
 *
 * This runs as System, not as the requester - which is why async modes are
 * admin-only at queue time (IscanScanOrchestrator.canLaunch). All scan logic
 * lives in the orchestrator; this file only unpacks the event.
 */
;(function executeQueuedScan() {
    // `event` here is the sysevent GlideRecord the platform injects into every
    // Script Action, NOT the browser's window.event - now-sdk's lint cannot tell
    // them apart (same false-positive class as the `global.` qualifier noted in
    // CLAUDE.md). Keep this comment if you touch the line below.
    // eslint-disable-next-line no-restricted-globals
    new IscanScanOrchestrator().executeQueuedRun(current.getUniqueValue(), String(event.parm1), String(event.parm2))
})()
