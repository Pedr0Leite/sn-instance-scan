#!/usr/bin/env python3
"""Builds src/server/IscanCmdbHealthScanner.server.js from the upstream
noviq-cmdb-health scripts/cmdb_health_collector.js.

The 49 check bodies (collector lines 142-760) are spliced in VERBATIM, and every
change scoped execution requires is applied as a named, asserted patch below.
That keeps the port 1:1 and auditable: diffing this script shows exactly what
differs from the collector, rather than burying edits in 600 hand-copied lines.
Each patch asserts it matched exactly once, so an upstream change that moves the
target text fails the build of this file instead of silently skipping a fix.

    python3 scripts/gen-cmdb-scanner.py ../noviq-cmdb-health/scripts/cmdb_health_collector.js
"""
import sys

src = sys.argv[1] if len(sys.argv) > 1 else '../noviq-cmdb-health/scripts/cmdb_health_collector.js'
lines = open(src, encoding='utf-8').read().split('\n')

def block(first, last):
    """1-indexed inclusive line range from the collector."""
    return '\n'.join(lines[first - 1:last])

constants = block(32, 35)   # NOT_RETIRED, TSO_Q, BSO_Q, out
body = block(142, 760)      # metadata & inventory .. last BP check

PATCHES = [
    # --- global properties read from a scoped context --------------------------
    ("        instance: gs.getProperty('instance_name'),",
     "        instance: globalProp('instance_name'),"),
    ("        build: gs.getProperty('glide.buildtag') || gs.getProperty('glide.war'),",
     "        build: globalProp('glide.buildtag') || globalProp('glide.war'),"),
    # --- meta counts run outside safe(): a denial there must not abort the scan -
    ("        ci_total: count('cmdb_ci', ''),", "        ci_total: metaCount('cmdb_ci', ''),"),
    ("        ci_active: count('cmdb_ci', NOT_RETIRED),", "        ci_active: metaCount('cmdb_ci', NOT_RETIRED),"),
    ("        rel_total: count('cmdb_rel_ci', ''),", "        rel_total: metaCount('cmdb_rel_ci', ''),"),
    # --- addHaving is not in the scoped GlideAggregate API (FD-03, CI-10) ------
    ("        ga.addHaving('COUNT', '>', '1');", "        var filterDupes = !having(ga);", 2),
    ("            var c = parseInt(ga.getAggregate('COUNT'), 10);\n            groups++; recs += c;",
     "            var c = parseInt(ga.getAggregate('COUNT'), 10);\n            if (filterDupes && c <= 1) continue;\n            groups++; recs += c;"),
    ("            var s = String(ga.getValue('serial_number')), c = parseInt(ga.getAggregate('COUNT'), 10);",
     "            var s = String(ga.getValue('serial_number')), c = parseInt(ga.getAggregate('COUNT'), 10);\n            if (filterDupes && c <= 1) continue;"),
    # --- offering id sets are built outside safe(); a denial must reach the checks
    #     that use them, or RL-07 / BP-01 would score an EMPTY set as a clean pass
    ("    var BSO = idSet('service_offering', BSO_Q);\n    var TSO = idSet('service_offering', TSO_Q);",
     "    var BSO = {}, TSO = {}, offeringSetError = null;\n"
     "    try { BSO = idSet('service_offering', BSO_Q); TSO = idSet('service_offering', TSO_Q); }\n"
     "    catch (e) { if (!e || !e.deniedTable) throw e; offeringSetError = e; }"),
    ("    safe(['RL-07', 'RL-08'], function () {",
     "    safe(['RL-07', 'RL-08'], function () {\n        if (offeringSetError) throw offeringSetError;"),
    ("    safe('BP-01', function () {",
     "    safe('BP-01', function () {\n        if (offeringSetError) throw offeringSetError;"),
]
for p in PATCHES:
    old, new = p[0], p[1]
    expect = p[2] if len(p) > 2 else 1
    n = body.count(old)
    if n != expect:
        sys.exit(f'patch expected {expect} match(es), found {n}:\n{old}')
    body = body.replace(old, new)

