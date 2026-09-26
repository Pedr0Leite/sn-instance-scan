import { List, default_view } from '@servicenow/sdk/core'

List({
    table: 'x_nold_iscan_run',
    view: default_view,
    columns: ['app_count', 'completed', 'manual_app_list', 'requested_by', 'scan_mode', 'started', 'status'],
})
