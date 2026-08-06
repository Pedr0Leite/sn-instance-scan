# Graph Report - .  (2026-07-30)

## Corpus Check
- 45 files · ~51,940 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 183 nodes · 192 edges · 31 communities (27 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.79)
- Token cost: 201,866 input · 0 output

## Community Hubs (Navigation)
- Project Memory & Design Decisions
- Script Includes & Modes Sub-spec
- ACLs
- Package Config
- Cross-refs & Report Generator
- Counting Sub-spec & App Files Scanner
- Navigation Menu
- Run Scan UI Action Fix
- Script Include Registrations
- Table Schema
- System Properties
- Related Lists
- Generated Keys
- UI Policies
- IscanAppSelector Source
- Copy LLM Context UI Action
- App Root

## God Nodes (most connected - your core abstractions)
1. `IscanScanOrchestrator script include` - 13 edges
2. `IscanReportGenerator script include` - 11 edges
3. `INSTANCE_ASSESSMENT_STATUS.md (cross-session status)` - 10 edges
4. `CLAUDE.md (sn-instance-scan project memory)` - 8 edges
5. `IscanTableScanner script include` - 8 edges
6. `IscanAppFilesScanner script include` - 7 edges
7. `x_335329_iscan_run table` - 7 edges
8. `scripts` - 6 edges
9. `Sub-spec 2: Counting — Design` - 6 edges
10. `x_335329_iscan_crossref table (inbound reference child table)` - 6 edges

## Surprising Connections (you probably didn't know these)
- `scan_findings/comments dual-write pattern (queryable log vs Activity stream)` --semantically_similar_to--> `Design: 3 presence/absence status flags (fallback, dictionary override, dependents)`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/superpowers/specs/2026-07-22-report-design.md
- `Working conventions still in force (no build/deploy/commit, no new ATF tests)` --conceptually_related_to--> `CLAUDE.md (sn-instance-scan project memory)`  [INFERRED]
  docs/OUTSTANDING_WORK.md → CLAUDE.md
- `CLAUDE.md (sn-instance-scan project memory)` --references--> `DEPLOY.md (build/install guide)`  [EXTRACTED]
  CLAUDE.md → DEPLOY.md
- `Decision: change profileTable() itself to be unscoped, not add a parallel method` --rationale_for--> `IscanTableScanner script include`  [EXTRACTED]
  docs/future-schema-ideas.md → CLAUDE.md
- `Task 2: findInboundReferences discovery method` --references--> `IscanTableScanner script include`  [EXTRACTED]
  docs/superpowers/plans/2026-07-22-crossrefs-implementation.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GlideAjax-to-server-side UI Action migration pattern** — claude_runscanuiaction, claude_downloadrunreportuiaction, claude_run_scan_glideajax_failure_pattern [EXTRACTED 0.90]
- **Instance-assessment extension: Modes -> Counting -> Cross-refs -> Report sequence** — claude_modes_subspec, claude_counting_subspec, claude_crossrefs_subspec, claude_report_subspec [EXTRACTED 0.95]
- **Zero or blank result is expected, not a bug - recurring design precedent across sub-specs** — docs_future_schema_ideas_group_b_gating_decision, docs_superpowers_specs_2026_07_22_crossrefs_design_findinboundreferences, docs_outstanding_work_verification_checklist [INFERRED 0.75]

## Communities (31 total, 4 thin omitted)

### Community 0 - "Project Memory & Design Decisions"
Cohesion: 0.13
Nodes (23): CLAUDE.md (sn-instance-scan project memory), Read-only app / no elevated privilege convention, Report sub-spec (sub-spec 4 — IMPLEMENTED), DEPLOY.md (build/install guide), Open decision: dedicated x_335329_iscan.scanner role vs admin default, Decision: sys_choice is count-only (GlideAggregate), no name list, docs/future-schema-ideas.md (roads not taken), Decision: gate Group B queries off by default for full-mode scans (+15 more)

### Community 1 - "Script Includes & Modes Sub-spec"
Cohesion: 0.11
Nodes (23): IscanAppSelector script include, IscanModuleScanner script include, IscanScanOrchestrator script include, IscanSummaryGenerator script include, IscanTableScanner script include, llm_context (always full) vs summary_text (GenAI-dependent) distinction, Modes sub-spec (sub-spec 1 — IMPLEMENTED), Installed Modules scan mode (5th scan mode) (+15 more)

