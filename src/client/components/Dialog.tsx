import React, { useCallback, useEffect, useRef, useState } from 'react'

/* Own modal, replacing the platform Modal. Focus handling is hand-built and
   must stay: a dialog that traps nothing and restores nothing is a keyboard
   dead end.

   - Escape closes.
   - Focus moves into the dialog on open and returns to the opener on close.
   - Tab cycles inside (a real trap, not just an autofocus).
   - Clicking the backdrop closes; clicks inside do not bubble to it.

   Console v7 addition: closing is now ANIMATED, not instant. Every close
   trigger (Esc, backdrop click, the × button, and -- via `exposeClose` --
   buttons INSIDE the dialog's own content, like NewScanPanel's Cancel/
   Start-scan-success) routes through the same `requestClose`, which plays an
   exit class for one animation frame's worth of time before calling the real
   `onClose` prop (the thing that actually unmounts this component from the
   parent). Skips the delay entirely under prefers-reduced-motion. */
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Drawer's slide-out is the longer of the two exit animations (matches the
// entrance's --snx-morph-ish timing); the centered dialog's fade/scale-out is
// quicker. Both are defined in app.css as iscan-drawer-out/iscan-dialog-out.
const CLOSE_DELAY_MS = { center: 180, drawer: 240 } as const

interface DialogProps {
    title: string
    onClose: () => void
    footer?: React.ReactNode
    children: React.ReactNode
    wide?: boolean
    // 'drawer' slides in from the right edge instead of the centered card --
    // same focus-trap/Esc/backdrop behaviour, just a different panel shape.
    variant?: 'center' | 'drawer'
    // Hands the dialog's own animated `requestClose` up to the parent, so
    // content-driven closes (a Cancel button, an auto-close after success)
    // play the same exit animation as Esc/backdrop/× instead of unmounting
    // instantly. Called once per mount with a stable function reference.
    exposeClose?: (requestClose: () => void) => void
}

export default function Dialog({
    title,
    onClose,
    footer,
    children,
    wide,
    variant = 'center',
    exposeClose,
}: DialogProps) {
    const panel = useRef<HTMLDivElement>(null)
    const opener = useRef<Element | null>(null)
    const [closing, setClosing] = useState(false)
    const closingRef = useRef(false)

    useEffect(() => {
        opener.current = document.activeElement
        const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE)
        ;(first || panel.current)?.focus()
        return () => {
            const target = opener.current as HTMLElement | null
            if (target && typeof target.focus === 'function') target.focus()
        }
    }, [])

    const requestClose = useCallback(() => {
        if (closingRef.current) return
        closingRef.current = true
        setClosing(true)
        const reduced =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) {
            onClose()
            return
        }
        setTimeout(onClose, CLOSE_DELAY_MS[variant])
    }, [onClose, variant])

    useEffect(() => {
        exposeClose?.(requestClose)
    }, [exposeClose, requestClose])

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                requestClose()
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
        [requestClose]
    )

    const panelClass = [
        'iscan-dialog',
        wide ? 'iscan-dialog--wide' : '',
        variant === 'drawer' ? 'iscan-dialog--drawer' : '',
        closing ? 'iscan-dialog--closing' : '',
    ]
        .filter(Boolean)
        .join(' ')
    const backdropClass = [
        'iscan-backdrop',
        variant === 'drawer' ? 'iscan-backdrop--drawer' : '',
        closing ? 'iscan-backdrop--closing' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={backdropClass} onClick={requestClose}>
            <div
                ref={panel}
                className={panelClass}
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
                        onClick={requestClose}
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
