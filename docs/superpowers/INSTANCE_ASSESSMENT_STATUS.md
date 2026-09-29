# Instance-assessment extension — cross-session status

Read this first if resuming this work in a new session. Sequenced as
**Modes → Counting → Cross-refs → Report** (see `CLAUDE.md`'s "Instance-
assessment extension" section).

## Sub-spec 1: Modes — DONE

Spec: `docs/superpowers/specs/2026-07-21-modes-design.md`
Plan: `docs/superpowers/plans/2026-07-21-modes-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 7 tasks complete, final review clean, merged to main directly — no branch was used, per user's explicit consent)

## Sub-spec 2: Counting — DONE

Spec: `docs/superpowers/specs/2026-07-21-counting-design.md`
Plan: `docs/superpowers/plans/2026-07-21-counting-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 6 tasks complete + 3 controller-caught
mid-implementation fixes, final whole-branch review = ready to merge with 3
non-blocking minors, all 3 fixed in a follow-up commit, merged to main
directly — no branch was used). 5 table/field names remain flagged
low-confidence pending real-instance verification (see CLAUDE.md's Counting
section and the design doc's Risks section) — check these before go-live,
same as the other instance-dependent items already tracked in `DEPLOY.md`.

## Sub-spec 3: Cross-refs — DONE

Spec: `docs/superpowers/specs/2026-07-22-crossrefs-design.md`
Plan: `docs/superpowers/plans/2026-07-22-crossrefs-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 4 tasks complete, merged to main
directly — no branch was used). Inbound-reference discovery is
whole-instance and ungated (no new property), unlike Counting's Group B —
see CLAUDE.md's Cross-refs section for why that was judged safe.

## Sub-spec 4: Report — DONE

Spec: `docs/superpowers/specs/2026-07-22-report-design.md`
Plan: `docs/superpowers/plans/2026-07-22-report-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 3 tasks complete, merged to main
directly — no branch was used). No numeric-threshold flags were added, per
the design's explicit rejection of invented cutoffs.

## 2026-07-22: "fully implemented" doesn't mean "visible in the run log"

A run's `scan_findings`/`comments` log is a terse PER-APP PROGRESS log by
design (table/business-rule/script-include/flow counts + a customization
line, then "Scan complete.") — it has never held the full v3 assessment
and was never meant to. Diagnosed after a report that a Custom Apps Only
run "only produces a terse log line instead of the full report" — traced
the whole path (UI Action → orchestrator → report generator) and found
no disconnect: it's working as designed, the confusion was about WHERE
the output lives. The actual v3 assessment is:
- ~30 per-artifact-type count fields on each `x_nold_iscan_result` row
  (client scripts, UI policies, roles, groups, choices, etc. — see
  `IscanScanOrchestrator._scanOneApp`'s `result.setValue()` calls).
- Field + cross-reference data on `x_nold_iscan_table` /
  `x_nold_iscan_crossref` / `x_nold_iscan_global_customization` child
  records (one row per table/reference/customization found).
- The exportable status-flagged, itemized, narrative report — generated
  ON DEMAND, not automatically, via the "Download Report" UI Action on
  either the Run or Result record → `IscanReportGenerator`.
Fix applied: the run's closing "Scan complete." log line now appends a
pointer to where the full data actually lives (see
`IscanScanOrchestrator._reportPointerMessage()`), so this doesn't need
re-diagnosing from scratch in a future session or by a user unfamiliar
with the schema.

## All 4 sub-specs complete

Modes → Counting → Cross-refs → Report have all shipped to `main`. Recall
before any go-live: 5 table/field names flagged low-confidence during
Counting still need verification against a real instance (see CLAUDE.md's
Counting section and that design doc's Risks section).

## Working conventions established this session (apply to all remaining sub-specs)
- Implementing directly on `main`, no branch/worktree (explicit user
  consent given for Modes; carry forward unless the user says otherwise).
- Design docs → `docs/superpowers/specs/`, plans → `docs/superpowers/plans/`,
  rejected alternatives → `docs/future-schema-ideas.md` (append, don't
  duplicate the existing Modes entries).
- `CLAUDE.md` gets a status-labeled section per sub-spec under "Instance-
  assessment extension" (see the two Modes sub-headings already there for
  the pattern: one for schema/what's decided, one for
  implementation/orchestrator notes, both eventually retitled
  "— IMPLEMENTED" once shipped).
- Subagent-driven-development: haiku for mechanical/complete-spec tasks,
  sonnet for multi-step/integration tasks, opus for the architect design
  research and the final whole-branch review. Always generate a scoped
  diff file per task before dispatching reviewers (this repo's src/ files
  were untracked before this session, so raw `git diff` between early
  commits shows whole-file "additions" — note this explicitly in reviewer
  prompts, as done for Modes).
- No ATF test authoring going forward (see above).


## 2026-09-26 — Runs stuck in "running"; async execution; CMDB & CSDM Health mode

- **Status bug fixed.** Terminal `status`/`completed` now written by
  `_finishRun()` through a fresh GlideRecord (decoupled from the log write), and
  the two long modes (`full`, `cmdb_health`) run in a worker via the
  `x_nold_iscan.scan.execute` event + Script Action instead of inside a request.
  States: pending → running → complete/error. Both async modes are admin-only
  (the worker runs as System). The legacy run `f7da38d9…` on ven09425 is
  still `running` — it predates the fix and is not touched by it.
- **CMDB & CSDM Health (`cmdb_health`)** implemented: catalog + scanner (both
  generated from noviq-cmdb-health) + scorer; two run-keyed tables; report
  section; Copy LLM Context on the summary form; opt-in Full-scan inclusion.
- **Verified locally:** scorer parity, 34/34 (`npm run test:cmdb-parity`),
  including the byte-identical markdown report; write path (49 rows + summary);
  report rendering against the Python ordering/measures; no A4 overflow.
- **Not verified — needs the instance:** collector parity against the original
  background script, Script-Action-as-System, scoped `addHaving`, dot-walked
  encoded queries from scope. See CLAUDE.md "Later addition #7".
