import { useEffect, useState } from 'react'

// Design-approved light/dark toggle (see CLAUDE.md "Console v2/oklch palette
// decision"). Persisted in localStorage, wrapped in try/catch -- it can throw
// in restricted contexts (private windows, blocked site data) -- falling back
// to the OS's prefers-color-scheme so a first visit still matches the user's
// system theme.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'iscan-theme'

function systemTheme(): Theme {
    return typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
}

export function getInitialTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'light' || stored === 'dark') return stored
    } catch {
        // Ignore -- fall back to system preference below.
    }
    return systemTheme()
}

export function applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme)
    try {
        localStorage.setItem(STORAGE_KEY, theme)
    } catch {
        // Persistence is a nicety, not a requirement -- theme still applies
        // for this page load even if it can't be remembered.
    }
}

// Applies the theme as a side effect on mount/change so app.css's
// `:root[data-theme="..."]` overrides take over immediately.
export function useTheme(): [Theme, () => void] {
    const [theme, setTheme] = useState<Theme>(getInitialTheme)

    useEffect(() => {
        applyTheme(theme)
    }, [theme])

    const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

    return [theme, toggleTheme]
}