indent = lambda t: '\n'.join(('    ' + l) if l.strip() else l for l in t.split('\n'))

HEADER = r'''/*
 * Script Include: IscanCmdbHealthScanner
 * Client callable: false.
 *
 * CMDB & CSDM Health evidence collector. GENERATED from noviq-cmdb-health
 * scripts/cmdb_health_collector.js by scripts/gen-cmdb-scanner.py - do not
 * edit the spliced check bodies by hand; change the generator's patch list.
 *
 * The 49 check bodies are the collector's own, verbatim: check IDs, queries and
 * semantics unchanged. What differs is only what running in the x_nold_iscan
 * scope requires (each change is a named patch in the generator):
 *   - CFG comes from the x_nold_iscan.cmdb_health.* properties, and the values
 *     used are snapshotted into meta.config.
 *   - TableUtils (global) -> GlideTableHierarchy (scoped).
 *   - Returns {meta, inventory, checks, accessGaps} instead of gs.print().
 *   - addHaving() is used only when available (see having()).
 *   - The offering id sets are capped at maxIterate (the collector left them
 *     unbounded).
 *   - Access denials become not_assessed with "access denied to <table>",
 *     never a zero count - see the guarded constructors in collect().
 *
 * READ-ONLY: GlideRecord/GlideAggregate reads only. No insert/update/delete on
 * any CMDB or platform table - the only writes in this whole feature are the
 * run-keyed rows IscanScanOrchestrator inserts into x_nold_iscan_* tables.
 *
 * Runs in the async worker (as System) - CMDB Health is admin-only to launch,
 * see IscanScanOrchestrator.canLaunch().
 */
var IscanCmdbHealthScanner = Class.create()

IscanCmdbHealthScanner.prototype = {
    initialize: function () {
        // Captured HERE, outside collect(): collect() shadows both names with
        // guarded factories, and a `var` declaration is hoisted over the whole
        // function, so reading the globals from inside collect() would see
        // undefined.
        this._GlideRecord = GlideRecord
        this._GlideAggregate = GlideAggregate
    },

    /**
     * Runs every check and returns the collector's result object.
     * @returns {Object} {meta, inventory, checks:[{id,count,total,samples,note}], accessGaps:[table]}
     */
    collect: function () {
        var RealGR = this._GlideRecord
        var RealGA = this._GlideAggregate
        var DENIAL = IscanTableScanner.prototype.CROSS_SCOPE_DENIAL_SIGNATURE
        var gaps = {}

        function intProp(name, def) {
            var v = parseInt(gs.getProperty('x_nold_iscan.cmdb_health.' + name, String(def)), 10)
            return isNaN(v) ? def : v
        }
        function strProp(name, def) {
            return String(gs.getProperty('x_nold_iscan.cmdb_health.' + name, def) || def)
        }
        // instance_name / glide.buildtag are global properties read from this
        // scope; they only feed meta, never scoring, so a refusal degrades to ''.
        function globalProp(name) {
            try { return gs.getProperty(name) || '' } catch (e) { return '' }
        }

        var CFG = {
            staleDays: intProp('stale_days', 90),
            ticketWindowDays: intProp('ticket_window_days', 90),
            sampleSize: intProp('sample_size', 5),
            maxIterate: intProp('max_iterate', 200000),
            expectedBaAsRel: strProp('expected_ba_as_rel', 'Consumes::Consumed by'),
            systemUsers: strProp('system_users', 'fresh,system,glide.maint,maint').split(',')
                .map(function (u) { return u.trim() })
                .filter(function (u) { return u !== '' }),
        }

'''

