#!/usr/bin/env node
/*
 * Parity check: IscanCmdbHealthScorer (JS, runs on the instance) against the
 * upstream Python scorer score_results.py.
 *
 *     node tests/cmdb-health-scorer.parity.mjs
 *
 * Runs the REAL script include files in a Node vm sandbox - not a copy - so what
 * passes here is exactly what deploys. The scorer can run under Node only
 * because it makes no Glide calls; keep it that way.
 *
 * Ground truth is tests/fixtures/cmdb-health/golden.json, produced by running
 * the real Python scorer end to end (scripts/gen-cmdb-golden.py). Compared per
 * fixture: overall score, checks scored, status counts, every per-check status,
 * the worst-first ordering, the measure strings, theme scores and stage labels.
 * The catalog script include is also deep-compared against the upstream JSON,
 * so a hand edit to that generated file fails here.
 *
 * No framework and no new dependency - node:assert and node:vm only. This is
 * NOT an ATF test (the repo's standing rule is no new ATF entries); it needs no
 * instance and runs in well under a second.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIX = join(ROOT, 'tests', 'fixtures', 'cmdb-health')

// The three acceptance targets from the feature spec, asserted literally so a
// regenerated golden file can never quietly move the goalposts.
const ACCEPTANCE = {
    'demo_instance_results.json': { overall: 67, scored: 35, counts: { fail: 9, warn: 6, pass: 20, n_a: 12, not_assessed: 2 } },
    'sample_results.json': { overall: 17, scored: 42, counts: { fail: 31, warn: 6, pass: 5, n_a: 5, not_assessed: 2 } },
    'ven0295.txt': { overall: 65, scored: 36, counts: { fail: 10, warn: 6, pass: 20, n_a: 13, not_assessed: 0 } },
}

// Minimal ServiceNow runtime: the script includes only need Class.create().
const ctx = vm.createContext({})
vm.runInContext(
    'var Class = { create: function () { return function () { this.initialize.apply(this, arguments) } } }',
    ctx
)
for (const f of ['IscanCmdbHealthCatalog.server.js', 'IscanCmdbHealthScorer.server.js']) {
    vm.runInContext(readFileSync(join(ROOT, 'src', 'server', f), 'utf8'), ctx, { filename: f })
}
const catalog = vm.runInContext('new IscanCmdbHealthCatalog().get()', ctx)
const scorer = vm.runInContext('new IscanCmdbHealthScorer()', ctx)
// Values created inside the vm have the vm's Object prototype; round-trip them so
// deepStrictEqual compares data rather than realm identity.
const plain = v => JSON.parse(JSON.stringify(v))

// score_results.py load_results(): the JSON between the collector's markers,
// otherwise the first "{" to the last "}".
function loadResults(path) {
    let text = readFileSync(path, 'utf8')
    const m = text.match(/===CMDB_HEALTH_JSON_START===([\s\S]*?)===CMDB_HEALTH_JSON_END===/)
    if (m) text = m[1]
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
}

let failures = 0
function check(label, fn) {
    try {
        fn()
        console.log('  ok   ' + label)
    } catch (e) {
        failures++
        console.log('  FAIL ' + label + '\n       ' + String(e.message).split('\n').join('\n       '))
    }
}

console.log('catalog')
check('generated catalog SI equals upstream check_catalog.json', () =>
    assert.deepStrictEqual(plain(catalog), JSON.parse(readFileSync(join(FIX, 'check_catalog.json'), 'utf8')))
)
check('catalog has 49 checks', () => assert.equal(catalog.checks.length, 49))

const golden = JSON.parse(readFileSync(join(FIX, 'golden.json'), 'utf8'))

for (const name of Object.keys(ACCEPTANCE)) {
    console.log('\n' + name)
    const results = loadResults(join(FIX, name))
    const out = plain(scorer.score(results, catalog))
    const g = golden[name]
    const want = ACCEPTANCE[name]

    check(`overall ${want.overall}/100, ${want.scored} scored (acceptance)`, () => {
        assert.equal(out.overall, want.overall)
        assert.equal(out.checksScored, want.scored)
        assert.deepStrictEqual(out.counts, want.counts)
    })
    check('headline matches the Python scorer', () => {
        assert.equal(out.overall, g.overall)
        assert.equal(out.checksScored, g.scored)
        assert.deepStrictEqual(out.counts, g.counts)
    })
    check('every one of the 49 catalog checks produces a row', () => {
        assert.equal(out.rows.length, 49)
        assert.deepStrictEqual(
            out.rows.map(r => r.id).sort(),
            plain(catalog.checks.map(c => c.id)).sort()
        )
    })
    check('per-check status matches Python for all 49 checks', () => {
        const mine = Object.fromEntries(out.rows.map(r => [r.id, r.status]))
        const theirs = Object.fromEntries(g.findings.map(f => [f.id, f.status]))
        assert.deepStrictEqual(mine, theirs)
    })
    check('worst-first ordering matches Python', () =>
        assert.deepStrictEqual(out.ordered.map(r => r.id), g.findings.map(f => f.id))
    )
    check('measure strings match Python', () => {
        const mine = out.ordered.map(r => ({ id: r.id, measure: scorer.formatMeasure(r.check, r.res, r.pct) }))
        assert.deepStrictEqual(plain(mine), g.findings.map(f => ({ id: f.id, measure: f.measure })))
    })
    check('theme scores match Python', () =>
        assert.deepStrictEqual(out.themes.map(t => ({ theme: t.theme, score: t.score })), g.themes)
    )
    check('stage readiness (score + label, incl. anchor override) matches Python', () =>
        assert.deepStrictEqual(out.stages, g.stages)
    )
    check('unknown result IDs are ignored and listed, as in Python', () =>
        assert.deepStrictEqual(out.unknownIds, g.unknown)
    )
    // The LLM export embeds this markdown, so it must be exactly what the
    // skill's own scorer prints - emoji icons, em dashes, spacing and all.
    check('markdown report is byte-identical to score_results.py output', () => {
        const mine = scorer.toMarkdown(scorer.score(results, catalog), catalog)
        if (mine !== g.markdown) {
            const a = mine.split('\n'), b = g.markdown.split('\n')
            const i = a.findIndex((line, n) => line !== b[n])
            assert.fail(`first difference at line ${i + 1}:\n  js:     ${JSON.stringify(a[i])}\n  python: ${JSON.stringify(b[i])}`)
        }
    })
}

// Python rounding semantics the port depends on - pinned explicitly because the
// fixtures happen not to land on a tie, so they would not catch a regression.
console.log('\nrounding')
const S = vm.runInContext('IscanCmdbHealthScorer', ctx)
check('pyRound ties to even like Python round()', () => {
    assert.deepStrictEqual([0.5, 1.5, 2.5, 66.5, 67.5, 66.4, 66.6].map(S.pyRound), [0, 2, 2, 66, 68, 66, 67])
})
// Expected values are Python's own output for these inputs. 12.25/12.75/0.25/
// 0.75 are exact ties (round to even); 12.35 and 0.15 sit just BELOW their
// decimal and 0.05/99.95/33.35 just ABOVE, so they round on the exact value.
// 12.35 is the regression case: x*10 turns it into a false tie.
check('fixed1 matches Python format(x, ".1f"), incl. exact ties and false ties', () => {
    assert.deepStrictEqual(
        [12.25, 12.75, 0.25, 0.75, 12.35, 0.15, 0.05, 99.95, 33.35, 7.0].map(S.fixed1),
        ['12.2', '12.8', '0.2', '0.8', '12.3', '0.1', '0.1', '100.0', '33.4', '7.0']
    )
})

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall parity checks passed')
process.exit(failures ? 1 : 0)
