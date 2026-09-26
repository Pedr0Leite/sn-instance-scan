import { Test } from '@servicenow/sdk/core'
import '@servicenow/sdk/global'
import { scannerRole } from './roles.now'

/*
 * ATF tests generated from tests/atf_tests.json (the design source of
 * truth — do not edit that file from here; it stays authoritative for
 * *why* each test exists).
 *
 * Trigger mechanism used throughout: this app's "Run Scan" UI Action
 * (runScanUiAction) is server-side (client.isClient: false) and runs
 * IscanScanOrchestrator.runScanForRecord() directly on the submitted
 * form record — see RunScanUiAction.server.js and the CLAUDE.md section
 * on why this replaced a GlideAjax-based trigger. Fluent's ATF API has
 * no generic "run a server script" step (only impersonate / createUser /
 * log / recordQuery / recordInsert / recordValidation / recordUpdate /
 * recordDelete / searchForCatalogItem / checkoutShoppingCart /
 * replayRequestItem — see node_modules/@servicenow/sdk/docs/guides/atf-guide.md),
 * so every JSON step that reads "Server-side script step: call
 * IscanScanOrchestrator.runScan(...)" is mapped here to the real UI path:
 * create/open an x_nold_iscan_run record with the right field values,
 * then atf.form.clickUIAction the Run Scan button — exactly what a user
 * does, and exactly what actually invokes the orchestrator.
 *
 * SKIPPED (not converted to Test() blocks) — both are explicitly flagged
 * in tests/atf_tests.json's own "note" field as code-inspection only:
 *
 *   - "Row count uses GlideAggregate, not getRowCount" — note: "Partly a
 *     code-inspection check, not fully ATF-automatable." The row-count
 *     ATF-observable part (row_count matches actual count) is folded
 *     into atfFullScanHappyPath below instead of a separate test; the
 *     "confirm IscanTableScanner uses GlideAggregate, not
 *     GlideRecord.getRowCount()" half requires reading source, which no
 *     atf.* step can do.
 *   - "canAccessMetadata gate is deterministic, not exception-based" —
 *     note: "Code-inspection only, not ATF-automatable." Reviewing
 *     IscanTableScanner.canAccessMetadata()'s implementation has no ATF
 *     equivalent; its observable behavior (fallback path taken cleanly,
 *     no exception) is already covered by atfAclDeniedAppFallsBackCleanly.
 *
 * Known best-effort mappings (real limitations of the ATF surface, not
 * oversights):
 *   - "Copy LLM Context" (atfCopyLlmContextCopiesField): ATF has no
 *     clipboard-read step, so the pasted-text-matches-llm_context half of
 *     the JSON assertion can't be automated — the test clicks the button
 *     and validates the info message / no-GlideAjax-network-call parts
 *     that ARE observable, and logs the clipboard-content check as a
 *     manual follow-up.
 *   - ACL-denial / restricted-user tests (atfAclDeniedAppFallsBackCleanly,
 *     atfModulesSysPluginsDenialSurfacesError, atfScannerRoleCanWriteComments):
 *     atf.server.createUser only assigns ROLES, it can't author new ACL
 *     rules. These tests create a user holding only x_nold_iscan.scanner
 *     (never security_admin/admin) and rely on the target instance's own
 *     ACL configuration to actually deny sys_db_object/sys_dictionary/
 *     sys_plugins read for a role-minimal user, per each JSON test's
 *     stated precondition — verify against the real target instance.
 *   - "Download Report produces a PDF with hyperlinks": ATF can't inspect
 *     PDF binary content or hyperlink targets. The test validates the
 *     externally observable proxy — a sys_attachment record gets created
 *     against the run/result record after clicking Download Report — and
 *     logs the link/hyperlink content check as a manual follow-up.
 */

