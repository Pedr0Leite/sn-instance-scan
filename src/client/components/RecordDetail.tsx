import React from 'react'
import RecordFields from './RecordFields'
import { ActionButton, Note, PageTitle, TextAction } from './ui'

interface RecordDetailProps {
    table: string
    sysId: string
    onBack: () => void
}

// Labels the breadcrumb/heading with which section this record belongs to,
// so the detail view reads as "somewhere in the app" rather than a bare form.
const TABLE_META: Record<string, { record: string; section: string }> = {
    x_nold_iscan_run: { record: 'Scan Run', section: 'Scan Runs' },
    x_nold_iscan_result: { record: 'Scan Result', section: 'Scan Results' },
}

// Read-only by design: this console reviews scan output. Every write path
// (Run Scan, Download Report) stays on the platform form's UI Actions, so the
// page introduces no new writer -- there is no form to edit, hence no dirty
// state to track.
export default function RecordDetail({ table, sysId, onBack }: RecordDetailProps) {
    const meta = TABLE_META[table] || { record: 'Record', section: 'Console' }

    // A detail URL with no id means the row-click payload carried no usable
    // record sys_id. Say so plainly instead of handing RecordProvider an empty
    // sysId, which renders as a bare "record not found" with no way back.
    if (!sysId) {
        return (
            <section className="iscan-panel" aria-label="Scan record detail">
                <div className="iscan-panel__toolbar">
                    <ActionButton
                        label={`← Back to ${meta.section}`}
                        variant="small"
                        onClick={onBack}
                    />
                </div>
                <Note tone="warning" title="No record selected">
                    This link is missing a record id. Return to the list and open the record
                    again.
                </Note>
            </section>
        )
    }

    return (
        <section className="iscan-panel" aria-label="Scan record detail">
            <div className="iscan-panel__toolbar">
                <div className="iscan-panel__titlegroup">
                    <ActionButton
                        label={`← Back to ${meta.section}`}
                        variant="small"
                        onClick={onBack}
                    />
                    <PageTitle>{`${meta.record} detail`}</PageTitle>
                </div>
                <TextAction
                    label="Open in platform form (Run Scan, Download Report)"
                    href={`/${table}.do?sys_id=${sysId}`}
                />
            </div>
            <RecordFields table={table} sysId={sysId} />
        </section>
    )
}
