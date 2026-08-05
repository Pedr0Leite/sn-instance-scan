import { Test } from '@servicenow/sdk/core'

/*
 * End-to-end scan tests: one per scan mode, plus the cross-cutting
 * guarantees (findings log, read-only, error handling).
 *
 * Everything these tests write goes through the ATF test's rollback
 * context, so no scan history survives the run.
 *
 * Full mode is deliberately NOT in this file — it walks every scope on
 * the instance and belongs to the long-running suite (long-running-tests.now.ts).
 */

export const iscanTestOrchestratorManualApp = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_manual_app'],
        name: 'iScan — Manual (App) scan, end to end',
        description:
            'The reference happy path: run -> result -> table profiles -> crossref rows, with counts, table_list, llm_context and the findings log all asserted, and no result written for any app other than the requested one.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_manual_app_step1'],
            script: Now.include('../../server/tests/OrchestratorManualApp.test.js'),
        })
    }
)

export const iscanTestOrchestratorCustomOnly = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_custom_only'],
        name: 'iScan — Custom Only scan',
        description:
            'Scans exactly the apps getCustomApps() resolves: one result per app, no store-installed app and no non-prefixed scope, with Group B counts included (the full-scan gate does not apply to this mode).',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_custom_only_step1'],
            script: Now.include('../../server/tests/OrchestratorCustomOnly.test.js'),
        })
    }
)

export const iscanTestOrchestratorSingleTableOwned = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_single_table_owned'],
        name: 'iScan — Manual (Single Table): table owned by a custom app',
        description:
            'A picked table whose scope has a sys_app record runs the full per-app tally: one result for the owning app, all of its tables profiled, and the picked table present with its complete field list and reference graph.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_single_table_owned_step1'],
            script: Now.include('../../server/tests/OrchestratorSingleTableOwned.test.js'),
        })
    }
)

export const iscanTestOrchestratorSingleTableOob = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_single_table_oob'],
        name: 'iScan — Manual (Single Table): base-system table with no owning app',
        description:
            'A base-system table has no sys_app to satisfy the mandatory result.app reference, so the run completes with ZERO result records by design and the table profile goes into the findings log. Zero results here is the contract, not a bug.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_single_table_oob_step1'],
            script: Now.include('../../server/tests/OrchestratorSingleTableOob.test.js'),
        })
    }
)

export const iscanTestOrchestratorFindingsLog = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_findings_log'],
        name: 'iScan — Findings log and Activity-stream comments',
        description:
            'scan_findings holds one timestamped line per milestone and the comments journal holds one ACCUMULATED entry per line — the check that proves _appendScanFinding() still re-fetches a fresh GlideRecord for the journal write.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_findings_log_step1'],
            script: Now.include('../../server/tests/OrchestratorFindingsLog.test.js'),
        })
    }
)

export const iscanTestOrchestratorReadOnly = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_read_only'],
        name: 'iScan — Read-only guarantee: no writes outside this app',
        description:
            'The spec\'s hardest constraint. Row counts across 15 metadata and data tables are compared before and after both a per-app scan and a base-system table scan, with a sys_audit cross-check over the same tables.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_read_only_step1'],
            script: Now.include('../../server/tests/OrchestratorReadOnly.test.js'),
        })
    }
)

export const iscanTestOrchestratorErrorHandling = Test(
    {
        $id: Now.ID['iscan_test_orchestrator_error_handling'],
        name: 'iScan — Error and edge-case handling',
        description:
            'Bad input throws with a message naming the problem (unknown mode, missing/unknown target table, unknown run record); finding nothing is NOT an error (empty app list completes with zero results, a missing app inside a list is skipped and logged).',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_orchestrator_error_handling_step1'],
            script: Now.include('../../server/tests/OrchestratorErrorHandling.test.js'),
        })
    }
)
