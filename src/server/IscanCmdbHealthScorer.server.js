/*
 * Script Include: IscanCmdbHealthScorer
 * Client callable: false.
 *
 * Scores CMDB & CSDM Health evidence against the check catalog. A 1:1 port of
 * noviq-cmdb-health scripts/score_results.py: evaluate(), score_group(),
 * stage_label(), the stage-anchor "Not started" override, worst-first ordering,
 * fmt_measure() and kb_links().
 *
 * PURE JavaScript - no Glide API calls anywhere in this file. That is a hard
 * requirement, not a style choice: it is what lets
 * tests/cmdb-health-scorer.parity.mjs run this exact file under Node and prove
 * it produces the same scores and per-check statuses as the Python scorer on
 * the three upstream fixtures. Keep Glide calls in IscanCmdbHealthScanner /
 * IscanScanOrchestrator.
 *
 * Status values are the x_nold_iscan_cmdb_check.status choice values:
 * fail | warn | pass | n_a | not_assessed. Python spells the last two "n/a" and
 * "not assessed"; the parity test maps between them.
 */
var IscanCmdbHealthScorer = Class.create()

// Worst first, as in score_results.py STATUS_ORDER.
IscanCmdbHealthScorer.STATUS_ORDER = { fail: 0, warn: 1, pass: 2, n_a: 3, not_assessed: 4 }
IscanCmdbHealthScorer.PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }
// Only these three statuses contribute to a score (score_results.py SCORE).
IscanCmdbHealthScorer.SCORE = { pass: 1.0, warn: 0.5, fail: 0.0 }
IscanCmdbHealthScorer.LABEL = {
    fail: 'Fail',
    warn: 'Warn',
    pass: 'Pass',
    n_a: 'N/A',
    not_assessed: 'Not assessed',
}

/**
 * Python 3's round(x) for a float: nearest integer, ties to EVEN, decided on the
 * exact binary value. JS Math.round() rounds ties UP, so a weighted score that
 * lands on exactly .5 would be one point higher than the Python scorer's -
 * score_group() uses round(). x - floor(x) is exact for the magnitudes seen here.
 */
IscanCmdbHealthScorer.pyRound = function (x) {
    var f = Math.floor(x)
    var diff = x - f
    if (diff > 0.5) return f + 1
    if (diff < 0.5) return f
    return f % 2 === 0 ? f : f + 1
}

/**
 * Python's format(x, '.<n>f'). Both Python and toFixed() round the EXACT binary
 * value, so they agree everywhere except on an exact tie: Python rounds a tie to
 * EVEN, toFixed rounds it up (12.25 -> Python '12.2', toFixed '12.3').
 *
 * The tie must be detected from the exact decimal expansion, never from
 * x * 10^n: 12.35 is really 12.3499999..., but 12.35 * 10 rounds in floating
 * point to exactly 123.5 - a false tie that printed '12.4' where Python prints
 * '12.3' (caught by the parity test). toFixed(20) exposes the exact digits; any
 * double within 1e-20 of a tie at these magnitudes IS that tie, since the spacing
 * between doubles near 1-100 is ~1e-15. Display only - never used for scoring.
 */
IscanCmdbHealthScorer.fixedN = function (x, n) {
    var exact = x.toFixed(20)
    var dot = exact.indexOf('.')
    var rest = exact.slice(dot + 1 + n)
    if (/^50*$/.test(rest)) {
        var truncated = exact.slice(0, dot + 1 + n)
        var digit = Number(exact.charAt(dot + n))
        if (digit % 2 === 0) return truncated
        var scale = Math.pow(10, n)
        return ((Math.round(Number(truncated) * scale) + 1) / scale).toFixed(n)
    }
    return x.toFixed(n)
}
IscanCmdbHealthScorer.fixed1 = function (x) {
    return IscanCmdbHealthScorer.fixedN(x, 1)
}

/** Python str(): None prints as 'None'. Used where Python interpolates raw values. */
IscanCmdbHealthScorer.pyStr = function (v) {
    return v === null || v === undefined ? 'None' : String(v)
}

