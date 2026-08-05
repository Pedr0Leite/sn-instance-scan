import { Test } from '@servicenow/sdk/core'

/*
 * Configuration / post-upgrade sanity tests.
 *
 * These run first in the regression suite: they assert that the app's own
 * metadata (tables, columns, choices, script includes, ACLs, UI actions,
 * UI policies) and its platform dependencies survived the upgrade. Every
 * failure mode they cover is one that fails SILENTLY at runtime — a
 * dropped column makes setValue() a no-op, a flipped clientCallable flag
 * makes GlideAjax return an empty answer with no server-side log line —
 * so behaviour tests alone would report them as confusing downstream
 * failures instead of naming the cause.
 *
 * Every step script lives in src/server/tests/ and is inlined at build
 * time with Now.include(), the same way this app's script includes and
 * client scripts are — see CLAUDE.md.
 */

export const iscanTestEnvironmentReadiness = Test(
    {
        $id: Now.ID['iscan_test_environment_readiness'],
        name: 'iScan — Environment readiness',
        description:
            'Verifies the app scope, its 5 tables, the scanner role, its 5 system properties, and the PDF Generation Utilities plugin the Download Report actions depend on. Reports GenAI Controller availability without asserting it (only summary_text needs it).',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_environment_readiness_step1'],
            script: Now.include('../../server/tests/EnvironmentReadiness.test.js'),
        })
    }
)

export const iscanTestTableSchemaIntegrity = Test(
    {
        $id: Now.ID['iscan_test_table_schema_integrity'],
        name: 'iScan — Table and column integrity',
        description:
            'Asserts every column the scan scripts write to still exists with the expected type, that comments is still a journal field and scan_findings is not, and that the scan_mode/status/scan_mode_used/well_known_base choice lists are intact.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_table_schema_integrity_step1'],
            script: Now.include('../../server/tests/TableSchemaIntegrity.test.js'),
        })
    }
)

export const iscanTestMetadataIntegrity = Test(
    {
        $id: Now.ID['iscan_test_metadata_integrity'],
        name: 'iScan — Script include, ACL, UI action and UI policy integrity',
        description:
            'Guards the silent-failure configuration flags: per-script-include clientCallable values, package_private access on IscanReportGenerator, the scope-qualified execute ACL, the absence of a write ACL on results, and isUi16Compatible on the UI actions (a regression that has already shipped once).',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_metadata_integrity_step1'],
            script: Now.include('../../server/tests/MetadataIntegrity.test.js'),
        })
    }
)
