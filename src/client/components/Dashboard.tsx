import React, { useEffect, useState } from 'react'
import { GroupLabel, Note, SectionTitle, Spinner } from './ui'
import MetricTile from './MetricTile'
import RecordTable from './RecordTable'
import ResultDashboard from './ResultDashboard'
import { loadMetrics, Metrics } from '../services/MetricsService'
import { runStatusSeverity } from '../utils/severity'
import { SEVERITY_LABELS } from '../utils/tokens'

const RUN_COLUMNS = ['scan_mode', 'status', 'requested_by', 'started', 'completed', 'app_count']

interface DashboardProps {
    onOpenRecord: (table: string, sysId: string) => void
    onNewRun: () => void
    resultId: string | null
    onSelectResult: (sysId: string) => void
    // Lets the two governance-signal tiles (cross-references, base-table
    // customizations) jump straight to their dedicated list views instead of
    // just reporting a count nobody can act on.
    onNavigateView?: (view: string) => void
}

export default function Dashboard({
    onOpenRecord,
    onNewRun,
    resultId,
    onSelectResult,
    onNavigateView,
}: DashboardProps) {
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        loadMetrics().then(setMetrics, e => setError(e.message))
    }, [])

    if (error) {
        return (
            <Note tone="critical" title="Could not load scan metrics">
                {error}
            </Note>
        )
    }
    if (!metrics) {
        return <Spinner label="Loading scan metrics" />
    }

    const status = metrics.byStatus
    // Proportion bars for the 4 run-activity tiles -- each tile's own share of
    // ALL runs, the one total this dashboard already has. Guarded against 0
    // runs so a fresh instance shows no bar rather than a NaN-driven one.
    const proportionOf = (count: number) => (metrics.runs > 0 ? count / metrics.runs : undefined)
    return (
        <>
            <section aria-labelledby="iscan-metrics-heading">
                <SectionTitle id="iscan-metrics-heading">Scan state</SectionTitle>

                {/* Grouped, like ResultSummary's per-category tiles, so the row of 10
                    numbers reads as "how scanning is going" then "what it found" rather
                    than one undifferentiated strip. */}
                <GroupLabel>Run activity</GroupLabel>
                <ul className="iscan-tiles">
                    <MetricTile label="Scan runs" count={metrics.runs} size="xl" />
                    <MetricTile
                        label="Runs complete"
                        count={status.complete || 0}
                        severity="positive"
                        severityLabel={SEVERITY_LABELS.positive}
                        size="xl"
                        proportion={proportionOf(status.complete || 0)}
                    />
                    <MetricTile
                        label="Runs in flight"
                        count={(status.running || 0) + (status.pending || 0)}
                        severity="info"
                        severityLabel={SEVERITY_LABELS.info}
                        size="xl"
                        proportion={proportionOf((status.running || 0) + (status.pending || 0))}
                    />
                    <MetricTile
                        label="Runs errored"
                        count={status.error || 0}
                        severity="critical"
                        severityLabel={SEVERITY_LABELS.critical}
                        size="xl"
                        proportion={proportionOf(status.error || 0)}
                    />
                </ul>

                <GroupLabel>Coverage &amp; findings</GroupLabel>
                <ul className="iscan-tiles">
                    <MetricTile label="Apps scanned" count={metrics.results} />
                    <MetricTile label="Tables profiled" count={metrics.tables} />
                    <MetricTile label="Installed modules found" count={metrics.modules} />
                    <MetricTile label="AI agent findings" count={metrics.aiAgents} />
                    <MetricTile
                        label="Inbound cross-references"
                        count={metrics.crossrefs}
                        onActivate={onNavigateView ? () => onNavigateView('crossrefs') : undefined}
                    />
                    <MetricTile
                        label="Base-table customizations"
                        count={metrics.customizations}
                        severity={metrics.customizations > 0 ? 'warning' : undefined}
                        severityLabel={SEVERITY_LABELS.warning}
                        onActivate={onNavigateView ? () => onNavigateView('customizations') : undefined}
                    />
                </ul>
            </section>
            {/* The design's bottom half: a narrow result-detail column beside the
                recent-runs list, not two stacked full-width panels. */}
            <div className="iscan-dash-split">
                <ResultDashboard resultId={resultId} onSelect={onSelectResult} />
                <RecordTable
                    ariaLabel="Recent scan runs"
                    table="x_nold_iscan_run"
                    listTitle="Recent scan runs"
                    columns={RUN_COLUMNS}
                    statusField="status"
                    statusSeverity={runStatusSeverity}
                    pageSize={10}
                    onOpen={onOpenRecord}
                    onNew={onNewRun}
                />
            </div>
        </>
    )
}
