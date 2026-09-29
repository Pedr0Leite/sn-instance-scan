#!/usr/bin/env python3
"""Regenerates src/server/IscanCmdbHealthCatalog.server.js from the upstream
noviq-cmdb-health check_catalog.json, so the port is exact by construction.

Run only when the upstream catalog changes:
    python3 scripts/gen-cmdb-catalog.py ../noviq-cmdb-health/scripts/check_catalog.json

tests/cmdb-health-scorer.parity.mjs deep-equals the generated catalog against
the upstream JSON, so a hand edit to the generated file (or a stale regen) fails
the parity check instead of silently drifting.
"""
import json, sys

src = sys.argv[1] if len(sys.argv) > 1 else '../noviq-cmdb-health/scripts/check_catalog.json'
cat = json.load(open(src, encoding='utf-8'))
# Top-level assignment, so json.dumps' own indentation is already correct.
body = json.dumps(cat, indent=4, ensure_ascii=False)

out = f'''/*
 * Script Include: IscanCmdbHealthCatalog
 * Client callable: false. Data only.
 *
 * GENERATED - do not edit by hand. Source: noviq-cmdb-health
 * scripts/check_catalog.json (version {cat.get("version")}), regenerated with
 * scripts/gen-cmdb-catalog.py. tests/cmdb-health-scorer.parity.mjs deep-equals
 * this against the upstream JSON, so edits here fail that check.
 *
 * 49 checks (id, title, kb[], theme, priority, kind, table, issue_query,
 * population_query, action, optional pct_thresholds / warn_max), scoring
 * defaults (weights High=3 Medium=2 Low=1, pct thresholds per priority), 9
 * themes, 5 CSDM stages and the stage anchors used for the "Not started"
 * override. Consumed by IscanCmdbHealthScorer.
 */
var IscanCmdbHealthCatalog = Class.create()

IscanCmdbHealthCatalog.DATA = {body}

IscanCmdbHealthCatalog.prototype = {{
    initialize: function () {{}},

    /** @returns {{Object}} the catalog, same shape as check_catalog.json */
    get: function () {{
        return IscanCmdbHealthCatalog.DATA
    }},

    type: 'IscanCmdbHealthCatalog',
}}
'''
open('src/server/IscanCmdbHealthCatalog.server.js', 'w', encoding='utf-8').write(out)
print(f"wrote catalog: {len(cat['checks'])} checks, {len(cat['themes'])} themes, version {cat.get('version')}")
