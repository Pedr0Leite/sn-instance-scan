# Sub-spec 3: Cross-refs — Design

Part of the instance-assessment extension (`Modes → Counting → Cross-refs →
Report`, see `CLAUDE.md`'s "Instance-assessment extension" section and
`docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`). Builds on Modes and
Counting, both already implemented.

## Problem

Today, `IscanTableScanner.profileTable()` (Counting sub-spec) already
captures **outbound** references for free: `reference_field_list` on
`x_nold_iscan_table` shows every `field->target_table` pair for fields on
a table this app owns. What's missing is the reverse direction: for a table
this app owns, which fields *elsewhere in the instance* — on tables owned by
other apps, or by no app at all (global/OOB scopes) — have a reference
field pointing back at it. That inbound-dependent view is the actual gap
Cross-refs exists to fill, and it's the piece the original `/goal` spec's
"cross-reference map (which tables/apps reference which)" language is
mainly about.

## Scope of the search

The search for inbound references spans the **whole instance**, not just
apps already included in the current scan run. In Manual and Single Table
modes especially, most of the instance is outside the run's own app list —
restricting the search to scanned apps would silently hide the majority of
real dependents. The cost is one extra `sys_dictionary` query per table
being profiled (`addQuery('reference', tableName)`), not per app — judged
cheap and indexed enough that it runs unconditionally in every scan mode,
including `full`, with no property-based opt-out (unlike Counting's Group B,
which gates 7 dedicated per-app queries).

Same-app inbound references (a field on a table the same app owns, pointing
back at another table it also owns) are **included**, not filtered out at
write time. `referencing_app` will simply equal the app currently being
scanned in that case. Keeping the raw data complete lets the Report
sub-spec later distinguish "real" cross-app dependencies from intra-app
self-references without needing to re-scan; filtering happens at read/report
time, not at write time.

## New method: `IscanTableScanner.findInboundReferences(tableName)`

```
@param {String} tableName
@returns {Array} [{referencing_table, referencing_field, referencing_app, referencing_scope}]
```

Queries `sys_dictionary` with `addQuery('reference', tableName)` and
`addNotNullQuery('element')` (same shape as the existing
`_getAppAddedFields` query, just filtering on `reference` instead of
`name`). For each result row, resolves the **referencing table's** owning
app the same way `IscanScanOrchestrator._resolveSingleTableApp` already
does: look up `sys_db_object.sys_scope` for `referencing_table`, then try
`sys_app.get(scopeSysId)`. Per-table resolution is cached in a local map
within one `findInboundReferences()` call, since multiple referencing
fields can share the same `referencing_table` (avoids redundant
`sys_db_object`/`sys_app` lookups within a single call — no cross-call
caching, consistent with the rest of this scanner being stateless per
call).

`referencing_scope` is always populated (the referencing field's table's
`sys_scope`, resolved once per distinct `referencing_table`).
`referencing_app` is the resolved `sys_app` sys_id, or `''` when that scope
has no `sys_app` record — the same "no owning app" case Modes and Counting
already handle for `global` and most OOB scopes. A `0`/blank
`referencing_app` here is expected for a genuinely appless referencing
table, not a bug — same precedent as Counting's Group B zero-counts.

This method does not gate on `canAccessMetadata()` itself — it's always
called from `_profileOwnedTables`, which already runs behind that same gate
at the orchestrator level (see below), so no separate check is needed
inside the method.

## Schema changes

**`x_nold_iscan_table`** gains two columns, mirroring the existing
`dictionary_override_count`/`dictionary_override_list` pattern exactly:

- `inbound_reference_count` (Integer, default 0)
- `inbound_reference_list` (String, maxLength 4000) — comma-joined
  `field(table)` pairs, e.g. `"assigned_to(x_other_app_widget),parent(incident)"`

These give an at-a-glance count/list on the table-profile form without
requiring a child-table query, same rationale as the dictionary-override
pair.

**New table `x_nold_iscan_crossref`** — one row per inbound-referencing
field, full per-row detail (including the resolved app) for the Report
sub-spec to query/group/filter later:

| Column | Type | Notes |
|---|---|---|
| `table` | Reference → `x_nold_iscan_table` | mandatory |
| `referencing_table` | String (maxLength 80) | the table that holds the referencing field |
| `referencing_field` | String (maxLength 80) | the field name |
| `referencing_app` | Reference → `sys_app` | blank when the referencing table has no owning app |
| `referencing_scope` | String | `sys_scope` sys_id of the referencing table, always set |

Indexed on `table` (same pattern as `x_nold_iscan_table`'s index on
`result`).

## Orchestrator wiring

`IscanScanOrchestrator._profileOwnedTables(appScopeSysId)` calls
`this.tableScanner.findInboundReferences(tables[i].name)` alongside the
existing `profileTable()` call, attaching `inbound_references` (the raw
array) and `inbound_reference_count` onto each table object — same pattern
already used for `dictionary_overrides`/`dictionary_override_count`.

`_writeTableProfiles(resultSysId, tables)` writes the two new
`x_nold_iscan_table` columns (count + comma-joined `field(table)` list,
built the same way `dictionary_override_list` is built today), then — after
the table row's `insert()` returns its sys_id — loops
`tables[i].inbound_references` and inserts one `x_nold_iscan_crossref`
row per entry, setting `table` to that sys_id.

`_scanOneTable` (the Single Table mode, no-owning-app fallback path) also
gets the inbound-reference count folded into its `run.activities` log
line, consistent with how it already reports `dictionary_override_count` —
no `x_nold_iscan_crossref` rows are written for this fallback path since
(same as today) no `x_nold_iscan_table` row exists to reference.

## Out of scope for this sub-spec

- No UI Action, GenAI prompt, or report changes — `IscanSummaryGenerator`'s
  `buildPrompt()` briefing is NOT touched here; wiring cross-ref data into
  the LLM context / report narrative is the Report sub-spec's job.
- No ATF test entries (standing instruction for this extension).
- No property-based perf gate — deliberately decided against, see "Scope
  of the search" above.