/** Python's '{:,}' for an integer: thousands separators, locale-independent. */
IscanCmdbHealthScorer.commas = function (n) {
    var neg = n < 0
    var s = String(Math.abs(n))
    var out = ''
    while (s.length > 3) {
        out = ',' + s.slice(-3) + out
        s = s.slice(0, -3)
    }
    return (neg ? '-' : '') + s + out
}

/*
 * Brief prepended to the scored findings by buildLlmContext(): the task, the
 * report structure (noviq-cmdb-health assets/report_template.md) and the
 * interpretation, roadmap, expert-judgment and safety rules from its SKILL.md,
 * copied verbatim. This is what lets an LLM write the narrative and roadmap
 * that this app deliberately does not generate itself.
 */
IscanCmdbHealthScorer.LLM_BRIEF = "# Task: write a CMDB & CSDM Health assessment\n\nYou are given the scored output of a read-only CMDB & CSDM Health scan of a ServiceNow instance (after the \"---\" line below). The scores, statuses and per-check measures are already computed - do not re-score. Write the parts of the deliverable that need judgment: the executive summary, the root-cause clusters, and the staged remediation roadmap, following the structure and rules below.\n\nRules for this task:\n- Base every statement on the findings below. Cite check IDs and playbook KB numbers.\n- \"Not assessed\" and \"N/A\" are different: N/A means the population is empty on this instance (itself often a CSDM-stage finding); not assessed means the check could not run. Never treat either as a pass.\n- The rules below come from the noviq-cmdb-health skill. Where they mention files (references/*.md, scripts/*, examples/), those files are not included here; rely on the rules as written.\n\n## Report structure\n\n# CMDB & CSDM Health Assessment — {Customer} ({instance})\n\n_Assessment date · release family · evidence route (A collector / B list views / C dashboards / D interview) · assessor_\n\n## 1. Executive summary (one page)\n- **Overall health score:** {score}/100 — {one-sentence interpretation}\n- **CSDM stage:** {current stage achieved} → next target {stage}\n- **Top 5 risks (business language):** e.g. \"Changes can't show which services they affect (62% of changes lack a service)\".\n- **Wave-1 actions (next 30 days):** 3–5 bullets with owners.\n- **What this unlocks:** products/capabilities enabled once fixed (e.g. EA technology risk, group sync, service impact).\n\n## 2. Scope and method\nInstance, clone date, modules/licences in use, discovery sources, what was and wasn't assessed and why, thresholds used (defaults or agreed), heuristics and their caveats.\n\n## 3. Scorecard\n- Score by theme (table from `score_results.py`)\n- CSDM stage readiness (table)\n- CI inventory profile (top classes, custom classes)\n\n## 4. Key findings by root cause\nFor each cluster (see SKILL.md §4): symptoms (check IDs + measures), root cause, business impact, evidence samples.\n\n## 5. Detailed findings\nFull findings table (worst first) with playbook KB links; per-check detail for Fail/Warn.\n\n## 6. Recommendations and roadmap\nWaves 1–4 (references/best-practices.md §9). For each action: check IDs · KB · effort S/M/L · owner role · dependency · value unlocked.\n\n## 7. Governance and KPIs\nRoles, cadence, targets (best-practices §8), dashboards to monitor, attestation plan.\n\n## 8. Appendix\n- Not assessed / N/A list\n- Remediation safety checklist (playbooks.md §6)\n- Playbook cross reference (playbooks.md §5)\n- Raw collector output reference\n\n## Interpretation and recommendation rules\n\n### 4. Interpret — look for root causes, not just red indicators\n\nIndividual checks are symptoms. Group them before recommending. Common patterns:\n\n| Symptom cluster | Likely root cause | Lead recommendation |\n|---|---|---|\n| Empty discovery source + duplicates + direct transform maps into `cmdb_ci*` | Integrations bypass the IRE | Re-platform integrations onto IRE (Service Graph Connectors, IntegrationHub ETL, or `CMDBTransformUtil`); register data sources; set reconciliation rules |\n| Stale CIs + missing serials/models + name ≠ host name | Discovery coverage gaps or failing schedules; manual CI creation | Fix discovery credentials/schedules; stop manual creation of discoverable classes; CMDB Data Manager retire policies |\n| Custom classes, custom service/business-app tables, custom status choices, modified relationship types | Pre-CSDM custom data model (technical debt) | CSDM migration using the 5-step method; refactor or drop attributes (Best Practice / Keep / Refactor / DNN) |\n| Incidents/changes without CI or service; business apps used as affected CI | ITSM process not consuming CMDB, or CI picker unusable | Make CI mandatory at resolution/closure, improve CI identification attributes, restrict pickers to operational classes |\n| TSOs without support/change group or parent; CIs in several TSOs; DCGs without CMDB group | Walk stage started but incomplete | Complete TSO model; one TSO per CI; enable group synchronisation |\n| Business units without company, location hierarchy gaps, duplicate locations, model owners missing | Foundation data has no trusted source or owner | Name a source and owner per foundation table; integrate HR/real-estate sources; location hierarchy with Location Type |\n\nRead the **CSDM population** table before the scores: if the anchor tables for a stage are empty (no Business Applications or Service Instances for Crawl, no TSOs for Walk…), the stage is *not started*, however green its peripheral checks look. Check **relationship density** too — well under 1 relationship per CI means impact analysis cannot work. If `last_discovered` is empty everywhere, \"fresh\" CIs are not evidence of discovery.\n\nRecognise **demo data** (ServiceNow sample records such as San Diego addresses, \"Retail\" services, `CHG00000xx` numbers) and say the findings describe the demo data set, not a customer.\n\nAlso sanity-check the numbers against each other: 40% stale CIs but 0 duplicates usually means duplicate detection isn't running, not that there are no duplicates.\n\n### 5. Recommend — a staged roadmap\n\nUse `references/best-practices.md`. Structure recommendations in waves so the customer isn't handed 45 equal-weight tasks:\n\n1. **Stop the bleeding (0–30 days):** anything that keeps creating bad data — non-IRE integrations, inactive asset/CI business rules, manual creation of discoverable classes, deleted/modified base relationship types.\n2. **Fix the foundation (1–3 months):** foundation data, duplicates, orphans, stale-CI policy, models and serials.\n3. **Progress the CSDM stage (3–12 months):** close the gaps for the customer's *next* stage only (Crawl → Walk → Run → Fly). Do not recommend Fly-stage work to a customer failing Crawl.\n4. **Govern and sustain (ongoing):** ownership, CMDB Health KPIs, data certification/attestation, change control on the class model.\n\nFor each recommendation give: the check IDs it resolves, the playbook KB number(s), effort (S/M/L), owner role, and the product value it unlocks (e.g. \"enables EA Technology Portfolio Management risk\", \"enables group sync to CIs\").\n\n### 6. Deliver\n\nFollow `assets/report_template.md`. Keep the executive summary to a page: overall score, CSDM stage, top five risks in business language, and the wave-1 actions. Put the full findings table and per-check detail in the body. Always list what was *not assessed* and why.\n\nAsk the user what form they want the report in (reply, doc, or a file such as Word/PowerPoint/Excel) if they haven't said.\n\n## Expert judgments to apply consistently\n\n- **Operational vs. design CIs.** Business Applications, Business Capabilities, Information Objects and SDLC Components are not targets for Incident/Problem/Change. Operational choices are Application Services (and other Service Instances), Service Offerings, and infrastructure CIs.\n- **`cmdb_ci_appl` is discovered, not an inventory.** Manually populated Application CIs are a finding; the application inventory belongs in Business Application.\n- **What would Discovery do (WWDD).** When relationships are created manually, use the types Discovery/Service Mapping would create.\n- **One Technology Management Service Offering per CI.** A CI reached by several TSOs (directly or via Dynamic CI Groups) gets its support/change/managed-by groups overwritten by group synchronisation.\n- **Retire, don't delete.** Use life cycle status and CMDB Data Manager policies (retire → archive → delete) rather than ad-hoc deletion; deletion breaks task history and audit.\n- **Don't change base choice values or base relationship types.** Product features depend on their values and sys_ids.\n- **Life Cycle Stage / Product Instance 2.0.** Recommend evaluating dependencies on legacy status fields (reports, scripts, integrations) before enabling; PI 2.0 disables legacy status synchronisation and is hard to reverse — test in non-prod first.\n- **Relationship type for Business Application → Application Service.** KB0831503 and EA documentation historically require `Consumes::Consumed by`; the CSDM 5 relationship figure shows `Uses::Used by`. Report the distribution of types found, state which one the customer's EA release expects, and don't mass-change relationships without confirming.\n- **Heuristics are labelled as heuristics.** Detection of custom relationship types, relabelled choices and \"OOB-created\" records relies on creator names and update records. Recommend confirming against a Personal Developer Instance of the same family release before remediating.\n\n## Safety and tone\n\n- The assessment is read-only. Remediation steps in the report must say: back up, test in sub-production, run in small batches, validate.\n- Don't present thresholds as ServiceNow-mandated; they are this skill's defaults unless the customer has its own.\n- Don't reproduce KB article text; summarise and link by KB number.\n- Write for two audiences: an executive summary a CIO can read, and technical detail a CMDB admin can act on."

