import React, { useEffect, useState } from 'react'
import { GroupLabel, Note, SectionTitle, Spinner } from './ui'
import MetricTile from './MetricTile'
import RecordTable from './RecordTable'
import ResultDashboard from './ResultDashboard'
import { loadMetrics, Metrics } from '../services/MetricsService'
import { runStatusSeverity } from '../utils/severity'
import { SEVERITY_LABELS } from '../utils/tokens'

const RUN_COLUMNS = ['scan_mode', 'status', 'requested_by', 'started', 'completed', 'app_count']

// Console v7: every KPI tile below links to the platform list of the EXACT
// table/query it counts, opened in a new tab -- derived one-to-one from
// MetricsService's own queries (read that file, don't guess). Centralized
// here as one helper rather than a query string typed out at each tile, so
// the table name and the query can't quietly drift apart.
const tileHref = (table: string, query?: string) =>
    `/${table}_list.do${query ? `?sysparm_query=${encodeURIComponent(query)}` : ''}`

interface DashboardProps {
    onOpenRecord: (table: string, sysId: string) => void
    resultId: string | null
    onSelectResult: (sysId: string) => void
}

export default function Dashboard({ onOpenRecord, resultId, onSelectResult }: DashboardProps) {
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
                    <MetricTile
                        label="Scan runs"
                        count={metrics.runs}
                        size="xl"
                        href={tileHref('x_nold_iscan_run')}
                    />
                    <MetricTile
                        label="Runs complete"
                        count={status.complete || 0}
                        severity="positive"
                        severityLabel={SEVERITY_LABELS.positive}
                        size="xl"
                        proportion={proportionOf(status.complete || 0)}
                        href={tileHref('x_nold_iscan_run', 'status=complete')}
                    />
                    <MetricTile
                        label="Runs in flight"
                        count={(status.running || 0) + (status.pending || 0)}
                        severity="info"
                        severityLabel={SEVERITY_LABELS.info}
                        size="xl"
                        proportion={proportionOf((status.running || 0) + (status.pending || 0))}
                        href={tileHref('x_nold_iscan_run', 'status=pending^ORstatus=running')}
                    />
                    <MetricTile
                        label="Runs errored"
                        count={status.error || 0}
                        severity="critical"
                        severityLabel={SEVERITY_LABELS.critical}
                        size="xl"
                        proportion={proportionOf(status.error || 0)}
                        href={tileHref('x_nold_iscan_run', 'status=error')}
                    />
                </ul>

                <GroupLabel>Coverage &amp; findings</GroupLabel>
                <ul className="iscan-tiles">
                    <MetricTile
                        label="Apps scanned"
                        count={metrics.results}
                        href={tileHref('x_nold_iscan_result')}
                    />
                    <MetricTile
                        label="Tables profiled"
                        count={metrics.tables}
                        href={tileHref('x_nold_iscan_table')}
                    />
                    <MetricTile
                        label="Installed modules found"
                        count={metrics.modules}
                        href={tileHref('x_nold_iscan_module')}
                    />
                    <MetricTile
                        label="AI agent findings"
                        count={metrics.aiAgents}
                        href={tileHref('x_nold_iscan_ai_agent')}
                    />
                    <MetricTile
                        label="Inbound cross-references"
                        count={metrics.crossrefs}
                        href={tileHref('x_nold_iscan_crossref')}
                    />
                    <MetricTile
                        label="Base-table customizations"
                        count={metrics.customizations}
                        severity={metrics.customizations > 0 ? 'warning' : undefined}
                        severityLabel={SEVERITY_LABELS.warning}
                        href={tileHref('x_nold_iscan_global_customization')}
                    />
                </ul>
            </section>
            {/* The design's bottom half: a result-detail column beside the
                recent-runs list. Narrow until a result is picked, then the two
                share the width evenly -- the detail card (LLM context especially)
                needs real room, not a 340px sliver. See app.css's
                .iscan-dash-split--wide. */}
            <div className={resultId ? 'iscan-dash-split iscan-dash-split--wide' : 'iscan-dash-split'}>
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
                />
            </div>
        </>
    )
}
