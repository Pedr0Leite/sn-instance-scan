import { useEffect, useState } from 'react'

// Animates a tile's number counting up to its real value on mount/change.
// Skips the animation entirely under prefers-reduced-motion -- the final
// value renders immediately, no motion at all, per the reduced-motion
// contract every other effect in this app already honors.
export function useCountUp(target: number, durationMs = 700): number {
    const [current, setCurrent] = useState(() =>
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? target
            : 0
    )

    useEffect(() => {
        if (
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            setCurrent(target)
            return
        }
        let raf = 0
        const start = performance.now()
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs)
            const eased = 1 - Math.pow(1 - t, 3)
            setCurrent(Math.round(target * eased))
            if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [target, durationMs])

    return current
}
