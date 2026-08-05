import { Test } from '@servicenow/sdk/core'

/*
 * Report tests, split so a failure is self-diagnosing: one test covers
 * what the report SAYS (pure HTML building), the other covers whether the
 * platform PDF plugin turns it into a real attachment. A red PDF test
 * with a green content test points at the plugin, not at this app.
 */

export const iscanTestReportContent = Test(
    {
        $id: Now.ID['iscan_test_report_content'],
        name: 'iScan — Report content, status flags and recommendations',
        description:
            'Run and result report HTML carry every expected section (findings log, per-app detail, status, recommendations, itemized artifact inventory, tables, cross-references) and link back to the source records. Status flags and recommendations are asserted in both directions: present when the condition holds, absent when it does not.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_report_content_step1'],
            script: Now.include('../../server/tests/ReportGeneratorContent.test.js'),
        })
    }
)

export const iscanTestReportPdf = Test(
    {
        $id: Now.ID['iscan_test_report_pdf'],
        name: 'iScan — Report PDF generation and attachment',
        description:
            'Both reports produce a real sys_attachment on the record the button was clicked from, with a PDF content type, a non-zero size and the expected file name. Unknown record ids return an empty attachment id without throwing.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_report_pdf_step1'],
            script: Now.include('../../server/tests/ReportGeneratorPdf.test.js'),
        })
    }
)
