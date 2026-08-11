import {
    Table,
    StringColumn,
    ChoiceColumn,
    ReferenceColumn,
    DateTimeColumn,
    IntegerColumn,
    GenericColumn,
    BooleanColumn,
    ListColumn,
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
                // Instance-wide, no app/table scoping — profiles sys_plugins
                // directly. See IscanModuleScanner / IscanScanOrchestrator._executeModulesRun.
                modules: { label: 'Installed Modules', sequence: 4 },
                // Instance-wide, no app/table scoping — layered AI agent/
                // tool/credential inventory. See IscanAiAgentScanner /
                // IscanScanOrchestrator._executeAiAgentsRun.
                ai_agents: { label: 'AI Agent Discovery', sequence: 5 },
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
        // RunScanUiAction.server.js. List (not Reference) so a Manual run
        // can target several apps at once — renders as a slushbucket,
        // same attributes OOB task.watch_list uses. getValue() returns the
        // same comma-separated sys_id string a Reference field would for a
        // single value, so RunScanUiAction.server.js just .split(',') it.
        target_app: ListColumn({
            label: 'Target App',
            referenceTable: 'sys_app',
            attributes: { no_sort: true, slushbucket_ref_no_expand: true },
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
        // uses a string instead of HTMLColumn). Renamed from `activities`
        // to `scan_findings` (2026-07-22) — "Activities" read as the
        // native Activity stream, which this is NOT; it's the queryable
        // plain-text log.
        scan_findings: StringColumn({
            label: 'Scan Findings',
            maxLength: 8000,
        }),
        // v2: a real Journal field so scan progress also renders in the
        // native Activity formatter. This is ADDITIVE alongside
        // `scan_findings` above, not a replacement — `scan_findings` stays
        // a plain String because it must remain queryable and free of
        // journal-field ACL complications. Both are written on every
        // _appendScanFinding() call; see that method's comment.
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
        // Group A — folded into IscanAppFilesScanner's existing single
        // sys_metadata query via new CLASS_BUCKETS entries (see that
        // file). Free performance-wise: same query, more buckets.
        client_script_count: IntegerColumn({ label: 'Client Script Count', default: 0 }),
        ui_policy_count: IntegerColumn({ label: 'UI Policy Count', default: 0 }),
        scheduled_job_count: IntegerColumn({ label: 'Scheduled Job Count', default: 0 }),
        notification_count: IntegerColumn({ label: 'Notification Count', default: 0 }),
        scripted_rest_api_count: IntegerColumn({ label: 'Scripted REST API Count', default: 0 }),
        transform_map_count: IntegerColumn({ label: 'Transform Map Count', default: 0 }),
        catalog_item_count: IntegerColumn({ label: 'Catalog Item Count', default: 0 }),
        workflow_count: IntegerColumn({ label: 'Workflow Count', default: 0 }),
        subflow_count: IntegerColumn({ label: 'Subflow Count', default: 0 }),
        atf_test_count: IntegerColumn({ label: 'ATF Test Count', default: 0 }),
        report_count: IntegerColumn({ label: 'Report Count', default: 0 }),
        fix_script_count: IntegerColumn({ label: 'Fix Script Count', default: 0 }),
        processor_count: IntegerColumn({ label: 'Processor Count', default: 0 }),
        data_policy_count: IntegerColumn({ label: 'Data Policy Count', default: 0 }),
        inbound_email_action_count: IntegerColumn({ label: 'Inbound Email Action Count', default: 0 }),
        // Group B — dedicated per-app queries, gated off by default for
        // full-instance scans (see x_335329_iscan.include_extended_counts_on_full_scan
        // and IscanScanOrchestrator._scanOneApp). Zero when not run, not
        // "unknown" — a 0 for a mode/property combo that skips Group B
        // is expected, not a bug.
        catalog_variable_count: IntegerColumn({ label: 'Catalog Variable Count', default: 0 }),
        dashboard_count: IntegerColumn({ label: 'Dashboard Count', default: 0 }),
        pa_indicator_count: IntegerColumn({ label: 'PA Indicator Count', default: 0 }),
        service_portal_count: IntegerColumn({ label: 'Service Portal Count', default: 0 }),
        service_portal_widget_count: IntegerColumn({ label: 'Service Portal Widget Count', default: 0 }),
        choice_count: IntegerColumn({ label: 'Choice Count', default: 0 }),
        flow_action_count: IntegerColumn({ label: 'Flow Designer Action Count', default: 0 }),
        // Per the original v3 spec (roles/groups/system properties should
        // be counted per scope). group_count relies on sys_user_group
        // carrying a sys_scope field, which stock ServiceNow does NOT
        // provide (groups aren't scoped metadata) -- flagged low-confidence,
        // see IscanAppFilesScanner._countScopedRecords()'s field-existence
        // guard, which returns 0 rather than silently counting every row
        // when the field doesn't exist on the target instance.
        role_count: IntegerColumn({ label: 'Role Count', default: 0 }),
        group_count: IntegerColumn({ label: 'Group Count', default: 0 }),
        system_property_count: IntegerColumn({ label: 'System Property Count', default: 0 }),
        // Added alongside the itemized-report extension: Scripted REST
        // resources (sys_ws_operation, child of scripted_rest_api_count's
        // sys_ws_definition rows), SLA definitions, UI pages, and Service
        // Portal pages (distinct from service_portal_count, which is the
        // sp_portal container record itself).
        scripted_rest_resource_count: IntegerColumn({ label: 'Scripted REST Resource Count', default: 0 }),
        sla_definition_count: IntegerColumn({ label: 'SLA Definition Count', default: 0 }),
        ui_page_count: IntegerColumn({ label: 'UI Page Count', default: 0 }),
        service_portal_page_count: IntegerColumn({ label: 'Service Portal Page Count', default: 0 }),
        // Events and import sets — from the original v3 "count everything"
        // list, added later than the rest of Counting. Table names
        // (sysevent_register, sys_import_set_source) are low-confidence,
        // see IscanAppFilesScanner.scanApp()'s comment.
        event_count: IntegerColumn({ label: 'Event Count', default: 0 }),
        import_set_count: IntegerColumn({ label: 'Import Set Count', default: 0 }),
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
        // Dictionary override: a field on this table whose OWN sys_scope
        // differs from this table's owning scope — i.e. another app
        // added a field to a table it doesn't own. See
        // IscanTableScanner.profileTable()/_getAppAddedFields().
        dictionary_override_count: IntegerColumn({ label: 'Dictionary Override Count', default: 0 }),
        dictionary_override_list: StringColumn({
            label: 'Dictionary Override List',
            maxLength: 4000,
        }),
        // Inbound reference: a field on ANY table elsewhere in the
        // instance whose `reference` points AT this table — i.e. who
        // depends on me. Whole-instance search, not limited to apps in
        // the current scan run. See IscanTableScanner.findInboundReferences().
        inbound_reference_count: IntegerColumn({ label: 'Inbound Reference Count', default: 0 }),
        inbound_reference_list: StringColumn({
            label: 'Inbound Reference List',
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

// Base-system (global/OOB) table that a customer scope has customized —
// custom fields and/or config artifacts (business rules, client scripts,
// UI policies, ACLs) targeting a table this app doesn't own. Distinct
// from x_335329_iscan_table, which profiles tables OWNED by a scanned
// app. Two distinct write paths feed this table, so it gets rows in
// EVERY scan mode, not just one:
//   - Per-app (result set): IscanTableScanner.findAppCustomizationsOnGlobalTables()
//     runs for every app in every mode (custom_only, manual, full's
//     per-app branch, single_table's owning-app branch) — did THIS app
//     customize a base-system table it doesn't own?
//   - Per-table (result blank): IscanTableScanner.findGlobalCustomizations()
//     runs for the table-only fallback path (full mode's tableOnlyTables,
//     single_table's no-owning-app case) — what customizations (from ANY
//     scope) exist on THIS specific OOB table being profiled directly?
export const x_335329_iscan_global_customization = Table({
    name: 'x_335329_iscan_global_customization',
    label: 'Instance Scan Global Customization',
    display: 'table_name',
    schema: {
        run: ReferenceColumn({
            label: 'Run',
            referenceTable: 'x_335329_iscan_run',
            mandatory: true,
        }),
        // Blank for the per-table fallback path (no result record exists
        // there) — set for the per-app path so the Result report can
        // scope this app's own findings. Blank is expected, not a bug —
        // same precedent as referencing_app on x_335329_iscan_crossref.
        result: ReferenceColumn({
            label: 'Result',
            referenceTable: 'x_335329_iscan_result',
        }),
        table_name: StringColumn({ label: 'Table Name', maxLength: 80 }),
        custom_field_count: IntegerColumn({ label: 'Custom Field Count', default: 0 }),
        custom_field_list: StringColumn({
            label: 'Custom Field List',
            maxLength: 4000,
        }),
        custom_artifact_count: IntegerColumn({ label: 'Custom Artifact Count', default: 0 }),
        custom_artifact_list: StringColumn({
            label: 'Custom Artifact List',
            maxLength: 4000,
        }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'run',
        },
    ],
})

// One row per installed plugin/module (sys_plugins), written only by
// 'modules' scan mode. Instance-wide — no owning app, so this is keyed
// directly off `run` (no `result`), same precedent as
// x_335329_iscan_global_customization's no-owning-app rows.
export const x_335329_iscan_module = Table({
    name: 'x_335329_iscan_module',
    label: 'Instance Scan Module',
    display: 'name',
    schema: {
        run: ReferenceColumn({
            label: 'Run',
            referenceTable: 'x_335329_iscan_run',
            mandatory: true,
        }),
        name: StringColumn({ label: 'Name', maxLength: 200 }),
        plugin_id: StringColumn({ label: 'Plugin ID', maxLength: 200 }),
        // sys_plugins' own stored active flag.
        active_flag: BooleanColumn({ label: 'Active (sys_plugins)', default: false }),
        // Live GlidePluginManager().isActive() result — cross-checked
        // rather than trusting sys_plugins.active alone (can go stale
        // mid-activation or on a stale cache).
        active_confirmed: BooleanColumn({ label: 'Active (Confirmed)', default: false }),
        status_mismatch: BooleanColumn({ label: 'Status Mismatch', default: false }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'run',
        },
    ],
})

// One row per AI agent/tool/credential finding, written only by
// 'ai_agents' scan mode. Instance-wide — no owning app, same run-keyed
// (no `result`) precedent as x_335329_iscan_module above. See
// IscanAiAgentScanner for the 5 detection layers this feeds from.
export const x_335329_iscan_ai_agent = Table({
    name: 'x_335329_iscan_ai_agent',
    label: 'Instance Scan AI Agent Finding',
    display: 'name',
    schema: {
        run: ReferenceColumn({
            label: 'Run',
            referenceTable: 'x_335329_iscan_run',
            mandatory: true,
        }),
        layer: ChoiceColumn({
            label: 'Layer',
            dropdown: 'dropdown_without_none',
            choices: {
                native_platform: { label: 'Native Platform (AI Agent Studio)', sequence: 0 },
                custom_shadow: { label: 'Custom / Shadow Integration', sequence: 1 },
                flow_designer: { label: 'Flow Designer', sequence: 2 },
                credential: { label: 'Credential / Configuration', sequence: 3 },
            },
        }),
        name: StringColumn({ label: 'Name', maxLength: 200 }),
        detail: StringColumn({ label: 'Detail', maxLength: 1000 }),
        source_table: StringColumn({ label: 'Source Table', maxLength: 80 }),
        confidence: ChoiceColumn({
            label: 'Confidence',
            dropdown: 'dropdown_without_none',
            choices: {
                confirmed: { label: 'Confirmed', sequence: 0 },
                needs_review: { label: 'Needs Review', sequence: 1 },
            },
        }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'run',
        },
    ],
})

export const x_335329_iscan_crossref = Table({
    name: 'x_335329_iscan_crossref',
    label: 'Instance Scan Cross-Reference',
    display: 'referencing_table',
    schema: {
        table: ReferenceColumn({
            label: 'Table',
            referenceTable: 'x_335329_iscan_table',
            mandatory: true,
        }),
        referencing_table: StringColumn({ label: 'Referencing Table', maxLength: 80 }),
        referencing_field: StringColumn({ label: 'Referencing Field', maxLength: 80 }),
        // Blank when the referencing table's owning scope has no sys_app
        // record (global/OOB referencing tables) — a blank reference
        // here is expected, not a bug, same precedent as Counting's
        // Group B zero-counts.
        referencing_app: ReferenceColumn({
            label: 'Referencing App',
            referenceTable: 'sys_app',
        }),
        referencing_scope: StringColumn({ label: 'Referencing Scope', maxLength: 32 }),
    },
    index: [
        {
            name: 'index',
            unique: false,
            element: 'table',
        },
    ],
})
