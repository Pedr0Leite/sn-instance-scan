import { Test } from '@servicenow/sdk/core'

/*
 * Component-level tests: one per script include, exercising its public
 * methods directly rather than through a scan.
 *
 * The app under test is its own fixture — x_335329_iscan is a
 * custom-scoped, internally-developed app that owns 5 tables with a known
 * reference graph, so it is guaranteed present wherever this suite runs
 * and needs no seeded demo data to stay in sync.
 */

export const iscanTestAppSelector = Test(
    {
        $id: Now.ID['iscan_test_app_selector'],
        name: 'iScan — IscanAppSelector: custom-only, manual and full resolution',
        description:
            'Custom Only applies BOTH filters (scope prefix and not store-installed), Manual validates each sys_id and drops the rest, and Full mode returns apps plus the table-only fallback list while excluding the global scope.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_app_selector_step1'],
            script: Now.include('../../server/tests/AppSelector.test.js'),
        })
    }
)

export const iscanTestTableScannerCore = Test(
    {
        $id: Now.ID['iscan_test_table_scanner_core'],
        name: 'iScan — IscanTableScanner: access gate, owned tables and profiling',
        description:
            'canAccessMetadata() is a deterministic boolean gate; row counts match an independent GlideAggregate COUNT (never getRowCount()); profileTable() is unscoped and returns the complete field list plus the outbound reference graph.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_table_scanner_core_step1'],
            script: Now.include('../../server/tests/TableScannerCore.test.js'),
        })
    }
)

export const iscanTestTableScannerCrossrefs = Test(
    {
        $id: Now.ID['iscan_test_table_scanner_crossrefs'],
        name: 'iScan — IscanTableScanner: inbound reference discovery',
        description:
            'findInboundReferences() finds every field pointing at a table, keeps same-app references, resolves the referencing app where one exists, and leaves referencing_app blank (not wrong) for base-system referencing tables.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_table_scanner_crossrefs_step1'],
            script: Now.include('../../server/tests/TableScannerCrossrefs.test.js'),
        })
    }
)

export const iscanTestTableScannerCustomizations = Test(
    {
        $id: Now.ID['iscan_test_table_scanner_customizations'],
        name: 'iScan — IscanTableScanner: base-system customization detection',
        description:
            'Both directions: findGlobalCustomizations() no-ops for an app-owned table and applies to a base-system one; findAppCustomizationsOnGlobalTables() never reports an app as customizing its own tables and only reports tables with no owning sys_app.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_table_scanner_customizations_step1'],
            script: Now.include('../../server/tests/TableScannerCustomizations.test.js'),
        })
    }
)

export const iscanTestAppFilesScanner = Test(
    {
        $id: Now.ID['iscan_test_app_files_scanner'],
        name: 'iScan — IscanAppFilesScanner: buckets, item shape and Group B gating',
        description:
            'Group A buckets carry sys_id + name for every artifact; count-only buckets stay numbers; Group B is skipped when includeExtended is false, included when it is true, and defaults to true when the argument is omitted.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_app_files_scanner_step1'],
            script: Now.include('../../server/tests/AppFilesScanner.test.js'),
        })
    }
)

export const iscanTestSummaryGeneratorContext = Test(
    {
        $id: Now.ID['iscan_test_summary_generator_context'],
        name: 'iScan — IscanSummaryGenerator: the 5-section LLM briefing',
        description:
            'buildPrompt() emits all five sections in order, names automation rather than only counting it, renders the reference graph, labels missing facts instead of leaving them blank, and closes with the fixed instruction footer.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_summary_generator_context_step1'],
            script: Now.include('../../server/tests/SummaryGeneratorContext.test.js'),
        })
    }
)

export const iscanTestSummaryGeneratorFallback = Test(
    {
        $id: Now.ID['iscan_test_summary_generator_fallback'],
        name: 'iScan — IscanSummaryGenerator: fallback briefing and GenAI degradation',
        description:
            'On the fallback path the data model section is omitted with an explanation and never zero-filled; generate() returns null (never throws) when GenAI is disabled or absent; the GenAI input cap truncates with a marker while llm_context stays full length.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_summary_generator_fallback_step1'],
            script: Now.include('../../server/tests/SummaryGeneratorFallback.test.js'),
        })
    }
)
