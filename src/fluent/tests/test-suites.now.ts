import { Record } from '@servicenow/sdk/core'
import {
    iscanTestEnvironmentReadiness,
    iscanTestMetadataIntegrity,
    iscanTestTableSchemaIntegrity,
} from './config-tests.now'
import {
    iscanTestAppFilesScanner,
    iscanTestAppSelector,
    iscanTestSummaryGeneratorContext,
    iscanTestSummaryGeneratorFallback,
    iscanTestTableScannerCore,
    iscanTestTableScannerCrossrefs,
    iscanTestTableScannerCustomizations,
} from './unit-tests.now'
import {
    iscanTestOrchestratorCustomOnly,
    iscanTestOrchestratorErrorHandling,
    iscanTestOrchestratorFindingsLog,
    iscanTestOrchestratorManualApp,
    iscanTestOrchestratorReadOnly,
    iscanTestOrchestratorSingleTableOob,
    iscanTestOrchestratorSingleTableOwned,
} from './scan-tests.now'
import { iscanTestReportContent, iscanTestReportPdf } from './report-tests.now'
import { iscanTestSecurityNoRole, iscanTestSecurityScannerRole } from './security-tests.now'
import {
    iscanTestUiMandatoryGuards,
    iscanTestUiResultForm,
    iscanTestUiRunFormPolicies,
    iscanTestUiRunScanHappyPath,
} from './ui-tests.now'
import { iscanTestOrchestratorFullMode } from './long-running-tests.now'

/*
 * Test suites — the thing to actually run after an upgrade or a change.
 *
 * There is no Fluent TestSuite API in this SDK version, so the suite and
 * its membership rows are defined with the generic Record API against
 * sys_atf_test_suite / sys_atf_test_suite_test, the same escape hatch
 * related-lists.now.ts uses.
 *
 * Ordering inside the regression suite is deliberate, cheapest and most
 * diagnostic first:
 *   100s  configuration — does the app's own metadata still exist?
 *   200s  component behaviour — does each script include still work?
 *   300s  end-to-end scans — does a whole run still produce the right records?
 *   400s  reports
 *   500s  security (ACLs, impersonated users)
 *   600s  UI (needs the client test runner / a browser session)
 * A metadata failure at 100 explains most of what would otherwise fail
 * further down, so reading the results top-down goes cause-first.
 */

export const iscanRegressionSuite = Record({
    $id: Now.ID['iscan_regression_test_suite'],
    table: 'sys_atf_test_suite',
    data: {
        name: 'SN Instance Scan — Regression',
        description:
            'Run after every upgrade or change to this app. Covers configuration integrity, all four scan modes, every script include, the PDF reports, the ACL set, and the run/result forms. Excludes the whole-instance Full scan, which lives in its own suite because of how long it takes.',
        active: true,
    },
})

export const iscanFullScanSuite = Record({
    $id: Now.ID['iscan_full_scan_test_suite'],
    table: 'sys_atf_test_suite',
    data: {
        name: 'SN Instance Scan — Full Scan (long running)',
        description:
            'The whole-instance Full scan mode, on its own because it walks every scope on the instance and can take minutes. Run it deliberately (before a release, or when Full mode itself changed), not on every commit.',
        active: true,
    },
})

/*
 * Membership rows. Each carries a literal Now.ID key so re-installing the
 * app updates the same row instead of duplicating the suite — the keys
 * are extracted statically at build time, so they cannot be generated in
 * a loop.
 */

// --- 100s: configuration — cheapest checks first, and the ones whose
// failure explains most of what would otherwise fail below.
export const iscanSuiteEntryEnvironment = Record({
    $id: Now.ID['iscan_suite_entry_environment'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestEnvironmentReadiness,
        order: 100,
    },
})

export const iscanSuiteEntrySchema = Record({
    $id: Now.ID['iscan_suite_entry_schema'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestTableSchemaIntegrity,
        order: 110,
    },
})

export const iscanSuiteEntryMetadata = Record({
    $id: Now.ID['iscan_suite_entry_metadata'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestMetadataIntegrity,
        order: 120,
    },
})

// --- 200s: component behaviour, one test per script include.
export const iscanSuiteEntryAppSelector = Record({
    $id: Now.ID['iscan_suite_entry_app_selector'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestAppSelector,
        order: 200,
    },
})

export const iscanSuiteEntryTableScannerCore = Record({
    $id: Now.ID['iscan_suite_entry_table_scanner_core'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestTableScannerCore,
        order: 210,
    },
})