### Community 2 - "ACLs"
Cohesion: 0.10
Nodes (19): crossrefCreateAcl, crossrefReadAcl, globalCustomizationCreateAcl, globalCustomizationReadAcl, moduleCreateAcl, moduleReadAcl, reportGeneratorExecuteAcl, resultCreateAcl (+11 more)

### Community 3 - "Package Config"
Cohesion: 0.11
Nodes (17): description, devDependencies, @servicenow/glide, @servicenow/sdk, imports, #now:*, license, name (+9 more)

### Community 4 - "Cross-refs & Report Generator"
Cohesion: 0.14
Nodes (17): Cross-refs sub-spec (sub-spec 3 — IMPLEMENTED), Download Report (Result table, GlideAjax + client-side UI Action), GlideAjax 3-point checklist (apiName, accessibleFrom=package_private, execute ACL name), global.AbstractAjaxProcessor cross-scope qualifier convention, IscanReportGenerator script include, scan_findings/comments dual-write pattern (queryable log vs Activity stream), Run report Scan Findings Log + Result report Recommendations section, Report table overflow fix (table-layout:fixed + colgroup) (+9 more)

### Community 5 - "Counting Sub-spec & App Files Scanner"
Cohesion: 0.29
Nodes (10): Itemized artifact inventory + base-system customization detection (2026-07-22), Counting sub-spec (sub-spec 2 — IMPLEMENTED), IscanAppFilesScanner script include, x_335329_iscan_global_customization table, x_335329_iscan_result table, x_335329_iscan_table table (table profile), Task 2: IscanAppFilesScanner Group A CLASS_BUCKETS extension + subflow split, Task 3: IscanAppFilesScanner Group B dedicated queries (+2 more)

### Community 6 - "Navigation Menu"
Cohesion: 0.22
Nodes (8): appMenu, newCustomOnlyScanModule, newFullScanModule, newManualScanModule, newModulesScanModule, scanResultsListModule, scanRunsListModule, separatorModule

### Community 7 - "Run Scan UI Action Fix"
Cohesion: 0.29
Nodes (8): Run-table Download Report converted to server-side UI Action, DownloadRunReportUiAction (server-side UI Action), Manual mode multi-select (target_app ListColumn), Run Scan GlideAjax silent-failure pattern (rationale for server-side UI Action), RunScanUiAction (server-side UI Action), Uncommitted/undeployed work list (build-clean, not browser-tested), Task 5: RunScanUiAction.server.js precedence and validation, Design §2: Manual — App precedence (target_app vs manual_app_list)

### Community 8 - "Script Include Registrations"
Cohesion: 0.25
Nodes (7): iscanAppFilesScanner, iscanAppSelector, iscanModuleScanner, iscanReportGenerator, iscanScanOrchestrator, iscanSummaryGenerator, iscanTableScanner

### Community 9 - "Table Schema"
Cohesion: 0.29
Nodes (6): x_335329_iscan_crossref, x_335329_iscan_global_customization, x_335329_iscan_module, x_335329_iscan_result, x_335329_iscan_run, x_335329_iscan_table

### Community 10 - "System Properties"
Cohesion: 0.33
Nodes (5): customScopePrefixProperty, genaiEnabledProperty, genaiMaxInputCharsProperty, includeExtendedCountsOnFullScanProperty, rowCountTimeoutProperty

### Community 11 - "Related Lists"
Cohesion: 0.40
Nodes (4): iscanModuleRelatedList, iscanModuleRelatedListEntry, iscanResultRelatedList, iscanResultRelatedListEntry

### Community 12 - "Generated Keys"
Cohesion: 0.50
Nodes (3): Internal, Keys, Now

## Knowledge Gaps
- **71 isolated node(s):** `name`, `version`, `description`, `license`, `#now:*` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `IscanScanOrchestrator script include` connect `Script Includes & Modes Sub-spec` to `Cross-refs & Report Generator`, `Counting Sub-spec & App Files Scanner`, `Run Scan UI Action Fix`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `IscanReportGenerator script include` connect `Cross-refs & Report Generator` to `Project Memory & Design Decisions`, `Run Scan UI Action Fix`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `IscanTableScanner script include` connect `Script Includes & Modes Sub-spec` to `Project Memory & Design Decisions`, `Cross-refs & Report Generator`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `IscanScanOrchestrator script include` (e.g. with `IscanAppFilesScanner script include` and `IscanAppSelector script include`) actually correct?**
  _`IscanScanOrchestrator script include` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `IscanTableScanner script include` (e.g. with `IscanModuleScanner script include` and `IscanScanOrchestrator script include`) actually correct?**
  _`IscanTableScanner script include` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Memory & Design Decisions` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._