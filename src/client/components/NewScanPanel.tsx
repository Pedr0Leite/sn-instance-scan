import React, { useEffect, useState } from 'react'
import Dialog from './Dialog'
import { ActionButton, Note, TextAction } from './ui'
import { useToast } from '../utils/toast'
import { startScan } from '../services/ScanService'
import { searchRecords } from '../services/TableService'
import { display, value } from '../utils/fields'

/* Labels/descriptions are this app's own wording, not copied from anywhere in
   the schema -- unlike ScanLauncher's ONE_CLICK array, which quotes the
   scan_mode ChoiceColumn verbatim, these are one-line explanations for a
   picker UI. `background` mirrors ScanLauncher's own note: the SERVER decides
   sync vs. queued (IscanScanOrchestrator.ASYNC_MODES) and rejects a non-admin
   with 403 -- this label only sets expectations honestly. */
const MODES: { mode: string; label: string; desc: string; background?: boolean }[] = [
    { mode: 'full', label: 'Full', desc: 'Every app and table in the instance.', background: true },
    { mode: 'custom_only', label: 'Custom Only', desc: 'Every customer-scoped application.' },
    { mode: 'manual', label: 'Manual — App', desc: 'Pick one or more applications.' },
    { mode: 'single_table', label: 'Manual — Single Table', desc: 'Pick one table to profile.' },
    { mode: 'modules', label: 'Installed Modules', desc: 'Instance-wide plugin audit.' },
    { mode: 'ai_agents', label: 'AI Agent Discovery', desc: 'Instance-wide 5-layer agent sweep.' },
    { mode: 'cmdb_health', label: 'CMDB & CSDM Health', desc: '49-check CMDB/CSDM scorecard.', background: true },
]

interface AppRow {
    sys_id: string
    name: string
    scope: string
}
interface TableRow {
    sys_id: string
    name: string
    label: string
}

/* Debounced typeahead over sys_app (Manual mode) or sys_db_object (Single
   Table mode) -- the two pickers that already exist on the platform form,
   rebuilt here only far enough to pick a target without leaving the page. */
function useSearch<T>(table: string, fields: string[], likeFields: string[], mapRow: (r: any) => T) {
    const [term, setTerm] = useState('')
    const [results, setResults] = useState<T[]>([])
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!term.trim()) {
            setResults([])
            return
        }
        setBusy(true)
        const handle = setTimeout(() => {
            searchRecords(table, fields, likeFields, term).then(
                rows => {
                    setBusy(false)
                    setResults(rows.map(mapRow))
                },
                () => {
                    setBusy(false)
                    setResults([])
                }
            )
        }, 250)
        return () => clearTimeout(handle)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term])

    return { term, setTerm, results, busy }
}

interface NewScanPanelProps {
    onClose: () => void
    onRunStarted: (sysId: string) => void
}

