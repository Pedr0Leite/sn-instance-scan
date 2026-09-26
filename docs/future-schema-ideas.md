# Future schema ideas / roads not taken

Alternatives considered and rejected while brainstorming the
instance-assessment extension (see the "Planned: instance-assessment
extension" section in `CLAUDE.md`), kept here so they aren't silently
re-proposed later without knowing why they lost. Not a backlog of
committed work — just context for future design conversations.

## Sub-spec 1: Modes

**Manual mode input — considered dropping `manual_app_list` entirely.**
Decided: keep both `manual_app_list` (legacy multi-app string, still used
by the programmatic/ATF API) and the new `target_app` reference field
(the primary UI picker, takes precedence when set). Rejected the
single-field replacement because it would have broken
`runScan('manual', [id1, id2])` callers (ATF tests included) for no
functional gain — the two inputs serve genuinely different callers
(form UI vs. programmatic multi-app scans).

**Single Table mode scope — considered "table-only, no app tally."**
Decided: run the full owning-app tally when the picked table's scope
resolves to a real `sys_app` record (falls back to table-only only when
it doesn't — see the `global`/OOB case below). Rejected "always
table-only" as too narrow — it would have made Single Table mode
strictly weaker than Manual mode on a 1-table app, when the user's
intent is closer to "assess the app that owns this table, and guarantee
this specific table is profiled."

**OOB / global-scope table case — considered relaxing the schema.**
When a picked table's owning scope has no `sys_app` record (`global` and
many platform scopes — e.g. `incident`, `sys_user`), the option was to
make `x_nold_iscan_result.app` optional and generalize the scanners to
tally by `sys_scope` directly instead of `sys_app`. Rejected as too
invasive for this sub-spec: it touches the result table's mandatory
reference and every scanner method's scope-lookup assumption, for a case
that mostly matters for platform tables outside this app's "custom app
assessment" focus. **Revisit if a real use case needs OOB-table
app-level tallies** — the schema change itself (making `app` optional,
querying `sys_scope`) is well-understood if needed later.

**Table picker qualifier — considered restricting to custom-app-owned
tables only.** Decided: no qualifier, all of `sys_db_object` selectable.
Rejected the restriction because Single Table mode's whole value is
being able to point at ANY table, including OOB ones like `incident` —
restricting the picker would have contradicted that. The cost (a long
picker list) was judged acceptable.

## Sub-spec 2: Counting

**Roles/groups/system properties — considered counting them per-app via
sys_scope.** Decided: exclude entirely from the per-app tally. Rejected
because these are instance/security config, not app "components" the
way a business rule is — groups have no per-app ownership concept at
all, and counting roles/properties per-app would misrepresent what an
app "contains" for the assessment narrative this tool is building
toward. **Revisit if a future report section specifically wants
security/config posture (not architecture) — that's a different kind of
report section, not a reason to fold these into the existing per-app
counts.**

**Choices (`sys_choice`) — considered returning a `{sys_id, name}` list
like every other bucket.** Decided: `GlideAggregate` COUNT only, no name
list. Rejected the consistent-shape option because `sys_choice` is
high-cardinality (every choice-list row for every field, per language)
even scoped to one app — an in-memory name list here risks being large
for busy apps for no real benefit (a choice list enumeration isn't as
useful to a reader as a business-rule name list is).

**Group B performance — considered always running all 7 dedicated
queries in every scan mode, including `full`.** Decided: gate Group B
off by default for `full` mode (on by default for `custom_only`/
`manual`/`single_table`), with `x_nold_iscan.include_extended_counts_on_full_scan`
(default `false`) as an opt-in escape hatch. Rejected "always run"
because `full` mode can touch hundreds of apps, and 7 extra queries per
app — one of them against a potentially large table (`sys_choice`) — is
a real risk of scan timeouts on production instances, which cuts against
this app's "safe read-only assessment tool" identity. **Revisit if
real-world full scans turn out fast enough that the gate is unnecessary
friction** — the property escape hatch already lets an admin who's
verified their instance opt back in without a code change.

**`profileTable()` field capture — considered adding a second, unscoped
method (`profileTableFields()`) instead of changing the existing one.**
Decided: change `profileTable()` itself to drop the `sys_scope` filter
on field capture, affecting all 4 modes' `field_count`/
`reference_field_list`, not just Single Table mode. Rejected the
"leave existing behavior alone, add a parallel method" option because
it would have meant two field-listing code paths to maintain, and the
Cross-refs sub-spec (3) needs the same complete-field-list capability
instance-wide anyway — better to have one method used everywhere than
one scoped + one unscoped version doing almost the same query.

**No-owning-app fallback (Single Table mode) — considered relaxing
`x_nold_iscan_result.app` to optional so this case gets a real,
queryable result row.** Decided: skip writing a result/table-profile row
entirely for this case; log the table's profile data (fields, row
count, references) into `run.activities`/`run.comments` instead, visible
on the run form but not queryable via `x_nold_iscan_result`/
`x_nold_iscan_table`. Rejected relaxing the mandatory reference for
the same reason the earlier "make result.app optional" option was
rejected (see above) — it's a bigger schema change than this sub-spec
should take on for a case (profiling a bare OOB table with no owning
app) that's real but secondary to Single Table mode's main use case
(profiling a table that DOES belong to a custom app, which already gets
a full queryable result row via the normal per-app pipeline). **Revisit
if reporting/dashboards later need OOB single-table scans to be
queryable, not just log-visible** — same "well-understood if needed
later" caveat as the earlier rejection.

**Orchestrator signature change — considered an options-object refactor
now instead of a 4th positional parameter.** Decided: add
`targetTableSysId` as a 4th positional parameter to
`runScanForRecord`/`runScan`/`_resolveAppList`, undefined/unused for the
3 existing modes. Rejected the bigger options-object refactor
(`{scanMode, manualAppList, targetTableSysId}`) for now — smaller diff,
and the Cross-refs sub-spec (3) may reveal a different/better shape for
this surface once its actual instance-wide scanning needs are known.
**Revisit if a 5th mode or another sub-spec needs a 5th input** — a 5-
positional-parameter signature would be the signal to do the refactor
instead of adding a 5th param.
