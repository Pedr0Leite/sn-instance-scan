import React from 'react'
import { useTheme } from '../utils/theme'

/* Plain-HTML primitives matching `Instance Scan Console.dc.html`.

   Why these exist at all: every @servicenow/react-components component is an
   external uxasset web component with its own shadow root, so app.css cannot
   reach inside one. Using them for headings, buttons, links, selects, alerts
   and spinners is what kept making this page render as stock platform chrome
   no matter what the palette said. The design draws all of those as ordinary
   HTML, so we do too.

   Still platform, deliberately: RecordProvider + FormColumnLayout (the record
   form) and Modal (the preview shell). Reimplementing a platform form is not
   worth it, and neither is dominant visual mass. */

export function PageTitle({ children }: { children: React.ReactNode }) {
    return <h1 className="iscan-h1">{children}</h1>
}

export function SectionTitle({
    children,
    level = 2,
    id,
}: {
    children: React.ReactNode
    level?: 2 | 3
    id?: string
}) {
    const Tag = (level === 2 ? 'h2' : 'h3') as 'h2' | 'h3'
    return (
        <Tag id={id} className={level === 2 ? 'iscan-h2' : 'iscan-h3'}>
            {children}
        </Tag>
    )
}

/* The muted one-line label above a tile group ("Run activity"). Visually
   subordinate but still a real heading, so the tile groups stay navigable. */
export function GroupLabel({ children }: { children: React.ReactNode }) {
    return <h3 className="iscan-grouplabel">{children}</h3>
}

export function Crumbs({ current }: { current: string }) {
    return (
        <nav className="iscan-crumbs" aria-label="Breadcrumb">
            <span>Console</span>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{current}</span>
        </nav>
    )
}

type ButtonVariant = 'primary' | 'secondary' | 'small'

export function ActionButton({
    label,
    variant = 'primary',
    disabled,
    onClick,
}: {
    label: string
    variant?: ButtonVariant
    disabled?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            className={`iscan-btn iscan-btn--${variant}`}
            disabled={disabled}
            onClick={onClick}
        >
            {label}
        </button>
    )
}

export function TextAction({ label, href }: { label: string; href: string }) {
    return (
        <a className="iscan-link" href={href}>
            {label}
        </a>
    )
}

/* Native <select>. The platform Select renders a shadow-DOM combobox that
   cannot be styled to match; a native control also gets the OS picker on
   touch for free. */
export function FieldSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: { id: string; label: string }[]
    onChange: (id: string) => void
}) {
    const id = `iscan-select-${label.replace(/\W+/g, '-').toLowerCase()}`
    return (
        <div className="iscan-field">
            <label className="iscan-field__label" htmlFor={id}>
                {label}
            </label>
            <select
                id={id}
                className="iscan-select"
                value={value}
                onChange={e => onChange(e.target.value)}
            >
                <option value="">— none selected —</option>
                {options.map(option => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

/* Replaces the platform Alert. `tone` follows this app's severity vocabulary
   (positive/critical/warning/info) -- never success/error. */
export function Note({
    tone,
    title,
    children,
}: {
    tone: 'critical' | 'info' | 'warning'
    title: string
    children?: React.ReactNode
}) {
    return (
        <div className={`iscan-note iscan-note--${tone}`} role={tone === 'critical' ? 'alert' : 'status'}>
            <strong className="iscan-note__title">{title}</strong>
            {children ? <span className="iscan-note__body">{children}</span> : null}
        </div>
    )
}

/* Mosaic-style header control -- previously lived inside SideNav's footer;
   moved to the header (console v6 full pass) so the slim top bar carries the
   page's own actions ("+ New", theme) rather than the sidebar. Self-contained
   (owns its own useTheme() call) so it can be dropped wherever the design
   wants a theme switch without threading isDark/toggle through props. */
export function ThemeToggle() {
    const [theme, toggleTheme] = useTheme()
    const isDark = theme === 'dark'
    return (
        <button
            type="button"
            className="iscan-theme-toggle"
            role="switch"
            aria-checked={isDark}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={toggleTheme}
        >
            <span className="iscan-theme-toggle__knob" aria-hidden="true" />
        </button>
    )
}

/* Loading placeholder for a block of rows/fields whose shape is already known
   (a table page, a record's field list) -- a shimmering bar reads as "content
   is coming" more clearly than a spinner when several lines are about to
   appear at once. `lines` renders that many bars at decreasing widths so the
   block doesn't look like a repeated single element. Inert under
   prefers-reduced-motion (see app.css) -- the bars still show, they just
   don't shimmer. */
export function Skeleton({ lines = 4 }: { lines?: number }) {
    return (
        <div className="iscan-skeleton" role="status" aria-label="Loading">
            {Array.from({ length: lines }).map((_, i) => (
                <span key={i} className="iscan-skeleton__bar" style={{ '--i': i } as React.CSSProperties} />
            ))}
        </div>
    )
}

/* Announced busy indicator. aria-live carries the label because a spinner
   alone tells a screen-reader user nothing. */
export function Spinner({ label }: { label: string }) {
    return (
        <div className="iscan-spinner" role="status" aria-live="polite">
            <span className="iscan-spinner__ring" aria-hidden="true" />
            <span className="iscan-spinner__label">{label}</span>
        </div>
    )
}
