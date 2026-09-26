// Aggregate counts for the dashboard tiles. NowRecordListConnected covers every
// record listing; only these roll-up numbers need a direct call, so they live
// here rather than in components.
const headers = { Accept: 'application/json', 'X-UserToken': (window as any).g_ck }

async function stats(table: string, params: Record<string, string>): Promise<any[]> {
    const search = new URLSearchParams({
        sysparm_count: 'true',
        sysparm_display_value: 'all',
        ...params,
    })
    const response = await fetch(`/api/now/stats/${table}?${search}`, { headers })
    if (!response.ok) throw new Error(`Count failed for ${table}: ${response.status}`)
    const { result } = await response.json()
    return Array.isArray(result) ? result : [result]
}

async function total(table: string): Promise<number> {
    const [row] = await stats(table, {})
    return Number(row?.stats?.count || 0)
}

async function countByStatus(): Promise<Record<string, number>> {
    const rows = await stats('x_nold_iscan_run', { sysparm_group_by: 'status' })
    const byStatus: Record<string, number> = {}
    for (const row of rows) {
        const field = (row?.groupby_fields || [])[0]
        if (field) byStatus[field.value] = Number(row?.stats?.count || 0)
    }
    return byStatus
}

export interface Metrics {
    runs: number
    byStatus: Record<string, number>
    results: number
    tables: number
    modules: number
    aiAgents: number
    crossrefs: number
    customizations: number
}

export async function loadMetrics(): Promise<Metrics> {
    const [runs, byStatus, results, tables, modules, aiAgents, crossrefs, customizations] =
        await Promise.all([
            total('x_nold_iscan_run'),
            countByStatus(),
            total('x_nold_iscan_result'),
            total('x_nold_iscan_table'),
            total('x_nold_iscan_module'),
            total('x_nold_iscan_ai_agent'),
            total('x_nold_iscan_crossref'),
            total('x_nold_iscan_global_customization'),
        ])
    return { runs, byStatus, results, tables, modules, aiAgents, crossrefs, customizations }
}