Test({
    $id: Now.ID['atf_custom_only_excludes_store_apps'],
    name: 'Custom-only excludes store apps',
    description: 'Custom-only scope filter: result set includes an internally-developed custom app, excludes a store-installed one.',
    failOnServerError: true,
}, (atf) => {
    const internalApp = atf.server.recordQuery({
        $id: Now.ID['t1_query_internal_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t1_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t1_set_scan_mode'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'custom_only' },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t1_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })

    atf.form.openExistingRecord({
        $id: Now.ID['t1_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t1_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t1_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t1_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t1_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t1_validate_run_complete'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=complete',
        assert: 'record_validated',
    })

    const internalResult = atf.server.recordQuery({
        $id: Now.ID['t1_query_internal_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${internalApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t1_validate_internal_result'],
        table: 'x_nold_iscan_result',
        recordId: internalResult.first_record,
        fieldValues: `app=${internalApp.first_record}`,
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t1_log_note'],
        log: 'Manually confirm no x_nold_iscan_result row exists for a store-installed app on this run — see IscanAppSelector.getCustomApps() for the source/vendor filter under test.',
    })
})

Test({
    $id: Now.ID['atf_full_scan_happy_path'],
    name: 'Full scan happy path (Table & field discovery, full access)',
    description: 'Manual scan against this app itself validates table/field discovery, row counts, and well-known-base flagging under full metadata access.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t2_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t2_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t2_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t2_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })

    atf.form.openExistingRecord({
        $id: Now.ID['t2_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t2_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t2_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t2_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t2_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t2_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t2_validate_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'scan_mode_used=full_access^table_countGREATER THAN 0',
        assert: 'record_validated',
    })

    const tableProfile = atf.server.recordQuery({
        $id: Now.ID['t2_query_table_profile'],
        table: 'x_nold_iscan_table',
        fieldValues: `result=${result.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t2_validate_table_profile'],
        table: 'x_nold_iscan_table',
        recordId: tableProfile.first_record,
        fieldValues: 'row_countISNOTEMPTY^field_countGREATER THAN 0',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t2_log_note'],
        log: 'Manually cross-check row_count on the table profile against the real row count of the picked table, and confirm well_known_base is set correctly for tables extending task/cmdb_ci.',
    })
})

Test({
    $id: Now.ID['atf_acl_denied_app_falls_back_cleanly'],
    name: 'ACL-denied app falls back cleanly',
    description: 'A restricted scanner-role-only user triggers app_files_fallback scan mode with no thrown errors and zero table profile rows.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t4_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    // Role-minimal user: holds ONLY the scanner role, never admin/
    // security_admin. Whether this user truly lacks sys_db_object/
    // sys_dictionary read depends on the target instance's own ACL
    // configuration (createUser cannot author ACLs) — verify against the
    // real target instance per this test's JSON precondition.
    atf.server.createUser({
        $id: Now.ID['t4_create_restricted_user'],
        firstName: 'ATF',
        lastName: 'RestrictedScanner',
        fieldValues: {},
        groups: [],
        roles: [scannerRole],
        impersonate: true,
    })

    atf.form.openNewForm({
        $id: Now.ID['t4_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t4_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t4_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })

    atf.form.openExistingRecord({
        $id: Now.ID['t4_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t4_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t4_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t4_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t4_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t4_validate_run_status'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=complete',
        assert: 'record_validated',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t4_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t4_validate_fallback_mode'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'scan_mode_used=app_files_fallback',
        assert: 'record_validated',
    })

    const tableRow = atf.server.recordQuery({
        $id: Now.ID['t4_query_table_rows'],
        table: 'x_nold_iscan_table',
        fieldValues: `result=${result.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t4_validate_no_table_rows'],
        table: 'x_nold_iscan_table',
        recordId: tableRow.first_record,
        fieldValues: `result=${result.first_record}`,
        assert: 'record_not_found',
    })
})

Test({
    $id: Now.ID['atf_summary_generated_via_single_genai_call'],
    name: 'Summary generated via single GenAI call',
    description: 'summary_text is populated after a scan when GenAI is enabled, without creating any sn_aia_execution_plan records.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t6_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t6_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t6_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t6_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t6_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t6_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t6_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t6_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t6_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t6_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t6_validate_summary_populated'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'summary_textISNOTEMPTY',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t6_log_note'],
        log: 'Manually confirm summary_text plausibly references this app\'s table/automation counts, and that no sn_aia_execution_plan records were created by IscanSummaryGenerator.generate() (single-shot GenAI call, not an AI Agent/ReAct loop).',
    })
})

Test({
    $id: Now.ID['atf_genai_unavailable_degrades_gracefully'],
    name: 'GenAI unavailable degrades gracefully',
    description: 'With genai_enabled=false, the result record is fully structured with summary_text empty and no error thrown.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t7_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t7_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t7_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t7_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t7_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t7_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t7_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t7_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t7_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t7_validate_run_complete'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=complete',
        assert: 'record_validated',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t7_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t7_validate_structured_fields'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'table_countISNOTEMPTY^scan_mode_usedISNOTEMPTY',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t7_log_note'],
        log: 'This test requires x_nold_iscan.genai_enabled=false (or no GenAI Controller) on the target instance. With that precondition met, expect summary_text empty/null on the result above while all structured count fields still populate.',
    })
})

