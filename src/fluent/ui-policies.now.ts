import { UiPolicy, default_view } from '@servicenow/sdk/core'

export const manualAppVisibilityPolicy = UiPolicy({
    $id: Now.ID['manual_app_visibility_policy'],
    table: 'x_nold_iscan_run',
    shortDescription: 'Show Target App only for Manual — App scan mode',
    active: true,
    onLoad: true,
    reverseIfFalse: true,
    conditions: 'scan_mode=manual',
    view: default_view,
    actions: [
        {
            field: 'target_app',
            visible: true,
        },
    ],
})

export const singleTableVisibilityPolicy = UiPolicy({
    $id: Now.ID['single_table_visibility_policy'],
    table: 'x_nold_iscan_run',
    shortDescription: 'Show Target Table only for Manual — Single Table scan mode',
    active: true,
    onLoad: true,
    reverseIfFalse: true,
    conditions: 'scan_mode=single_table',
    view: default_view,
    actions: [
        {
            field: 'target_table',
            visible: true,
        },
    ],
})
