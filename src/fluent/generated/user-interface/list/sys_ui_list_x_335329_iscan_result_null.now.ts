import { List, default_view } from '@servicenow/sdk/core'

List({
    table: 'x_nold_iscan_result',
    view: default_view,
    columns: [
        'acl_count',
        'app',
        'business_rule_count',
        'flow_count',
        'integration_count',
        'run',
        'scan_date',
        'scan_mode_used',
        'script_include_count',
        'summary_text',
    ],
})
