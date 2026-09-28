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
