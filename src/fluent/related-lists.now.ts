import { Record } from '@servicenow/sdk/core'

// Explicit related list: x_335329_iscan_result records where run = this
// record, shown on the x_335329_iscan_run form. Related lists for a
// reference field normally auto-render at the bottom of any OOB form —
// but this app's run form already has a custom sys_ui_section (see
// generated/other/sys-ui-element/sys_ui_section_...now.ts), and a custom
// form section has previously been found to suppress form elements the
// platform would otherwise render automatically (see target_app/
// target_table's history in CLAUDE.md) — so this is defined explicitly
// rather than relying on default behavior.
//
// Format verified against real ServiceNow update-set XML exports of
// hand-configured related lists (not guessed): the parent
// sys_ui_related_list.name is the table the list appears ON
// (x_335329_iscan_run); the child sys_ui_related_list_entry.related_list
// is "<child_table>.<field_on_child_referencing_parent>"
// (x_335329_iscan_result.run).
export const iscanResultRelatedList = Record({
    $id: Now.ID['iscan_result_related_list'],
    table: 'sys_ui_related_list',
    data: {
        name: 'x_335329_iscan_run',
    },
})

export const iscanResultRelatedListEntry = Record({
    $id: Now.ID['iscan_result_related_list_entry'],
    table: 'sys_ui_related_list_entry',
    data: {
        list_id: iscanResultRelatedList,
        related_list: 'x_335329_iscan_result.run',
        position: 0,
    },
})

// Same explicit-related-list treatment for x_335329_iscan_module
// (Installed Modules mode child rows) — without this they'd be written
// correctly but invisible on the Run form, same failure class as above.
export const iscanModuleRelatedList = Record({
    $id: Now.ID['iscan_module_related_list'],
    table: 'sys_ui_related_list',
    data: {
        name: 'x_335329_iscan_run',
    },
})

export const iscanModuleRelatedListEntry = Record({
    $id: Now.ID['iscan_module_related_list_entry'],
    table: 'sys_ui_related_list_entry',
    data: {
        list_id: iscanModuleRelatedList,
        related_list: 'x_335329_iscan_module.run',
        position: 1,
    },
})

// Same explicit-related-list treatment for x_335329_iscan_ai_agent
// (AI Agent Discovery mode child rows) — same failure class as above.
export const iscanAiAgentRelatedList = Record({
    $id: Now.ID['iscan_ai_agent_related_list'],
    table: 'sys_ui_related_list',
    data: {
        name: 'x_335329_iscan_run',
    },
})

export const iscanAiAgentRelatedListEntry = Record({
    $id: Now.ID['iscan_ai_agent_related_list_entry'],
    table: 'sys_ui_related_list_entry',
    data: {
        list_id: iscanAiAgentRelatedList,
        related_list: 'x_335329_iscan_ai_agent.run',
        position: 2,
    },
})
