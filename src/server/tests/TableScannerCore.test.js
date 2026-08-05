/*
 * ATF step script — "IscanTableScanner: access gate, owned tables, profiling".
 *
 * Covers the three hard conventions from CLAUDE.md that are easy to
 * regress and impossible to notice from the UI:
 *   1. canAccessMetadata() is a deterministic canRead() gate, not a
 *      try/catch fallback.
 *   2. row counts come from GlideAggregate COUNT, never
 *      GlideRecord.getRowCount() — verified by recomputing the count here
 *      with GlideAggregate and comparing.
 *   3. profileTable() is deliberately UNSCOPED: it returns every field on
 *      the table, not only the ones the owning app added.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var scanner = new IscanTableScanner()

    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })
    var appSysId = app.getUniqueValue()

    // ---- canAccessMetadata() -------------------------------------------
    var canAccess = scanner.canAccessMetadata()
    assertEqual({
        name: 'canAccessMetadata() returns a boolean, not a truthy object',
        shouldbe: 'boolean',
        value: typeof canAccess,
    })
    // This step runs as the test user (admin by default), who can read
    // both metadata tables — so the primary path must be selected.
    assertEqual({ name: 'canAccessMetadata() is true for a metadata-reading user', shouldbe: true, value: canAccess })

    // ---- getOwnedTables() ----------------------------------------------
    var owned = scanner.getOwnedTables(appSysId)
    var ownedNames = []
    for (var i = 0; i < owned.length; i++) {
        ownedNames.push(owned[i].name)
    }
    var expectedTables = [
        'x_335329_iscan_run',
        'x_335329_iscan_result',
        'x_335329_iscan_table',
        'x_335329_iscan_crossref',
        'x_335329_iscan_global_customization',
    ]
    for (var e = 0; e < expectedTables.length; e++) {
        assertEqual({
            name: 'getOwnedTables() finds ' + expectedTables[e],
            shouldbe: true,
            value: ownedNames.indexOf(expectedTables[e]) !== -1,
        })
    }
    // None of this app's tables extend anything, so the classifier must
    // report 'none' — not 'other', and not a blank string.
    assertEqual({
        name: 'getOwnedTables() classifies non-extending tables as well_known_base "none"',
        shouldbe: 'none',
        value: owned[0].well_known_base,
    })
    assertEqual({
        name: 'getOwnedTables() reports no parent table for a base table',
        shouldbe: '',
        value: owned[0].extends,
    })
    assertEqual({
        name: 'getOwnedTables() returns nothing for a scope that owns no tables',
        shouldbe: 0,
        value: scanner.getOwnedTables('deadbeefdeadbeefdeadbeefdeadbeef').length,
    })

    // ---- profileTable() -------------------------------------------------
    var profile = scanner.profileTable('x_335329_iscan_run')

    var aggregate = new GlideAggregate('x_335329_iscan_run')
    aggregate.addAggregate('COUNT')
    aggregate.query()
    var expectedRowCount = aggregate.next() ? parseInt(aggregate.getAggregate('COUNT'), 10) || 0 : 0
    assertEqual({
        name: 'profileTable() row_count matches an independent GlideAggregate COUNT',
        shouldbe: expectedRowCount,
        value: profile.row_count,
    })

    var fieldNames = []
    for (var f = 0; f < profile.fields.length; f++) {
        fieldNames.push(profile.fields[f].name)
    }
    assertEqual({
        name: 'profileTable() captures an app-defined field (scan_mode)',
        shouldbe: true,
        value: fieldNames.indexOf('scan_mode') !== -1,
    })
    // The unscoped field capture is the whole point: sys_id is a platform
    // field, so its presence proves the sys_scope filter is really gone.
    assertEqual({
        name: 'profileTable() is unscoped — platform fields are captured too (sys_id)',
        shouldbe: true,
        value: fieldNames.indexOf('sys_id') !== -1,
    })
    assertEqual({
        name: 'profileTable() field entries carry a type',
        shouldbe: true,
        value: !!profile.fields[0].internal_type,
    })

    var refs = profile.reference_fields.join(',')
    assertEqual({
        name: 'profileTable() reference graph records requested_by -> sys_user',
        shouldbe: true,
        value: refs.indexOf('requested_by->sys_user') !== -1,
    })
    assertEqual({
        name: 'profileTable() reference graph records target_app -> sys_app',
        shouldbe: true,
        value: refs.indexOf('target_app->sys_app') !== -1,
    })
    assertEqual({
        name: 'profileTable() reference graph records target_table -> sys_db_object',
        shouldbe: true,
        value: refs.indexOf('target_table->sys_db_object') !== -1,
    })

    // A dictionary override means another app added a field to a table it
    // does not own. Nothing else has touched this app's own tables, so a
    // non-zero count here means either a real governance finding on this
    // instance or a broken comparison in profileTable().
    assertEqual({
        name: 'profileTable() reports override count as a number',
        shouldbe: 'number',
        value: typeof profile.dictionary_override_count,
    })
    assertEqual({
        name: 'dictionary_override_count matches the dictionary_overrides list length',
        shouldbe: profile.dictionary_overrides.length,
        value: profile.dictionary_override_count,
    })

    // A child table's profile must resolve its own outbound references too.
    var resultProfile = scanner.profileTable('x_335329_iscan_result')
    var resultRefs = resultProfile.reference_fields.join(',')
    assertEqual({
        name: 'result table reference graph records run -> x_335329_iscan_run',
        shouldbe: true,
        value: resultRefs.indexOf('run->x_335329_iscan_run') !== -1,
    })
    assertEqual({
        name: 'result table reference graph records app -> sys_app',
        shouldbe: true,
        value: resultRefs.indexOf('app->sys_app') !== -1,
    })

    stepResult.setOutputMessage(
        'Owned tables: ' +
            owned.length +
            '. x_335329_iscan_run profile: ' +
            profile.row_count +
            ' row(s), ' +
            profile.fields.length +
            ' field(s), ' +
            profile.reference_fields.length +
            ' reference field(s), ' +
            profile.dictionary_override_count +
            ' dictionary override(s).'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
