# Instance-assessment extension — cross-session status

Read this first if resuming this work in a new session. Sequenced as
**Modes → Counting → Cross-refs → Report** (see `CLAUDE.md`'s "Instance-
assessment extension" section).

## Sub-spec 1: Modes — DONE

Spec: `docs/superpowers/specs/2026-07-21-modes-design.md`
Plan: `docs/superpowers/plans/2026-07-21-modes-implementation.md`
Ledger: `.superpowers/sdd/progress.md` (all 7 tasks complete, final review clean, merged to main directly — no branch was used, per user's explicit consent)

## Sub-spec 2: Counting — IN PROGRESS (brainstorming)

Goal: extend `IscanAppFilesScanner`'s artifact tally from 5 types to ~22,
plus `IscanTableScanner` dictionary-override detection. Full list and the
schema decision (22 new `IntegerColumn`s on `x_335329_iscan_result`,
`snake_case_count` naming) is APPROVED — see the brainstorming
conversation in this session, or re-derive from `CLAUDE.md` once this
doc's "next step" below is filled in with a written spec.

**Decisions locked in:**
- Group A (extends existing `sys_metadata` single-query bucketing —
  free perf-wise, just new `CLASS_BUCKETS` entries): client scripts, UI
  policies, scheduled jobs, notifications, scripted REST APIs, transform
  maps (folds in import sets), catalog items, workflows, subflows (split
  from the existing flows query by `type`), ATF tests, reports, fix
  scripts, processors, data policies, inbound email actions (table name
  low-confidence — `sysevent_in_email_action` needs instance
  verification).
- Group B (new dedicated per-app queries, real perf cost on full-instance
  scans — flagged, not yet resolved how to mitigate): catalog variables
  (joins through parent catalog item), dashboards, PA indicators, service
  portals, service portal widgets, choices, Flow Designer custom actions
  (`sys_hub_action_type_definition`, low confidence).
- Explicitly EXCLUDED: roles, groups, system properties (not per-app
  components).
- Dictionary overrides: NOT a new result-table column — becomes an
  `IscanTableScanner` capability (per-table, not per-app-file) in a later
  step of this same sub-spec.
- Per user's explicit instruction this session: **do NOT add ATF test
  entries** for this or future sub-specs — app code only. (Saved as a
  memory: `feedback_no_atf_tests` in the assistant's memory store.)

**Next step:** get the exact query-mechanics design for Group B (the
join strategy for catalog variables in particular) and the
dictionary-override addition to `IscanTableScanner`, then write
`docs/superpowers/specs/<date>-counting-design.md`, get it approved,
write the implementation plan, and execute via subagent-driven-
development exactly like Modes.

## Sub-spec 3: Cross-refs — NOT STARTED
## Sub-spec 4: Report — NOT STARTED

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
