/*
 * ATF step script — "IscanTableScanner: base-system customization detection".
 *
 * Two directions, deliberately kept separate in the code and here:
 *   - findGlobalCustomizations(table): what has ANY customer scope done
 *     to this ONE base-system table? Only applicable to tables with no
 *     owning sys_app record.
 *   - findAppCustomizationsOnGlobalTables(app): which base-system tables
 *     has THIS app reached into? Runs for every app in every scan mode.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var scanner = new IscanTableScanner()

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    // ---- findGlobalCustomizations() ------------------------------------
    // A table owned by a real app is not a base-system table, so the whole
    // check no-ops rather than reporting the app's own fields as
    // "customizations" of itself.
    var owned = scanner.findGlobalCustomizations('x_335329_iscan_run')
    assertEqual({
        name: 'findGlobalCustomizations() is not applicable to an app-owned table',
        shouldbe: false,
        value: owned.applicable,
    })
    assertEqual({ name: 'inapplicable result still returns empty field list', shouldbe: 0, value: owned.custom_fields.length })
    assertEqual({
        name: 'inapplicable result still returns empty artifact list',
        shouldbe: 0,
        value: owned.custom_artifacts.length,
    })

    // A base-system table IS applicable. Its contents are instance-
    // specific (a vanilla instance has none, a customized one has many),
    // so the shape is asserted, not the counts.
    var base = scanner.findGlobalCustomizations('incident')
    assertEqual({ name: 'findGlobalCustomizations() is applicable to a base-system table', shouldbe: true, value: base.applicable })
    assertEqual({ name: 'base-system result returns a field array', shouldbe: true, value: !!base.custom_fields.length || base.custom_fields.length === 0 })
    var badArtifact = ''
    for (var a = 0; a < base.custom_artifacts.length; a++) {
        var type = base.custom_artifacts[a].type
        if (['business_rule', 'client_script', 'ui_policy', 'acl'].indexOf(type) === -1) {
            badArtifact = type
        }
    }
    assertEqual({ name: 'artifact types are limited to the four scanned classes', shouldbe: '', value: badArtifact })

    // ---- findAppCustomizationsOnGlobalTables() --------------------------
    var findings = scanner.findAppCustomizationsOnGlobalTables(appSysId)
    assertEqual({ name: 'findAppCustomizationsOnGlobalTables() returns a list', shouldbe: true, value: !!findings.length || findings.length === 0 })

    // This app must never report ITS OWN tables here — those are covered
    // by the per-app table profile, not by base-system customization.
    var ownTables = [
        'x_335329_iscan_run',
        'x_335329_iscan_result',
        'x_335329_iscan_table',
        'x_335329_iscan_crossref',
        'x_335329_iscan_global_customization',
    ]
    var selfReported = ''
    for (var f = 0; f < findings.length; f++) {
        if (ownTables.indexOf(findings[f].table_name) !== -1) {
            selfReported = findings[f].table_name
        }
    }
    assertEqual({
        name: 'an app is never reported as customizing its own tables',
        shouldbe: '',
        value: selfReported,
    })

    // Every reported table must genuinely have no owning sys_app record.
    var wronglyOwned = ''
    for (var g = 0; g < findings.length; g++) {
        var db = new GlideRecord('sys_db_object')
        db.addQuery('name', findings[g].table_name)
        db.setLimit(1)
        db.query()
        if (db.next()) {
            var owner = new GlideRecord('sys_app')
            if (db.getValue('sys_scope') && owner.get(db.getValue('sys_scope'))) {
                wronglyOwned = findings[g].table_name
            }
        }
    }
    assertEqual({
        name: 'only tables with no owning sys_app are reported as base-system customizations',
        shouldbe: '',
        value: wronglyOwned,
    })

    // A scope that owns nothing must come back empty rather than throwing.
    assertEqual({
        name: 'unknown scope produces no findings',
        shouldbe: 0,
        value: scanner.findAppCustomizationsOnGlobalTables('deadbeefdeadbeefdeadbeefdeadbeef').length,
    })

    stepResult.setOutputMessage(
        'incident: ' +
            base.custom_fields.length +
            ' custom field(s), ' +
            base.custom_artifacts.length +
            ' custom artifact(s). This app customizes ' +
            findings.length +
            ' base-system table(s).'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
