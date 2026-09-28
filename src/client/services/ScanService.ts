// Starts a scan from the console. The only trigger the console has: a UI Page
// cannot press the server-side "Run Scan" UI Action, so it POSTs to this app's
// own Scripted REST resource, which runs IscanScanOrchestrator.runScan() as the
// calling user. See src/fluent/rest-apis.now.ts for why it is REST and not a
// business rule or GlideAjax.
//
// Two response shapes, decided server-side by scan mode:
//   - long-running modes (full, cmdb_health): HTTP 202, the run comes back
//     'pending' with queued=true and a worker does the scan. These are admin-only
//     (the worker runs as System) and a non-admin gets a 403 with the reason.
//   - every other mode: HTTP 201, synchronous, the run comes back finished.
// See IscanScanOrchestrator.queueScan() for why the split exists.
const ENDPOINT = '/api/x_nold_iscan/iscan_run_scan/run'

export interface StartedScan {
    sys_id: string
    status: string
    scan_mode: string
    // true when the scan was queued to a worker rather than run in the request
    queued?: boolean
}

export async function startScan(
    scanMode: string,
    appIds?: string[],
    targetTable?: string
): Promise<StartedScan> {
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-UserToken': (window as any).g_ck,
        },
        body: JSON.stringify({ scan_mode: scanMode, app_ids: appIds, target_table: targetTable }),
    })
    // A scripted REST resource sets the body directly, but platform-level
    // failures (401, ACL denial) come back in the standard {error:{message}}
    // envelope -- and some instances wrap successful bodies in {result}. Read
    // all three shapes rather than assuming one.
    const payload = await response.json().catch(() => null)
    const data = payload?.result || payload
    if (!response.ok) {
        throw new Error(
            data?.error?.message || data?.error || `Scan request failed (HTTP ${response.status})`
        )
    }
    return data as StartedScan
}