export const iscanSuiteEntryTableScannerCrossrefs = Record({
    $id: Now.ID['iscan_suite_entry_table_scanner_crossrefs'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestTableScannerCrossrefs,
        order: 220,
    },
})

export const iscanSuiteEntryTableScannerCustomizations = Record({
    $id: Now.ID['iscan_suite_entry_table_scanner_customizations'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestTableScannerCustomizations,
        order: 230,
    },
})

export const iscanSuiteEntryAppFilesScanner = Record({
    $id: Now.ID['iscan_suite_entry_app_files_scanner'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestAppFilesScanner,
        order: 240,
    },
})

export const iscanSuiteEntrySummaryContext = Record({
    $id: Now.ID['iscan_suite_entry_summary_context'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestSummaryGeneratorContext,
        order: 250,
    },
})

export const iscanSuiteEntrySummaryFallback = Record({
    $id: Now.ID['iscan_suite_entry_summary_fallback'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestSummaryGeneratorFallback,
        order: 260,
    },
})

// --- 300s: end-to-end scans, one per scan mode plus the cross-cutting
// guarantees (findings log, read-only, error handling).
export const iscanSuiteEntryManualApp = Record({
    $id: Now.ID['iscan_suite_entry_manual_app'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorManualApp,
        order: 300,
    },
})

export const iscanSuiteEntryCustomOnly = Record({
    $id: Now.ID['iscan_suite_entry_custom_only'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorCustomOnly,
        order: 310,
    },
})

export const iscanSuiteEntrySingleTableOwned = Record({
    $id: Now.ID['iscan_suite_entry_single_table_owned'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorSingleTableOwned,
        order: 320,
    },
})

export const iscanSuiteEntrySingleTableOob = Record({
    $id: Now.ID['iscan_suite_entry_single_table_oob'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorSingleTableOob,
        order: 330,
    },
})

export const iscanSuiteEntryFindingsLog = Record({
    $id: Now.ID['iscan_suite_entry_findings_log'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorFindingsLog,
        order: 340,
    },
})

export const iscanSuiteEntryReadOnly = Record({
    $id: Now.ID['iscan_suite_entry_read_only'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorReadOnly,
        order: 350,
    },
})

export const iscanSuiteEntryErrorHandling = Record({
    $id: Now.ID['iscan_suite_entry_error_handling'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestOrchestratorErrorHandling,
        order: 360,
    },
})

// --- 400s: reports. Content before PDF, so a platform-plugin failure is
// distinguishable from a report-logic failure.
export const iscanSuiteEntryReportContent = Record({
    $id: Now.ID['iscan_suite_entry_report_content'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestReportContent,
        order: 400,
    },
})

export const iscanSuiteEntryReportPdf = Record({
    $id: Now.ID['iscan_suite_entry_report_pdf'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestReportPdf,
        order: 410,
    },
})

// --- 500s: security, run as real impersonated users.
export const iscanSuiteEntrySecurityScanner = Record({
    $id: Now.ID['iscan_suite_entry_security_scanner'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestSecurityScannerRole,
        order: 500,
    },
})

export const iscanSuiteEntrySecurityNoRole = Record({
    $id: Now.ID['iscan_suite_entry_security_no_role'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestSecurityNoRole,
        order: 510,
    },
})

// --- 600s: UI. These need the ATF client test runner (a browser
// session); the rest of the suite runs server-side only.
export const iscanSuiteEntryUiRunForm = Record({
    $id: Now.ID['iscan_suite_entry_ui_run_form'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestUiRunFormPolicies,
        order: 600,
    },
})

export const iscanSuiteEntryUiRunScan = Record({
    $id: Now.ID['iscan_suite_entry_ui_run_scan'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestUiRunScanHappyPath,
        order: 610,
    },
})

export const iscanSuiteEntryUiGuards = Record({
    $id: Now.ID['iscan_suite_entry_ui_guards'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestUiMandatoryGuards,
        order: 620,
    },
})

export const iscanSuiteEntryUiResultForm = Record({
    $id: Now.ID['iscan_suite_entry_ui_result_form'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanRegressionSuite,
        test: iscanTestUiResultForm,
        order: 630,
    },
})

// --- The long-running suite's single member.
export const iscanSuiteEntryFullMode = Record({
    $id: Now.ID['iscan_suite_entry_full_mode'],
    table: 'sys_atf_test_suite_test',
    data: {
        test_suite: iscanFullScanSuite,
        test: iscanTestOrchestratorFullMode,
        order: 100,
    },
})