export default function NewScanPanel({ onClose, onRunStarted }: NewScanPanelProps) {
    const [mode, setMode] = useState('custom_only')
    const [selectedApps, setSelectedApps] = useState<AppRow[]>([])
    const [selectedTable, setSelectedTable] = useState<TableRow | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const { push } = useToast()

    const appSearch = useSearch<AppRow>(
        'sys_app',
        ['name', 'scope'],
        ['name'],
        r => ({ sys_id: value(r.sys_id), name: display(r.name), scope: display(r.scope) })
    )
    const tableSearch = useSearch<TableRow>(
        'sys_db_object',
        ['name', 'label'],
        ['name', 'label'],
        r => ({ sys_id: value(r.sys_id), name: display(r.name), label: display(r.label) })
    )

    const active = MODES.find(m => m.mode === mode)
    // Mirrors the server's own validation (IscanRunScanApi.server.js) so a bad
    // request never reaches the network -- the server still re-checks this.
    const clientError =
        mode === 'manual' && selectedApps.length === 0
            ? 'Pick at least one application.'
            : mode === 'single_table' && !selectedTable
              ? 'Pick a table.'
              : ''

    const submit = () => {
        if (clientError) {
            setError(clientError)
            return
        }
        setError('')
        setBusy(true)
        startScan(
            mode,
            mode === 'manual' ? selectedApps.map(a => a.sys_id) : undefined,
            mode === 'single_table' ? selectedTable?.sys_id : undefined
        ).then(
            started => {
                setBusy(false)
                push(
                    started.status === 'error' ? 'critical' : 'positive',
                    started.queued
                        ? `${active?.label} scan queued - it runs in the background.`
                        : started.status === 'error'
                          ? `${active?.label} scan finished with errors - see the run's findings.`
                          : `${active?.label} scan complete.`
                )
                onRunStarted(started.sys_id)
                onClose()
            },
            e => {
                setBusy(false)
                setError(e.message)
            }
        )
    }

    return (
        <Dialog title="Start a new scan" onClose={onClose} variant="drawer">
            <div className="iscan-newscan">
                {error ? (
                    <Note tone="critical" title="Could not start scan">
                        {error}
                    </Note>
                ) : null}

                <fieldset className="iscan-newscan__modes">
                    <legend className="iscan-field__label">Scan mode</legend>
                    {MODES.map(item => (
                        <label
                            key={item.mode}
                            className={
                                mode === item.mode
                                    ? 'iscan-modetile iscan-modetile--active'
                                    : 'iscan-modetile'
                            }
                        >
                            <input
                                type="radio"
                                name="iscan-newscan-mode"
                                value={item.mode}
                                checked={mode === item.mode}
                                onChange={() => {
                                    setMode(item.mode)
                                    setError('')
                                }}
                            />
                            <span className="iscan-modetile__label">
                                {item.label}
                                {item.background ? (
                                    <span className="iscan-modetile__badge">background · admin only</span>
                                ) : null}
                            </span>
                            <span className="iscan-modetile__desc">{item.desc}</span>
                        </label>
                    ))}
                </fieldset>

                {mode === 'manual' ? (
                    <div className="iscan-field">
                        <label className="iscan-field__label" htmlFor="iscan-app-search">
                            Applications
                        </label>
                        {selectedApps.length > 0 ? (
                            <ul className="iscan-chiplist">
                                {selectedApps.map(app => (
                                    <li key={app.sys_id} className="iscan-chip">
                                        {app.name}
                                        <button
                                            type="button"
                                            aria-label={`Remove ${app.name}`}
                                            onClick={() =>
                                                setSelectedApps(list =>
                                                    list.filter(a => a.sys_id !== app.sys_id)
                                                )
                                            }
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        <input
                            id="iscan-app-search"
                            className="iscan-select"
                            type="text"
                            placeholder="Search applications by name…"
                            value={appSearch.term}
                            onChange={e => appSearch.setTerm(e.target.value)}
                        />
                        {appSearch.busy ? <p className="iscan-hint">Searching…</p> : null}
                        {appSearch.results.length > 0 ? (
                            <ul className="iscan-searchresults">
                                {appSearch.results
                                    .filter(a => !selectedApps.some(s => s.sys_id === a.sys_id))
                                    .map(a => (
                                        <li key={a.sys_id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedApps(list => [...list, a])
                                                    appSearch.setTerm('')
                                                    setError('')
                                                }}
                                            >
                                                {a.name}
                                                <span className="iscan-searchresults__meta">{a.scope}</span>
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}

                {mode === 'single_table' ? (
                    <div className="iscan-field">
                        <label className="iscan-field__label" htmlFor="iscan-table-search">
                            Table
                        </label>
                        {selectedTable ? (
                            <ul className="iscan-chiplist">
                                <li className="iscan-chip">
                                    {selectedTable.label || selectedTable.name}
                                    <button
                                        type="button"
                                        aria-label="Remove selected table"
                                        onClick={() => setSelectedTable(null)}
                                    >
                                        ✕
                                    </button>
                                </li>
                            </ul>
                        ) : (
                            <>
                                <input
                                    id="iscan-table-search"
                                    className="iscan-select"
                                    type="text"
                                    placeholder="Search tables by name or label…"
                                    value={tableSearch.term}
                                    onChange={e => tableSearch.setTerm(e.target.value)}
                                />
                                {tableSearch.busy ? <p className="iscan-hint">Searching…</p> : null}
                                {tableSearch.results.length > 0 ? (
                                    <ul className="iscan-searchresults">
                                        {tableSearch.results.map(t => (
                                            <li key={t.sys_id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedTable(t)
                                                        tableSearch.setTerm('')
                                                        setError('')
                                                    }}
                                                >
                                                    {t.label || t.name}
                                                    <span className="iscan-searchresults__meta">{t.name}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </>
                        )}
                    </div>
                ) : null}

                {clientError ? <p className="iscan-hint">{clientError}</p> : null}

                <div className="iscan-actions">
                    <ActionButton
                        label={busy ? 'Starting…' : 'Start scan'}
                        variant="primary"
                        disabled={busy || !!clientError}
                        onClick={submit}
                    />
                    <ActionButton label="Cancel" variant="secondary" disabled={busy} onClick={onClose} />
                </div>
                <TextAction
                    label="Open platform form instead →"
                    href={`/x_nold_iscan_run.do?sys_id=-1&sysparm_query=scan_mode=${mode}`}
                />
            </div>
        </Dialog>
    )
}
