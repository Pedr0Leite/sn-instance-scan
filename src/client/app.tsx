import React, { useCallback, useEffect, useState } from 'react'
import { ToastProvider } from './utils/toast'
import SideNav from './components/SideNav'
import { Crumbs, PageTitle } from './components/ui'
import Dashboard from './components/Dashboard'
import RecordTable from './components/RecordTable'
import RecordDetail from './components/RecordDetail'
import ScanLauncher from './components/ScanLauncher'
import { buildPath, getViewFromUrl, setPageTitle, ViewState } from './utils/nav'
import { runStatusSeverity } from './utils/severity'

const RUN_COLUMNS = ['scan_mode', 'status', 'requested_by', 'started', 'completed', 'app_count']
const RESULT_COLUMNS = [
    'app',
    'run',
    'scan_mode_used',
    'table_count',
    'business_rule_count',
    'acl_count',
]
// x_nold_iscan_crossref: one row per referencing field found instance-wide
// against a table this app owns (see IscanTableScanner.findInboundReferences).
const CROSSREF_COLUMNS = [
    'table',
    'referencing_table',
    'referencing_field',
    'referencing_app',
    'referencing_scope',
]
// x_nold_iscan_global_customization: base-system tables a scope has
// customized -- written per-app AND per-table; `result` is blank for the
// per-table fallback path (expected, not a bug -- see tables.now.ts).
const CUSTOMIZATION_COLUMNS = ['table_name', 'custom_field_count', 'custom_artifact_count', 'run', 'result']

const TITLES: Record<string, string> = {
    dashboard: 'Instance Scan Console',
    runs: 'Instance Scan Console - Scan Runs',
    results: 'Instance Scan Console - Scan Results',
    crossrefs: 'Instance Scan Console - Cross-References',
    customizations: 'Instance Scan Console - Customizations',
    detail: 'Instance Scan Console - Record',
}

// Drives the header's breadcrumb + subtitle so the frame itself says which
// section is active, on top of SideNav's own active-item styling.
const VIEW_META: Record<string, { label: string; description: string }> = {
    dashboard: {
        label: 'Dashboard',
        description: 'Instance-wide scan metrics, plus one application result at a time.',
    },
    runs: {
        label: 'Scan Runs',
        description: 'Launch a scan and review every run that has been started.',
    },
    results: {
        label: 'Scan Results',
        description: 'Per-application artifact counts from completed scans.',
    },
    crossrefs: {
        label: 'Cross-References',
        description: 'Every field, anywhere in the instance, that points back at a table this app owns.',
    },
    customizations: {
        label: 'Customizations',
        description:
            'Base-system tables a scope has customized — fields and config artifacts added to a table it does not own.',
    },
    detail: {
        label: 'Record',
        description: 'Read-only view of a single scan record.',
    },
}

