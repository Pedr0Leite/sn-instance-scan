import React, { useEffect, useState } from 'react'
import { FieldSelect, Note, SectionTitle, Spinner } from './ui'
import ResultSummary from './ResultSummary'
import { getResult, listResults, ResultOption } from '../services/ResultsService'

interface ResultDashboardProps {
    resultId: string | null
    onSelect: (sysId: string) => void
}

/* Picker + one result's numbers, below the instance-wide "Scan state" tiles.

   Select (not a compact record list) because the choice is one value out of a
   flat list, it needs type-ahead over app names, and it stays one row tall --
   a second embedded list would compete with the recent-runs list right below.
   The selection lives in the URL as ?view=dashboard&result=<sys_id>, so it is
   linkable and browser back/forward moves between results. */
export default function ResultDashboard({ resultId, onSelect }: ResultDashboardProps) {
    const [options, setOptions] = useState<ResultOption[] | null>(null)
    const [record, setRecord] = useState<Record<string, any> | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        listResults().then(setOptions, e => setError(e.message))
    }, [])

    useEffect(() => {
        setRecord(null)
        if (!resultId) return
        getResult(resultId).then(setRecord, e => setError(e.message))
    }, [resultId])

    return (
        <section className="iscan-panel" aria-labelledby="iscan-result-heading">
            <div className="iscan-panel__toolbar">
                <SectionTitle id="iscan-result-heading">Scan result detail</SectionTitle>
                {/* Does EXACTLY what picking "-- none selected --" in the select
                    below does -- same handler, same route (?view=dashboard with no
                    result), so URL/back-forward behaviour is identical either way.
                    Only shown once a result is actually selected. */}
                {resultId ? (
                    <button
                        type="button"
                        className="iscan-dialog__close"
                        aria-label="Close scan result detail"
                        onClick={() => onSelect('')}
                    >
                        ✕
                    </button>
                ) : null}
            </div>
            {error ? (
                <Note tone="critical" title="Could not load scan results">
                    {error}
                </Note>
            ) : null}
            {options === null && !error ? (
                <Spinner label="Loading scan results" />
            ) : null}
            {options !== null ? (
                <FieldSelect
                    label="Scan result (optional)"
                    value={resultId || ''}
                    options={options.map(option => ({ id: option.sysId, label: option.label }))}
                    onChange={onSelect}
                />
            ) : null}
            {resultId && !record && !error ? (
                <Spinner label="Loading scan result" />
            ) : null}
            {record ? <ResultSummary record={record} /> : null}
            {!resultId && options && !error ? (
                <div className="iscan-empty-note">
                    <svg className="iscan-icon iscan-empty-note__icon" viewBox="0 0 20 20" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm1.25 9.5h-2.5a.75.75 0 0 1 0-1.5h.5v-4h-.5a.75.75 0 0 1 0-1.5h1.25a.75.75 0 0 1 .75.75V13.5h.5a.75.75 0 0 1 0 1.5Z"
                        />
                    </svg>
                    <div>
                        <p className="iscan-text">No scan result selected.</p>
                        <p className="iscan-hint">
                            Pick a completed application scan above to see its full artifact
                            breakdown, GenAI summary, and LLM context right here — without
                            leaving the dashboard.
                        </p>
                    </div>
                </div>
            ) : null}
        </section>
    )
}
