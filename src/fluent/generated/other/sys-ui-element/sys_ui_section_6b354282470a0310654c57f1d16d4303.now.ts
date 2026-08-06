import { Record } from '@servicenow/sdk/core'
Record({
    $id: Now.ID['a7354282470a0310654c57f1d16d4311'],
    table: 'sys_ui_element',
    data: {
        element: 'started',
        position: 2,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['2f354282470a0310654c57f1d16d4312'],
    table: 'sys_ui_element',
    data: {
        element: '.split',
        position: 4,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
        type: '.split',
    },
})
Record({
    $id: Now.ID['6e62e3da474ac310654c57f1d16d437b'],
    table: 'sys_ui_element',
    data: {
        element: 'scan_mode',
        position: 0,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['2a62e3da474ac310654c57f1d16d437c'],
    table: 'sys_ui_element',
    data: {
        element: 'status',
        position: 1,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['ae62e3da474ac310654c57f1d16d437d'],
    table: 'sys_ui_element',
    data: {
        element: 'completed',
        position: 3,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['2662e3da474ac310654c57f1d16d437f'],
    table: 'sys_ui_element',
    data: {
        element: 'sys_created_on',
        position: 5,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['ee62e3da474ac310654c57f1d16d437f'],
    table: 'sys_ui_element',
    data: {
        element: 'sys_created_by',
        position: 6,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['aa62e3da474ac310654c57f1d16d4380'],
    table: 'sys_ui_element',
    data: {
        element: 'requested_by',
        position: 7,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['6662e3da474ac310654c57f1d16d4381'],
    table: 'sys_ui_element',
    data: {
        element: 'app_count',
        position: 8,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['2262e3da474ac310654c57f1d16d4382'],
    table: 'sys_ui_element',
    data: {
        element: '.end_split',
        position: 9,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
        type: '.end_split',
    },
})
Record({
    $id: Now.ID['ea62e3da474ac310654c57f1d16d4382'],
    table: 'sys_ui_element',
    data: {
        element: 'manual_app_list',
        position: 10,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
// target_app — the Manual — App mode picker (reference to sys_app).
// Hidden by default and shown only for scan_mode=manual via the
// manualAppVisibilityPolicy UI policy. This element MUST exist on the
// form for that policy to have anything to toggle — the field being a
// table column alone is not enough.
Record({
    $id: Now.ID['iscan_form_target_app'],
    table: 'sys_ui_element',
    data: {
        element: 'target_app',
        position: 11,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
// target_table — the Manual — Single Table mode picker (reference to
// sys_db_object). Hidden by default, shown only for
// scan_mode=single_table via singleTableVisibilityPolicy.
Record({
    $id: Now.ID['iscan_form_target_table'],
    table: 'sys_ui_element',
    data: {
        element: 'target_table',
        position: 12,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
// comments — the Journal input field. Gives the Incident-style
// "Additional comments" input box; paired with the activity.xml
// formatter below it renders the same Activity stream Incident uses.
Record({
    $id: Now.ID['iscan_form_comments'],
    table: 'sys_ui_element',
    data: {
        element: 'comments',
        position: 13,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
Record({
    $id: Now.ID['6262e3da474ac310654c57f1d16d4384'],
    table: 'sys_ui_element',
    data: {
        element: 'activity.xml',
        position: 14,
        sys_ui_formatter: '444ea5c6bf310100e628555b3f0739d6',
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
        type: 'formatter',
    },
})
// scan_findings — the plain queryable String log (renamed from
// `activities` 2026-07-22; that name read as the native Activity stream,
// which this is NOT). Shown alongside `comments`/the Activity formatter
// above, not instead of them — both are written on every
// IscanScanOrchestrator._appendScanFinding() call.
Record({
    $id: Now.ID['iscan_form_scan_findings'],
    table: 'sys_ui_element',
    data: {
        element: 'scan_findings',
        position: 15,
        sys_ui_section: '6b354282470a0310654c57f1d16d4303',
    },
})
