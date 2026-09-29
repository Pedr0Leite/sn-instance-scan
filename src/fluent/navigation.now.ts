import { ApplicationMenu, Record } from '@servicenow/sdk/core'

// Top-level "SN Instance Scan" entry in the application navigator.
export const appMenu = ApplicationMenu({
    $id: Now.ID['iscan_app_menu'],
    title: 'SN Instance Scan',
    hint: 'Scan the instance app-by-app and review architecture summaries',
    description: 'Scan a ServiceNow instance application-by-application and produce a per-app architecture summary.',
    roles: ['x_nold_iscan.scanner'],
    active: true,
    category: '',
})

// The console UI Page is the app's front door: order 50 puts it above every
// "New <mode> Scan" module. link_type CONTENT points at a UI Page endpoint.
export const consoleModule = Record({
    $id: Now.ID['iscan_module_console'],
    table: 'sys_app_module',
    data: {
        title: 'Instance Scan Console',
        application: appMenu,
        link_type: 'DIRECT',
        query: 'x_nold_iscan_console.do',
        hint: 'Dashboard of scan runs, results, and instance-wide findings',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 50,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

// One module per scan mode, so picking a run type is a single click: each
// opens a pre-filled "New" form (scan_mode set via the module's Arguments
// field) rather than making the user fill it in by hand.
export const newFullScanModule = Record({
    $id: Now.ID['iscan_module_new_full'],
    table: 'sys_app_module',
    data: {
        title: 'New Full Scan',
        application: appMenu,
        link_type: 'NEW',
        name: 'x_nold_iscan_run',
        query: 'scan_mode=full',
        hint: 'Scan every application on the instance',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 100,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const newCustomOnlyScanModule = Record({
    $id: Now.ID['iscan_module_new_custom_only'],
    table: 'sys_app_module',
    data: {
        title: 'New Custom-Only Scan',
        application: appMenu,
        link_type: 'NEW',
        name: 'x_nold_iscan_run',
        query: 'scan_mode=custom_only',
        hint: 'Scan internally-developed apps only, excluding store-installed apps',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 200,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const newManualScanModule = Record({
    $id: Now.ID['iscan_module_new_manual'],
    table: 'sys_app_module',
    data: {
        title: 'New Manual Scan',
        application: appMenu,
        link_type: 'NEW',
        name: 'x_nold_iscan_run',
        query: 'scan_mode=manual',
        hint: 'Pick specific applications to scan (fill in Manual App List after opening)',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 300,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const newModulesScanModule = Record({
    $id: Now.ID['iscan_module_new_modules'],
    table: 'sys_app_module',
    data: {
        title: 'New Modules Scan',
        application: appMenu,
        link_type: 'NEW',
        name: 'x_nold_iscan_run',
        query: 'scan_mode=modules',
        hint: 'Scan installed plugins/modules instance-wide (sys_plugins)',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 350,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const newAiAgentsScanModule = Record({
    $id: Now.ID['iscan_module_new_ai_agents'],
    table: 'sys_app_module',
    data: {
        title: 'New AI Agent Discovery Scan',
        application: appMenu,
        link_type: 'NEW',
        name: 'x_nold_iscan_run',
        query: 'scan_mode=ai_agents',
        hint: 'Scan instance-wide for AI agents, tools, and LLM integrations',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 375,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

// Admin-only, unlike the other "New ... Scan" modules: CMDB & CSDM Health runs
// as System in a background worker, so launching it is restricted to admins
// (IscanScanOrchestrator.canLaunch). Showing it to scanner-only users would only
// offer a button that refuses them.
export const newCmdbHealthScanModule = Record({
    $id: Now.ID['iscan_module_new_cmdb_health'],
    table: 'sys_app_module',
    data: {
        title: 'New CMDB & CSDM Health Scan',
        application: appMenu,
        link_type: 'NEW',
        name: 'x_nold_iscan_run',
        query: 'scan_mode=cmdb_health',
        hint: 'Assess CMDB and CSDM health against the Get Well Playbooks (admin only, runs in the background)',
        roles: ['admin'],
        active: true,
        order: 380,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const separatorModule = Record({
    $id: Now.ID['iscan_module_separator'],
    table: 'sys_app_module',
    data: {
        title: 'Browse',
        application: appMenu,
        link_type: 'SEPARATOR',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 400,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const scanRunsListModule = Record({
    $id: Now.ID['iscan_module_runs_list'],
    table: 'sys_app_module',
    data: {
        title: 'Scan Runs',
        application: appMenu,
        link_type: 'LIST',
        name: 'x_nold_iscan_run',
        hint: 'All scan runs',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 500,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})

export const scanResultsListModule = Record({
    $id: Now.ID['iscan_module_results_list'],
    table: 'sys_app_module',
    data: {
        title: 'Scan Results',
        application: appMenu,
        link_type: 'LIST',
        name: 'x_nold_iscan_result',
        hint: 'All per-application scan results',
        roles: ['x_nold_iscan.scanner'],
        active: true,
        order: 600,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})
