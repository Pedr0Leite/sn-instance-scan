import React, { useEffect, useState } from 'react'

/* Full Mosaic shell (console v6): the rail is now full-height from the very
   top of the page (brand at its top, nothing above it) with a slim header to
   its right -- rather than a rail plus a separate big page-level title that
   duplicated the same "Instance Scan Console" name. The theme toggle moved to
   that header (see components/ui.tsx's ThemeToggle) since Mosaic's own header
   carries the global actions; this rail keeps only navigation + its own
   collapse control.

   Grouped sections (a flat list read as one undifferentiated block once
   Cross-References/Customizations were added), plus a collapse toggle to
   icon-only width -- the admin-dashboard hallmark this console was missing
   entirely.

   The previous version positioned one sliding pill via a hardcoded per-item
   pixel step (ITEM_STEP) computed from an assumed flat list. Grouping breaks
   that assumption (group labels take vertical space the math never counted),
   so the indicator is now a plain per-item active background + left accent
   bar -- less exotic, but correct regardless of how many groups/labels sit
   above an item, and it still animates via a color/transform transition. */
interface NavItem {
    view: string
    label: string
    glyph: string
}
interface NavGroup {
    label: string
    items: NavItem[]
}

const GROUPS: NavGroup[] = [
    { label: 'Overview', items: [{ view: 'dashboard', label: 'Dashboard', glyph: '◧' }] },
    {
        label: 'Scans',
        items: [
            { view: 'runs', label: 'Scan Runs', glyph: '▶' },
            { view: 'results', label: 'Scan Results', glyph: '▤' },
        ],
    },
    {
        label: 'Governance',
        items: [
            { view: 'crossrefs', label: 'Cross-References', glyph: '⇄' },
            { view: 'customizations', label: 'Customizations', glyph: '✎' },
        ],
    },
]

const COLLAPSE_KEY = 'iscan-nav-collapsed'

function getInitialCollapsed(): boolean {
    try {
        return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
        return false
    }
}

interface SideNavProps {
    current: string
    onNavigate: (view: string) => void
}

export default function SideNav({ current, onNavigate }: SideNavProps) {
    const [collapsed, setCollapsed] = useState(getInitialCollapsed)

    // The shell's grid column width lives in app.css, keyed off this same
    // document-level attribute the way utils/theme.ts already keys dark mode
    // off data-theme -- avoids threading collapsed state through app.tsx just
    // so one grid-template-columns value can react to it.
    useEffect(() => {
        document.documentElement.setAttribute('data-nav-collapsed', collapsed ? 'true' : 'false')
    }, [collapsed])

    const toggleCollapsed = () => {
        setCollapsed(c => {
            const next = !c
            try {
                localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
            } catch {
                // Persistence is a nicety -- the toggle still works this load.
            }
            return next
        })
    }

    return (
        <nav
            className={collapsed ? 'iscan-nav iscan-nav--collapsed' : 'iscan-nav'}
            aria-label="Instance scan console sections"
        >
            <div className="iscan-nav__brand">
                {!collapsed ? (
                    <>
                        <span className="iscan-nav__brand-name">Instance Scan Console</span>
                        <span className="iscan-nav__brand-sub">Now Platform app</span>
                    </>
                ) : (
                    <span className="iscan-nav__brand-name iscan-nav__brand-name--mark" aria-hidden="true">
                        ISC
                    </span>
                )}
            </div>
            {GROUPS.map(group => (
                <div className="iscan-nav__group" key={group.label}>
                    {!collapsed ? <div className="iscan-nav__group-label">{group.label}</div> : null}
                    <ul className="iscan-nav__list">
                        {group.items.map(item => {
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
                                        title={collapsed ? item.label : undefined}
                                        onClick={() => onNavigate(item.view)}
                                    >
                                        <span className="iscan-nav__glyph" aria-hidden="true">
                                            {item.glyph}
                                        </span>
                                        {!collapsed ? item.label : (
                                            <span className="iscan-visually-hidden">{item.label}</span>
                                        )}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            ))}
            <div className="iscan-nav__footer">
                <button
                    type="button"
                    className="iscan-nav__collapse"
                    aria-pressed={collapsed}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    onClick={toggleCollapsed}
                >
                    {collapsed ? '»' : '« Collapse'}
                </button>
            </div>
        </nav>
    )
}
