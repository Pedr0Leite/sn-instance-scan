import type { Severity } from './tokens'

// Maps x_nold_iscan_run.status raw choice values to Horizon severity
// naming (positive/critical/warning/info -- never success/error). Shared by
// every RecordTable that shows the run status column, so the mapping can't
// drift between the Scan Runs list and the Dashboard's recent-runs list.
export function runStatusSeverity(raw: string): Severity | undefined {
    if (raw === 'complete') return 'positive'
    if (raw === 'error') return 'critical'
    if (raw === 'running' || raw === 'pending') return 'info'
    return undefined
}
