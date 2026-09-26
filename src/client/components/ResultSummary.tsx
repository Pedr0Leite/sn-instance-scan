import React, { useState } from 'react'
import { GroupLabel, SectionTitle } from './ui'
import MetricTile from './MetricTile'
import { display, humanizeField, value } from '../utils/fields'
import { categoryFor, CATEGORY_ORDER } from '../utils/countCategories'

// Turns business_rule_count -> "Business rule". Strips the trailing _count
// before handing off to the shared humanizer RecordTable's column headers
// also use -- derived from the field name, never a per-field label map.
const labelFor = (field: string) => humanizeField(field.replace(/_count$/, ''))

export default function ResultSummary({ record }: { record: Record<string, any> }) {
    const [showContext, setShowContext] = useState(false)

    // Zero-valued counts are skipped, matching the PDF report's own rule: 41
    // mostly-zero tiles is noise, not information. What's left is grouped by
    // category (see CATEGORIES above), sorted by count within each group.
    const tilesByCategory = new Map<string, { field: string; count: number }[]>()
    Object.keys(record)
        .filter(field => field.endsWith('_count'))
        .map(field => ({ field, count: Number(value(record[field]) || 0) }))
        .filter(tile => tile.count > 0)
        .forEach(tile => {
            const category = categoryFor(tile.field)
            if (!tilesByCategory.has(category)) tilesByCategory.set(category, [])
            tilesByCategory.get(category)!.push(tile)
        })
    const groups = CATEGORY_ORDER.filter(category => tilesByCategory.has(category)).map(category => ({
        category,
        tiles: tilesByCategory.get(category)!.sort((a, b) => b.count - a.count),
    }))

    const summary = display(record.summary_text) || value(record.summary_text)
    const context = display(record.llm_context) || value(record.llm_context)

    return (
        <>
            <p className="iscan-hint">
                {display(record.app)} · scanned {display(record.scan_date)} ·{' '}
                {display(record.scan_mode_used)}
            </p>
            {groups.length ? (
                groups.map(group => (
                    <div key={group.category}>
                        <GroupLabel>{group.category}</GroupLabel>
                        <ul className="iscan-tiles">
                            {group.tiles.map(tile => (
                                <MetricTile
                                    key={tile.field}
                                    label={labelFor(tile.field)}
                                    count={tile.count}
                                    size="md"
                                />
                            ))}
                        </ul>
                    </div>
                ))
            ) : (
                <p className="iscan-hint">This result recorded no non-zero counts.</p>
            )}

            <SectionTitle level={3}>Summary</SectionTitle>
            <p className="iscan-text">
                {summary ||
                    'No GenAI summary was stored for this scan — the summary is optional and degrades to nothing when the Generative AI Controller is unavailable.'}
            </p>

            {/* Disclosure, per the design: a chevron that rotates, and the block
                below only in the DOM when open -- aria-expanded carries the state. */}
            <button
                type="button"
                className="iscan-disclosure"
                aria-expanded={showContext}
                onClick={() => setShowContext(!showContext)}
            >
                <span
                    className={
                        showContext
                            ? 'iscan-disclosure__chevron iscan-disclosure__chevron--open'
                            : 'iscan-disclosure__chevron'
                    }
                    aria-hidden="true"
                >
                    ▸
                </span>
                {showContext ? 'Hide LLM context' : 'Show LLM context'}
            </button>
            {showContext ? (
                <pre className="iscan-pre">{context || 'No LLM context was stored for this scan.'}</pre>
            ) : null}
        </>
    )
}