IscanCmdbHealthScorer.prototype = {
    initialize: function () {},

    /**
     * Scores one set of collector results.
     * @param {Object} results - {meta, inventory, checks:[{id,count,total,samples,note}]}
     * @param {Object} catalog - IscanCmdbHealthCatalog data (check_catalog.json shape)
     * @returns {Object} rows (catalog order), ordered (worst first), overall,
     *   checksScored, counts, themes, stages, population, unknownIds, meta
     */
    score: function (results, catalog) {
        var S = IscanCmdbHealthScorer
        var meta = (results && results.meta) || {}
        var defaults = catalog.defaults
        var weights = defaults.weights

        var byId = {}
        var resultChecks = (results && results.checks) || []
        for (var i = 0; i < resultChecks.length; i++) byId[resultChecks[i].id] = resultChecks[i]

        var catalogIds = {}
        var rows = []
        for (var c = 0; c < catalog.checks.length; c++) {
            var chk = catalog.checks[c]
            catalogIds[chk.id] = true
            var res = byId.hasOwnProperty(chk.id) ? byId[chk.id] : null
            var ev = this.evaluate(chk, res, defaults)
            rows.push({ id: chk.id, check: chk, res: res, status: ev.status, pct: ev.pct })
        }
        // Result IDs the catalog doesn't know are ignored and listed, as in Python.
        var unknownIds = []
        for (var k in byId) {
            if (byId.hasOwnProperty(k) && !catalogIds[k]) unknownIds.push(k)
        }

        var overall = this.scoreGroup(rows, weights)
        var counts = { fail: 0, warn: 0, pass: 0, n_a: 0, not_assessed: 0 }
        for (var r = 0; r < rows.length; r++) counts[rows[r].status]++

        return {
            rows: rows,
            ordered: this.order(rows),
            overall: overall.score,
            checksScored: overall.counted,
            counts: counts,
            themes: this.themeScores(rows, catalog, weights),
            stages: this.stageReadiness(rows, catalog, weights, meta),
            population: meta.csdm_population || {},
            unknownIds: unknownIds,
            meta: this.metaSummary(meta),
            rawMeta: meta,
            inventory: (results && results.inventory) || [],
        }
    },

    /**
     * score_results.py evaluate(). Returns {status, pct}; pct only for kind=pct.
     */
    evaluate: function (check, res, defaults) {
        // `is None` in Python: a missing count, or a missing result, is not assessed.
        if (res === null || res === undefined || res.count === null || res.count === undefined) {
            return { status: 'not_assessed', pct: null }
        }
        var count = res.count
        var total = res.total
        var kind = check.kind
        if (kind === 'bool') {
            return { status: count === 0 ? 'pass' : 'fail', pct: null }
        }
        if (kind === 'count') {
            // An explicit empty population (e.g. no TSOs exist) is n/a, not a pass.
            // Strict === mirrors Python's `total == 0`, which is False for None.
            if (total === 0) return { status: 'n_a', pct: null }
            var warnMax = check.hasOwnProperty('warn_max') ? check.warn_max : 0
            if (count === 0) return { status: 'pass', pct: null }
            return { status: count <= warnMax ? 'warn' : 'fail', pct: null }
        }
        // pct - `not total` in Python covers both None and 0.
        if (!total) return { status: 'n_a', pct: null }
        var pct = (100.0 * count) / total
        var th = check.pct_thresholds || defaults.pct_thresholds[check.priority]
        if (pct <= th.pass_max) return { status: 'pass', pct: pct }
        if (pct <= th.warn_max) return { status: 'warn', pct: pct }
        return { status: 'fail', pct: pct }
    },

    /**
     * score_results.py score_group(). Weighted, only pass/warn/fail count.
     * Same accumulation order and float ops as Python, then Python-style round.
     * @returns {{score: Number|null, counted: Number}}
     */
    scoreGroup: function (rows, weights) {
        var S = IscanCmdbHealthScorer
        var num = 0.0
        var den = 0.0
        var counted = 0
        for (var i = 0; i < rows.length; i++) {
            var st = rows[i].status
            if (S.SCORE.hasOwnProperty(st)) {
                var w = weights[rows[i].check.priority]
                num += w * S.SCORE[st]
                den += w
                counted++
            }
        }
        return { score: den ? S.pyRound((100 * num) / den) : null, counted: counted }
    },

    /** score_results.py stage_label(). */
    stageLabel: function (score, counted, rows) {
        var nNa = 0
        for (var i = 0; i < rows.length; i++) if (rows[i].status === 'n_a') nNa++
        if (counted === 0) {
            if (rows.length && nNa === rows.length) return 'Not started (no records)'
            return 'Not assessed'
        }
        var label
        if (score >= 85) label = 'Achieved'
        else if (score >= 60) label = 'In progress'
        else label = 'At risk'
        if (nNa && nNa * 2 >= rows.length) {
            label = 'Largely not started - ' + label.toLowerCase() + ' on the checks that apply'
        }
        if (nNa) label += ' (' + nNa + ' of ' + rows.length + ' checks have no records)'
        return label
    },

    /** "Score by theme" table - themes in catalog order. */
    themeScores: function (rows, catalog, weights) {
        var out = []
        for (var theme in catalog.themes) {
            if (!catalog.themes.hasOwnProperty(theme)) continue
            var tr = []
            for (var i = 0; i < rows.length; i++) if (rows[i].check.theme === theme) tr.push(rows[i])
            var sg = this.scoreGroup(tr, weights)
            var t = { theme: theme, description: catalog.themes[theme], score: sg.score, fail: 0, warn: 0, pass: 0, other: 0 }
            for (var j = 0; j < tr.length; j++) {
                var st = tr[j].status
                if (st === 'fail' || st === 'warn' || st === 'pass') t[st]++
                else t.other++ // n/a + not assessed, one column in the Python table
            }
            out.push(t)
        }
        return out
    },

    /**
     * "CSDM stage readiness". Foundation combines the Foundation, Hygiene and
     * Integration themes; later stages use their own theme. The stage-anchor
     * override replaces the label with "Not started" when every anchor entity
     * the collector counted has zero records - otherwise a stage with no
     * business applications at all could read "Achieved" off peripheral checks.
     */
    stageReadiness: function (rows, catalog, weights, meta) {
        var stageMap = { Foundation: ['Foundation', 'Hygiene', 'Integration'] }
        var pop = meta.csdm_population || {}
        var popHasKeys = false
        for (var pk in pop) if (pop.hasOwnProperty(pk)) { popHasKeys = true; break }
        var anchors = catalog.stage_anchors || {}
        var out = []
        for (var s = 0; s < catalog.stages.length; s++) {
            var st = catalog.stages[s]
            var themes = stageMap[st] || [st]
            var sr = []
            for (var i = 0; i < rows.length; i++) if (themes.indexOf(rows[i].check.theme) !== -1) sr.push(rows[i])
            var sg = this.scoreGroup(sr, weights)
            var label = this.stageLabel(sg.score, sg.counted, sr)
            var keys = anchors[st] || []
            // Python: pop and keys and all(not pop.get(k) for k in keys if k in pop)
            //         and any(k in pop for k in keys)
            if (popHasKeys && keys.length) {
                var anyPresent = false
                var allEmpty = true
                for (var k = 0; k < keys.length; k++) {
                    if (pop.hasOwnProperty(keys[k])) {
                        anyPresent = true
                        if (pop[keys[k]]) allEmpty = false
                    }
                }
                if (allEmpty && anyPresent) {
                    var names = []
                    for (var n = 0; n < keys.length; n++) names.push(keys[n].replace(/_/g, ' '))
                    label = 'Not started - no ' + names.join(' / ') + ' records (scores below reflect only peripheral checks)'
                }
            }
            out.push({ stage: st, score: sg.score, label: label })
        }
        return out
    },

    /**
     * Worst first: status, then priority, then highest percentage, then id.
     * Check IDs are unique, so this is a total order and the result does not
     * depend on the engine's sort stability (Rhino's is not guaranteed).
     */
    order: function (rows) {
        var S = IscanCmdbHealthScorer
        var copy = rows.slice()
        copy.sort(function (a, b) {
            var d = S.STATUS_ORDER[a.status] - S.STATUS_ORDER[b.status]
            if (d) return d
            d = S.PRIORITY_ORDER[a.check.priority] - S.PRIORITY_ORDER[b.check.priority]
            if (d) return d
            d = -(a.pct || 0) - -(b.pct || 0)
            if (d) return d < 0 ? -1 : 1
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
        })
        return copy
    },

    /** score_results.py fmt_measure(). */
    formatMeasure: function (check, res, pct) {
        var S = IscanCmdbHealthScorer
        if (!res || res.count === null || res.count === undefined) return '-'
        if (check.kind === 'pct' && res.total) {
            return S.commas(res.count) + ' / ' + S.commas(res.total) + ' (' + S.fixed1(pct) + '%)'
        }
        if (check.kind === 'bool') return res.count ? 'issue' : 'ok'
        var total = res.total
        // isinstance(total, int) and total
        var suffix = typeof total === 'number' && total % 1 === 0 && total ? ' (of ' + S.commas(total) + ')' : ''
        return S.commas(res.count) + suffix
    },

    /**
     * score_results.py kb_links(), as data rather than markdown so the HTML
     * report can build real anchors. Empty kb list means "CSDM best practice".
     * @returns {Array} [{kb, url}]
     */
    kbLinks: function (check, kbUrl) {
        var out = []
        for (var i = 0; i < check.kb.length; i++) {
            out.push({ kb: check.kb[i], url: kbUrl.replace('{kb}', check.kb[i]) })
        }
        return out
    },

    /**
     * The header facts score_results.py prints under the title: relationship
     * density, the maxIterate truncation warning, class counts, and whether the
     * Data Foundations dashboard / Service Graph Connectors are installed.
     */
    metaSummary: function (meta) {
        var config = meta.config || {}
        var maxIterate = config.hasOwnProperty('maxIterate') ? config.maxIterate : 1000000
        var apps = meta.apps || {}
        var hasApps = false
        for (var a in apps) if (apps.hasOwnProperty(a)) { hasApps = true; break }
        return {
            density:
                meta.ci_active && meta.rel_total !== null && meta.rel_total !== undefined
                    ? meta.rel_total / meta.ci_active
                    : null,
            maxIterateWarning: !!(meta.max_iterate_warning || maxIterate < 50000),
            maxIterate: config.maxIterate,
            cmdbClassCount: meta.cmdb_class_count,
            customClassCount: meta.custom_class_count,
            appsReported: hasApps,
            dataFoundationsDashboard: hasApps ? !!(apps.data_foundations_dashboard && apps.data_foundations_dashboard.length) : null,
            serviceGraphConnectors: hasApps ? (apps.service_graph_connectors || []).length : null,
        }
    },

    /**
     * score_results.py main()'s markdown, line for line. The parity test compares
     * this BYTE FOR BYTE with the real Python output on all three fixtures, so an
     * LLM given this text sees exactly what the skill's own scorer would print.
     * Python's emoji status icons, em dashes and middle dots are kept verbatim.
     * @param {Object} scored - score() output
     * @param {Object} catalog
     * @returns {String}
     */
    toMarkdown: function (scored, catalog) {
        var S = IscanCmdbHealthScorer
        var ICON = { fail: '🔴 Fail', warn: '🟠 Warn', pass: '🟢 Pass', n_a: '⚪ N/A', not_assessed: '⚫ Not assessed' }
        var ORDER = ['fail', 'warn', 'pass', 'n_a', 'not_assessed']
        var meta = scored.rawMeta || {}
        var url = catalog.kb_url
        var self = this
        var kb = function (chk) {
            var links = chk.kb.map(function (k) { return '[' + k + '](' + url.replace('{kb}', k) + ')' })
            return links.length ? links.join(', ') : 'CSDM best practice'
        }
        var dash = function (v) { return v === null || v === undefined ? '-' : String(v) }
        var L = []

        L.push('# CMDB & CSDM Health Findings — ' + (meta.instance || 'instance'))
        L.push('')
        L.push('- **Build:** ' + (meta.build || 'n/a') + '  ')
        L.push('- **Generated:** ' + (meta.generated || 'n/a') + '  ')
        if (meta.ci_total !== null && meta.ci_total !== undefined) {
            L.push('- **CIs:** ' + S.commas(meta.ci_total) + ' total, ' + S.commas(meta.ci_active || 0) +
                ' non-retired; **relationships:** ' + S.commas(meta.rel_total || 0) + '  ')
        }
        if (meta.adjustments) L.push('- **Adjustments:** ' + meta.adjustments + '  ')
        if (meta.ci_active && meta.rel_total !== null && meta.rel_total !== undefined) {
            L.push('- **Relationship density:** ' + S.fixedN(meta.rel_total / meta.ci_active, 2) + ' relationships per non-retired CI  ')
        }
        var config = meta.config || {}
        var maxIt = config.hasOwnProperty('maxIterate') ? config.maxIterate : 1000000
        if (meta.max_iterate_warning || maxIt < 50000) {
            L.push('- ⚠️ **Collector ran with maxIterate=' + S.pyStr(config.maxIterate) +
                '** — record-by-record checks may be truncated; re-run with the default (200000) for a real assessment.  ')
        }
        if (meta.custom_class_count !== null && meta.custom_class_count !== undefined) {
            L.push('- **CMDB classes:** ' + S.pyStr(meta.cmdb_class_count) + ' (' + S.pyStr(meta.custom_class_count) + ' custom)  ')
        }
        var apps = meta.apps || {}
        var hasApps = false
        for (var a in apps) if (apps.hasOwnProperty(a)) { hasApps = true; break }
        if (hasApps) {
            var df = apps.data_foundations_dashboard
            L.push('- **Data Foundations dashboard installed:** ' + (df && (df.length === undefined || df.length) ? 'yes' : 'no') +
                '; **Service Graph Connectors:** ' + (apps.service_graph_connectors || []).length + '  ')
        }
        L.push('')
        L.push('**Overall health score: ' + (scored.overall === null ? 'n/a' : scored.overall) + '/100** ' +
            '(weighted High=3, Medium=2, Low=1; ' + scored.checksScored + ' checks scored). ' +
            ORDER.map(function (st) { return ICON[st] + ': ' + scored.counts[st] }).join(' · '))
        L.push('')

        L.push('## Score by theme')
        L.push('')
        L.push('| Theme | Score | Fail | Warn | Pass | N/A / not assessed |')
        L.push('|---|---|---|---|---|---|')
        scored.themes.forEach(function (t) {
            L.push('| ' + t.theme + ' — ' + t.description + ' | ' + dash(t.score) + ' | ' + t.fail + ' | ' + t.warn + ' | ' + t.pass + ' | ' + t.other + ' |')
        })
        L.push('')

        L.push('## CSDM stage readiness')
        L.push('')
        L.push('Foundation combines the Foundation, Hygiene and Integration themes; later stages use their own checks.')
        L.push('')
        L.push('| Stage | Score | Assessment |')
        L.push('|---|---|---|')
        scored.stages.forEach(function (st) { L.push('| ' + st.stage + ' | ' + dash(st.score) + ' | ' + st.label + ' |') })
        L.push('')

        var pop = scored.population || {}
        var popKeys = []
        for (var pk in pop) if (pop.hasOwnProperty(pk)) popKeys.push(pk)
        if (popKeys.length) {
            L.push('## CSDM population')
            L.push('')
            L.push('| Entity | Records |')
            L.push('|---|---|')
            popKeys.forEach(function (k) {
                L.push('| ' + k.replace(/_/g, ' ') + ' | ' + (pop[k] === null || pop[k] === undefined ? 'not collected' : pop[k]) + ' |')
            })
            L.push('')
        }

        L.push('## Findings (worst first)')
        L.push('')
        L.push('| Status | ID | Priority | Check | Measure | Playbook |')
        L.push('|---|---|---|---|---|---|')
        scored.ordered.forEach(function (r) {
            L.push('| ' + ICON[r.status] + ' | ' + r.id + ' | ' + r.check.priority + ' | ' + r.check.title + ' | ' +
                self.formatMeasure(r.check, r.res, r.pct) + ' | ' + kb(r.check) + ' |')
        })
        L.push('')

        L.push('## Detail for failing and warning checks')
        L.push('')
        scored.ordered.forEach(function (r) {
            if (r.status !== 'fail' && r.status !== 'warn') return
            var c = r.check
            L.push('### ' + c.id + ' · ' + c.title + ' — ' + ICON[r.status])
            L.push('')
            L.push('- **Measure:** ' + self.formatMeasure(c, r.res, r.pct) + ' · **Priority:** ' + c.priority + ' · **Theme:** ' + c.theme)
            L.push('- **Playbook:** ' + kb(c))
            L.push('- **Where:** `' + c.table + '` — `' + c.issue_query + '`')
            if (r.res.note) L.push('- **Collector note:** ' + r.res.note)
            if (r.res.samples && r.res.samples.length) {
                L.push('- **Examples:** ' + r.res.samples.slice(0, 8).map(String).join('; '))
            }
            L.push('- **Recommended action:** ' + c.action)
            L.push('')
        })

        var na = scored.rows.filter(function (r) { return r.status === 'n_a' || r.status === 'not_assessed' })
        if (na.length) {
            L.push('## Not applicable / not assessed')
            L.push('')
            na.forEach(function (r) {
                var why = (r.res && r.res.note) || (r.status === 'n_a' ? 'no records in population' : 'no data provided')
                L.push('- **' + r.id + '** ' + r.check.title + ' — ' + ICON[r.status] + ': ' + why)
            })
            L.push('')
        }

        if (scored.inventory && scored.inventory.length) {
            L.push('## CI inventory (top classes, non-retired)')
            L.push('')
            L.push('| Class | CIs |')
            L.push('|---|---|')
            scored.inventory.slice(0, 25).forEach(function (row) { L.push('| ' + row.cls + ' | ' + S.commas(row.n) + ' |') })
            L.push('')
        }

        if (scored.unknownIds.length) {
            L.push('_Ignored result IDs not in catalog: ' + scored.unknownIds.join(', ') + '_')
            L.push('')
        }
        return L.join('\n')
    },

    /**
     * The text behind "Copy CMDB Health LLM Context": a task for the LLM, the
     * noviq-cmdb-health SKILL.md interpretation rules it needs to write the
     * narrative and roadmap this app deliberately does not generate, and the
     * scored findings (toMarkdown - byte-identical to the Python scorer).
     */
    buildLlmContext: function (scored, catalog) {
        return IscanCmdbHealthScorer.LLM_BRIEF + '\n\n---\n\n' + this.toMarkdown(scored, catalog)
    },

    type: 'IscanCmdbHealthScorer',
}
