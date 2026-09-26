// Centralized, typed handles for this app's design vocabulary -- a single
// place that knows the literal --snx-* custom property names (defined in
// app.css) and the Horizon severity vocabulary (positive/critical/warning/
// info -- never success/error, see app.css's own banner comment). Nothing
// here holds an actual color: CSS keeps owning color via design tokens,
// this module just gives the JS/TS side compile-time safety instead of
// scattered string literals that could silently drift or typo.

export type Severity = 'positive' | 'critical' | 'warning' | 'info'

// Matches the severity/label pairing already used throughout Dashboard.tsx
// and ResultSummary.tsx -- centralized here so it can't drift between call
// sites, and so a future severity gets one place to add a label.
export const SEVERITY_LABELS: Record<Severity, string> = {
    positive: 'Complete',
    critical: 'Error',
    warning: 'Review',
    info: 'Running',
}

// The --snx-* custom properties app.css defines on :root. A typo here is a
// TS compile error; a typo in a raw `var(--snx-...)` string literal is a
// silent no-op var() that resolves to nothing at runtime.
export const CSS_VAR = {
    surface: '--snx-color-surface',
    border: '--snx-color-border',
    text: '--snx-color-text',
    textMuted: '--snx-color-text-muted',
    navSurface: '--snx-color-nav-surface',
    navText: '--snx-color-nav-text',
    navSelected: '--snx-color-nav-selected',
    accent: '--snx-color-accent',
    focus: '--snx-color-focus',
    spaceTight: '--snx-space-tight',
    spaceInner: '--snx-space-inner',
    spaceOuter: '--snx-space-outer',
    spaceSection: '--snx-space-section',
    radiusContainer: '--snx-radius-container',
    radiusChrome: '--snx-radius-chrome',
    radiusIndicator: '--snx-radius-indicator',
    morph: '--snx-morph',
} as const

export type CssVarKey = keyof typeof CSS_VAR

// var(--snx-x) or var(--snx-x, fallback) -- for the rare inline style that
// needs one of these outside a stylesheet.
export function cssVar(name: CssVarKey, fallback?: string): string {
    return fallback ? `var(${CSS_VAR[name]}, ${fallback})` : `var(${CSS_VAR[name]})`
}

// The four custom properties MetricTile's cursor-tracking tilt/glow effect
// reads and writes directly via style.setProperty -- typed here so the
// effect's writer (MetricTile.tsx) and app.css's reader use the same
// literal string, instead of that string existing only as a code comment.
export const TILT_VAR = {
    tiltX: '--iscan-tilt-x',
    tiltY: '--iscan-tilt-y',
    glowX: '--iscan-glow-x',
    glowY: '--iscan-glow-y',
} as const
