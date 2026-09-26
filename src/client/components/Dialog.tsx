import React, { useCallback, useEffect, useRef } from 'react'

/* Own modal, replacing the platform Modal. Focus handling is hand-built and
   must stay: a dialog that traps nothing and restores nothing is a keyboard
   dead end.

   - Escape closes.
   - Focus moves into the dialog on open and returns to the opener on close.
   - Tab cycles inside (a real trap, not just an autofocus).
   - Clicking the backdrop closes; clicks inside do not bubble to it. */
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogProps {
    title: string
    onClose: () => void
    footer?: React.ReactNode
    children: React.ReactNode
    wide?: boolean
}

export default function Dialog({ title, onClose, footer, children, wide }: DialogProps) {
    const panel = useRef<HTMLDivElement>(null)
    const opener = useRef<Element | null>(null)

    useEffect(() => {
        opener.current = document.activeElement
        const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE)
        ;(first || panel.current)?.focus()
        return () => {
            const target = opener.current as HTMLElement | null
            if (target && typeof target.focus === 'function') target.focus()
        }
    }, [])

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
                return
            }
            if (e.key !== 'Tab' || !panel.current) return
            const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))
            if (items.length === 0) return
            const first = items[0]
            const last = items[items.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        },
        [onClose]
    )

    return (
        <div className="iscan-backdrop" onClick={onClose}>
            <div
                ref={panel}
                className={wide ? 'iscan-dialog iscan-dialog--wide' : 'iscan-dialog'}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                onClick={e => e.stopPropagation()}
            >
                <div className="iscan-dialog__head">
                    <h2 className="iscan-h2">{title}</h2>
                    <button
                        type="button"
                        className="iscan-dialog__close"
                        aria-label="Close"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </div>
                <div className="iscan-dialog__body">{children}</div>
                {footer ? <div className="iscan-dialog__foot">{footer}</div> : null}
            </div>
        </div>
    )
}
