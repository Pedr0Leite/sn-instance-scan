import '@servicenow/sdk/global'
import { UiPage } from '@servicenow/sdk/core'
import page from '../../client/index.html'

// React 18 SPA console for reviewing scan output. Endpoint must start with the
// scope prefix; `direct: true` is required so the platform serves the built
// HTML verbatim instead of wrapping it in the classic UI Page chrome.
export const iscanConsolePage = UiPage({
    $id: Now.ID['iscan_console_page'],
    endpoint: 'x_nold_iscan_console.do',
    description: 'Instance Scan Console — dashboard, scan runs, scan results, and record detail.',
    html: page,
    direct: true,
})
