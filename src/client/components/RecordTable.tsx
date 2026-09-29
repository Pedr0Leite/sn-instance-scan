import React, { useEffect, useState } from 'react'
import { ActionButton, Note, Skeleton, TextAction } from './ui'
import { fetchTablePage } from '../services/TableService'
import { display, humanizeField, value } from '../utils/fields'
import type { Severity } from '../utils/tokens'
import RecordPreviewModal from './RecordPreviewModal'

// Right-aligns a column purely by its field name -- every numeric column in
// this schema ends in _count (business_rule_count, app_count, row_count, ...).
// Mosaic tables right-align numeric columns; this is a naming convention, not
// a fixed per-table list, so a new *_count column picks it up for free.
const isNumericField = (field: string) => field.endsWith('_count')

interface RecordTableProps {
    table: string
    listTitle: string
    ariaLabel: string
    // Field names in display order. sys_id is always fetched separately --
    // never include it here.
    columns: string[]
    pageSize?: number
    onOpen: (table: string, sysId: string) => void
    children?: React.ReactNode
    // Renders this column as an opaque severity pill instead of plain text.
    statusField?: string
    statusSeverity?: (rawValue: string) => Severity | undefined
    // Row click opens our own preview modal instead of navigating straight to
    // the full-page detail view. "Open full record" inside the modal is what
    // finally calls onOpen.
    preview?: boolean
    /* Row click opens an inline detail strip under the row instead of
       navigating or opening the modal. The strip repeats the row's own numeric
       columns at a readable size and carries the one link out to the full
       record, so scanning a list and inspecting one row no longer costs a
       round trip. */
    expandable?: boolean
    /* Renders a "?" disclosure beside the title. Used where an EMPTY list is
       usually correct rather than broken and that needs explaining in place. */
    help?: string
}

/* Own replacement for NowRecordListConnected -- see CLAUDE.md's "Later
   addition #6" for why: that component is an external uxasset with its own
   shadow root, so it renders as unstyleable stock platform chrome no matter
   what app.css says, and it exposes neither a query nor a sort prop. This
   fetches its own page via TableService (the raw Table API DOES support
   both) and renders a real, fully-ours <table>.

   Accepted trade-off, stated once here rather than at every call site: this
   loses platform list personalization, the column chooser, and the built-in
   context menu. Acceptable for a READ-ONLY review console -- own sorting
   (click a header) and paging (Prev/Next) below replace what a reviewer
   actually needs day to day, and "Open in platform list" stays one click
   away for anyone who wants the real thing. */
