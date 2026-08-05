/*
 * ATF step script — "IscanAppFilesScanner: buckets, item shape, Group B gating".
 *
 * Group A (one shared sys_metadata query, ~19 artifact classes) is
 * always collected. Group B (7+ dedicated per-app queries) only runs when
 * includeExtended is true — that flag is what the
 * x_335329_iscan.include_extended_counts_on_full_scan property controls
 * for full-instance scans, so getting it backwards would silently add a
 * per-app query storm to every full scan.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var scanner = new IscanAppFilesScanner()

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    var files = scanner.scanApp(appSysId, true)

    // ---- Group A --------------------------------------------------------
    // This app's own contents are the fixture: 6 script includes, 4 UI
    // actions, 11 record ACLs + 1 execute ACL, 2 UI policies, and the ATF
    // tests in this very suite.
    assertEqual({
        name: 'script_includes bucket holds at least the 6 known script includes',
        shouldbe: true,
        value: files.script_includes.length >= 6,
    })
    var includeNames = []
    for (var i = 0; i < files.script_includes.length; i++) {
        includeNames.push(files.script_includes[i].name)
    }
    assertEqual({
        name: 'script_includes bucket names IscanScanOrchestrator',
        shouldbe: true,
        value: includeNames.indexOf('IscanScanOrchestrator') !== -1,
    })
    assertEqual({
        name: 'ui_actions bucket holds at least the 4 known UI actions',
        shouldbe: true,
        value: files.ui_actions.length >= 4,
    })
    assertEqual({ name: 'acls bucket is populated', shouldbe: true, value: files.acls.length >= 11 })
    assertEqual({ name: 'ui_policies bucket is populated', shouldbe: true, value: files.ui_policies.length >= 2 })
    // Self-referential on purpose: this suite's own tests are app files of
    // this app, so a broken sys_atf_test bucket shows up immediately.
    assertEqual({ name: 'atf_tests bucket sees this suite', shouldbe: true, value: files.atf_tests.length >= 1 })

    // Every bucket entry must carry sys_id + name, since the report's
    // itemized inventory and the LLM briefing both render names.
    var missingShape = ''
    for (var s = 0; s < files.script_includes.length; s++) {
        if (!files.script_includes[s].sys_id || !files.script_includes[s].name) {
            missingShape = files.script_includes[s].sys_id || '(no sys_id)'
        }
    }
    assertEqual({ name: 'bucket entries carry both sys_id and name', shouldbe: '', value: missingShape })

    // ---- Count-only buckets --------------------------------------------
    // These are numbers, not arrays — the report renders them separately
    // from the itemized inventory, so the type matters.
    var countOnly = ['choice_count', 'role_count', 'group_count', 'system_property_count']
    for (var c = 0; c < countOnly.length; c++) {
        assertEqual({
            name: countOnly[c] + ' is a number, not an array',
            shouldbe: 'number',
            value: typeof files[countOnly[c]],
        })
    }
    // sys_user_group has no sys_scope column on stock ServiceNow. The
    // field-existence guard must return an honest 0 rather than counting
    // every group on the instance.
    var groupScopeField = new GlideRecord('sys_dictionary')
    groupScopeField.addQuery('name', 'sys_user_group')
    groupScopeField.addQuery('element', 'sys_scope')
    groupScopeField.query()
    if (!groupScopeField.hasNext()) {
        assertEqual({
            name: 'group_count is 0 when sys_user_group has no sys_scope field',
            shouldbe: 0,
            value: files.group_count,
        })
    }

    // ---- Group B gating -------------------------------------------------
    var lean = scanner.scanApp(appSysId, false)
    var groupB = [
        'dashboards',
        'pa_indicators',
        'service_portals',
        'service_portal_pages',
        'service_portal_widgets',
        'flow_actions',
        'catalog_variables',
        'scripted_rest_resources',
        'sla_definitions',
        'ui_pages',
        'events',
        'import_sets',
    ]
    for (var b = 0; b < groupB.length; b++) {
        assertEqual({
            name: 'Group B bucket is skipped when includeExtended=false: ' + groupB[b],
            shouldbe: 0,
            value: lean[groupB[b]].length,
        })
    }
    assertEqual({ name: 'Group B choice_count is skipped when includeExtended=false', shouldbe: 0, value: lean.choice_count })
    // Group A must be unaffected by the gate.
    assertEqual({
        name: 'Group A buckets are unaffected by the includeExtended gate',
        shouldbe: files.script_includes.length,
        value: lean.script_includes.length,
    })

    // Omitting the flag entirely must behave like true (the documented
    // default) — Custom Only / Manual / Single Table modes rely on it.
    var defaulted = scanner.scanApp(appSysId)
    assertEqual({
        name: 'includeExtended defaults to true when omitted',
        shouldbe: files.choice_count,
        value: defaulted.choice_count,
    })

    // An unknown scope yields empty buckets, not an exception.
    var empty = scanner.scanApp('deadbeefdeadbeefdeadbeefdeadbeef', true)
    assertEqual({ name: 'unknown scope yields empty buckets', shouldbe: 0, value: empty.script_includes.length })

    stepResult.setOutputMessage(
        'Group A: ' +
            files.script_includes.length +
            ' script include(s), ' +
            files.ui_actions.length +
            ' UI action(s), ' +
            files.acls.length +
            ' ACL(s), ' +
            files.atf_tests.length +
            ' ATF test(s). Group B choice_count=' +
            files.choice_count +
            ', role_count=' +
            files.role_count +
            ', system_property_count=' +
            files.system_property_count +
            '.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
