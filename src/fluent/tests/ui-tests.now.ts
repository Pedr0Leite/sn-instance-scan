import { Test } from '@servicenow/sdk/core'
import { scannerRole } from '../roles.now'

/*
 * Client-runner tests: the form, the UI policies and the UI Action
 * buttons, all driven as a real non-admin scanner user.
 *
 * These need the ATF client test runner (a browser session) — they cannot
 * run headless. See tests/README.md.
 *
 * What is deliberately NOT covered here: the "Copy LLM Context" button's
 * actual clipboard write. It calls navigator.clipboard, which needs a
 * secure origin and a user-gesture permission the test runner cannot
 * grant; the button's presence and the field it copies are asserted
 * instead, and the clipboard round-trip stays a manual check.
 */

export const iscanTestUiRunFormPolicies = Test(
    {
        $id: Now.ID['iscan_test_ui_run_form_policies'],
        name: 'iScan — UI: run form field visibility per scan mode',
        description:
            'The two UI policies toggle Target App and Target Table symmetrically as the scan mode changes, and neither Run Scan nor Download Report appears on an unsaved record (both are showUpdate-only).',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.createUser({
            $id: Now.ID['iscan_test_ui_run_form_policies_step1'],
            firstName: 'iScan',
            lastName: 'FormUser ATF',
            roles: [scannerRole],
            impersonate: true,
        })
        atf.form.openNewForm({
            $id: Now.ID['iscan_test_ui_run_form_policies_step2'],
            table: 'x_335329_iscan_run',
            formUI: 'standard_ui',
            view: '',
        })

        // Full mode: neither picker is relevant.
        atf.form.setFieldValue({
            $id: Now.ID['iscan_test_ui_run_form_policies_step3'],
            table: 'x_335329_iscan_run',
            fieldValues: { scan_mode: 'full' },
        })
        atf.form.fieldStateValidation({
            $id: Now.ID['iscan_test_ui_run_form_policies_step4'],
            table: 'x_335329_iscan_run',
            notVisible: ['target_app', 'target_table'],
        })

        // Manual — App: the app picker appears, the table picker does not.
        atf.form.setFieldValue({
            $id: Now.ID['iscan_test_ui_run_form_policies_step5'],
            table: 'x_335329_iscan_run',
            fieldValues: { scan_mode: 'manual' },
        })
        atf.form.fieldStateValidation({
            $id: Now.ID['iscan_test_ui_run_form_policies_step6'],
            table: 'x_335329_iscan_run',
            visible: ['target_app'],
            notVisible: ['target_table'],
        })

        // Manual — Single Table: the reverse.
        atf.form.setFieldValue({
            $id: Now.ID['iscan_test_ui_run_form_policies_step7'],
            table: 'x_335329_iscan_run',
            fieldValues: { scan_mode: 'single_table' },
        })
        atf.form.fieldStateValidation({
            $id: Now.ID['iscan_test_ui_run_form_policies_step8'],
            table: 'x_335329_iscan_run',
            visible: ['target_table'],
            notVisible: ['target_app'],
        })

        atf.form.uiActionVisibility({
            $id: Now.ID['iscan_test_ui_run_form_policies_step9'],
            table: 'x_335329_iscan_run',
            notVisible: [Now.ref('sys_ui_action', 'run_scan_ui_action'), Now.ref('sys_ui_action', 'download_run_report_ui_action')],
        })
    }
)

export const iscanTestUiRunScanHappyPath = Test(
    {
        $id: Now.ID['iscan_test_ui_run_scan_happy_path'],
        name: 'iScan — UI: Run Scan and Download Report from the run form',
        description:
            'Drives the whole user-facing flow as a scanner-role user: fill the form, save, click Run Scan (a server-side UI Action, no GlideAjax), confirm the run completed with a result record, then click Download Report and confirm a PDF is attached to the run.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        // Resolved before impersonation, as the test user, so the lookup
        // does not depend on the scanner's own sys_app access.
        const fixtureApp = atf.server.recordQuery({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step1'],
            table: 'sys_app',
            fieldValues: 'scope=x_335329_iscan',
            assert: 'records_match_query',
        })

        atf.server.createUser({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step2'],
            firstName: 'iScan',
            lastName: 'RunUser ATF',
            roles: [scannerRole],
            impersonate: true,
        })

        atf.form.openNewForm({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step3'],
            table: 'x_335329_iscan_run',
            formUI: 'standard_ui',
            view: '',
        })
        atf.form.setFieldValue({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step4'],
            table: 'x_335329_iscan_run',
            fieldValues: {
                scan_mode: 'manual',
                target_app: fixtureApp.first_record,
            },
        })
        const submitted = atf.form.submitForm({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step5'],
            assert: 'form_submitted_to_server',
        })

        atf.form.openExistingRecord({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step6'],
            table: 'x_335329_iscan_run',
            recordId: submitted.record_id,
        })
        // Both buttons only render on a saved record, and only for the
        // scanner role — this is the positive half of that check.
        atf.form.uiActionVisibility({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step7'],
            table: 'x_335329_iscan_run',
            visible: [Now.ref('sys_ui_action', 'run_scan_ui_action'), Now.ref('sys_ui_action', 'download_run_report_ui_action')],
        })

        atf.form.clickUIAction({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step8'],
            table: 'x_335329_iscan_run',
            uiAction: Now.ref('sys_ui_action', 'run_scan_ui_action'),
            assert: 'page_reloaded_or_redirected',
        })

        // target_app takes precedence over manual_app_list, so exactly one
        // app must have been scanned.
        atf.server.recordValidation({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step9'],
            table: 'x_335329_iscan_run',
            recordId: submitted.record_id,
            fieldValues: 'status=complete^app_count=1',
            assert: 'record_validated',
        })
        atf.server.recordQuery({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step10'],
            table: 'x_335329_iscan_result',
            fieldValues: `run=${submitted.record_id}^app=${fixtureApp.first_record}`,
            assert: 'records_match_query',
        })

        // Download Report is a server-side UI Action too: it attaches the
        // PDF to this same run record in the same request.
        atf.form.openExistingRecord({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step11'],
            table: 'x_335329_iscan_run',
            recordId: submitted.record_id,
        })
        atf.form.clickUIAction({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step12'],
            table: 'x_335329_iscan_run',
            uiAction: Now.ref('sys_ui_action', 'download_run_report_ui_action'),
            assert: 'page_reloaded_or_redirected',
        })
        atf.server.recordQuery({
            $id: Now.ID['iscan_test_ui_run_scan_happy_path_step13'],
            table: 'sys_attachment',
            fieldValues: `table_name=x_335329_iscan_run^table_sys_id=${submitted.record_id}^content_typeLIKEpdf`,
            assert: 'records_match_query',
        })
    }
)

