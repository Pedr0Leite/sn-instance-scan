# Sub-spec 2: Counting — design

Part of the instance-assessment extension, sequenced **Modes → Counting →
Cross-refs → Report** (see `CLAUDE.md`). This spec covers Counting only.
Rejected alternatives are logged in `docs/future-schema-ideas.md`.

## Goal

Extend `IscanAppFilesScanner`'s artifact tally from 5 types (script
includes, business rules, ACLs, UI actions, flows) to ~22, plus a new
per-table "dictionary override" detection capability on
`IscanTableScanner`.

## 1. Schema

**22 new `IntegerColumn`s on `x_335329_iscan_result`**, `snake_case_count`
naming, matching the existing `business_rule_count`/`script_include_count`
pattern:

Group A (client_script, ui_policy, scheduled_job, notification,
scripted_rest_api, transform_map, catalog_item, workflow, subflow,
atf_test, report, fix_script, processor, data_policy,
inbound_email_action) — 15 counts.

Group B (catalog_variable, dashboard, pa_indicator, service_portal,
service_portal_widget, choice, flow_action) — 7 counts.

**2 new columns on `x_335329_iscan_table`** for dictionary overrides:
`dictionary_override_count` (Integer), `dictionary_override_list`
(String, maxLength 4000, comma-joined `fieldname(scope)` pairs —
mirrors the existing `reference_field_list` pattern).

**REST/SOAP messages are NOT a new count** — already covered by the
existing `integration_count`/`_findIntegrations()`; adding a Group A
bucket for `sys_rest_message`/`sys_web_service` would double-count the
same records under two different mechanisms.

**Explicitly excluded**: roles, groups, system properties (not per-app
components — a scoped app "containing" a role is a different question
than an app "containing" a business rule; groups have no per-app
ownership at all). Import sets (no stable metadata table — the intent is
covered by `transform_map_count`). Dictionary overrides (not a
per-app-file concept — see §3).

## 2. `IscanAppFilesScanner` — Group A extension

Extend `CLASS_BUCKETS` (currently 5 entries) with 14 more
`sys_class_name → bucket_name` pairs — same single `sys_metadata` query,
no new queries:

```js
this.CLASS_BUCKETS = {
    sys_script_include: 'script_includes',
    sys_script: 'business_rules',
    sys_security_acl: 'acls',
    sys_ui_action: 'ui_actions',
    sys_hub_flow: 'flows',
    sys_script_client: 'client_scripts',
    sys_ui_policy: 'ui_policies',
    sysauto_script: 'scheduled_jobs',
    sysevent_email_action: 'notifications',
    sys_ws_definition: 'scripted_rest_apis',
    sys_transform_map: 'transform_maps',
    sc_cat_item: 'catalog_items',
    sys_atf_test: 'atf_tests',
    sys_report: 'reports',
    sys_script_fix: 'fix_scripts',
    sys_processor: 'processors',
    sys_data_policy2: 'data_policies',
    sysevent_in_email_action: 'inbound_email_actions', // table name: verify against instance
};
```

`scanApp()`'s `result` initializer gains one empty array per new bucket,
plus `subflows` (not a `CLASS_BUCKETS` value — derived at read time).

**Subflows split**: `sys_hub_flow` rows carry a `type` field (`flow` vs
`subflow` — field/values to verify against instance). Both live in the
same table, so the bucket lookup resolves to `'flows'`; the split is one
conditional inside the existing loop:

```js
while (meta.next()) {
    var bucket = this.CLASS_BUCKETS[meta.getValue('sys_class_name')];
    if (!bucket) continue;
    if (bucket === 'flows' && meta.getValue('type') === 'subflow') {
        bucket = 'subflows';
    }
    result[bucket].push({ sys_id: meta.getUniqueValue(), name: meta.getValue('name') || meta.getValue('sys_name') || '' });
}
```

The `type` read only fires for rows already bucketed `'flows'` — no
added query.

**Cleanup, not required but recommended**: the `gs.info` summary line
currently hardcodes one term per bucket (5 today); at ~22 buckets this
is unmaintainable. Replace with a loop over `Object.keys(result)`
producing `"bucket=count"` pairs.

## 3. `IscanAppFilesScanner` — Group B dedicated queries

7 new private methods on `IscanAppFilesScanner` (not a new script
include — extends the existing "gather app files" role):

| Type | Table | Query | Shape |
|---|---|---|---|
| Dashboards | `pa_dashboards` | `addQuery('sys_scope', appScopeSysId)` | `{sys_id, name}` list |
| PA indicators | `pa_indicators` | `addQuery('sys_scope', appScopeSysId)` | `{sys_id, name}` list |
| Service portals | `sp_portal` | `addQuery('sys_scope', appScopeSysId)` | `{sys_id, name}` list |
| Portal widgets | `sp_widget` | `addQuery('sys_scope', appScopeSysId)` | `{sys_id, name}` list |
| Flow Designer actions | `sys_hub_action_type_definition` | `addQuery('sys_scope', appScopeSysId)` | `{sys_id, name}` list |
| Choices | `sys_choice` | `addQuery('sys_scope', appScopeSysId)` | **`GlideAggregate` COUNT only** — no name list (high-cardinality, per-field-per-language rows) |
| Catalog variables | `item_option_new` | dot-walked OR query, see below | `{sys_id, name}` list |

