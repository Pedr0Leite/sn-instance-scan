import React from 'react'
import { useTheme } from '../utils/theme'

/* Own markup, not platform Buttons. The design's rail is a sliding accent pill
   behind the items plus a per-item state dot -- neither can be drawn through a
   <now-button>'s shadow root, which is the same reason the lists and tiles were
   converted earlier. The pill is ONE element that moves, not a per-item
   background, so the movement between sections is continuous. */
const ITEMS: { view: string; label: string }[] = [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'runs', label: 'Scan Runs' },
    { view: 'results', label: 'Scan Results' },
    { view: 'crossrefs', label: 'Cross-References' },
    { view: 'customizations', label: 'Customizations' },
]

/* Item height (38px) + list gap (8px). The pill is positioned by index, so this
   must stay in step with .iscan-nav__link's height and .iscan-nav__list's gap
   in app.css -- they are declared from these same two numbers. */
const ITEM_STEP = 46

interface SideNavProps {
    current: string
    onNavigate: (view: string) => void
}

export default function SideNav({ current, onNavigate }: SideNavProps) {
    const [theme, toggleTheme] = useTheme()
    const isDark = theme === 'dark'
    const activeIndex = ITEMS.findIndex(item => item.view === current)

    return (
        <nav className="iscan-nav" aria-label="Instance scan console sections">
            <div className="iscan-nav__brand">
                <span className="iscan-nav__brand-name">Instance Scan Console</span>
                <span className="iscan-nav__brand-sub">Now Platform app</span>
            </div>
            <ul className="iscan-nav__list">
                {/* Decorative: the selected item already carries aria-current. */}
                {activeIndex >= 0 ? (
                    <li
                        className="iscan-nav__pill"
                        aria-hidden="true"
                        style={{ transform: `translateY(${activeIndex * ITEM_STEP}px)` }}
                    />
                ) : null}
                {ITEMS.map(item => {
                    const active = current === item.view
                    return (
                        <li key={item.view}>
                            <button
                                type="button"
                                className={
                                    active
                                        ? 'iscan-nav__link iscan-nav__link--active'
                                        : 'iscan-nav__link'
                                }
                                aria-current={active ? 'page' : undefined}
                                onClick={() => onNavigate(item.view)}
                            >
                                <span className="iscan-nav__dot" aria-hidden="true" />
                                {item.label}
                            </button>
                        </li>
                    )
                })}
            </ul>
            {/* Real labelled toggle control, not a styled <div> -- role="switch" +
                aria-checked reports state to assistive tech, and it stays a native
                <button> so it is keyboard-reachable without extra wiring. */}
            <div className="iscan-nav__footer">
                <span className="iscan-nav__theme-label">{isDark ? 'Dark' : 'Light'} mode</span>
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
            </div>
        </nav>
    )
}
