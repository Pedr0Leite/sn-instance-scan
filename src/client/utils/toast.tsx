import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/* Own toast layer, replacing the platform Notifications provider.

   The design draws a bottom-right card that fades in and auto-dismisses; that
   is markup we control, so it is markup we own. Same reasoning as every other
   platform component removed from this page -- theirs renders into a shadow
   root app.css cannot reach. */

export type ToastTone = 'positive' | 'critical' | 'info'

interface Toast {
    id: number
    tone: ToastTone
    message: string
}

interface ToastApi {
    push: (tone: ToastTone, message: string) => void
}

const ToastContext = createContext<ToastApi>({ push: () => undefined })

export const useToast = () => useContext(ToastContext)

const DISMISS_MS = 2600

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const nextId = useRef(1)
    const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

    const dismiss = useCallback((id: number) => {
        setToasts(list => list.filter(toast => toast.id !== id))
        clearTimeout(timers.current[id])
        delete timers.current[id]
    }, [])

    const push = useCallback(
        (tone: ToastTone, message: string) => {
            const id = nextId.current++
            setToasts(list => [...list, { id, tone, message }])
            timers.current[id] = setTimeout(() => dismiss(id), DISMISS_MS)
        },
        [dismiss]
    )

    const api = useMemo(() => ({ push }), [push])

    return (
        <ToastContext.Provider value={api}>
            {children}
            {/* aria-live so a toast is announced even though focus never moves. */}
            <div className="iscan-toasts" role="status" aria-live="polite">
                {toasts.map(toast => (
                    <div key={toast.id} className={`iscan-toast iscan-toast--${toast.tone}`}>
                        <span className="iscan-toast__dot" aria-hidden="true" />
                        <span>{toast.message}</span>
                        <button
                            type="button"
                            className="iscan-toast__close"
                            aria-label="Dismiss notification"
                            onClick={() => dismiss(toast.id)}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
