import { ScriptInclude } from '@servicenow/sdk/core'

export const iscanAppSelector = ScriptInclude({
    $id: Now.ID['iscan_app_selector_si'],
    name: 'IscanAppSelector',
    script: Now.include('../server/IscanAppSelector.server.js'),
    description: 'Resolves the app list for the 3 scan modes (full / custom_only / manual).',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanAppSelector',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanTableScanner = ScriptInclude({
    $id: Now.ID['iscan_table_scanner_si'],
    name: 'IscanTableScanner',
    script: Now.include('../server/IscanTableScanner.server.js'),
    description:
        'Primary full-access scan path: canAccessMetadata() gate, owned-table discovery, and per-table profiling via GlideAggregate.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanTableScanner',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanAppFilesScanner = ScriptInclude({
    $id: Now.ID['iscan_app_files_scanner_si'],
    name: 'IscanAppFilesScanner',
    script: Now.include('../server/IscanAppFilesScanner.server.js'),
    description:
        'ACL-denial fallback path: enumerates script includes, business rules, ACLs, UI actions, and flows via sys_metadata.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanAppFilesScanner',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanSummaryGenerator = ScriptInclude({
    $id: Now.ID['iscan_summary_generator_si'],
    name: 'IscanSummaryGenerator',
    script: Now.include('../server/IscanSummaryGenerator.server.js'),
    description: 'Single-shot GenAI summarization of gathered scan facts. Not an AI Agent/ReAct loop.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanSummaryGenerator',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanModuleScanner = ScriptInclude({
    $id: Now.ID['iscan_module_scanner_si'],
    name: 'IscanModuleScanner',
    script: Now.include('../server/IscanModuleScanner.server.js'),
    description:
        'Installed Modules scan mode: instance-wide sys_plugins profile, cross-checked against GlidePluginManager().isActive(). No app/table scoping.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanModuleScanner',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanAiAgentScanner = ScriptInclude({
    $id: Now.ID['iscan_ai_agent_scanner_si'],
    name: 'IscanAiAgentScanner',
    script: Now.include('../server/IscanAiAgentScanner.server.js'),
    description:
        'AI Agent Discovery scan mode: layered inventory of AI agents/tools/credentials (native platform, outbound integrations, script keywords, Flow Designer, configuration). No app/table scoping.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanAiAgentScanner',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanScanOrchestrator = ScriptInclude({
    $id: Now.ID['iscan_scan_orchestrator_si'],
    name: 'IscanScanOrchestrator',
    script: Now.include('../server/IscanScanOrchestrator.server.js'),
    description:
        'Orchestrates a full scan run across all resolved apps. Called directly (server-side) from the "Run Scan" UI Action script — not GlideAjax, so clientCallable is false.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanScanOrchestrator',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanReportGenerator = ScriptInclude({
    $id: Now.ID['iscan_report_generator_si'],
    name: 'IscanReportGenerator',
    script: Now.include('../server/IscanReportGenerator.server.js'),
    description:
        'GlideAjax entry point for the "Download Report" UI Actions. Builds HTML and converts it to a PDF attached to the source record.',
    clientCallable: true,
    active: true,
    apiName: 'x_nold_iscan.IscanReportGenerator',
    mobileCallable: false,
    sandboxCallable: false,
    // Same as IscanScanOrchestrator — left at package_private, see that
    // comment for why 'public' is wrong here.
})

export const iscanCmdbHealthCatalog = ScriptInclude({
    $id: Now.ID['iscan_cmdb_health_catalog_si'],
    name: 'IscanCmdbHealthCatalog',
    script: Now.include('../server/IscanCmdbHealthCatalog.server.js'),
    description:
        'CMDB & CSDM Health check catalog (49 checks, themes, stages, thresholds) ported 1:1 from noviq-cmdb-health check_catalog.json. Data only.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanCmdbHealthCatalog',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanCmdbHealthScanner = ScriptInclude({
    $id: Now.ID['iscan_cmdb_health_scanner_si'],
    name: 'IscanCmdbHealthScanner',
    script: Now.include('../server/IscanCmdbHealthScanner.server.js'),
    description:
        'CMDB & CSDM Health evidence collector: read-only checks against cmdb_ci and related tables, ported from cmdb_health_collector.js. Returns {meta, inventory, checks}.',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanCmdbHealthScanner',
    mobileCallable: false,
    sandboxCallable: false,
})

export const iscanCmdbHealthScorer = ScriptInclude({
    $id: Now.ID['iscan_cmdb_health_scorer_si'],
    name: 'IscanCmdbHealthScorer',
    script: Now.include('../server/IscanCmdbHealthScorer.server.js'),
    description:
        'CMDB & CSDM Health scoring: evaluate, weighted theme/stage scores, stage-anchor override - ported 1:1 from score_results.py. Pure JS, no Glide calls, so it is parity-tested under Node (tests/cmdb-health-scorer.parity.mjs).',
    clientCallable: false,
    active: true,
    apiName: 'x_nold_iscan.IscanCmdbHealthScorer',
    mobileCallable: false,
    sandboxCallable: false,
})