export const iscanTestUiMandatoryGuards = Test(
    {
        $id: Now.ID['iscan_test_ui_mandatory_guards'],
        name: 'iScan — UI: Run Scan refuses an incomplete form',
        description:
            'The UI policies only hide fields; the real guards are server-side in RunScanUiAction. Manual mode with no app and Single Table mode with no table must both abort with an error message and leave the run at status pending.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.createUser({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step1'],
            firstName: 'iScan',
            lastName: 'GuardUser ATF',
            roles: [scannerRole],
            impersonate: true,
        })

        // Manual — App with neither target_app nor manual_app_list.
        atf.form.openNewForm({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step2'],
            table: 'x_335329_iscan_run',
            formUI: 'standard_ui',
            view: '',
        })
        atf.form.setFieldValue({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step3'],
            table: 'x_335329_iscan_run',
            fieldValues: { scan_mode: 'manual' },
        })
        const manualRun = atf.form.submitForm({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step4'],
            assert: 'form_submitted_to_server',
        })
        atf.form.openExistingRecord({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step5'],
            table: 'x_335329_iscan_run',
            recordId: manualRun.record_id,
        })
        atf.form.clickUIAction({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step6'],
            table: 'x_335329_iscan_run',
            uiAction: Now.ref('sys_ui_action', 'run_scan_ui_action'),
            assert: '',
        })
        atf.server.recordValidation({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step7'],
            table: 'x_335329_iscan_run',
            recordId: manualRun.record_id,
            fieldValues: 'status=pending^app_count=0',
            assert: 'record_validated',
        })
        atf.server.recordQuery({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step8'],
            table: 'x_335329_iscan_result',
            fieldValues: `run=${manualRun.record_id}`,
            assert: 'no_records_match_query',
        })

        // Manual — Single Table with no target_table.
        atf.form.openNewForm({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step9'],
            table: 'x_335329_iscan_run',
            formUI: 'standard_ui',
            view: '',
        })
        atf.form.setFieldValue({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step10'],
            table: 'x_335329_iscan_run',
            fieldValues: { scan_mode: 'single_table' },
        })
        const tableRun = atf.form.submitForm({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step11'],
            assert: 'form_submitted_to_server',
        })
        atf.form.openExistingRecord({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step12'],
            table: 'x_335329_iscan_run',
            recordId: tableRun.record_id,
        })
        atf.form.clickUIAction({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step13'],
            table: 'x_335329_iscan_run',
            uiAction: Now.ref('sys_ui_action', 'run_scan_ui_action'),
            assert: '',
        })
        atf.server.recordValidation({
            $id: Now.ID['iscan_test_ui_mandatory_guards_step14'],
            table: 'x_335329_iscan_run',
            recordId: tableRun.record_id,
            fieldValues: 'status=pending',
            assert: 'record_validated',
        })
    }
)

export const iscanTestUiResultForm = Test(
    {
        $id: Now.ID['iscan_test_ui_result_form'],
        name: 'iScan — UI: result form shows its report and copy actions',
        description:
            'Seeds a real scan, then opens the result form as a scanner-role user: llm_context must be populated on the form and both result-table buttons must be visible. The clipboard write itself is a manual check (navigator.clipboard needs a permission the runner cannot grant).',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        const seeded = atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_ui_result_form_step1'],
            script: Now.include('../../server/tests/SeedScanForUi.test.js'),
        })

        atf.server.createUser({
            $id: Now.ID['iscan_test_ui_result_form_step2'],
            firstName: 'iScan',
            lastName: 'ResultUser ATF',
            roles: [scannerRole],
            impersonate: true,
        })

        atf.form.openExistingRecord({
            $id: Now.ID['iscan_test_ui_result_form_step3'],
            table: 'x_335329_iscan_result',
            recordId: seeded.record_id,
        })
        // The Copy LLM Context button reads this field straight off the
        // form — no GlideAjax — so an empty field is the one thing that
        // makes it useless.
        atf.form.fieldValueValidation({
            $id: Now.ID['iscan_test_ui_result_form_step4'],
            table: 'x_335329_iscan_result',
            conditions: 'llm_contextISNOTEMPTY',
        })
        atf.form.uiActionVisibility({
            $id: Now.ID['iscan_test_ui_result_form_step5'],
            table: 'x_335329_iscan_result',
            visible: [Now.ref('sys_ui_action', 'download_result_report_ui_action'), Now.ref('sys_ui_action', 'copy_llm_context_ui_action')],
        })
    }
)
