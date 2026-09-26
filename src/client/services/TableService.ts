// Paged/sorted reads for RecordTable, our own replacement for
// NowRecordListConnected (see that component for why). Same conventions as
// every other service here: X-UserToken from window.g_ck,
// sysparm_display_value=all so utils/fields' display()/value() apply.
//
// Unlike NowRecordListConnected -- which the docs confirm has no query/order
// prop at all -- the raw Table API supports both, so this is a strict
// capability upgrade for a read-only console, not just a reimplementation.
const headers = { Accept: 'application/json', 'X-UserToken': (window as any).g_ck }

export interface TablePage {
    rows: Record<string, any>[]
    // Table API only reports a total when the instance doesn't suppress the
    // count header. Null means "unknown" -- render range-only paging, never
    // a fabricated total.
    total: number | null
}

export async function fetchTablePage(
    table: string,
    fields: string[],
    limit: number,
    offset: number,
    orderBy?: string,
    orderDesc?: boolean
): Promise<TablePage> {
    const search = new URLSearchParams({
        sysparm_display_value: 'all',
        sysparm_fields: ['sys_id', ...fields].join(','),
        sysparm_limit: String(limit),
        sysparm_offset: String(offset),
    })
    if (orderBy) search.set('sysparm_query', `${orderDesc ? 'ORDERBYDESC' : 'ORDERBY'}${orderBy}`)

    const response = await fetch(`/api/now/table/${table}?${search}`, { headers })
    if (!response.ok) {
        throw new Error(`Could not load ${table} (HTTP ${response.status})`)
    }
    const totalHeader = response.headers.get('X-Total-Count')
    const { result } = await response.json()
    return {
        rows: Array.isArray(result) ? result : [],
        total: totalHeader !== null ? Number(totalHeader) : null,
    }
}

/* One record, every readable field. Backs RecordFields (our replacement for
   RecordProvider + FormColumnLayout) -- no sysparm_fields, because a detail
   view wants whatever the row actually has rather than a fixed column list. */
export async function fetchRecord(table: string, sysId: string): Promise<Record<string, any>> {
    const search = new URLSearchParams({ sysparm_display_value: 'all' })
    const response = await fetch(`/api/now/table/${table}/${sysId}?${search}`, { headers })
    if (!response.ok) {
        throw new Error(`Could not load this ${table} record (HTTP ${response.status})`)
    }
    const { result } = await response.json()
    return result
}