HELPERS = r'''
        // ---------- access handling -------------------------------------------
        // A table this scope may not read throws Denied; safe() turns every check
        // still open in that block into "NOT ASSESSED: access denied to <table>",
        // and the table is listed in accessGaps. A denial is never a zero count.
        function Denied(table) {
            this.deniedTable = table
            this.message = 'access denied to ' + table
        }
        Denied.prototype.toString = function () { return this.message }

        function guard(g, t) {
            // A missing table is left alone: the collector's own isTable() guards
            // turn it into a null count (not assessed), exactly as before.
            if (g.isValid() && !g.canRead()) {
                gaps[t] = true
                throw new Denied(t)
            }
            return g
        }
        // The spliced check bodies call `new GlideRecord(t)` / `new
        // GlideAggregate(t)` directly ~30 times. Shadowing both names here gives
        // every one of them the canRead() gate without editing a single check
        // body. A constructor that returns an object makes `new` yield that
        // object, so callers receive the real, guarded record.
        var GlideRecord = function (t) { return guard(new RealGR(t), t) }
        var GlideAggregate = function (t) { return guard(new RealGA(t), t) }

        // Cross-scope-privilege denials do not throw; they surface through
        // getLastErrorMessage() after query() (KB2291532). Same signature
        // IscanTableScanner._detectCrossScopePrivDenial uses.
        function checkCrossScope(g, t) {
            var err = g.getLastErrorMessage ? String(g.getLastErrorMessage() || '') : ''
            if (err && err.indexOf(DENIAL) !== -1) {
                gaps[t] = true
                throw new Denied(t)
            }
        }

        // ---------- helpers (the collector's, scoped) ---------------------------
        function isTable(t) { var g = new RealGR(t); return g.isValid(); }
        function hasField(t, f) { var g = new RealGR(t); return g.isValid() && g.isValidField(f); }
        function daysAgo(n) { var d = new GlideDateTime(); d.addDaysUTC(-n); return d.getValue(); }
        function olderThan(field, days) { return function (g) { g.addQuery(field, '<', daysAgo(days)); }; }
        function newerThan(field, days) { return function (g) { g.addQuery(field, '>=', daysAgo(days)); }; }
        function uniq(a) { var s = {}, r = []; for (var i = 0; i < a.length; i++) if (!s[a[i]]) { s[a[i]] = 1; r.push(a[i]); } return r; }
        function isCustomName(t) { return /^(u_|x_)/.test(t); }

        // TableUtils is global-only; GlideTableHierarchy is its scoped
        // equivalent. Per c_GlideTableHierarchyScopedAPI.md getAllExtensions()
        // already includes the base table - [base] stays in front (uniq'd) so the
        // result does not depend on that. Indexed by .length so it works whether
        // the platform hands back a JS or a Java array.
        function extensions(base) {
            if (!isTable(base)) return [];
            var ext = new GlideTableHierarchy(base).getAllExtensions();
            var a = [];
            for (var i = 0; i < ext.length; i++) a.push(String(ext[i]));
            return uniq([base].concat(a));
        }

        function count(table, eq, extra) {
            if (!isTable(table)) return null;
            var ga = new GlideAggregate(table);
            if (eq) ga.addEncodedQuery(eq);
            if (extra) extra(ga);
            ga.addAggregate('COUNT');
            ga.query();
            checkCrossScope(ga, table);
            return ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) : 0;
        }

        // meta is built outside safe(); a denied meta count degrades to null
        // (unknown) instead of aborting every check.
        function metaCount(table, eq) {
            try { return count(table, eq); }
            catch (e) { if (e && e.deniedTable) return null; throw e; }
        }

        function samples(table, eq, extra, n) {
            var res = [];
            if (!isTable(table)) return res;
            var gr = new GlideRecord(table);
            if (eq) gr.addEncodedQuery(eq);
            if (extra) extra(gr);
            gr.setLimit(n || CFG.sampleSize);
            gr.query();
            checkCrossScope(gr, table);
            while (gr.next()) res.push(String(gr.getDisplayValue() || gr.getUniqueValue()));
            return res;
        }

        // addHaving() is documented only in the GLOBAL GlideAggregate API
        // (c_GlideAggregateAPI.md), not the scoped one (c_GlideAggregateScopedAPI.md
        // has no match). Use it when it works; otherwise return false and the
        // caller skips COUNT <= 1 groups in its own loop - the same result, at the
        // cost of iterating every group.
        function having(ga) {
            try { ga.addHaving('COUNT', '>', '1'); return true; }
            catch (e) { return false; }
        }

        function add(id, cnt, total, smp, note) {
            out.checks.push({ id: id, count: cnt, total: total, samples: smp || [], note: note || '' });
        }
        function skip(id, why) {
            out.checks.push({ id: id, count: null, total: null, samples: [], note: 'NOT ASSESSED: ' + why });
        }
        // The collector's safe(): one failing check (or block of checks) is
        // recorded as not assessed and never fails the run.
        function safe(ids, fn) {
            ids = [].concat(ids);
            var before = out.checks.length;
            try { fn(); }
            catch (e) {
                var why = e && e.deniedTable ? 'access denied to ' + e.deniedTable : 'error: ' + e;
                var done = {};
                for (var i = before; i < out.checks.length; i++) done[out.checks[i].id] = true;
                for (var j = 0; j < ids.length; j++) if (!done[ids[j]]) skip(ids[j], why);
            }
        }

        function relPairs(parentClasses, childClasses) {
            var pairs = [];
            if (!parentClasses.length || !childClasses.length) return pairs;
            var g = new GlideRecord('cmdb_rel_ci');
            g.addEncodedQuery('parent.sys_class_nameIN' + parentClasses.join(',') +
                              '^child.sys_class_nameIN' + childClasses.join(','));
            g.setLimit(CFG.maxIterate);
            g.query();
            while (g.next()) pairs.push({ p: g.getValue('parent'), c: g.getValue('child'), t: String(g.type.name) });
            return pairs;
        }

        function missingFrom(table, eq, set) {
            var r = { missing: 0, total: 0, samples: [] };
            if (!isTable(table)) return null;
            var g = new GlideRecord(table);
            if (eq) g.addEncodedQuery(eq);
            g.setLimit(CFG.maxIterate);
            g.query();
            while (g.next()) {
                r.total++;
                if (!set[g.getUniqueValue()]) {
                    r.missing++;
                    if (r.samples.length < CFG.sampleSize) r.samples.push(String(g.getDisplayValue()));
                }
            }
            return r;
        }

        // The collector left this unbounded, loading every matching sys_id into
        // memory. Capped like every other record-by-record loop.
        function idSet(table, eq) {
            var s = {};
            if (!isTable(table)) return s;
            var g = new GlideRecord(table);
            if (eq) g.addEncodedQuery(eq);
            g.setLimit(CFG.maxIterate);
            g.query();
            while (g.next()) s[g.getUniqueValue()] = true;
            return s;
        }

        // sys_store_app only feeds meta; a denial there degrades to "none found".
        function storeApps(term) {
            var r = [];
            if (!isTable('sys_store_app')) return r;
            try {
                var g = new GlideRecord('sys_store_app');
                g.addQuery('name', 'CONTAINS', term);
                g.query();
                while (g.next()) r.push(g.getValue('name') + ' ' + (g.getValue('version') || ''));
            } catch (e) {
                if (!e || !e.deniedTable) throw e;
            }
            return r;
        }
'''

FOOTER = r'''

        out.accessGaps = Object.keys(gaps).sort();
        return out;
    },

    type: 'IscanCmdbHealthScanner',
}
'''

text = HEADER + indent(constants) + '\n' + HELPERS + '\n' + indent(body) + FOOTER
open('src/server/IscanCmdbHealthScanner.server.js', 'w', encoding='utf-8').write(text)
print(f'wrote scanner: {len(text.splitlines())} lines, {len(PATCHES)} patches applied')
