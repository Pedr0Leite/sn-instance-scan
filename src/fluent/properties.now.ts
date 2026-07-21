import { Property } from '@servicenow/sdk/core'

export const customScopePrefixProperty = Property({
    $id: Now.ID['sn_inst_scan_custom_scope_prefix_property'],
    name: 'x_335329_iscan.custom_scope_prefix',
    type: 'string',
    value: 'x_',
    description: 'Prefix used to identify custom-scoped applications in the custom-only scan mode. Read via gs.getProperty(), never hardcoded.',
})

export const rowCountTimeoutProperty = Property({
    $id: Now.ID['sn_inst_scan_row_count_timeout_property'],
    name: 'x_335329_iscan.row_count_timeout_ms',
    type: 'integer',
    value: '5000',
    description: 'Safety threshold for GlideAggregate row-count queries on very large tables.',
})

export const genaiEnabledProperty = Property({
    $id: Now.ID['sn_inst_scan_genai_enabled_property'],
    name: 'x_335329_iscan.genai_enabled',
    type: 'boolean',
    value: 'true',
    description: 'Master switch for GenAI summary generation. Auto-disables gracefully if the Generative AI Controller API is absent on the instance, regardless of this value.',
})

export const genaiMaxInputCharsProperty = Property({
    $id: Now.ID['sn_inst_scan_genai_max_input_chars_property'],
    name: 'x_335329_iscan.genai_max_input_chars',
    type: 'integer',
    value: '20000',
    description:
        'Character cap applied to the architecture briefing before it is sent to the Generative AI Controller (IscanSummaryGenerator._truncateForGenAI). The real ceiling is instance- and model-dependent — verify it on the target instance and tune this. Only affects the GenAI input; the persisted llm_context field always stores the full-length briefing.',
})

export const includeExtendedCountsOnFullScanProperty = Property({
    $id: Now.ID['sn_inst_scan_include_extended_counts_on_full_scan_property'],
    name: 'x_335329_iscan.include_extended_counts_on_full_scan',
    type: 'boolean',
    value: 'false',
    description:
        'When false (default), Group B artifact counts (dashboards, PA indicators, service portals/widgets, choices, Flow Designer actions, catalog variables — see IscanAppFilesScanner) are skipped for scan_mode=full to avoid 7 extra queries per app on a full-instance scan. Custom Only / Manual / Single Table modes always include Group B regardless of this property (their app counts are inherently small). Set true to include Group B in full scans too.',
})
