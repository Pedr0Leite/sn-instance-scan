import React, { useEffect, useState } from 'react'
import { fetchRecord } from '../services/TableService'
import { display, humanizeField } from '../utils/fields'
import { Note, Spinner } from './ui'

/* Read-only record view, replacing RecordProvider + FormColumnLayout.

   Those two were the last reason this page carried a shadow-DOM component on
   a surface whose appearance matters. This console never edits -- every write
   stays on the platform form's UI Actions -- so a form engine was always more
   machinery than the job needed: a definition list of non-empty fields is the
   whole requirement, and it is ours to style.

   Empty fields are dropped rather than rendered blank: a scan result has ~50
   columns, most of them zero or unset on any given record. */
export default function RecordFields({ table, sysId }: { table: string; sysId: string }) {
    const [record, setRecord] = useState<Record<string, any> | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        setRecord(null)
        setError('')
        fetchRecord(table, sysId).then(setRecord, e => setError(e.message))
    }, [table, sysId])

    if (error) {
        return (
            <Note tone="critical" title="Could not load this record">
                {error}
            </Note>
        )
    }
    if (!record) return <Spinner label="Loading record" />

    const fields = Object.keys(record)
        .filter(name => !name.startsWith('sys_') || name === 'sys_created_on')
        .map(name => ({ name, text: display(record[name]) }))
        .filter(field => field.text !== '')

    if (fields.length === 0) {
        return (
            <Note tone="warning" title="Nothing to show">
                This record has no readable field values.
            </Note>
        )
    }

    return (
        <dl className="iscan-fields">
            {fields.map(field => (
                <div key={field.name} className="iscan-fields__row">
                    <dt className="iscan-fields__label">{humanizeField(field.name)}</dt>
                    <dd className="iscan-fields__value">{field.text}</dd>
                </div>
            ))}
        </dl>
    )
}
