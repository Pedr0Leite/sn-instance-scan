# Sub-spec 4: Report — Design

Part of the instance-assessment extension (`Modes → Counting → Cross-refs →
Report`, see `CLAUDE.md`'s "Instance-assessment extension" section and
`docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`). Builds on Modes, Counting,
and Cross-refs — all already implemented.

## Scope

Extend the existing `IscanReportGenerator` (no new script include, no new
tables, no new UI Actions) to surface the data Counting and Cross-refs
already collect, plus a small set of presence/absence status flags per app.
No numeric thresholds are introduced (e.g. "10+ overrides = warning") —
there's no real basis for picking a cutoff, so every flag is a plain
yes/no check against data that already exists.

## Status flags

Computed at report-build time from the `x_nold_iscan_result`/
`x_nold_iscan_table`/`x_nold_iscan_crossref` records — not persisted
anywhere new. Per app:

- ⚠️ **"Scanned via Application Files fallback"** — `scan_mode_used ===
  'app_files_fallback'` (the requesting user lacked metadata read access,
  so table-level data is incomplete; this warning already exists as prose
  in the Result report today — it's promoted to a flag here).
- ⚠️ **"N dictionary override(s) detected"** — sum of
  `dictionary_override_count` across all of this app's `x_nold_iscan_table`
  rows, shown when `> 0`. A real governance signal (another app modified a
  table it doesn't own, or this app did), not an invented threshold.
- ℹ️ **"N other app(s) depend on this app's tables"** — count of distinct
  `referencing_app` values (excluding blank and excluding this app itself)
  across all `x_nold_iscan_crossref` rows tied to this app's tables.
  Informational, not a warning — having dependents isn't inherently bad.
- If none of the above trigger: **✅ OK**.

## Run report changes (`_buildRunReportHtml`)

The existing per-app table gains one column: **Status**, showing the
condensed flag icons/short text for that row (e.g. "⚠️⚠️" or "✅"). Full
flag text lives in that app's Result report, linked from the existing
per-row link.

## Result report changes (`_buildResultReportHtml`)

- New **Status** line near the top, above the existing scan-date/mode
  line, spelling out each triggered flag in full (or "✅ OK" if none).
- New **Extended counts** section (after the existing "Automation
  surface" list): every Counting-sub-spec count not already shown there
  (client scripts, UI policies, scheduled jobs, notifications, scripted
  REST APIs, transform maps, catalog items, workflows, subflows, ATF
  tests, reports, fix scripts, processors, data policies, inbound email
  actions, dashboards, PA indicators, service portals/widgets, choices,
  Flow Designer actions, catalog variables), same `<ul>` style as
  "Automation surface". Zero-valued counts are skipped so the list stays
  short for apps that don't use a given artifact type.
- The existing **Tables** table gains 2 columns: **Dictionary Overrides**
  and **Inbound References** — both already stored as counts on
  `x_nold_iscan_table`, just not yet rendered.
- New **Cross-references** section (after the Tables table): one row per
  `x_nold_iscan_crossref` record belonging to any of this app's tables
  — columns Table, Referencing Table, Referencing Field, Referencing App.
  Section is omitted entirely (not shown as an empty table) when the app
  has zero crossref rows.

## Out of scope

- No numeric-threshold flags (e.g. count-based warnings) — rejected per
  the "no invented cutoffs" principle above.
- No changes to `_convertToPdf`, the GlideAjax entry points, or the
  "Download Report" UI Actions — this sub-spec only changes the two
  private HTML-building methods.
- No ATF test entries (standing instruction for this extension).
