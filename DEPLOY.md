# Building and installing this app

This app is built with the **ServiceNow SDK** (`@servicenow/sdk`) using
**ServiceNow Fluent** — metadata is defined in TypeScript (`.now.ts`
files under `src/fluent/`), not classic Update Set XML. `now-sdk init`
already scaffolded `now.config.json` and `package.json` for this repo
(app name `SN Instance Scan`, package `x_335329_iscan`, **custom scoped**
app, scope `x_335329_iscan`).

## One-time setup

```bash
npm install
now-sdk auth --add https://<your-instance>.service-now.com --type oauth --alias <alias>
```

## Build and install

```bash
npm run build     # now-sdk build   — compiles src/ into installable artifacts
npm run deploy     # now-sdk install — packages and installs/updates on the instance
```

Re-run both after any change under `src/`. `now-sdk install --reinstall`
also works but **removes any instance metadata not present in this
repo** — only use it if you're sure the repo is the source of truth.

## Scope note

`now.config.json` sets `"scope": "x_335329_iscan"`. This is a **custom
scoped** app, not global — the platform automatically namespaces
everything this scope creates, so there's no cross-app collision risk.

- Every table, role, and property name in `src/fluent/` still carries
  the `x_335329_iscan` prefix explicitly, matching what the platform
  generates (tables: `x_335329_iscan_run`, `x_335329_iscan_result`,
  `x_335329_iscan_table`; role: `x_335329_iscan.scanner`; properties:
  `x_335329_iscan.*`).
- Script include names (`IscanAppSelector`, `IscanTableScanner`, etc.)
  are not prefixed — they're plain classes — but each has an `apiName`
  of `x_335329_iscan.<ClassName>`, and GlideAjax must use that
  scope-qualified apiName (see the GlideAjax checklist in `CLAUDE.md`).
  Keep class names distinctive if you add more.
- `AbstractAjaxProcessor` lives in **global** scope, not this app's
  scope, so `IscanScanOrchestrator.server.js` and
  `IscanReportGenerator.server.js` must extend
  `global.AbstractAjaxProcessor` — omitting the qualifier throws
  `AbstractAjaxProcessor undefined, maybe missing global qualifier` at
  runtime (ServiceNow's cross-scope security check; see KB0635929).
  now-sdk 4.8.1's `no-unsupported-node-builtins` build lint misflags any
  bare `global` identifier as a Node.js reference, so both files carry
  `// eslint-disable-next-line no-unsupported-node-builtins` directly
  above the `global.AbstractAjaxProcessor` line — required to satisfy
  the build, not optional. `GlideRecord`/`GlideAggregate`/etc. need no
  prefix — those are native platform APIs, available unprefixed in every
  scope.

## Layout

- `src/fluent/*.now.ts` — all Fluent metadata definitions (tables,
  roles, properties, script includes, ACLs, UI actions)
- `src/server/*.server.js` — script include bodies, referenced from
  `script-includes.now.ts` via `Now.include(...)`
- `src/client-scripts/*.client.js` — UI Action client scripts, referenced from
  `ui-actions.now.ts` via `Now.include(...)`
- `src/fluent/tests/*.now.ts` — ATF tests + suites, installed with the app
- `src/server/tests/*.test.js` — their step scripts
- `tests/README.md` — how to run the suites after an upgrade, and their
  prerequisites (`sn_atf.runner.enabled`, the client test runner for the
  4 UI tests, the PDF plugin for the report tests)
- `tests/atf_tests.json` — the older hand-written test plan
  (mirrors `test-plan.md` in the docs vault, plus the report-generation test)

## After deploying: run the tests

`Automated Test Framework > Suites > SN Instance Scan — Regression`. It
asserts the instance-dependent things listed below as its first test, so
a missing plugin or a renamed platform field is named directly instead of
surfacing as a confusing downstream failure.

## Dependencies to verify against the target instance

- **PDF Generation Utilities** plugin (`com.snc.apppdfgenerator`,
  namespace `sn_pdfgeneratorutils`) — active by default, but confirm
  before relying on the "Download Report" UI Actions
  (`IscanReportGenerator.server.js`).
- `sys_app.source`/`vendor` field name and values (Vancouver+ vs older
  releases) — `IscanAppSelector.getCustomApps()` in
  `src/server/IscanAppSelector.server.js` has a documented, single-place
  filter to adjust.
- Exact Generative AI Controller API name/namespace for the active Now
  Assist plugin version — `IscanSummaryGenerator.generate()` checks
  availability first and degrades to `null` if absent, but the API call
  itself (`sn_one_extend.GenerativeAIInvocationAPI`) is a placeholder to
  confirm against the real instance.

## Open decision (flagged, not resolved)

Who can run scans? This build uses a dedicated `x_335329_iscan.scanner`
role rather than defaulting to admin, so the ACL-fallback path gets
exercised in normal use. Confirm this before go-live (see
`architecture.md` Story 1 in the docs vault for the original framing).