export default function RecordTable({
    table,
    listTitle,
    ariaLabel,
    columns,
    pageSize = 25,
    onOpen,
    children,
    statusField,
    statusSeverity,
    preview = false,
    expandable = false,
    help,
}: RecordTableProps) {
    const [rows, setRows] = useState<Record<string, any>[] | null>(null)
    const [total, setTotal] = useState<number | null>(null)
    const [error, setError] = useState('')
    const [page, setPage] = useState(0)
    const [expandedId, setExpandedId] = useState('')
    const [helpOpen, setHelpOpen] = useState(false)
    const [sortField, setSortField] = useState('sys_created_on')
    const [sortDesc, setSortDesc] = useState(true)
    const [previewId, setPreviewId] = useState<string | null>(null)

    useEffect(() => {
        setRows(null)
        setError('')
        fetchTablePage(table, columns, pageSize, page * pageSize, sortField, sortDesc).then(
            page => {
                setRows(page.rows)
                setTotal(page.total)
            },
            e => setError(e.message)
        )
    }, [table, columns.join(','), pageSize, page, sortField, sortDesc])

    const toggleSort = (field: string) => {
        setPage(0)
        if (field === sortField) setSortDesc(d => !d)
        else {
            setSortField(field)
            setSortDesc(true)
        }
    }

    const openRow = (sysId: string) => {
        if (preview) setPreviewId(sysId)
        else onOpen(table, sysId)
    }

    const rangeStart = page * pageSize + 1
    const rangeEnd = rows ? page * pageSize + rows.length : rangeStart
    const hasNext = rows ? (total !== null ? rangeEnd < total : rows.length === pageSize) : false

    return (
        <section className="iscan-panel" aria-label={ariaLabel}>
            <div className="iscan-panel__toolbar">
                <div className="iscan-panel__titlegroup">
                    <h2 className="iscan-panel__title">{listTitle}</h2>
                    {help ? (
                        <div className="iscan-help">
                            <button
                                type="button"
                                className="iscan-help__toggle"
                                aria-expanded={helpOpen}
                                aria-label={`About ${listTitle}`}
                                onClick={() => setHelpOpen(open => !open)}
                            >
                                ?
                            </button>
                            {helpOpen ? (
                                <div
                                    className="iscan-help__popover"
                                    role="note"
                                    /* Escape closes it from anywhere inside, and it is
                                       reachable by keyboard because the toggle is a real
                                       button that keeps focus. */
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') setHelpOpen(false)
                                    }}
                                >
                                    {help}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                <div className="iscan-actions">
                    {/* "+ New" was removed from here -- the header's own "+ New"
                        (every view, top right) is the one launch point now, so this
                        list toolbar no longer needs its own duplicate. */}
                    <TextAction label="Open in platform list" href={`/${table}_list.do`} />
                </div>
            </div>
            {children}

            {error ? (
                <Note tone="critical" title={`Could not load ${listTitle}`}>
                    {error}
                </Note>
            ) : null}

            {!error && rows === null ? <Skeleton lines={pageSize > 6 ? 6 : pageSize} /> : null}

            {!error && rows !== null && rows.length === 0 ? (
                <p className="iscan-hint">No records found.</p>
            ) : null}

            {!error && rows !== null && rows.length > 0 ? (
                <>
                    <div className="iscan-table-scroll">
                        <table className="iscan-table">
                            <caption className="iscan-visually-hidden">{listTitle}</caption>
                            <thead>
                                <tr>
                                    {columns.map(field => {
                                        const isSorted = field === sortField
                                        return (
                                            <th
                                                key={field}
                                                scope="col"
                                                className={isNumericField(field) ? 'iscan-table__num' : undefined}
                                                aria-sort={
                                                    isSorted
                                                        ? sortDesc
                                                            ? 'descending'
                                                            : 'ascending'
                                                        : 'none'
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    className="iscan-table__sort"
                                                    onClick={() => toggleSort(field)}
                                                >
                                                    {humanizeField(field)}
                                                    <span aria-hidden="true" className="iscan-table__sort-icon">
                                                        {isSorted ? (sortDesc ? '▾' : '▴') : ''}
                                                    </span>
                                                </button>
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => {
                                    const sysId = value(row.sys_id)
                                    const isExpanded = expandable && expandedId === sysId
                                    return (
                                        <React.Fragment key={sysId}>
                                        <tr style={{ '--row-index': idx } as React.CSSProperties}>
                                            {columns.map((field, i) => {
                                                if (field === statusField) {
                                                    const raw = value(row[field])
                                                    const severity = statusSeverity?.(raw)
                                                    return (
                                                        <td key={field}>
                                                            <span
                                                                className={
                                                                    severity
                                                                        ? `iscan-status iscan-status--${severity}`
                                                                        : undefined
                                                                }
                                                            >
                                                                {display(row[field])}
                                                            </span>
                                                        </td>
                                                    )
                                                }
                                                return (
                                                    <td key={field} className={isNumericField(field) ? 'iscan-table__num' : undefined}>
                                                        {i === 0 ? (
                                                            <button
                                                                type="button"
                                                                className="iscan-row-link"
                                                                aria-expanded={
                                                                    expandable ? isExpanded : undefined
                                                                }
                                                                onClick={() =>
                                                                    expandable
                                                                        ? setExpandedId(
                                                                              isExpanded ? '' : sysId
                                                                          )
                                                                        : openRow(sysId)
                                                                }
                                                            >
                                                                {display(row[field]) || '(none)'}
                                                            </button>
                                                        ) : (
                                                            display(row[field]) || '—'
                                                        )}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                        {isExpanded ? (
                                            <tr className="iscan-table__detailrow">
                                                <td colSpan={columns.length}>
                                                    <div className="iscan-rowdetail">
                                                        {columns.slice(1).map(field => (
                                                            <div key={field}>
                                                                <div className="iscan-rowdetail__label">
                                                                    {humanizeField(field)}
                                                                </div>
                                                                <div className="iscan-rowdetail__value">
                                                                    {display(row[field]) || '—'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="iscan-rowdetail__open"
                                                            onClick={() => onOpen(table, sysId)}
                                                        >
                                                            Open record page →
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                        </React.Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="iscan-panel__toolbar">
                        <p className="iscan-hint">
                            Showing {rangeStart}–{rangeEnd}
                            {total !== null ? ` of ${total}` : ''}
                        </p>
                        <div className="iscan-actions">
                            <ActionButton
                                label="‹ Previous"
                                variant="small"
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                            />
                            <ActionButton
                                label="Next ›"
                                variant="small"
                                disabled={!hasNext}
                                onClick={() => setPage(p => p + 1)}
                            />
                        </div>
                    </div>
                </>
            ) : null}

            {previewId ? (
                <RecordPreviewModal
                    table={table}
                    sysId={previewId}
                    onClose={() => setPreviewId(null)}
                    onOpenFull={() => {
                        setPreviewId(null)
                        onOpen(table, previewId)
                    }}
                />
            ) : null}
        </section>
    )
}
