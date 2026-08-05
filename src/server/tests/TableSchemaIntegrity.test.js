/*
 * ATF step script — "Table & column integrity".
 *
 * Upgrade regression guard for the app's own schema: every column the
 * scripts write to must still exist, with the type/attributes the code
 * assumes. A dropped or retyped column shows up here as one named
 * assertion instead of as a silent no-op write during a scan (setValue()
 * on a nonexistent field does nothing and throws nothing).
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    function fieldExists(tableName, element) {
        var dict = new GlideRecord('sys_dictionary')
        dict.addQuery('name', tableName)
        dict.addQuery('element', element)
        dict.query()
        return dict.next() ? dict : null
    }

    function assertField(tableName, element, expectedType) {
        var dict = fieldExists(tableName, element)
        assertEqual({ name: 'field exists: ' + tableName + '.' + element, shouldbe: true, value: !!dict })
        if (dict && expectedType) {
            assertEqual({
                name: 'field type: ' + tableName + '.' + element,
                shouldbe: expectedType,
                value: dict.getValue('internal_type'),
            })
        }
        return dict
    }

    // GlideRecord.getValue() on a boolean returns '1'/'0' on some
    // versions and 'true'/'false' on others — normalize rather than
    // betting on one.
    function isTrue(value) {
        return value === '1' || value === 'true' || value === true
    }

    function choiceValues(tableName, element) {
        var values = []
        var choice = new GlideRecord('sys_choice')
        choice.addQuery('name', tableName)
        choice.addQuery('element', element)
        choice.query()
        while (choice.next()) {
            if (values.indexOf(choice.getValue('value')) === -1) {
                values.push(choice.getValue('value'))
            }
        }
        return values
    }

    function assertChoices(tableName, element, expected) {
        var actual = choiceValues(tableName, element)
        for (var i = 0; i < expected.length; i++) {
            assertEqual({
                name: 'choice value present: ' + tableName + '.' + element + ' = ' + expected[i],
                shouldbe: true,
                value: actual.indexOf(expected[i]) !== -1,
            })
        }
    }

    // ---- x_335329_iscan_run -------------------------------------------
    var runFields = [
        'scan_mode',
        'status',
        'requested_by',
        'started',
        'completed',
        'app_count',
        'manual_app_list',
        'target_app',
        'target_table',
        'scan_findings',
        'comments',
    ]
    for (var r = 0; r < runFields.length; r++) {
        assertField('x_335329_iscan_run', runFields[r])
    }
    // comments must stay a journal field — the native Activity formatter
    // renders journal fields only (see IscanScanOrchestrator._appendScanFinding).
    assertEqual({
        name: 'x_335329_iscan_run.comments is a journal field',
        shouldbe: 'journal_input',
        value: fieldExists('x_335329_iscan_run', 'comments').getValue('internal_type'),
    })
    // scan_findings is deliberately NOT a journal field: it stays a plain,
    // queryable String holding the whole timestamped log.
    assertEqual({
        name: 'x_335329_iscan_run.scan_findings is a plain string',
        shouldbe: 'string',
        value: fieldExists('x_335329_iscan_run', 'scan_findings').getValue('internal_type'),
    })
    assertEqual({
        name: 'x_335329_iscan_run.target_app references sys_app',
        shouldbe: 'sys_app',
        value: fieldExists('x_335329_iscan_run', 'target_app').getValue('reference'),
    })
    assertEqual({
        name: 'x_335329_iscan_run.target_table references sys_db_object',
        shouldbe: 'sys_db_object',
        value: fieldExists('x_335329_iscan_run', 'target_table').getValue('reference'),
    })
    assertChoices('x_335329_iscan_run', 'scan_mode', ['full', 'custom_only', 'manual', 'single_table'])
    assertChoices('x_335329_iscan_run', 'status', ['pending', 'running', 'complete', 'error'])

    // ---- x_335329_iscan_result ---------------------------------------
    // Every column IscanScanOrchestrator._scanOneApp() writes to. Kept as
    // an explicit list rather than derived from the record, so that
    // dropping a column fails here instead of quietly shrinking the check.
    var resultFields = [
        'run',
        'app',
        'scan_date',
        'scan_mode_used',
        'table_count',
        'business_rule_count',
        'script_include_count',
        'flow_count',
        'acl_count',
        'ui_action_count',
        'integration_count',
        'client_script_count',
        'ui_policy_count',
        'scheduled_job_count',
        'notification_count',
        'scripted_rest_api_count',
        'transform_map_count',
        'catalog_item_count',
        'workflow_count',
        'subflow_count',
        'atf_test_count',
        'report_count',
        'fix_script_count',
        'processor_count',
        'data_policy_count',
        'inbound_email_action_count',
        'catalog_variable_count',
        'dashboard_count',
        'pa_indicator_count',
        'service_portal_count',
        'service_portal_page_count',
        'service_portal_widget_count',
        'choice_count',
        'flow_action_count',
        'role_count',
        'group_count',
        'system_property_count',
        'scripted_rest_resource_count',
        'sla_definition_count',
        'ui_page_count',
        'event_count',
        'import_set_count',
        'table_list',
        'summary_text',
        'llm_context',
    ]
    for (var i = 0; i < resultFields.length; i++) {
        assertField('x_335329_iscan_result', resultFields[i])
    }
    assertEqual({
        name: 'x_335329_iscan_result.app is mandatory (drives the table-only fallback path)',
        shouldbe: true,
        value: isTrue(fieldExists('x_335329_iscan_result', 'app').getValue('mandatory')),
    })
    assertChoices('x_335329_iscan_result', 'scan_mode_used', ['full_access', 'app_files_fallback'])

    // ---- x_335329_iscan_table ----------------------------------------
    var tableFields = [
        'result',
        'table_name',
        'extends_table',
        'well_known_base',
        'row_count',
        'field_count',
        'reference_field_list',
        'dictionary_override_count',
        'dictionary_override_list',
        'inbound_reference_count',
        'inbound_reference_list',
    ]
    for (var tf = 0; tf < tableFields.length; tf++) {
        assertField('x_335329_iscan_table', tableFields[tf])
    }
    assertChoices('x_335329_iscan_table', 'well_known_base', ['task', 'cmdb_ci', 'other', 'none'])

    // ---- x_335329_iscan_crossref -------------------------------------
    var crossrefFields = ['table', 'referencing_table', 'referencing_field', 'referencing_app', 'referencing_scope']
    for (var cf = 0; cf < crossrefFields.length; cf++) {
        assertField('x_335329_iscan_crossref', crossrefFields[cf])
    }
    // referencing_app is deliberately NOT mandatory: it is blank whenever
    // the referencing table's scope has no sys_app record (global/OOB).
    assertEqual({
        name: 'x_335329_iscan_crossref.referencing_app is optional (blank for OOB referencing tables)',
        shouldbe: false,
        value: isTrue(fieldExists('x_335329_iscan_crossref', 'referencing_app').getValue('mandatory')),
    })

    // ---- x_335329_iscan_global_customization -------------------------
    var globalFields = [
        'run',
        'result',
        'table_name',
        'custom_field_count',
        'custom_field_list',
        'custom_artifact_count',
        'custom_artifact_list',
    ]
    for (var gf = 0; gf < globalFields.length; gf++) {
        assertField('x_335329_iscan_global_customization', globalFields[gf])
    }
    // result is blank on the per-table fallback write path — same
    // "blank is expected" precedent as crossref.referencing_app.
    assertEqual({
        name: 'x_335329_iscan_global_customization.result is optional (blank on the table-only path)',
        shouldbe: false,
        value: isTrue(fieldExists('x_335329_iscan_global_customization', 'result').getValue('mandatory')),
    })

    stepResult.setOutputMessage(
        'Schema intact: ' +
            runFields.length +
            ' run, ' +
            resultFields.length +
            ' result, ' +
            tableFields.length +
            ' table-profile, ' +
            crossrefFields.length +
            ' crossref, ' +
            globalFields.length +
            ' global-customization column(s) verified.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
