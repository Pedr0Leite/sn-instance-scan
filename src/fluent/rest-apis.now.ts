import { RestApi } from '@servicenow/sdk/core'
import { runScanApiExecuteAcl } from './acls.now'

/*
 * The single programmatic trigger for a scan from the Instance Scan Console
 * UI Page. POST /api/x_nold_iscan/iscan_run_scan/run
 *
 * Not a business rule (the "Run Scan" UI Action already scans on form submit,
 * so an insert rule would scan twice) and not GlideAjax (banned in UI Pages,
 * and the documented silent-failure class this app removed). A scripted REST
 * resource returns real HTTP statuses and bodies, so a failure is visible.
 *
 * Unversioned on purpose: one internal caller, this app's own console. Adding
 * a version later means adding `versions` + `version` — see the
 * scripted-rest-api-guide topic. Role gating is entirely via enforceAcl on
 * both the API and the route; authentication/authorization stay at their
 * secure defaults (true).
 */
export const iscanRunScanApi = RestApi({
    $id: Now.ID['iscan_run_scan_api'],
    name: 'Instance Scan Run Scan API',
    serviceId: 'iscan_run_scan',
    shortDescription: 'Starts an Instance Scan run for a given scan mode, as the calling user.',
    consumes: 'application/json',
    produces: 'application/json',
    active: true,
    enforceAcl: [runScanApiExecuteAcl],
    routes: [
        {
            $id: Now.ID['iscan_run_scan_api_run_route'],
            name: 'runScan',
            method: 'POST',
            path: '/run',
            active: true,
            authentication: true,
            authorization: true,
            consumes: 'application/json',
            produces: 'application/json',
            enforceAcl: [runScanApiExecuteAcl],
            shortDescription:
                'Body: {scan_mode, app_ids?, target_table?}. Returns {sys_id, status, scan_mode}. Synchronous.',
            requestExample: '{"scan_mode":"custom_only"}',
            script: Now.include('../server/IscanRunScanApi.server.js'),
        },
    ],
})
