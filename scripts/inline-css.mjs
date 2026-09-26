/* Inlines src/client/app.css into src/client/index.html before every build.

   Why this exists: `import './app.css'` in app.tsx makes now-sdk emit
   dist/static/app.css as a standalone asset, but that asset is NEVER installed
   -- the only sys_ux_lib_asset records the build produces are the JS bundle and
   its sourcemap -- and nothing injects a <link> for it. The published page
   therefore loaded no stylesheet at all, which is why the console rendered as
   unstyled HTML with native browser controls no matter what app.css said.

   A UI Page can always carry its own <style>, so that is where the CSS goes,
   exactly as sn-plugin-update-manager does. app.css stays the single source of
   truth; this script copies it in, so nobody edits CSS in two places.

   Runs from the `prebuild` npm lifecycle -- not a bundler config, of which this
   project has none and should never gain one. */
import { readFileSync, writeFileSync } from 'node:fs'

const CSS = 'src/client/app.css'
const HTML = 'src/client/index.html'
const OPEN = '<style id="iscan-styles">'
const CLOSE = '</style>'

const css = readFileSync(CSS, 'utf8')

// A CDATA close sequence inside the page's own CDATA wrapper splits it in two
// and renders a stray bracket into the DOM -- the blank-page bug this repo has
// already hit once. Fail the build rather than ship that.
if (css.includes(']]>')) {
    throw new Error(`${CSS} contains a CDATA close sequence; it cannot be inlined into a UI Page.`)
}

const html = readFileSync(HTML, 'utf8')
const start = html.indexOf(OPEN)
if (start === -1) throw new Error(`${HTML} is missing the ${OPEN} marker.`)
const end = html.indexOf(CLOSE, start)
if (end === -1) throw new Error(`${HTML} is missing the closing </style> for ${OPEN}.`)

const next = html.slice(0, start + OPEN.length) + '\n' + css + '\n    ' + html.slice(end)
if (next !== html) {
    writeFileSync(HTML, next)
    console.log(`[inline-css] inlined ${css.length} bytes of ${CSS} into ${HTML}`)
} else {
    console.log('[inline-css] already up to date')
}
