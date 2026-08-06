import { Acl } from '@servicenow/sdk/core'
import { scannerRole } from './roles.now'

// No ACL in this app grants broader table access than the user already
// has — sys_db_object, sys_dictionary, and scanned tables rely entirely
// on OOB ACLs and the caller's own access. These ACLs only gate the
// app's own result tables and its two client-callable script includes.

export const runReadAcl = Acl({
    $id: Now.ID['sn_inst_scan_run_read_acl'],
    type: 'record',
    table: 'x_335329_iscan_run',
    operation: 'read',
    roles: [scannerRole],
})

export const runCreateAcl = Acl({
    $id: Now.ID['sn_inst_scan_run_create_acl'],
    type: 'record',
    table: 'x_335329_iscan_run',
    operation: 'create',
    roles: [scannerRole],
})

// The orchestrator updates the run record (status/scan_findings/completed)
// as the CALLING user — scripts don't run elevated. Without write access
// every run.update() silently no-ops for non-admin scanners: status
// stays 'pending', the scan_findings log stays empty, and no results appear.
export const runWriteAcl = Acl({
    $id: Now.ID['sn_inst_scan_run_write_acl'],
    type: 'record',
    table: 'x_335329_iscan_run',
    operation: 'write',
    roles: [scannerRole],
})

export const resultReadAcl = Acl({
    $id: Now.ID['sn_inst_scan_result_read_acl'],
    type: 'record',
    table: 'x_335329_iscan_result',
    operation: 'read',
    roles: [scannerRole],
})

export const tableReadAcl = Acl({
    $id: Now.ID['sn_inst_scan_table_read_acl'],
    type: 'record',
    table: 'x_335329_iscan_table',
    operation: 'read',
    roles: [scannerRole],
})

// Result + table-profile rows are inserted by the orchestrator running
// as the calling user, so the scanner role needs CREATE on both. No
// write ACL — results are immutable once written (spec: system-generated
// output, "write reserved to the Script Include").
export const resultCreateAcl = Acl({
    $id: Now.ID['sn_inst_scan_result_create_acl'],
    type: 'record',
    table: 'x_335329_iscan_result',
    operation: 'create',
    roles: [scannerRole],
})

export const tableCreateAcl = Acl({
    $id: Now.ID['sn_inst_scan_table_create_acl'],
    type: 'record',
    table: 'x_335329_iscan_table',
    operation: 'create',
    roles: [scannerRole],
})

// Crossref rows are inserted by the orchestrator running as the calling
// user, same as result/table rows — missing create/read ACLs here means
// _writeCrossrefRows() silently no-ops for non-admin scanners.
export const crossrefReadAcl = Acl({
    $id: Now.ID['sn_inst_scan_crossref_read_acl'],
    type: 'record',
    table: 'x_335329_iscan_crossref',
    operation: 'read',
    roles: [scannerRole],
})

export const crossrefCreateAcl = Acl({
    $id: Now.ID['sn_inst_scan_crossref_create_acl'],
    type: 'record',
    table: 'x_335329_iscan_crossref',
    operation: 'create',
    roles: [scannerRole],
})

// Global-customization rows: same pattern, inserted by the orchestrator
// as the calling user when a base-system table is found to carry
// customer-scoped customizations.
export const globalCustomizationReadAcl = Acl({
    $id: Now.ID['sn_inst_scan_global_custom_read_acl'],
    type: 'record',
    table: 'x_335329_iscan_global_customization',
    operation: 'read',
    roles: [scannerRole],
})

export const globalCustomizationCreateAcl = Acl({
    $id: Now.ID['sn_inst_scan_global_custom_create_acl'],
    type: 'record',
    table: 'x_335329_iscan_global_customization',
    operation: 'create',
    roles: [scannerRole],
})

<<<<<<< HEAD
// Module rows (Installed Modules mode): same pattern as table/crossref/
// global-customization rows — inserted by the orchestrator as the calling
// user, no write ACL (immutable once written).
export const moduleReadAcl = Acl({
    $id: Now.ID['sn_inst_scan_module_read_acl'],
    type: 'record',
    table: 'x_335329_iscan_module',
    operation: 'read',
    roles: [scannerRole],
})

export const moduleCreateAcl = Acl({
    $id: Now.ID['sn_inst_scan_module_create_acl'],
    type: 'record',
    table: 'x_335329_iscan_module',
    operation: 'create',
    roles: [scannerRole],
})

=======
>>>>>>> dd36c29a6a14e52801e9864e5ac48855b837ca47
// Client-callable script includes require their own execute ACL for
// GlideAjax calls to pass (see fluent-script-include-api.md). The ACL
// name must be the scope-qualified API name — that's the resource name
// the platform checks for a scoped SI, and it's also what the client
// passes to `new GlideAjax(...)`. IscanScanOrchestrator no longer needs
// one of these: it's called directly, server-side, from the "Run Scan"
// UI Action script rather than via GlideAjax, so it isn't client-callable
// at all (see script-includes.now.ts).
export const reportGeneratorExecuteAcl = Acl({
    $id: Now.ID['iscan_report_generator_execute_acl'],
    type: 'client_callable_script_include',
    name: 'x_335329_iscan.IscanReportGenerator',
    operation: 'execute',
    roles: [scannerRole],
})
