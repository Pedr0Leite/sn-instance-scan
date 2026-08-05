import { Test } from '@servicenow/sdk/core'

/*
 * Long-running tests, kept out of the regression suite on purpose.
 *
 * Full mode walks every sys_scope on the instance — every app through the
 * per-app pipeline, every table of every scope without a sys_app record
 * through the table-only profile. On a populated instance that is minutes
 * of work and a large findings log, so it belongs to its own suite
 * ("SN Instance Scan — Full Scan") that a release manager runs
 * deliberately, not to the suite that runs after every change.
 *
 * The test itself is active: it is meant to be runnable on demand.
 */

export const iscanTestOrchestratorFullMode = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_full_mode'],
        name: 'iScan — Full (whole instance) scan',
        description:
            'LONG RUNNING. Full mode resolves every scope: apps with a sys_app record get a result record each, scopes without one get the table-only profile in the findings log, and Group B counts stay skipped while include_extended_counts_on_full_scan is false.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_full_mode_step1'],
            script: Now.include('../../server/tests/OrchestratorFullMode.test.js'),
        })
    }
)
