// Starts a scan from the console. The only trigger the console has: a UI Page
// cannot press the server-side "Run Scan" UI Action, so it POSTs to this app's
// own Scripted REST resource, which runs IscanScanOrchestrator.runScan() as the
// calling user. See src/fluent/rest-apis.now.ts for why it is REST and not a
// business rule or GlideAjax.
//
// Synchronous: a `full` scan of a large instance runs inside this request and
// can take a while. Same characteristic the platform form's UI Action already
// has -- it is not made worse by calling it from here.
const ENDPOINT = '/api/x_nold_iscan/iscan_run_scan/run'

export interface StartedScan {
    sys_id: string
    status: string
    scan_mode: string
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
