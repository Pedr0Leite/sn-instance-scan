// Groups x_nold_iscan_result's ~41 *_count fields for ResultSummary. A flat
// list sorted purely by count reads as noise once several are non-zero --
// unrelated artifact types side by side. Grouping by what an admin actually
// reasons about (data model vs. automation vs. security, ...) makes a busy
// result scannable. Membership, not a per-field label map -- a field this
// list forgets about still renders, just under "Other", never dropped.
const CATEGORIES: [string, string[]][] = [
    ['Data model', ['table_count', 'custom_field_count']],
    [
        'Automation',
        [
            'business_rule_count',
            'script_include_count',
            'client_script_count',
            'ui_policy_count',
            'ui_action_count',
            'scheduled_job_count',
            'fix_script_count',
            'processor_count',
            'data_policy_count',
            'inbound_email_action_count',
            'event_count',
        ],
    ],
    ['Flow & process', ['flow_count', 'subflow_count', 'flow_action_count', 'workflow_count']],
    [
        'Integration',
        [
            'integration_count',
            'scripted_rest_api_count',
            'scripted_rest_resource_count',
            'transform_map_count',
            'import_set_count',
        ],
    ],
    [
        'Catalog & portal',
        [
            'catalog_item_count',
            'catalog_variable_count',
            'service_portal_count',
            'service_portal_widget_count',
            'service_portal_page_count',
            'ui_page_count',
        ],
    ],
    ['Security & access', ['acl_count', 'role_count', 'group_count']],
    ['Reporting & analytics', ['report_count', 'dashboard_count', 'pa_indicator_count']],
    [
        'Testing & configuration',
        [
            'atf_test_count',
            'notification_count',
            'system_property_count',
            'choice_count',
            'sla_definition_count',
        ],
    ],
]

const CATEGORY_OF: Record<string, string> = Object.fromEntries(
    CATEGORIES.flatMap(([category, fields]) => fields.map(field => [field, category]))
)

export const categoryFor = (field: string): string => CATEGORY_OF[field] || 'Other'
export const CATEGORY_ORDER: string[] = [...CATEGORIES.map(([category]) => category), 'Other']
