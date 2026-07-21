import {
    Table,
    StringColumn,
    ChoiceColumn,
    ReferenceColumn,
    DateTimeColumn,
    IntegerColumn,
    GenericColumn,
} from '@servicenow/sdk/core'

// Named-scope tables must start with the scope prefix (x_335329_iscan_).
// Since these are new tables this scope owns, columns need no additional
// prefix — only columns added to a table this scope doesn't own would
// need one (see the table-guide topic in `now-sdk explain`).

export const x_335329_iscan_run = Table({
    name: 'x_335329_iscan_run',
    label: 'Instance Scan Run',
    display: 'requested_by',
    schema: {
        scan_mode: ChoiceColumn({
            label: 'Scan Mode',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            choices: {
                full: { label: 'Full', sequence: 0 },
                custom_only: { label: 'Custom Only', sequence: 1 },
                manual: { label: 'Manual — App', sequence: 2 },
                single_table: { label: 'Manual — Single Table', sequence: 3 },
            },
        }),
        status: ChoiceColumn({
            label: 'Status',
            mandatory: true,
            default: 'pending',
            dropdown: 'dropdown_without_none',
            choices: {
                pending: { label: 'Pending', sequence: 0 },
                running: { label: 'Running', sequence: 1 },
                complete: { label: 'Complete', sequence: 2 },
                error: { label: 'Error', sequence: 3 },
            },
        }),
        requested_by: ReferenceColumn({
            label: 'Requested By',
            referenceTable: 'sys_user',
            default: 'javascript:gs.getUserID()',
        }),
        started: DateTimeColumn({ label: 'Started' }),
        completed: DateTimeColumn({ label: 'Completed' }),
        app_count: IntegerColumn({ label: 'App Count', default: 0 }),
        manual_app_list: StringColumn({
            label: 'Manual App List',
            maxLength: 4000,
        }),
        // Primary picker for Manual — App mode. Takes precedence over
        // manual_app_list (the legacy multi-app string field, kept for
        // the programmatic/ATF API) when both are set — see
        // RunScanUiAction.server.js.
        target_app: ReferenceColumn({
            label: 'Target App',
            referenceTable: 'sys_app',
        }),
        // Picker for Manual — Single Table mode. No reference qualifier:
        // this mode's value is being able to point at ANY table,
        // including OOB ones (incident, sys_user) with no owning
        // sys_app record — see IscanScanOrchestrator._resolveSingleTableApp.
        target_table: ReferenceColumn({
            label: 'Target Table',
            referenceTable: 'sys_db_object',
        }),
        // Timestamped, append-only progress log written to as the scan
        // proceeds (one entry per app + start/end markers) so the user can
        // refresh the form mid-run and see what's happened so far. Plain
        // StringColumn rather than a journal field — this Fluent SDK
        // version has no JournalColumn type (same reason summary_text below
        // uses a string instead of HTMLColumn).
        activities: StringColumn({
            label: 'Activities',
            maxLength: 8000,
        }),
        // v2: a real Journal field so scan progress also renders in the
        // native Activity formatter. This is ADDITIVE alongside
        // `activities` above, not a replacement — `activities` stays a
        // plain String because it must remain queryable and free of
        // journal-field ACL complications. Both are written on every
        // _appendActivity() call; see that method's comment.
        //
        // There is no JournalColumn in this SDK version, so this uses
        // GenericColumn (the documented escape hatch) with the same
        // internal_type OOB task.comments uses — verified against
        // sdk-core's own task.now.js definition.
        comments: GenericColumn({
            label: 'Comments',
            columnType: 'journal_input',
            maxLength: 4000,
        }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'requested_by',
        },
    ],
    audit: true,
})

export const x_335329_iscan_result = Table({
    name: 'x_335329_iscan_result',
    label: 'Instance Scan Result',
    display: 'app',
    schema: {
        run: ReferenceColumn({
            label: 'Run',
            referenceTable: 'x_335329_iscan_run',
            mandatory: true,
        }),
        app: ReferenceColumn({
            label: 'Application',
            referenceTable: 'sys_app',
            mandatory: true,
        }),
        scan_date: DateTimeColumn({
            label: 'Scan Date',
            default: 'javascript:gs.nowDateTime()',
        }),
        scan_mode_used: ChoiceColumn({
            label: 'Scan Mode Used',
            mandatory: true,
            dropdown: 'dropdown_without_none',
            choices: {
                full_access: { label: 'Full Access', sequence: 0 },
                app_files_fallback: { label: 'Application Files Fallback', sequence: 1 },
            },
        }),
        table_count: IntegerColumn({ label: 'Table Count', default: 0 }),
        business_rule_count: IntegerColumn({ label: 'Business Rule Count', default: 0 }),
        script_include_count: IntegerColumn({ label: 'Script Include Count', default: 0 }),
        flow_count: IntegerColumn({ label: 'Flow Count', default: 0 }),
        acl_count: IntegerColumn({ label: 'ACL Count', default: 0 }),
        ui_action_count: IntegerColumn({ label: 'UI Action Count', default: 0 }),
        integration_count: IntegerColumn({
            label: 'Integration Count',
            default: 0,
        }),
        table_list: StringColumn({
            label: 'Table List',
            maxLength: 4000,
        }),
        // GenAI-generated summary text. HTMLColumn caused a build error
        // (TS213) on this SDK version, so this stores HTML as a plain
        // string field instead of a rich-text (glide_html) field.
        summary_text: StringColumn({ label: 'Summary', maxLength: 8000 }),
        // v2: the full, self-contained architecture briefing built by
        // IscanSummaryGenerator.buildPrompt() — written on every scan
        // regardless of whether the GenAI Controller is available (only
        // summary_text depends on that). Users copy this out via the
        // "Copy LLM Context" UI Action and paste it into any external
        // LLM. Plain String for the same reason as summary_text: this
        // SDK version's HTMLColumn errored (TS213), and a String stays
        // queryable with no journal complications.
        llm_context: StringColumn({ label: 'LLM Context', maxLength: 65536 }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'app',
        },
        {
            name: 'index2',
            unique: false,
            element: 'run',
        },
    ],
})

export const x_335329_iscan_table = Table({
    name: 'x_335329_iscan_table',
    label: 'Instance Scan Table Profile',
    display: 'table_name',
    schema: {
        result: ReferenceColumn({
            label: 'Result',
            referenceTable: 'x_335329_iscan_result',
            mandatory: true,
        }),
        table_name: StringColumn({ label: 'Table Name', maxLength: 80 }),
        extends_table: StringColumn({ label: 'Extends Table', maxLength: 80 }),
        well_known_base: ChoiceColumn({
            label: 'Well-Known Base',
            dropdown: 'dropdown_without_none',
            choices: {
                task: { label: 'task', sequence: 0 },
                cmdb_ci: { label: 'cmdb_ci', sequence: 1 },
                other: { label: 'Other', sequence: 2 },
                none: { label: 'None', sequence: 3 },
            },
        }),
        row_count: IntegerColumn({ label: 'Row Count' }),
        field_count: IntegerColumn({ label: 'Field Count' }),
        reference_field_list: StringColumn({
            label: 'Reference Field List',
            maxLength: 4000,
        }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'result',
        },
    ],
})
