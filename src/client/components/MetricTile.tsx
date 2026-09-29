import React, { useRef } from 'react'
import { useCountUp } from '../utils/useCountUp'
import type { Severity } from '../utils/tokens'
import { TILT_VAR } from '../utils/tokens'

interface MetricTileProps {
    label: string
    count: number
    /* Horizon severity naming only: positive / critical / warning / info. */
    severity?: Severity
    severityLabel?: string
    // When set, the whole tile becomes a real <button> (see app.css's
    // .iscan-tile__hit) that runs an arbitrary in-app action.
    onActivate?: () => void
    // When set (and onActivate is not), the whole tile becomes a real <a>
    // opening this URL in a new tab -- Dashboard's KPI tiles all link to the
    // platform list of the exact table/query their number comes from. Takes
    // priority over onActivate if somehow both are given.
    href?: string
    // Numeral size per the design spec's type scale (run-activity tiles read
    // largest, per-result detail tiles smaller). Defaults to the coverage/
    // detail-adjacent size used everywhere this isn't passed explicitly.
    size?: 'xl' | 'lg' | 'md'
    // Mosaic KPI tiles carry a small inline proportion bar under the number --
    // 0..1 of *this tile's own count against a meaningful total the caller
    // already has* (e.g. this status's share of all runs). Optional and never
    // fabricated: a tile with no real total to compare against renders none,
    // per the "don't invent fake trends" constraint -- there is no historical
    // series stored anywhere in this app to draw a real sparkline from.
    proportion?: number
}

/* Own element, not a platform <now-card> -- see app.css's tile section for
   why (Card is an external uxasset with its own shadow root; its surface is
   unreachable from here). Two reactbits-inspired, dependency-free touches:
   a cursor-following tilt + glow (plain JS setting CSS custom properties
   directly on the node, no re-render), and the count-up on mount/update.
   Both are inert wherever @media (prefers-reduced-motion: reduce) applies --
   the CSS side neutralizes transform/opacity there, and useCountUp renders
   the final value immediately instead of animating to it. */
export default function MetricTile({
    label,
    count,
    severity,
    severityLabel,
    onActivate,
    href,
    size = 'lg',
    proportion,
}: MetricTileProps) {
    const ref = useRef<HTMLDivElement>(null)
    const shown = useCountUp(count)

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const px = ((e.clientX - rect.left) / rect.width) * 100
        const py = ((e.clientY - rect.top) / rect.height) * 100
        el.style.setProperty(TILT_VAR.tiltX, `${(50 - py) / 8}deg`)
        el.style.setProperty(TILT_VAR.tiltY, `${(px - 50) / 8}deg`)
        el.style.setProperty(TILT_VAR.glowX, `${px}%`)
        el.style.setProperty(TILT_VAR.glowY, `${py}%`)
    }

    const onMouseLeave = () => {
        const el = ref.current
        if (!el) return
        el.style.setProperty(TILT_VAR.tiltX, '0deg')
        el.style.setProperty(TILT_VAR.tiltY, '0deg')
    }

    const pct = typeof proportion === 'number' ? Math.max(0, Math.min(1, proportion)) : null

    const content = (
        <>
            <span className={`iscan-tile__value iscan-tile__value--${size}`}>{shown}</span>
            <span className="iscan-tile__label">{label}</span>
            {pct !== null ? (
                <span
                    className="iscan-tile__bar"
                    role="img"
                    aria-label={`${Math.round(pct * 100)}% of total`}
                >
                    <span
                        className={severity ? `iscan-tile__bar-fill iscan-tile__bar-fill--${severity}` : 'iscan-tile__bar-fill'}
                        style={{ inlineSize: `${pct * 100}%` }}
                    />
                </span>
            ) : null}
            {severity && severityLabel ? (
                <span className={`iscan-status iscan-status--${severity}`}>{severityLabel}</span>
            ) : null}
            {/* "Opens in new tab" affordance -- hidden until hover/focus via CSS,
               so it doesn't compete with the number at rest. */}
            {href ? (
                <span className="iscan-tile__external" aria-hidden="true">
                    ↗
                </span>
            ) : null}
        </>
    )

    return (
        <li>
            <div className="iscan-tile" ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
                {href ? (
                    <a
                        className="iscan-tile__hit"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${label}: ${shown}. Opens the source list in a new tab.`}
                    >
                        {content}
                    </a>
                ) : onActivate ? (
                    <button
                        type="button"
                        className="iscan-tile__hit"
                        onClick={onActivate}
                        aria-label={`${label}: ${shown}. Open details.`}
                    >
                        {content}
                    </button>
                ) : (
                    content
                )}
            </div>
        </li>
    )
}
