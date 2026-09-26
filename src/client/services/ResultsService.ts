// Reads for the dashboard's per-result panel. Same conventions as
// MetricsService: X-UserToken from window.g_ck, sysparm_display_value=all, so
// reference/choice fields arrive as {value, display_value} for utils/fields.
// NowRecordListConnected covers record LISTS; one record's 41 count fields is a
// detail read no list component exposes, hence a direct Table API call.
import { display, value } from '../utils/fields'

const headers = { Accept: 'application/json', 'X-UserToken': (window as any).g_ck }

async function tableApi(path: string, params: Record<string, string>): Promise<any> {
    const search = new URLSearchParams({ sysparm_display_value: 'all', ...params })
    const response = await fetch(`/api/now/table/${path}?${search}`, { headers })
    if (!response.ok) throw new Error(`Scan result request failed (HTTP ${response.status})`)
    const { result } = await response.json()
    return result
}

export interface ResultOption {
    sysId: string
    label: string
}

export async function listResults(): Promise<ResultOption[]> {
    const rows: any[] = await tableApi('x_nold_iscan_result', {
        sysparm_fields: 'sys_id,app,scan_date',
        sysparm_query: 'ORDERBYDESCscan_date',
        sysparm_limit: '100',
    })
    return rows.map(row => ({
        sysId: value(row.sys_id),
        label: `${display(row.app) || '(unknown app)'} — ${display(row.scan_date)}`,
    }))
}

export async function getResult(sysId: string): Promise<Record<string, any>> {
    return await tableApi(`x_nold_iscan_result/${encodeURIComponent(sysId)}`, {})
}
