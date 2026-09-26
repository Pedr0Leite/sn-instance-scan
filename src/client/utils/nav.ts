// URLSearchParams routing + Polaris iframe awareness. Every view has a URL so
// browser back/forward and Polaris deep links both work.
export interface ViewState {
    view: string
    recordId: string | null
    table: string | null
    // Dashboard-only: which x_nold_iscan_result is shown below the roll-up
    // tiles. It lives in the URL for the same reason every other bit of view
    // state does -- so the chosen result is linkable and back/forward works.
    resultId: string | null
}

export function getViewFromUrl(): ViewState {
    const params = new URLSearchParams(window.location.search)
    return {
        view: params.get('view') || 'dashboard',
        recordId: params.get('id') || null,
        table: params.get('table') || null,
        resultId: params.get('result') || null,
    }
}

export function setPageTitle(title: string, relativePath?: string): void {
    const path = relativePath || window.location.pathname + window.location.search
    if (window.self !== window.top) {
        ;(window as any).CustomEvent.fireTop('magellanNavigator.permalink.set', {
            relativePath: path,
            title,
        })
    }
    document.title = title
}

export function buildPath(
    view: string,
    recordId?: string | null,
    table?: string | null,
    resultId?: string | null
): string {
    const params = new URLSearchParams({ view })
    if (recordId) params.set('id', recordId)
    if (table) params.set('table', table)
    if (resultId) params.set('result', resultId)
    return `${window.location.pathname}?${params}`
}
