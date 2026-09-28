import { Record, ScriptAction } from '@servicenow/sdk/core'

/*
 * Async execution for long-running scan modes (full, cmdb_health).
 *
 * Why this exists: a Full scan on ven09425 resolved 3,549 table-only
 * tables and ran for 16.5 minutes. UI transactions are cancelled at 298s and the
 * load balancer drops HTTP connections at 5 minutes, and a killed request never
 * reaches its own catch block - so the run stayed 'running' forever. Queuing the
 * scan to a worker takes it out of the request entirely.
 *
 * The event must be registered before it can be fired. In a scoped app BOTH
 * `suffix` and `event_name` ('<scope>.<suffix>') are required - the platform does
 * not derive event_name on creation - and event_name is silently truncated past
 * 40 characters ('x_nold_iscan.scan.execute' is 25).
 * The constant IscanScanOrchestrator.QUEUE_EVENT must match event_name here.
 */
export const scanExecuteEvent = Record({
    $id: Now.ID['x_nold_iscan.scan.execute'],
    table: 'sysevent_register',
    data: {
        suffix: 'scan.execute',
        event_name: 'x_nold_iscan.scan.execute',
        description: 'Runs a queued long-running Instance Scan (full, cmdb_health) in a worker.',
        table: 'x_nold_iscan_run',
        fired_by: 'IscanScanOrchestrator.queueScan (Run Scan UI Action, IscanRunScanApi)',
        priority: 100,
    },
})

// `active` defaults to FALSE in the Fluent API - a Script Action that omits it
// is created disabled and the queued event is silently never handled.
export const executeQueuedScanAction = ScriptAction({
    $id: Now.ID['x_nold_iscan_execute_queued_scan'],
    name: 'Execute queued Instance Scan',
    eventName: 'x_nold_iscan.scan.execute',
    script: Now.include('../server/ExecuteQueuedScanScriptAction.server.js'),
    active: true,
    description:
        'Worker for long-running scan modes. Runs as System, which is why those modes are admin-only at queue time (IscanScanOrchestrator.canLaunch).',
})
