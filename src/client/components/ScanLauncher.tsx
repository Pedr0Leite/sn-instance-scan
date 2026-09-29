import React from 'react'
import { ActionButton, SectionTitle } from './ui'

/* Labels are copied verbatim from the scan_mode ChoiceColumn in
   src/fluent/tables.now.ts -- do not invent new wording here.

   Console v7: this card no longer executes a scan or deep-links to the
   platform form itself -- every button here just opens the NewScanPanel
   drawer pre-selected on that mode (see app.tsx's openNewScan / the
   `onPickMode` prop below), so the actual mode picker + app/table search +
   Start button lives in exactly one place instead of two near-duplicate UIs.
   `background` is kept purely to word the hint text honestly -- the SERVER
   still decides sync vs. queued and rejects a non-admin with 403. */
const ONE_CLICK = [
    { mode: 'full', label: 'Full', background: true },
    { mode: 'cmdb_health', label: 'CMDB & CSDM Health', background: true },
    { mode: 'custom_only', label: 'Custom Only', background: false },
    { mode: 'modules', label: 'Installed Modules', background: false },
    { mode: 'ai_agents', label: 'AI Agent Discovery', background: false },
]

const NEEDS_TARGET = [
    { mode: 'manual', label: 'Manual — App' },
    { mode: 'single_table', label: 'Manual — Single Table' },
]

export default function ScanLauncher({ onPickMode }: { onPickMode: (mode: string) => void }) {
    return (
        <section className="iscan-panel" aria-labelledby="iscan-launcher-heading">
            <SectionTitle id="iscan-launcher-heading">Start a scan</SectionTitle>
            <p className="iscan-hint">
                Full and CMDB &amp; CSDM Health run in the background and are admin-only — the run
                opens straight away and its status moves from Pending to Running to Complete. The
                others finish before the page returns. Click any mode to configure and run it from
                the panel that opens on the right.
            </p>
            <div className="iscan-actions">
                {ONE_CLICK.map(item => (
                    <ActionButton
                        key={item.mode}
                        label={item.label}
                        variant="primary"
                        onClick={() => onPickMode(item.mode)}
                    />
                ))}
            </div>
            <p className="iscan-hint">These two need an application or table, picked in that panel.</p>
            <div className="iscan-actions">
                {NEEDS_TARGET.map(item => (
                    <ActionButton
                        key={item.mode}
                        label={item.label}
                        variant="secondary"
                        onClick={() => onPickMode(item.mode)}
                    />
                ))}
            </div>
        </section>
    )
}
