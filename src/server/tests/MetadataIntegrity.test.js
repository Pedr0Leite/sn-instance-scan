/*
 * ATF step script — "Script include / ACL / UI action / UI policy integrity".
 *
 * Guards the configuration flags this app has repeatedly been bitten by,
 * all of which fail SILENTLY at runtime rather than throwing (see the
 * "Custom scope" section of CLAUDE.md):
 *   - clientCallable on the wrong script include -> GlideAjax gets an
 *     empty answer with no server-side log line at all.
 *   - a missing execute ACL (or one not named with the scope-qualified
 *     apiName) -> same empty answer, same silence.
 *   - isUi16Compatible=false on a client-side UI Action -> the platform
 *     never loads the client script and the button does nothing. This
 *     exact regression shipped once already.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    function isTrue(value) {
        return value === '1' || value === 'true' || value === true
    }

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'sys_app record found for scope x_335329_iscan', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    // ---- Script includes ---------------------------------------------
    // clientCallable is asserted per-include, not just "at least one is
    // callable": IscanScanOrchestrator was deliberately made NON-callable
    // when Run Scan moved to a server-side UI Action, and flipping it back
    // on would quietly re-open the GlideAjax failure class.
    var expectedIncludes = {
        IscanAppSelector: false,
        IscanTableScanner: false,
        IscanAppFilesScanner: false,
        IscanSummaryGenerator: false,
        IscanScanOrchestrator: false,
        IscanReportGenerator: true,
    }
    var includeCount = 0
    for (var name in expectedIncludes) {
        if (!expectedIncludes.hasOwnProperty(name)) {
            continue
        }
        var si = new GlideRecord('sys_script_include')
        si.addQuery('name', name)
        si.addQuery('sys_scope', appSysId)
        si.query()
        var found = si.next()
        assertEqual({ name: 'script include exists: ' + name, shouldbe: true, value: found })
        if (!found) {
            continue
        }
        includeCount++
        assertEqual({ name: 'script include active: ' + name, shouldbe: true, value: isTrue(si.getValue('active')) })
        assertEqual({
            name: 'script include apiName is scope-qualified: ' + name,
            shouldbe: 'x_335329_iscan.' + name,
            value: si.getValue('api_name'),
        })
        assertEqual({
            name: 'script include client_callable flag: ' + name,
            shouldbe: expectedIncludes[name],
            value: isTrue(si.getValue('client_callable')),
        })
    }

    // package_private (blank/'package_private') is correct for this app's
    // own GlideAjax caller. 'public' makes the platform run a
    // GlidePluginManager.isActive() check that fails for an unregistered
    // in-development scoped app, and GlideAjax then returns nothing.
    var reportSi = new GlideRecord('sys_script_include')
    reportSi.addQuery('name', 'IscanReportGenerator')
    reportSi.addQuery('sys_scope', appSysId)
    reportSi.query()
    if (reportSi.next()) {
        var accessibleFrom = reportSi.getValue('access') || 'package_private'
        assertEqual({
            name: 'IscanReportGenerator accessibleFrom is package_private, not public',
            shouldbe: 'package_private',
            value: accessibleFrom,
        })
    }

    // ---- ACLs ---------------------------------------------------------
    function assertRecordAcl(table, operation) {
        var acl = new GlideRecord('sys_security_acl')
        acl.addQuery('name', table)
        acl.addQuery('operation', operation)
        acl.addQuery('sys_scope', appSysId)
        acl.query()
        assertEqual({ name: 'record ACL exists: ' + table + ' / ' + operation, shouldbe: true, value: acl.hasNext() })
    }
    assertRecordAcl('x_335329_iscan_run', 'read')
    assertRecordAcl('x_335329_iscan_run', 'create')
    assertRecordAcl('x_335329_iscan_run', 'write')
    assertRecordAcl('x_335329_iscan_result', 'read')
    assertRecordAcl('x_335329_iscan_result', 'create')
    assertRecordAcl('x_335329_iscan_table', 'read')
    assertRecordAcl('x_335329_iscan_table', 'create')
    assertRecordAcl('x_335329_iscan_crossref', 'read')
    assertRecordAcl('x_335329_iscan_crossref', 'create')
    assertRecordAcl('x_335329_iscan_global_customization', 'read')
    assertRecordAcl('x_335329_iscan_global_customization', 'create')

    // Results are system-generated output: no write ACL exists on purpose,
    // so they stay immutable once the scan has written them.
    var resultWrite = new GlideRecord('sys_security_acl')
    resultWrite.addQuery('name', 'x_335329_iscan_result')
    resultWrite.addQuery('operation', 'write')
    resultWrite.addQuery('sys_scope', appSysId)
    resultWrite.query()
    assertEqual({
        name: 'no write ACL on x_335329_iscan_result (results are immutable)',
        shouldbe: false,
        value: resultWrite.hasNext(),
    })

    // The execute ACL's name must be the scope-qualified apiName — that's
    // the resource name the platform checks for a scoped script include,
    // and the same string the client passes to new GlideAjax(...).
    var executeAcl = new GlideRecord('sys_security_acl')
    executeAcl.addQuery('name', 'x_335329_iscan.IscanReportGenerator')
    executeAcl.addQuery('operation', 'execute')
    executeAcl.query()
    assertEqual({
        name: 'execute ACL exists for x_335329_iscan.IscanReportGenerator',
        shouldbe: true,
        value: executeAcl.next(),
    })

    // ---- UI Actions ----------------------------------------------------
    var expectedActions = {
        run_scan: { table: 'x_335329_iscan_run', client: false, ui16: true, order: '100' },
        download_run_report: { table: 'x_335329_iscan_run', client: false, ui16: true, order: '200' },
        download_result_report: { table: 'x_335329_iscan_result', client: true, ui16: null, order: '100' },
        copy_llm_context: { table: 'x_335329_iscan_result', client: true, ui16: true, order: '200' },
    }
    for (var actionName in expectedActions) {
        if (!expectedActions.hasOwnProperty(actionName)) {
            continue
        }
        var expected = expectedActions[actionName]
        var ua = new GlideRecord('sys_ui_action')
        ua.addQuery('action_name', actionName)
        ua.addQuery('sys_scope', appSysId)
        ua.query()
        var uaFound = ua.next()
        assertEqual({ name: 'UI action exists: ' + actionName, shouldbe: true, value: uaFound })
        if (!uaFound) {
            continue
        }
        assertEqual({ name: 'UI action active: ' + actionName, shouldbe: true, value: isTrue(ua.getValue('active')) })
        assertEqual({ name: 'UI action table: ' + actionName, shouldbe: expected.table, value: ua.getValue('table') })
        assertEqual({
            name: 'UI action is form button: ' + actionName,
            shouldbe: true,
            value: isTrue(ua.getValue('form_button')),
        })
        assertEqual({
            name: 'UI action shows on update only (not insert): ' + actionName,
            shouldbe: true,
            value: !isTrue(ua.getValue('show_insert')) && isTrue(ua.getValue('show_update')),
        })
        assertEqual({ name: 'UI action order: ' + actionName, shouldbe: expected.order, value: ua.getValue('order') })
        assertEqual({
            name: 'UI action client flag: ' + actionName,
            shouldbe: expected.client,
            value: isTrue(ua.getValue('client')),
        })
        // Only meaningful for client-side actions, but asserted wherever
        // the design pins it: this is the flag whose false value silently
        // broke the Run-table Download Report button once already.
        if (expected.ui16 !== null) {
            assertEqual({
                name: 'UI action ui16_compatible: ' + actionName,
                shouldbe: expected.ui16,
                value: isTrue(ua.getValue('ui16_compatible')),
            })
        }
        // Roles are stored as a list; accept either sys_ids or names so
        // this check survives either storage convention.
        var rolesRaw = ua.getValue('roles') || ''
        assertEqual({
            name: 'UI action is role-gated: ' + actionName,
            shouldbe: true,
            value: rolesRaw.length > 0,
        })
    }

    // ---- UI Policies ---------------------------------------------------
    var policies = { 'scan_mode=manual': 'target_app', 'scan_mode=single_table': 'target_table' }
    for (var condition in policies) {
        if (!policies.hasOwnProperty(condition)) {
            continue
        }
        var policy = new GlideRecord('sys_ui_policy')
        policy.addQuery('table', 'x_335329_iscan_run')
        policy.addQuery('conditions', condition)
        policy.query()
        var policyFound = policy.next()
        assertEqual({ name: 'UI policy exists for ' + condition, shouldbe: true, value: policyFound })
        if (!policyFound) {
            continue
        }
        // reverse_if_false is what actually HIDES the field again when the
        // mode changes; without it the policy only ever shows.
        assertEqual({
            name: 'UI policy reverses when false: ' + condition,
            shouldbe: true,
            value: isTrue(policy.getValue('reverse_if_false')),
        })
        var action = new GlideRecord('sys_ui_policy_action')
        action.addQuery('ui_policy', policy.getUniqueValue())
        action.addQuery('field', policies[condition])
        action.query()
        assertEqual({
            name: 'UI policy action targets ' + policies[condition],
            shouldbe: true,
            value: action.hasNext(),
        })
    }

    // ---- Related list --------------------------------------------------
    // Explicit rather than relying on the platform's automatic related
    // list, because this form carries a custom sys_ui_section.
    var relatedList = new GlideRecord('sys_ui_related_list')
    relatedList.addQuery('name', 'x_335329_iscan_run')
    relatedList.query()
    var relatedFound = relatedList.next()
    assertEqual({ name: 'related list defined on x_335329_iscan_run', shouldbe: true, value: relatedFound })
    if (relatedFound) {
        var entry = new GlideRecord('sys_ui_related_list_entry')
        entry.addQuery('list_id', relatedList.getUniqueValue())
        entry.addQuery('related_list', 'x_335329_iscan_result.run')
        entry.query()
        assertEqual({
            name: 'related list entry is x_335329_iscan_result.run',
            shouldbe: true,
            value: entry.hasNext(),
        })
    }

    stepResult.setOutputMessage('Metadata intact: ' + includeCount + ' script include(s), 4 UI action(s), 2 UI policy/policies, ACLs and related list verified.')
    return true
})(outputs, steps, params, stepResult, assertEqual)