function AppShell() {
    const [state, setState] = useState<ViewState>(getViewFromUrl)

    useEffect(() => {
        const onPopState = () => setState(getViewFromUrl())
        window.addEventListener('popstate', onPopState)
        return () => window.removeEventListener('popstate', onPopState)
    }, [])

    const navigate = useCallback(
        (view: string, recordId?: string | null, table?: string | null, resultId?: string | null) => {
            const path = buildPath(view, recordId, table, resultId)
            window.history.pushState({ view, recordId, table, resultId }, '', path)
            setPageTitle(TITLES[view] || TITLES.dashboard, path)
            setState({
                view,
                recordId: recordId || null,
                table: table || null,
                resultId: resultId || null,
            })
        },
        []
    )

    useEffect(() => {
        setPageTitle(TITLES[state.view] || TITLES.dashboard)
    }, [state.view])

    const openRecord = useCallback(
        (table: string, sysId: string) => navigate('detail', sysId, table),
        [navigate]
    )
    // Creating a run from a list's New button stays on the platform form, which
    // carries the Run Scan UI Action. The Scan Runs tab's launcher is the
    // one-click path (see ScanLauncher); this console still never writes.
    const newRun = useCallback(() => {
        window.location.href = '/x_nold_iscan_run.do?sys_id=-1'
    }, [])

    const meta = VIEW_META[state.view] || VIEW_META.dashboard

    return (
        <div className="iscan-shell">
            {/* The design puts the title straight on the page -- breadcrumb above
                it, description right-aligned beside it -- not inside a card. */}
            <header className="iscan-header">
                <div>
                    <Crumbs current={meta.label} />
                    <PageTitle>Instance Scan Console</PageTitle>
                </div>
                <p className="iscan-header__subtitle">{meta.description}</p>
            </header>
            <SideNav current={state.view} onNavigate={navigate} />
            <main className="iscan-main">
                {state.view === 'dashboard' && (
                    <Dashboard
                        onOpenRecord={openRecord}
                        onNewRun={newRun}
                        resultId={state.resultId}
                        onSelectResult={sysId => navigate('dashboard', null, null, sysId)}
                        onNavigateView={view => navigate(view)}
                    />
                )}
                {state.view === 'runs' && (
                    <>
                        <ScanLauncher
                            onRunStarted={sysId => openRecord('x_nold_iscan_run', sysId)}
                        />
                        <RecordTable
                            ariaLabel="Scan runs"
                            table="x_nold_iscan_run"
                            listTitle="Scan runs"
                            columns={RUN_COLUMNS}
                            statusField="status"
                            statusSeverity={runStatusSeverity}
                            onOpen={openRecord}
                            onNew={newRun}
                        />
                    </>
                )}
                {state.view === 'results' && (
                    <RecordTable
                        ariaLabel="Scan results"
                        table="x_nold_iscan_result"
                        listTitle="Scan results"
                        columns={RESULT_COLUMNS}
                        onOpen={openRecord}
                        onNew={newRun}
                        expandable
                        help="Click a row to open its detail strip, then open the record page from there if you need it. One row per application scanned — Installed Modules and AI Agent Discovery runs write no rows here, their findings hang off the run record itself, as do Manual — Single Table runs on a table with no owning application. An empty list below usually means one of those modes, not a broken scan."
                    />
                )}
                {state.view === 'crossrefs' && (
                    <RecordTable
                        ariaLabel="Cross-references"
                        table="x_nold_iscan_crossref"
                        listTitle="Cross-references"
                        columns={CROSSREF_COLUMNS}
                        onOpen={openRecord}
                        preview
                    >
                        <p className="iscan-hint">
                            One row per field, anywhere in the instance, whose reference points back at a
                            table this app scanned. A blank Referencing App means the referencing table
                            has no owning application (global or an out-of-box scope) — expected, not a
                            gap.
                        </p>
                    </RecordTable>
                )}
                {state.view === 'customizations' && (
                    <RecordTable
                        ariaLabel="Customizations"
                        table="x_nold_iscan_global_customization"
                        listTitle="Customizations on base-system tables"
                        columns={CUSTOMIZATION_COLUMNS}
                        onOpen={openRecord}
                        preview
                    >
                        <p className="iscan-hint">
                            Base-system tables a scope has customized — a blank Result means this row
                            came from a table-only scan rather than an app scan.
                        </p>
                    </RecordTable>
                )}
                {state.view === 'detail' && (
                    <RecordDetail
                        table={state.table || 'x_nold_iscan_run'}
                        sysId={state.recordId || ''}
                        onBack={() =>
                            navigate(
                                state.table === 'x_nold_iscan_result'
                                    ? 'results'
                                    : state.table === 'x_nold_iscan_crossref'
                                    ? 'crossrefs'
                                    : state.table === 'x_nold_iscan_global_customization'
                                    ? 'customizations'
                                    : 'runs'
                            )
                        }
                    />
                )}
            </main>
        </div>
    )
}

// NotificationsProvider wraps the whole shell so any view -- ScanLauncher's
// scan start/failure today, any future write-adjacent action later -- shares
// one toast layer instead of each panel inventing its own local Alert. Per
// Notifications.md's "unified notification area" pattern, RecordDetail's and
// RecordPreviewModal's read-only RecordProvider instances detect this parent
// provider and reuse it rather than creating their own.
export default function App() {
    return (
        <ToastProvider>
            <AppShell />
        </ToastProvider>
    )
}
