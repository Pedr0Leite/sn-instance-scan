# Automated tests (ATF)

Regression suite for `sn-instance-scan`, to run **after every upgrade or
change to this app**.

The tests are ServiceNow Fluent `Test()` definitions under
`src/fluent/tests/`, with their server-side step scripts as plain JS under
`src/server/tests/` (inlined at build time with `Now.include()`, the same
pattern this repo already uses for script includes and client scripts).
They install with the app — no separate deployment.

`atf_tests.json` in this folder is the older hand-written test *plan*
(scenario descriptions, mirroring the vault's `test-plan.md`). It is kept
as the human-readable statement of intent; the files below are the
executable version of it.

## What to run

| Suite | Contains | When |
|---|---|---|
| **SN Instance Scan — Regression** | 25 tests: configuration, every script include, three of the four scan modes end to end, reports, ACLs, the forms | After every upgrade, plugin activation, or change to this app |
| **SN Instance Scan — Full Scan (long running)** | 1 test: whole-instance Full mode | Before a release, or when Full mode itself changed. Walks every scope on the instance — minutes, not seconds |

Run them from **Automated Test Framework > Suites**, or headless via the
CI/CD API:

```
POST /api/sn_cicd/testsuite/run?test_suite_name=SN%20Instance%20Scan%20—%20Regression
```

## Prerequisites

1. **`sn_atf.runner.enabled` must be true.** ATF is disabled by default,
   and is disabled on production instances for a reason — these tests
   create scan runs, results and users. Run them on dev/test/sub-prod.
2. **A browser session for the UI tests.** The four `iScan — UI:` tests
   (suite order 600–630) drive real forms and need the ATF **client test
   runner** — open it from the test/suite form before running. Everything
   else is server-side and runs headless.
3. **The app must be installed in its own scope** (`x_335329_iscan`). The
   app is its own test fixture: it is a custom-scoped, internally
   developed app that owns 5 tables with a known reference graph, so the
   tests need no seeded demo data. Nothing is hard-coded to a sys_id —
   the app is resolved by scope at runtime.
4. **PDF Generation Utilities** must be active for the report tests. The
   `iScan — Environment readiness` test asserts this explicitly and runs
   first, so a missing plugin is named once instead of failing the report
   tests for an unrelated-looking reason.
5. The Generative AI Controller is **not** required. It is reported, not
   asserted: only `summary_text` depends on it, and `llm_context` is
   written on every scan regardless.

Everything the tests write goes through ATF's rollback context, so no
scan history, result record, attachment or test user survives the run.

## Coverage

### Configuration (100s) — the silent-failure guards

Every failure mode here is one that produces **no error at runtime**: a
dropped column makes `setValue()` a no-op, a flipped `clientCallable`
flag makes GlideAjax return an empty answer with nothing in the log, and
`isUi16Compatible: false` stops the platform loading a client script at
all (that one has already shipped once — see CLAUDE.md).

| Test | Covers |
|---|---|
| Environment readiness | scope, 5 tables, scanner role, 5 properties, PDF plugin; reports GenAI availability |
| Table and column integrity | every column the scan writes to, `comments` still journal / `scan_findings` still not, all four choice lists, which references are mandatory |
| Script include, ACL, UI action and UI policy integrity | per-include `clientCallable`, `package_private` access, the scope-qualified execute ACL, the deliberate absence of a result write ACL, UI action flags/roles/order, both UI policies with `reverse_if_false`, the explicit related list |

### Components (200s)

| Test | Covers |
|---|---|
| IscanAppSelector | Custom Only applies both filters (prefix **and** not store-installed); Manual drops invalid sys_ids; Full returns apps + table-only fallback and excludes the `global` scope; deprecated `getFullScanApps()` still works |
| IscanTableScanner: core | `canAccessMetadata()` is a deterministic boolean gate; row count matches an independent `GlideAggregate` COUNT; `profileTable()` is unscoped (platform fields present) and resolves the outbound reference graph |
| IscanTableScanner: cross-refs | inbound references found for app and base-system tables, same-app references kept, `referencing_app` blank (not wrong) for OOB referencing tables |
| IscanTableScanner: customizations | both directions; an app is never reported as customizing its own tables; only tables with no owning `sys_app` are reported |
| IscanAppFilesScanner | Group A bucket contents and item shape; count-only buckets stay numbers; Group B gated off/on/defaulted |
| IscanSummaryGenerator: context | all 5 sections, in order; automation named not just counted; missing facts labelled |
| IscanSummaryGenerator: fallback | data model omitted **with an explanation**, never zero-filled; `generate()` returns null and never throws; GenAI input truncation marked |

### Scans (300s)

| Test | Covers |
|---|---|
| Manual (App) | the reference happy path: run → result → table profiles → crossref rows, counts, `table_list`, `llm_context`, findings log, no spillover to other apps |
| Custom Only | one result per resolved custom app, no store app, no non-prefixed scope, Group B included |
| Single Table (owned) | resolves the owning app and runs the **full per-app tally** |
| Single Table (base-system) | **zero result records by design** — the profile goes to the findings log, because `result.app` is a mandatory `sys_app` reference and there is no app |
| Findings log | one timestamped line per milestone **and** one accumulated journal entry per line (the check that proves `_appendScanFinding()` still re-fetches a fresh GlideRecord for the journal write) |
| Read-only guarantee | row counts across 15 metadata/data tables unchanged across both scan paths, plus a `sys_audit` cross-check |
| Error handling | bad input throws with a message naming the problem; finding nothing is **not** an error |

### Reports (400s), security (500s), UI (600s)

| Test | Covers |
|---|---|
| Report content | every section of both reports, links back to source records, status flags and recommendations asserted in **both** directions (present when the condition holds, absent when it does not) |
| Report PDF | a real `sys_attachment` on the right record, PDF content type, non-zero size, expected file name; unknown ids degrade without throwing |
| Security: scanner role | a non-admin with only `x_335329_iscan.scanner` can run a whole scan, and cannot write or delete a result |
| Security: no role | all 5 tables deny read and create; the insert returns null; scan history is invisible |
| UI: run form | the two UI policies toggle Target App / Target Table symmetrically; neither button renders on an unsaved record |
| UI: Run Scan happy path | fill form → save → Run Scan → run completes with a result → Download Report → PDF attached |
| UI: mandatory guards | the **server-side** guards in `RunScanUiAction` abort and leave the run at `pending` (UI policies only hide fields) |
| UI: result form | `llm_context` populated on the form, both result-table buttons visible |

## Not covered automatically

- **The "Copy LLM Context" clipboard write.** It calls
  `navigator.clipboard`, which needs a secure origin and a user-gesture
  permission the test runner cannot grant. The button's presence and the
  field it copies are asserted; the paste round-trip stays a manual
  check.
- **Opening the generated PDF.** The attachment, its content type and its
  size are asserted; that the rendered pages *look* right is a human
  check.
- **A real GenAI summary.** `summary_text` depends on an instance
  capability with a model behind it; the tests assert the graceful-
  degradation contract instead, which is the part that must not break.
- **The instance-version-dependent table names** flagged in CLAUDE.md
  (`sysevent_register`, `sys_import_set_source`, `contract_sla`,
  `sys_hub_action_type_definition`, PA scope fields). The scanner already
  guards these with `isValid()`/field-existence checks and returns 0
  rather than a wrong number, and the tests assert that guard — they do
  **not** assert those counts are non-zero, since a legitimately absent
  table on a given instance is not a failure. Verify them against the
  target instance as documented in DEPLOY.md.

## Writing more tests

Two conventions to keep:

- **No Jasmine `describe()`.** It is only supported in global scope, and
  these tests ship inside the scoped app. Every server-side step uses the
  supported scoped pattern instead:
  `(function (outputs, steps, params, stepResult, assertEqual) { ... })`
  with `assertEqual({ name, shouldbe, value })` and a closing
  `stepResult.setOutputMessage(...)`.
- **Every `Test()` and every step needs a literal `$id: Now.ID['...']`.**
  Keys are extracted statically at build time, so they cannot be
  generated in a loop; without one on a step, the build fails with
  `Failed to determine ID for "sys_atf_step" record`. Reference a UI
  action from a step with
  `Now.ref('sys_ui_action', '<its Now.ID key>')` — passing the imported
  `UiAction` object does not type-check there.

Add new tests to a suite in `src/fluent/tests/test-suites.now.ts` so they
actually run after an upgrade.