**Catalog variables join** — `item_option_new` has no `sys_scope` of its
own. A variable belongs to an app's scope either directly (`cat_item` →
`sc_cat_item.sys_scope`) or via a shared variable set
(`variable_set` → the variable set's own `sys_scope`):

```js
var vars = new GlideRecord('item_option_new')
var qc = vars.addQuery('cat_item.sys_scope', appScopeSysId)
qc.addOrCondition('variable_set.sys_scope', appScopeSysId)
vars.query()
```

Dot-walk generates the join server-side in one query, rather than a
two-step collect-then-IN-query. **Known limitation, not a bug**: a
variable set shared across multiple catalog items in the same app could
be visited once per referencing item depending on exact join semantics —
acceptable for a rough architecture tally, worth a one-line code comment
so it isn't mistaken for an error later. Exact `variable_set` field name
and whether it's a direct reference (vs. an m2m through a linking table
like `io_set_item`) is the lowest-confidence item in this design —
verify against the real instance before implementation.

**Gating (performance)**: `scanApp(appScopeSysId, includeExtended)`
gains a boolean parameter (default `true`). `IscanScanOrchestrator._scanOneApp`
computes it from `run.getValue('scan_mode')`: `true` for
`custom_only`/`manual`/`single_table`, `false` for `full` unless a new
property overrides it — `x_335329_iscan.include_extended_counts_on_full_scan`
(default `false`), following the existing `x_335329_iscan.*` property
convention. Group A stays unconditional in all 4 modes (same query
already running, no added cost).

## 4. `IscanTableScanner` — dictionary overrides

**Definition**: a `sys_dictionary` field row whose own `sys_scope`
differs from the table's owning scope (`sys_db_object.sys_scope` for
that table name) — i.e. app B added a field to a table app A owns.
Fields whose `sys_scope` matches the table's owning scope (or is
blank/global on a global table) are not overrides.

**Piggybacks on the existing unscoped field query — no new field
query.** `_getAppAddedFields()` (already unscoped per sub-spec 1) also
captures `dict.getValue('sys_scope')` per row in the same loop.

**One new query**: the table's own owning scope, resolved inside
`profileTable()` itself (not threaded in as a parameter — preserves
sub-spec 1's decision to keep `profileTable()` scope-agnostic, so it
keeps working for Single Table mode's OOB case):

```js
_getTableOwningScope: function(tableName) {
    var db = new GlideRecord('sys_db_object')
    db.addQuery('name', tableName)
    db.setLimit(1)
    db.query()
    return db.next() ? db.getValue('sys_scope') : ''
}
```

Called once per `profileTable()` invocation (single-row, indexed lookup
on `name`). Its result feeds `_getAppAddedFields(tableName,
tableOwningScope)`, which computes per field: `isOverride =
field.sys_scope && field.sys_scope !== tableOwningScope`.

`profileTable()`'s return shape gains `dictionary_overrides:
[{name, scope}]` and `dictionary_override_count`.

**Wiring**: `_profileOwnedTables()` folds these onto each table object
alongside `row_count`/`fields`/`reference_fields`. `_writeTableProfiles()`
gets two more `setValue()` calls. `_scanOneTable()`'s OOB fallback (no
result/table row written at all — logged to `run.activities` only)
mentions the override count in its existing text log line for parity,
no schema write there (consistent with how `reference_fields` already
surfaces there today).

## Risks / things to verify before implementation

1. `sys_hub_flow.type` field name and its `flow`/`subflow` values.
2. `sysevent_in_email_action` table name (inbound email actions).
3. `pa_dashboards`/`pa_indicators` — whether they carry `sys_scope` on
   this instance version, or scope by owning group instead.
4. `sys_hub_action_type_definition` table name (Flow Designer custom
   actions).
5. `item_option_new`'s variable-set field name and join shape (direct
   reference vs. m2m through `io_set_item`) — lowest confidence item in
   this design.

All 5 are instance-version-dependent facts, same category as the
existing "verify before go-live" list in `CLAUDE.md` (`sys_app.source`,
GenAI Controller API, PDF plugin name). Recommend a quick verification
pass against the real target instance before writing the implementation
plan's exact table/field names, rather than discovering these mid-build.

## Out of scope for this sub-spec

Cross-table/cross-app reference mapping and the report generator are
separate sub-specs (3, 4) and not designed here. Roles/groups/system
properties remain excluded per §1.
