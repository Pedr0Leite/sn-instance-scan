import { Role } from '@servicenow/sdk/core'

// Dedicated role rather than admin-only, so the ACL-denial fallback path
// (Story 4 in architecture.md) gets exercised in normal use rather than
// only as a theoretical negative test.
//
// containsRoles must NOT include 'admin' — that would mean *this* role
// contains (grants) admin, so every scanner would silently become a full
// admin, canAccessMetadata() would always return true, and the
// ACL-fallback path this app exists to exercise could never trigger.
// That directly contradicted the spec's "no elevated privilege" /
// "never assume security_admin" constraints.
export const scannerRole = Role({
    name: 'x_335329_iscan.scanner',
    description: 'Can request instance scans and read scan results.',
    grantable: true,
})
