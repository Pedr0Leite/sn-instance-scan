import { ApplicationMenu, Record } from '@servicenow/sdk/core'

// Top-level "SN Instance Scan" entry in the application navigator.
export const appMenu = ApplicationMenu({
    $id: Now.ID['iscan_app_menu'],
    title: 'SN Instance Scan',
    hint: 'Scan the instance app-by-app and review architecture summaries',
    description: 'Scan a ServiceNow instance application-by-application and produce a per-app architecture summary.',
    roles: ['x_335329_iscan.scanner'],
    active: true,
    category: '',
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
        name: 'x_335329_iscan_run',
        query: 'scan_mode=full',
        hint: 'Scan every application on the instance',
        roles: ['x_335329_iscan.scanner'],
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
        name: 'x_335329_iscan_run',
        query: 'scan_mode=custom_only',
        hint: 'Scan internally-developed apps only, excluding store-installed apps',
        roles: ['x_335329_iscan.scanner'],
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
        name: 'x_335329_iscan_run',
        query: 'scan_mode=manual',
        hint: 'Pick specific applications to scan (fill in Manual App List after opening)',
        roles: ['x_335329_iscan.scanner'],
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
        name: 'x_335329_iscan_run',
        query: 'scan_mode=modules',
        hint: 'Scan installed plugins/modules instance-wide (sys_plugins)',
        roles: ['x_335329_iscan.scanner'],
        active: true,
        order: 350,
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
        roles: ['x_335329_iscan.scanner'],
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
        name: 'x_335329_iscan_run',
        hint: 'All scan runs',
        roles: ['x_335329_iscan.scanner'],
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
        name: 'x_335329_iscan_result',
        hint: 'All per-application scan results',
        roles: ['x_335329_iscan.scanner'],
        active: true,
        order: 600,
        override_menu_roles: false,
        require_confirmation: false,
        sys_domain: 'global',
        sys_domain_path: '/',
        uncancelable: false,
    },
})
