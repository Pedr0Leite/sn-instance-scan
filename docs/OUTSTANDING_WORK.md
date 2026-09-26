# sn-instance-scan — Outstanding work (session handoff)

Rewritten 2026-07-22 to consolidate several appended session entries into
one current-state summary. Older narrative detail (root-cause writeups for
"Invalid update", the journal-reuse bug, the terse-log investigation) is
preserved in `CLAUDE.md` and git history — this file tracks what's left to
do, not a full changelog.

**Working conventions (still in force):**
- Do NOT run `npm run build` / `npm run deploy` / `git commit` on the
  user's behalf unless it's cheap (<2-3k tokens) and flagged first — the
  user runs these. (See memory `feedback-no-build-deploy-commit`.)
- No new ATF test entries. (Memory `feedback-no-atf-tests`.)
- Real scope prefix is `x_nold_iscan`, NOT `x_snis_iscan` (the vault
  spec docs use the old name — don't reintroduce it).
- Authoritative status = this repo (`CLAUDE.md`,
  `docs/superpowers/INSTANCE_ASSESSMENT_STATUS.md`), not the Obsidian vault.

---

## 1. Current deploy/commit state

Committed on `main`: `2dcd8da` (Full/sys_scope + role/group/property
counts), `4d37354` (target_app/target_table/comments form layout),
`d103f57` (package version bump).

**NOT yet committed, deployed, or browser-tested** — everything below,
across several sessions, all `npm run build`-clean:
- `activities` → `scan_findings` rename; "Invalid update" fix in
  `RunScanUiAction.server.js`; journal-reuse fix in `_appendScanFinding()`.
- Full-mode `sys_scope` widening + role/group/property counts (schema
  side already committed in `2dcd8da`, but see if orchestrator wiring
  matches — check `git diff` before assuming either state).
- Itemized report + global-scope customization detection (both write
  paths: per-table `findGlobalCustomizations`, per-app
  `findAppCustomizationsOnGlobalTables`), new
  `x_nold_iscan_global_customization` table, missing crossref ACLs fix.
- Run report "Scan Findings Log" section; `related-lists.now.ts` (Result
  related list on the Run form); Download Report's `isUi16Compatible`/
  `isUi11Compatible` set to `false` (accepted risk — see section 3).
- Events/import sets counts (`event_count`/`import_set_count`) + the new
  Recommendations section on the Result report.
- **Run report now embeds full per-app Result detail.**
  `_buildRunReportHtml()` gained an "Application Detail" section, one per
  scanned app, that calls the existing `_buildResultReportHtml()`
  unchanged and embeds its full output (Status, Recommendations, itemized
  Artifact inventory, Tables, Cross-references, base-system
  customizations) — not just the existing summary table row. No new
  report-building logic, pure reuse. `npm run build` passes.
- **Run-table "Download Report" converted to server-side** (was broken by
  the `isUi16Compatible: false` change above — confirmed root cause,
  fixed by removing the client-script dependency entirely rather than
  reverting the flag). New `src/server/DownloadRunReportUiAction.server.js`,
  `downloadRunReportUiAction` now `isClient: false`, deleted
  `src/client-scripts/DownloadRunReport.client.js`. Result-table "Download
  Report" left unchanged (still GlideAjax + client-side) — out of scope
  for this fix, revisit if the same failure class shows up there.

Run `git diff`/`git status` first next session — don't re-derive any of
this from scratch if the working tree still has it.

---

## 2. Remaining backlog

### 2.1 Activity-stream field selection (may be config, not code) — LOW
`comments` journal field + activity formatter are on the run form, but
whether the Activity stream auto-displays `comments` entries can depend
on a one-time formatter personalization (gear icon → select "Comments").
If manual testing shows an empty stream, this needs a form personalization
or an explicit activity-formatter field config — not a code fix.

### 2.2 Everything else from the original v3 backlog is now built
Report content for `single_table`/Full-fallback (done — Scan Findings Log
section), the recommendations/narrative section (done), events/import
sets counts (done). Nothing else identified as missing against the v3
spec as of this writeup — if a future session finds a gap, add it here
rather than assuming "fully implemented" is still accurate without
checking.

---

## 3. Needs manual/browser testing (nothing in this repo has been
browser-verified since well before this consolidation)

1. **Invalid update banner** gone after Run Scan.
2. **Comments/Activity stream** shows one entry per app scanned, matching
   the Scan Findings textarea's line count 1:1.
3. **Full scan** yields App Count > 1 and a "resolved N app(s) and M
   table-only fallback table(s)" scan_findings line.
4. **Role/Group/System Property counts** populate on result records
   (Group Count may legitimately be 0 — no `sys_scope` on
   `sys_user_group`, confirm this is acceptable).
5. **target_app/target_table** UI Policy visibility (Manual — App /
   Manual — Single Table only).
6. **Download Report (Run table)** — confirm clicking it no longer
   errors, and that a PDF attachment appears on the run record
   immediately (no separate download/new-tab step) after the server-side
   conversion. **Download Report (Result table)** still uses the old
   GlideAjax + client-side flow with `isUi16Compatible: false` — confirm
   whether it's actually broken there too; if so it needs the same
   server-side conversion.
7. **Related list** — confirm `x_nold_iscan_result` actually appears as
   a related list on the Run form after deploy (new, unverified).
8. **Recommendations section** — confirm it renders sensibly on a real
   scanned app's Result report PDF (new, unverified).
9. **Events/import sets counts** — confirm `sysevent_register` and
   `sys_import_set_source` are real tables with a usable `sys_scope`
   field on the target instance; if not, these two counts will silently
   stay 0 (by the same field-existence-guard precedent as `group_count`).

---

## 4. Instance-dependent names to verify before go-live

Low-confidence table/field names — verify against the real instance:
- `sys_hub_flow.type` field/values (flow vs subflow split)
- `sysevent_in_email_action` (inbound email actions table name)
- `pa_dashboards` / `pa_indicators` scope field presence
- `sys_hub_action_type_definition` (Flow Designer actions table name)
- `item_option_new`'s `variable_set` join shape (catalog variables)
- `sys_user_group.sys_scope`, `sys_properties.sys_scope`,
  `sys_user_role.sys_scope` (role/group/property counts)
- `sys_ws_operation` (Scripted REST resources; falls back to
  `operation_uri` if no `name`), `contract_sla` (SLA definitions),
  `sys_ui_page` (UI pages), `sp_page` (Service Portal pages)
- `sysevent_register` (events), `sys_import_set_source` (import sets) —
  newest additions, least confidence
- `com.snc.apppdfgenerator` plugin active (Download Report PDF export) —
  code path confirmed correct by trace, plugin-active status on the
  live instance not yet confirmed (see CLAUDE.md's Download Report note)