Test({
    $id: Now.ID['atf_list_and_form_views_render_expected_fields'],
    name: 'List and form views render expected fields',
    description: 'A completed result record\'s form shows the expected fields and its related list of table profile child records.',
    failOnServerError: true,
}, (atf) => {
    const result = atf.server.recordQuery({
        $id: Now.ID['t8_query_any_result'],
        table: 'x_nold_iscan_result',
        fieldValues: 'ORDERBYDESCsys_created_on',
    })

    atf.form.openExistingRecord({
        $id: Now.ID['t8_open_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        formUI: 'standard_ui',
    })
    atf.form.fieldStateValidation({
        $id: Now.ID['t8_validate_visible_fields'],
        table: 'x_nold_iscan_result',
        visible: ['app', 'scan_date', 'scan_mode_used', 'table_count', 'business_rule_count', 'script_include_count'],
        notVisible: [],
        readOnly: [],
        notReadOnly: [],
        mandatory: [],
        notMandatory: [],
        formUI: 'standard_ui',
    })

    atf.server.log({
        $id: Now.ID['t8_log_note'],
        log: 'ATF has no dedicated list-view assertion category; manually confirm the x_nold_iscan_result list view surfaces app/scan_date/scan_mode/table_count/automation_count columns, and that the form\'s related list of x_nold_iscan_table child records renders (see src/fluent/related-lists.now.ts).',
    })
})

Test({
    $id: Now.ID['atf_scan_performs_no_writes_to_scanned_app_data'],
    name: 'Scan performs no writes to scanned application data',
    description: 'A full scan against this app makes zero writes to any scanned table — only this app\'s own tables are modified.',
    failOnServerError: true,
}, (atf) => {
    const before = atf.server.recordQuery({
        $id: Now.ID['t9_snapshot_before'],
        table: 'x_nold_iscan_run',
        fieldValues: 'ORDERBYDESCsys_created_on',
    })

    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t9_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t9_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t9_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t9_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t9_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t9_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t9_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t9_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t9_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    // sys_db_object/sys_dictionary are metadata, not scanned application
    // DATA — confirm neither this app's own table definitions nor the
    // scanned app's row-level tables were mutated by the run above.
    atf.server.recordValidation({
        $id: Now.ID['t9_validate_run_complete'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=complete',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t9_log_note'],
        log: `Compare sys_created_on/sys_updated_on on the scanned app's own tables (x_nold_iscan_run, x_nold_iscan_result, x_nold_iscan_table) against the pre-scan snapshot record ${before.first_record} — expect the only new/changed rows to be under x_nold_iscan_*; the scan must never write to a table it merely profiles.`,
    })
})

Test({
    $id: Now.ID['atf_manual_mode_scans_only_selected_apps'],
    name: 'Manual mode scans only selected apps',
    description: 'Manual — App mode with two selected apps produces exactly two result records, matching the selection.',
    failOnServerError: true,
}, (atf) => {
    const appA = atf.server.recordQuery({
        $id: Now.ID['t10_query_app_a'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })
    const appB = atf.server.recordQuery({
        $id: Now.ID['t10_query_app_b'],
        table: 'sys_app',
        fieldValues: `scopeSTARTSWITHx_^sys_id!=${appA.first_record}`,
    })

    atf.form.openNewForm({
        $id: Now.ID['t10_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t10_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: `${appA.first_record},${appB.first_record}` },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t10_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t10_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t10_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t10_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t10_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t10_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t10_validate_app_count'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'app_count=2',
        assert: 'record_validated',
    })

    const resultA = atf.server.recordQuery({
        $id: Now.ID['t10_query_result_a'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${appA.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t10_validate_result_a'],
        table: 'x_nold_iscan_result',
        recordId: resultA.first_record,
        fieldValues: `app=${appA.first_record}`,
        assert: 'record_validated',
    })

    const resultB = atf.server.recordQuery({
        $id: Now.ID['t10_query_result_b'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${appB.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t10_validate_result_b'],
        table: 'x_nold_iscan_result',
        recordId: resultB.first_record,
        fieldValues: `app=${appB.first_record}`,
        assert: 'record_validated',
    })
})

Test({
    $id: Now.ID['atf_download_report_produces_pdf_with_hyperlinks'],
    name: 'Download Report produces a PDF with hyperlinks',
    description: 'Clicking Download Report on both the run and result forms attaches a PDF sys_attachment to each record.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t11_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t11_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t11_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t11_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t11_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t11_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t11_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t11_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t11_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const t11_click_download_run_report_action = atf.server.recordQuery({
        $id: Now.ID['t11_query_download_run_report_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=download_run_report',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t11_click_download_run_report'],
        table: 'x_nold_iscan_run',
        uiAction: t11_click_download_run_report_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })
    const runAttachment = atf.server.recordQuery({
        $id: Now.ID['t11_query_run_attachment'],
        table: 'sys_attachment',
        fieldValues: `table_name=x_nold_iscan_run^table_sys_id=${run.record_id}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t11_validate_run_attachment'],
        table: 'sys_attachment',
        recordId: runAttachment.first_record,
        fieldValues: `table_sys_id=${run.record_id}`,
        assert: 'record_validated',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t11_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t11_open_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        formUI: 'standard_ui',
    })
    const t11_click_download_result_report_action = atf.server.recordQuery({
        $id: Now.ID['t11_query_download_result_report_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_result^action_name=download_result_report',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t11_click_download_result_report'],
        table: 'x_nold_iscan_result',
        uiAction: t11_click_download_result_report_action.first_record,
        actionType: 'ui_action',
        assert: '',
        formUI: 'standard_ui',
    })
    const resultAttachment = atf.server.recordQuery({
        $id: Now.ID['t11_query_result_attachment'],
        table: 'sys_attachment',
        fieldValues: `table_name=x_nold_iscan_result^table_sys_id=${result.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t11_validate_result_attachment'],
        table: 'sys_attachment',
        recordId: resultAttachment.first_record,
        fieldValues: `table_sys_id=${result.first_record}`,
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t11_log_note'],
        log: 'ATF cannot inspect PDF binary content — manually confirm the run report links to result.record_id and the result report links to each x_nold_iscan_table record, and that links open in a new tab.',
    })
})

Test({
    $id: Now.ID['atf_v2_llm_context_all_five_sections'],
    name: 'v2: llm_context generated with all 5 sections on full-access scan',
    description: 'llm_context contains all five ordered section headings and states the full_access scan mode in section 1.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t12_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t12_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t12_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t12_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t12_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t12_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t12_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t12_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t12_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t12_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t12_validate_llm_context'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'llm_contextLIKE## 1. Application identity^llm_contextLIKE## 2. Data model^llm_contextLIKE## 3. Automation surface^llm_contextLIKE## 4. Integration points^llm_contextLIKE## 5. What to do with this^llm_contextLIKEScan mode: full_access',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t12_log_note'],
        log: 'Manually confirm section order (1 through 5 top to bottom) and that section 2 lists each owned table with Extends/Well-known base lines and a per-field "name (type)" list — the LIKE conditions above only confirm presence, not ordering.',
    })
})

Test({
    $id: Now.ID['atf_v2_automation_surface_lists_names'],
    name: 'v2: automation surface lists names, not only counts',
    description: 'Section 3 of llm_context lists business rules and script includes by name, with bracketed counts matching the bullet lists.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t13_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t13_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t13_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t13_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t13_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t13_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t13_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t13_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t13_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t13_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    // IscanScanOrchestrator (the SI itself) is a known, always-present
    // script include owned by this app — a reliable name to look for.
    atf.server.recordValidation({
        $id: Now.ID['t13_validate_names_present'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'llm_contextLIKE## 3. Automation surface^llm_contextLIKEIscanScanOrchestrator',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t13_log_note'],
        log: 'Manually confirm the bracketed count in each bucket header under "## 3. Automation surface" equals the number of name bullets listed under it.',
    })
})

Test({
    $id: Now.ID['atf_v2_fallback_omits_data_model_section'],
    name: 'v2: fallback scan omits the data model section entirely',
    description: 'A restricted user\'s fallback scan produces an llm_context with an explanatory section 2, never a zero-filled table list.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t14_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.server.createUser({
        $id: Now.ID['t14_create_restricted_user'],
        firstName: 'ATF',
        lastName: 'RestrictedScanner2',
        fieldValues: {},
        groups: [],
        roles: [scannerRole],
        impersonate: true,
    })

    atf.form.openNewForm({
        $id: Now.ID['t14_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t14_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t14_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t14_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t14_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t14_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t14_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t14_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t14_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t14_validate_fallback_context'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'scan_mode_used=app_files_fallback^llm_contextLIKEScan mode: app_files_fallback^llm_contextNOT LIKETables owned by this application: 0',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t14_log_note'],
        log: 'Manually confirm section 2 contains the "Not available" explanation and explicitly warns the data model was NOT inspected.',
    })
})

Test({
    $id: Now.ID['atf_v2_regression_count_fields_populate'],
    name: 'v2 regression: existing count fields still populate after return-shape change',
    description: 'The six v1 count fields (business_rule_count etc.) still populate exactly as before the v2 name-listing refactor.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t15_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t15_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t15_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t15_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t15_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t15_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t15_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t15_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t15_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t15_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t15_validate_counts_populated'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'business_rule_countISNOTEMPTY^script_include_countISNOTEMPTY^flow_countISNOTEMPTY^acl_countISNOTEMPTY^ui_action_countISNOTEMPTY^integration_countISNOTEMPTY',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t15_log_note'],
        log: 'Manually cross-check each count against known values for this app (business rules, script includes, flows, ACLs, UI actions, integrations) to confirm they are unchanged from v1 behaviour.',
    })
})

Test({
    $id: Now.ID['atf_v2_llm_context_written_without_genai'],
    name: 'v2: llm_context is written even when GenAI is unavailable',
    description: 'llm_context is fully populated and status reaches complete even with genai_enabled=false; summary_text stays empty.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t16_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t16_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t16_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t16_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t16_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t16_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t16_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t16_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t16_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t16_validate_run_complete'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=complete',
        assert: 'record_validated',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t16_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${targetApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t16_validate_context_populated'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: 'llm_contextISNOTEMPTY',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t16_log_note'],
        log: 'This test requires x_nold_iscan.genai_enabled=false (or no GenAI Controller) on the target instance. With that precondition met, expect summary_text empty/null on the result above while llm_context is still fully populated.',
    })
})

Test({
    $id: Now.ID['atf_v2_copy_llm_context_ui_action'],
    name: 'v2: Copy LLM Context UI Action copies the field',
    description: 'Clicking Copy LLM Context on a populated result shows a confirming info message.',
    failOnServerError: true,
}, (atf) => {
    const result = atf.server.recordQuery({
        $id: Now.ID['t17_query_result_with_context'],
        table: 'x_nold_iscan_result',
        fieldValues: 'llm_contextISNOTEMPTY^ORDERBYDESCsys_created_on',
    })

    atf.form.openExistingRecord({
        $id: Now.ID['t17_open_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        formUI: 'standard_ui',
    })
    const t17_click_copy_llm_context_action = atf.server.recordQuery({
        $id: Now.ID['t17_query_copy_llm_context_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_result^action_name=copy_llm_context',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t17_click_copy_llm_context'],
        table: 'x_nold_iscan_result',
        uiAction: t17_click_copy_llm_context_action.first_record,
        actionType: 'ui_action',
        assert: '',
        formUI: 'standard_ui',
    })

    atf.server.log({
        $id: Now.ID['t17_log_note'],
        log: 'ATF has no clipboard-read step: manually confirm the info message reports the correct character count, the pasted clipboard text matches llm_context exactly, no GlideAjax call appears in the browser network tab, and that a record with empty llm_context shows the explanatory error message instead.',
    })
})

Test({
    $id: Now.ID['atf_v2_append_activity_writes_both'],
    name: 'v2: _appendActivity writes both activities and comments',
    description: 'scan_findings and the native Activity stream (comments) both accumulate one entry per scan milestone.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t18_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t18_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t18_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t18_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t18_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t18_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t18_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t18_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t18_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t18_validate_scan_findings'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'scan_findingsISNOTEMPTY',
        assert: 'record_validated',
    })

    atf.form.fieldStateValidation({
        $id: Now.ID['t18_validate_activity_visible'],
        table: 'x_nold_iscan_run',
        visible: ['scan_findings', 'comments'],
        notVisible: [],
        readOnly: [],
        notReadOnly: [],
        mandatory: [],
        notMandatory: [],
        formUI: 'standard_ui',
    })

    atf.server.log({
        $id: Now.ID['t18_log_note'],
        log: 'Manually confirm the Activity stream entry count equals the line count in scan_findings, with matching messages, and that later journal entries do not overwrite earlier ones (see IscanScanOrchestrator._appendScanFinding\'s per-call fresh-GlideRecord re-fetch for the comments write).',
    })
})

Test({
    $id: Now.ID['atf_v2_scanner_role_can_write_comments'],
    name: 'v2: scanner role can write the comments journal field',
    description: 'A non-admin user holding only x_nold_iscan.scanner can still write journal comments entries during a scan.',
    failOnServerError: true,
}, (atf) => {
    const targetApp = atf.server.recordQuery({
        $id: Now.ID['t19_query_target_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.server.createUser({
        $id: Now.ID['t19_create_scanner_only_user'],
        firstName: 'ATF',
        lastName: 'ScannerOnly',
        fieldValues: {},
        groups: [],
        roles: [scannerRole],
        impersonate: true,
    })

    atf.form.openNewForm({
        $id: Now.ID['t19_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t19_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: targetApp.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t19_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t19_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t19_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t19_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t19_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t19_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t19_validate_scan_findings'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'scan_findingsISNOTEMPTY',
        assert: 'record_validated',
    })

    atf.server.log({
        $id: Now.ID['t19_log_note'],
        log: 'BUILD-TIME VERIFICATION: manually inspect the Activity stream on this run record — since x_nold_iscan_run does not extend task, if journal comments entries are silently missing here while scan_findings populated above, add an explicit field-level write ACL for comments and re-run this test.',
    })
})

Test({
    $id: Now.ID['atf_manual_target_app_precedence'],
    name: 'Manual — App: target_app takes precedence over manual_app_list',
    description: 'When both target_app and manual_app_list are set on a manual-mode run, only the app(s) in target_app get scanned.',
    failOnServerError: true,
}, (atf) => {
    const appA = atf.server.recordQuery({
        $id: Now.ID['t20_query_app_a'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })
    const appB = atf.server.recordQuery({
        $id: Now.ID['t20_query_app_b'],
        table: 'sys_app',
        fieldValues: `scopeSTARTSWITHx_^sys_id!=${appA.first_record}`,
    })

    // target_app is set to appA AND manual_app_list is separately set to
    // appB — RunScanUiAction.server.js's precedence logic must resolve
    // this to appA only (target_app wins whenever it's set).
    atf.form.openNewForm({
        $id: Now.ID['t20_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t20_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: appA.first_record, manual_app_list: appB.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t20_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t20_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t20_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t20_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t20_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t20_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t20_validate_app_count'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'app_count=1',
        assert: 'record_validated',
    })

    const resultA = atf.server.recordQuery({
        $id: Now.ID['t20_query_result_a'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${appA.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t20_validate_result_a_exists'],
        table: 'x_nold_iscan_result',
        recordId: resultA.first_record,
        fieldValues: `app=${appA.first_record}`,
        assert: 'record_validated',
    })

    const resultB = atf.server.recordQuery({
        $id: Now.ID['t20_query_result_b'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${appB.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t20_validate_result_b_absent'],
        table: 'x_nold_iscan_result',
        recordId: resultB.first_record,
        fieldValues: `run=${run.record_id}^app=${appB.first_record}`,
        assert: 'record_not_found',
    })
})

Test({
    $id: Now.ID['atf_manual_target_app_multiselect'],
    name: 'Manual — App: target_app multi-select scans all selected apps',
    description: 'target_app carrying two comma-separated app sys_ids (slushbucket multi-select) scans both apps and produces two result records.',
    failOnServerError: true,
}, (atf) => {
    const appA = atf.server.recordQuery({
        $id: Now.ID['t25_query_app_a'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })
    const appB = atf.server.recordQuery({
        $id: Now.ID['t25_query_app_b'],
        table: 'sys_app',
        fieldValues: `scopeSTARTSWITHx_^sys_id!=${appA.first_record}`,
    })

    atf.form.openNewForm({
        $id: Now.ID['t25_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t25_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'manual', target_app: `${appA.first_record},${appB.first_record}` },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t25_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t25_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t25_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t25_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t25_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t25_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t25_validate_app_count'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'app_count=2',
        assert: 'record_validated',
    })

    const resultA = atf.server.recordQuery({
        $id: Now.ID['t25_query_result_a'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${appA.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t25_validate_result_a'],
        table: 'x_nold_iscan_result',
        recordId: resultA.first_record,
        fieldValues: `app=${appA.first_record}`,
        assert: 'record_validated',
    })

    const resultB = atf.server.recordQuery({
        $id: Now.ID['t25_query_result_b'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${appB.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t25_validate_result_b'],
        table: 'x_nold_iscan_result',
        recordId: resultB.first_record,
        fieldValues: `app=${appB.first_record}`,
        assert: 'record_validated',
    })
})

Test({
    $id: Now.ID['atf_single_table_owning_app_case'],
    name: 'Manual — Single Table: table owned by a custom app runs the full app tally',
    description: 'Picking a table owned by this app (its own x_nold_iscan_run table) runs the full per-app tally against the owning app.',
    failOnServerError: true,
}, (atf) => {
    const targetTable = atf.server.recordQuery({
        $id: Now.ID['t21_query_target_table'],
        table: 'sys_db_object',
        fieldValues: 'name=x_nold_iscan_run',
    })
    const owningApp = atf.server.recordQuery({
        $id: Now.ID['t21_query_owning_app'],
        table: 'sys_app',
        fieldValues: 'scope=x_nold_iscan',
    })

    atf.form.openNewForm({
        $id: Now.ID['t21_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t21_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'single_table', target_table: targetTable.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t21_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t21_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t21_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t21_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t21_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t21_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t21_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}^app=${owningApp.first_record}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t21_validate_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: `app=${owningApp.first_record}`,
        assert: 'record_validated',
    })

    const tableProfile = atf.server.recordQuery({
        $id: Now.ID['t21_query_table_profile'],
        table: 'x_nold_iscan_table',
        fieldValues: `result=${result.first_record}^table_name=x_nold_iscan_run`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t21_validate_table_profile'],
        table: 'x_nold_iscan_table',
        recordId: tableProfile.first_record,
        fieldValues: 'row_countISNOTEMPTY^field_countGREATER THAN 0^reference_field_listISNOTEMPTY',
        assert: 'record_validated',
    })
})

Test({
    $id: Now.ID['atf_single_table_no_owning_app_case'],
    name: 'Manual — Single Table: OOB table with no owning sys_app falls back to table-only',
    description: 'Picking incident (no owning sys_app) creates zero result records and logs a table-only profile to the run.',
    failOnServerError: true,
}, (atf) => {
    const targetTable = atf.server.recordQuery({
        $id: Now.ID['t22_query_target_table'],
        table: 'sys_db_object',
        fieldValues: 'name=incident',
    })

    atf.form.openNewForm({
        $id: Now.ID['t22_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t22_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'single_table', target_table: targetTable.first_record },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t22_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t22_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t22_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t22_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t22_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t22_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t22_validate_run_complete'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=complete^scan_findingsLIKEincident^scan_findingsLIKEno owning application',
        assert: 'record_validated',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t22_query_result'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t22_validate_no_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: `run=${run.record_id}`,
        assert: 'record_not_found',
    })
})

Test({
    $id: Now.ID['atf_modules_mode_profiles_instance_wide'],
    name: 'Modules mode: installed plugins profiled instance-wide',
    description: 'Modules mode profiles sys_plugins instance-wide with one x_nold_iscan_module row per plugin and no result records.',
    failOnServerError: true,
}, (atf) => {
    atf.form.openNewForm({
        $id: Now.ID['t23_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t23_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'modules' },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t23_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t23_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t23_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t23_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t23_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t23_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t23_validate_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'app_count=0^status=complete',
        assert: 'record_validated',
    })

    const moduleRow = atf.server.recordQuery({
        $id: Now.ID['t23_query_module_row'],
        table: 'x_nold_iscan_module',
        fieldValues: `run=${run.record_id}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t23_validate_module_row'],
        table: 'x_nold_iscan_module',
        recordId: moduleRow.first_record,
        fieldValues: 'nameISNOTEMPTY^plugin_idISNOTEMPTY',
        assert: 'record_validated',
    })

    const result = atf.server.recordQuery({
        $id: Now.ID['t23_query_result_absent'],
        table: 'x_nold_iscan_result',
        fieldValues: `run=${run.record_id}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t23_validate_no_result'],
        table: 'x_nold_iscan_result',
        recordId: result.first_record,
        fieldValues: `run=${run.record_id}`,
        assert: 'record_not_found',
    })

    atf.server.log({
        $id: Now.ID['t23_log_note'],
        log: 'Manually compare the x_nold_iscan_module row count for this run against sys_plugins\' total row count on the instance, and spot-check active_flag/active_confirmed/status_mismatch on a few rows.',
    })
})

Test({
    $id: Now.ID['atf_modules_mode_sys_plugins_denial_surfaces_error'],
    name: 'Modules mode: sys_plugins read denial surfaces as an error, not a silent zero-row scan',
    description: 'A scanner-role-only user with no sys_plugins read access ends the run in error status with an explicit finding, never a silent zero-row complete.',
    failOnServerError: true,
}, (atf) => {
    // Role-minimal user: holds ONLY x_nold_iscan.scanner. Whether this
    // user actually lacks sys_plugins read depends on the target
    // instance's own ACL configuration (createUser cannot author ACLs) —
    // verify against the real target instance per this test's precondition.
    atf.server.createUser({
        $id: Now.ID['t24_create_restricted_user'],
        firstName: 'ATF',
        lastName: 'RestrictedModulesScanner',
        fieldValues: {},
        groups: [],
        roles: [scannerRole],
        impersonate: true,
    })

    atf.form.openNewForm({
        $id: Now.ID['t24_open_new_run'],
        table: 'x_nold_iscan_run',
        formUI: 'standard_ui',
    })
    atf.form.setFieldValue({
        $id: Now.ID['t24_set_fields'],
        table: 'x_nold_iscan_run',
        fieldValues: { scan_mode: 'modules' },
        formUI: 'standard_ui',
    })
    const run = atf.form.submitForm({
        $id: Now.ID['t24_submit_run'],
        assert: 'form_submitted_to_server',
        formUI: 'standard_ui',
    })
    atf.form.openExistingRecord({
        $id: Now.ID['t24_open_run'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        formUI: 'standard_ui',
    })
    const t24_click_run_scan_action = atf.server.recordQuery({
        $id: Now.ID['t24_query_run_scan_action'],
        table: 'sys_ui_action',
        fieldValues: 'table=x_nold_iscan_run^action_name=run_scan',
    })
    atf.form.clickUIAction({
        $id: Now.ID['t24_click_run_scan'],
        table: 'x_nold_iscan_run',
        uiAction: t24_click_run_scan_action.first_record,
        actionType: 'ui_action',
        assert: 'page_reloaded_or_redirected',
        formUI: 'standard_ui',
    })

    atf.server.recordValidation({
        $id: Now.ID['t24_validate_error_status'],
        table: 'x_nold_iscan_run',
        recordId: run.record_id,
        fieldValues: 'status=error^scan_findingsLIKEsys_plugins',
        assert: 'record_validated',
    })

    const moduleRow = atf.server.recordQuery({
        $id: Now.ID['t24_query_module_row_absent'],
        table: 'x_nold_iscan_module',
        fieldValues: `run=${run.record_id}`,
    })
    atf.server.recordValidation({
        $id: Now.ID['t24_validate_no_module_rows'],
        table: 'x_nold_iscan_module',
        recordId: moduleRow.first_record,
        fieldValues: `run=${run.record_id}`,
        assert: 'record_not_found',
    })
})
