import { Test } from '@servicenow/sdk/core'
import { scannerRole } from '../roles.now'

/*
 * Security tests.
 *
 * Nothing in this app runs elevated: every query and every write happens
 * as the calling user. That makes the ACL set functional, not decorative
 * — a missing grant does not raise an error, it makes the scan write
 * nothing. Both tests therefore run against a REAL freshly-created user
 * (ATF's "Create a user" step) rather than against the admin running the
 * suite.
 */

export const iscanTestSecurityScannerRole = Test(
    {
        $id: Now.ID['iscan_test_security_scanner_role'],
        name: 'iScan — Security: the scanner role alone can run a scan',
        description:
            'A non-admin user holding only x_335329_iscan.scanner can create and update a run, create result/table/crossref rows, and read them back — and cannot write or delete a result, which has no write ACL by design. Whichever scan mode the instance\'s metadata ACLs allow (full access or the Application Files fallback) is asserted on its own terms.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        atf.server.createUser({
            $id: Now.ID['iscan_test_security_scanner_role_step1'],
            firstName: 'iScan',
            lastName: 'Scanner ATF',
            roles: [scannerRole],
            impersonate: true,
        })
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_security_scanner_role_step2'],
            script: Now.include('../../server/tests/SecurityScannerRole.test.js'),
        })
    }
)

export const iscanTestSecurityNoRole = Test(
    {
        $id: Now.ID['iscan_test_security_no_role'],
        name: 'iScan — Security: a user without the scanner role is denied',
        description:
            'Seeds a run record as the test user, then impersonates a brand-new user with NO roles: every one of the app\'s 5 tables must deny read and create, the insert attempt must return null, and existing scan history must be invisible.',
        active: true,
        failOnServerError: true,
    },
    (atf) => {
        // Seeded before impersonation so the "no scan history is visible"
        // assertion has something it would see if the ACLs were wrong.
        atf.server.recordInsert({
            $id: Now.ID['iscan_test_security_no_role_step1'],
            table: 'x_335329_iscan_run',
            fieldValues: {
                scan_mode: 'manual',
                status: 'pending',
            },
        })
        atf.server.createUser({
            $id: Now.ID['iscan_test_security_no_role_step2'],
            firstName: 'iScan',
            lastName: 'NoRole ATF',
            roles: [],
            impersonate: true,
        })
        atf.server.runServerSideScript({
            $id: Now.ID['iscan_test_security_no_role_step3'],
            script: Now.include('../../server/tests/SecurityNoRole.test.js'),
        })
    }
)
