/*
 * ATF step script — "Orchestrator: findings log and Activity-stream comments".
 *
 * _appendScanFinding() writes TWO fields on purpose:
 *   - scan_findings (String): the queryable timestamped log, overwritten
 *     with the full text on every call.
 *   - comments (Journal): one NEW entry per call, so the native Activity
 *     formatter has something to render.
 *
 * The journal half is the fragile one: the run GlideRecord is reused
 * across the whole scan, and repeated set+update on one long-lived
 * instance can silently register only the first journal entry. The
 * method re-fetches a fresh GlideRecord for that write specifically to
 * avoid it — this test is what proves the re-fetch is still there, by
 * counting sys_journal_field rows against the log's line count.
 */
;(function (outputs, steps, params, stepResult, assertEqual) {
    var app = new GlideRecord('sys_app')
    app.addQuery('scope', 'x_335329_iscan')
    app.setLimit(1)
    app.query()
    assertEqual({ name: 'fixture app x_335329_iscan found', shouldbe: true, value: app.next() })

    var runSysId = new IscanScanOrchestrator().runScan('manual', [app.getUniqueValue()])
    outputs.table = 'x_335329_iscan_run'
    outputs.record_id = runSysId

    var run = new GlideRecord('x_335329_iscan_run')
    assertEqual({ name: 'run record was created', shouldbe: true, value: run.get(runSysId) })

    var findings = run.getValue('scan_findings') || ''
    var lines = findings.split('\n')
    // Minimum for a one-app scan: resolved-apps marker, "Scanning app...",
    // the per-app summary, and the completion marker.
    assertEqual({ name: 'findings log holds one line per milestone', shouldbe: true, value: lines.length >= 4 })

    // Every line is timestamped by the writer itself (the journal half
    // gets its timestamp from the platform instead).
    var untimestamped = ''
    for (var i = 0; i < lines.length; i++) {
        if (lines[i] && lines[i].indexOf(' - ') === -1) {
            untimestamped = lines[i]
        }
    }
    assertEqual({ name: 'every findings line carries a timestamp prefix', shouldbe: '', value: untimestamped })

    // ---- Journal entries --------------------------------------------------
    var journal = new GlideRecord('sys_journal_field')
    journal.addQuery('element_id', runSysId)
    journal.addQuery('element', 'comments')
    journal.orderBy('sys_created_on')
    journal.query()
    var journalCount = journal.getRowCount()

    assertEqual({
        name: 'journal entries accumulate rather than overwriting (more than one entry exists)',
        shouldbe: true,
        value: journalCount > 1,
    })
    assertEqual({
        name: 'one journal entry per findings line',
        shouldbe: lines.length,
        value: journalCount,
    })

    // Journal text is the raw message: the platform supplies the
    // timestamp and author, so the manual prefix must NOT be duplicated.
    var firstEntry = ''
    if (journal.next()) {
        firstEntry = journal.getValue('value') || ''
    }
    assertEqual({ name: 'journal entries carry text', shouldbe: true, value: firstEntry.length > 0 })
    assertEqual({
        name: 'journal text is not double-timestamped',
        shouldbe: true,
        value: firstEntry.indexOf(' - ') === -1 || firstEntry.indexOf('Resolved') === 0,
    })

    // Both fields must survive: neither is redundant, and the run form
    // shows both.
    assertEqual({ name: 'scan_findings is still populated alongside comments', shouldbe: true, value: findings.length > 0 })

    stepResult.setOutputMessage(
        'Findings log: ' + lines.length + ' line(s); Activity stream: ' + journalCount + ' journal entry/entries.'
    )
    return true
})(outputs, steps, params, stepResult, assertEqual)
