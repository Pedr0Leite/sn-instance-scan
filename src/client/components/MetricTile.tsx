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
    // .iscan-tile__hit) that navigates somewhere -- e.g. Dashboard's
    // cross-reference/customization tiles jump to their dedicated views
    // instead of just reporting a count nobody can act on.
    onActivate?: () => void
    // Numeral size per the design spec's type scale (run-activity tiles read
    // largest, per-result detail tiles smaller). Defaults to the coverage/
    // detail-adjacent size used everywhere this isn't passed explicitly.
    size?: 'xl' | 'lg' | 'md'
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
    size = 'lg',
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

    const content = (
        <>
            <span className={`iscan-tile__value iscan-tile__value--${size}`}>{shown}</span>
            <span className="iscan-tile__label">{label}</span>
            {severity && severityLabel ? (
                <span className={`iscan-status iscan-status--${severity}`}>{severityLabel}</span>
            ) : null}
        </>
    )

    return (
        <li>
            <div className="iscan-tile" ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
                {onActivate ? (
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
