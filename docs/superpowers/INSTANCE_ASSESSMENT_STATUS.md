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
