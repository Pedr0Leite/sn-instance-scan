import { Property } from '@servicenow/sdk/core'

export const customScopePrefixProperty = Property({
    $id: Now.ID['sn_inst_scan_custom_scope_prefix_property'],
    name: 'x_nold_iscan.custom_scope_prefix',
    type: 'string',
    value: 'x_',
    description: 'Prefix used to identify custom-scoped applications in the custom-only scan mode. Read via gs.getProperty(), never hardcoded.',
})

export const rowCountTimeoutProperty = Property({
    $id: Now.ID['sn_inst_scan_row_count_timeout_property'],
    name: 'x_nold_iscan.row_count_timeout_ms',
    type: 'integer',
    value: '5000',
    description: 'Safety threshold for GlideAggregate row-count queries on very large tables.',
})

export const genaiEnabledProperty = Property({
    $id: Now.ID['sn_inst_scan_genai_enabled_property'],
    name: 'x_nold_iscan.genai_enabled',
    type: 'boolean',
    value: 'true',
    description: 'Master switch for GenAI summary generation. Auto-disables gracefully if the Generative AI Controller API is absent on the instance, regardless of this value.',
})

export const genaiMaxInputCharsProperty = Property({
    $id: Now.ID['sn_inst_scan_genai_max_input_chars_property'],
    name: 'x_nold_iscan.genai_max_input_chars',
    type: 'integer',
    value: '20000',
    description:
        'Character cap applied to the architecture briefing before it is sent to the Generative AI Controller (IscanSummaryGenerator._truncateForGenAI). The real ceiling is instance- and model-dependent — verify it on the target instance and tune this. Only affects the GenAI input; the persisted llm_context field always stores the full-length briefing.',
})

export const includeExtendedCountsOnFullScanProperty = Property({
    $id: Now.ID['sn_inst_scan_include_extended_counts_on_full_scan_property'],
    name: 'x_nold_iscan.include_extended_counts_on_full_scan',
    type: 'boolean',
    value: 'false',
    description:
        'When false (default), Group B artifact counts (dashboards, PA indicators, service portals/widgets, choices, Flow Designer actions, catalog variables — see IscanAppFilesScanner) are skipped for scan_mode=full to avoid 7 extra queries per app on a full-instance scan. Custom Only / Manual / Single Table modes always include Group B regardless of this property (their app counts are inherently small). Set true to include Group B in full scans too.',
})

export const includeAiAgentKeywordScanProperty = Property({
    $id: Now.ID['sn_inst_scan_include_ai_agent_keyword_scan_property'],
    name: 'x_nold_iscan.include_ai_agent_keyword_scan',
    type: 'boolean',
    value: 'false',
    description:
        'When false (default), AI Agent Discovery mode (scan_mode=ai_agents) skips Layer 3 — a CONTAINS query on the script body field across every row of Business Rules, Script Includes, Scheduled Jobs, and UI Actions, instance-wide. Real per-instance perf cost, same rationale as include_extended_counts_on_full_scan. Layers 1, 2, 4, and 5 always run regardless of this property. Set true to include the script keyword scan too.',
})

// ---- CMDB & CSDM Health (replaces the collector's CFG block) ----------------
// The values actually used are snapshotted into each run's summary meta, so a
// report always states the configuration it was produced under.

export const cmdbHealthStaleDaysProperty = Property({
    $id: Now.ID['sn_inst_scan_cmdb_health_stale_days_property'],
    name: 'x_nold_iscan.cmdb_health.stale_days',
    type: 'integer',
    value: '90',
    description: 'CMDB Health: a CI not updated (CI-08) or discovered (CI-15) within this many days counts as stale. Collector CFG.staleDays.',
})

export const cmdbHealthTicketWindowDaysProperty = Property({
    $id: Now.ID['sn_inst_scan_cmdb_health_ticket_window_days_property'],
    name: 'x_nold_iscan.cmdb_health.ticket_window_days',
    type: 'integer',
    value: '90',
    description: 'CMDB Health: incidents and changes opened within this many days are assessed (FD-04..07, BP-02). Collector CFG.ticketWindowDays.',
})

export const cmdbHealthSampleSizeProperty = Property({
    $id: Now.ID['sn_inst_scan_cmdb_health_sample_size_property'],
    name: 'x_nold_iscan.cmdb_health.sample_size',
    type: 'integer',
    value: '5',
    description: 'CMDB Health: number of example records captured per check. Collector CFG.sampleSize.',
})

export const cmdbHealthMaxIterateProperty = Property({
    $id: Now.ID['sn_inst_scan_cmdb_health_max_iterate_property'],
    name: 'x_nold_iscan.cmdb_health.max_iterate',
    type: 'integer',
    value: '200000',
    description:
        'CMDB Health: cap on every record-by-record loop (relationship pairs, missing-from sets, CI-14, BP-01, offering id sets). A check that hits the cap says so in its note. Below 50000 the report warns that results may be truncated. Collector CFG.maxIterate.',
})

export const cmdbHealthExpectedBaAsRelProperty = Property({
    $id: Now.ID['sn_inst_scan_cmdb_health_expected_ba_as_rel_property'],
    name: 'x_nold_iscan.cmdb_health.expected_ba_as_rel',
    type: 'string',
    value: 'Consumes::Consumed by',
    description:
        'CMDB Health: the relationship type expected between a Business Application and an Application Service (RL-09). The CSDM 5 figure shows "Uses::Used by" - see the skill notes before changing. Collector CFG.expectedBaAsRel.',
})

export const cmdbHealthSystemUsersProperty = Property({
    $id: Now.ID['sn_inst_scan_cmdb_health_system_users_property'],
    name: 'x_nold_iscan.cmdb_health.system_users',
    type: 'string',
    value: 'fresh,system,glide.maint,maint',
    description:
        'CMDB Health: comma-separated user names treated as the platform itself when classifying relationship types as OOB or custom (RL-01, RL-03 creator-name heuristic). Collector CFG.systemUsers.',
})

export const includeCmdbHealthOnFullScanProperty = Property({
    $id: Now.ID['sn_inst_scan_include_cmdb_health_on_full_scan_property'],
    name: 'x_nold_iscan.include_cmdb_health_on_full_scan',
    type: 'boolean',
    value: 'false',
    description:
        'When false (default), a Full scan does not run the CMDB & CSDM Health checks - they are instance-wide and add record-by-record work up to max_iterate. Set true to append them to every Full scan. Same precedent as include_extended_counts_on_full_scan. The dedicated CMDB & CSDM Health mode always runs them.',
})

// ---- Report branding --------------------------------------------------------

export const reportLogoBase64Property = Property({
    $id: Now.ID['sn_inst_scan_report_logo_base64_property'],
    name: 'x_nold_iscan.report_logo_base64',
    type: 'string',
    value: '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',
    description:
        'Base64 PNG logo for the PDF report header. Used (a) to seed the NoviqTemplate record when sn_doc_template exists and (b) directly as the header image when it does not. Empty = no logo. Default is the Noviq logo (Dark variant, for light pages).',
})
