import React, { useState } from 'react'
import { useToast } from '../utils/toast'
import { ActionButton, Note, PageTitle, SectionTitle, Spinner } from './ui'
import { startScan } from '../services/ScanService'

/* Labels are copied verbatim from the scan_mode ChoiceColumn in
   src/fluent/tables.now.ts -- do not invent new wording here.

   Four modes run in one click through the Scripted REST endpoint. `manual` and
   `single_table` cannot run without an app or table, and the pickers for those
   (a sys_app slushbucket, a sys_db_object reference) already exist on the
   platform form, so those two deep-link to that form pre-filled with the mode
   -- the same link_type: 'NEW' + query shape this app's navigator modules use.
   Rebuilding those pickers in React would duplicate the form for no gain. */
const ONE_CLICK = [
    { mode: 'full', label: 'Full' },
    { mode: 'custom_only', label: 'Custom Only' },
    { mode: 'modules', label: 'Installed Modules' },
    { mode: 'ai_agents', label: 'AI Agent Discovery' },
]

const ON_FORM = [
    { mode: 'manual', label: 'Manual — App' },
    { mode: 'single_table', label: 'Manual — Single Table' },
]

// Scan start/failure now reports through the app-wide toast layer
// (NotificationsProvider, mounted once in app.tsx) instead of a local Alert
// only this panel could see -- a scan kicked off from here can finish (or
// fail) well after the user has clicked into another view, and the toast
// follows them there. The in-progress Loader/live-region below is unrelated
// and stays local -- that is ongoing state for THIS panel, not an event.
export default function ScanLauncher({ onRunStarted }: { onRunStarted: (sysId: string) => void }) {
    const [busy, setBusy] = useState('')
    const { push } = useToast()

    const run = (mode: string) => {
        const label = ONE_CLICK.find(i => i.mode === mode)?.label || mode
        setBusy(mode)
        startScan(mode).then(
            started => {
                setBusy('')
                push('positive', `${label} scan started.`)
                onRunStarted(started.sys_id)
            },
            e => {
                setBusy('')
                push('critical', `Scan could not be started — ${e.message}`)
            }
        )
    }

    return (
        <section className="iscan-panel" aria-labelledby="iscan-launcher-heading">
            <SectionTitle id="iscan-launcher-heading">Start a scan</SectionTitle>
            {busy ? (
                <>
                    <Note tone="info" title="Scan in progress — do not navigate away">
                        The page is waiting on the server for this scan to finish. A Full scan of
                        a large instance can take several minutes.
                    </Note>
                    <Spinner label={`Running ${ONE_CLICK.find(i => i.mode === busy)?.label} scan`} />
                </>
            ) : (
                <p className="iscan-hint">
                    These four start immediately and run to completion before the page returns, so a
                    Full scan of a large instance can take a while.
                </p>
            )}
            {/* Announces busy/idle transitions for screen readers even when focus
                never moves -- the buttons above only change their own label. */}
            <span className="iscan-visually-hidden" role="status" aria-live="polite">
                {busy ? `${ONE_CLICK.find(i => i.mode === busy)?.label} scan is running.` : ''}
            </span>
            <div className="iscan-actions">
                {ONE_CLICK.map(item => (
                    <ActionButton
                        key={item.mode}
                        label={busy === item.mode ? `${item.label} — scanning…` : item.label}
                        variant="primary"
                        disabled={busy !== ''}
                        onClick={() => run(item.mode)}
                    />
                ))}
            </div>
            <p className="iscan-hint">
                These two need an application or table first. They open the run form with the mode
                already set — pick the target there, then press Run Scan.
            </p>
            <div className="iscan-actions">
                {ON_FORM.map(item => (
                    <ActionButton
                        key={item.mode}
                        label={`${item.label} — pick target on form`}
                        variant="secondary"
                        disabled={busy !== ''}
                        onClick={() => {
                            window.location.href = `/x_nold_iscan_run.do?sys_id=-1&sysparm_query=scan_mode=${item.mode}`
                        }}
                    />
                ))}
            </div>
        </section>
    )
}
