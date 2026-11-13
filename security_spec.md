# DiplomaToppers Security Specification (Firestore Rules TDD)

## 1. Data Invariants
1. **Default Deny**: All unmatched paths are denied read and write access (`allow read, write: if false`).
2. **Public Academic Catalog Isolation**: Public visitors can read (`get` and `list`) ONLY documents where `isActive == true` for `branches`, `semesters`, `subjects`, `papers`, and `advertisements`. Inactive/draft items are strictly readable only by authenticated, verified active admins.
3. **Referential Integrity**:
   - Creating a `semester` requires an existing parent `branchId` in `/branches`.
   - Creating a `subject` requires existing `branchId` in `/branches` and `semesterId` in `/semesters`.
   - Creating a `paper` requires existing `subjectId` in `/subjects`, `branchId` in `/branches`, and `semesterId` in `/semesters`.
4. **Role-Based Access Control (RBAC)**:
   - No custom claims trust: roles are verified strictly against `/admins/$(request.auth.uid)` or the bootstrapped super-admin email (`jaivalpandya123@gmail.com`) with `request.auth.token.email_verified == true`.
   - Standard `admin` can manage `branches`, `semesters`, `subjects`, and `papers`.
   - Only `super_admin` can manage `advertisements`, `website_settings`, `admins`, and `admin_invites`.
5. **PII Isolation**:
   - `/admins/{uid}` and `/admin_invites/{inviteId}` store administrator email addresses. Public users and unverified accounts cannot read them.
   - Non-super-admin users can only `get` their own `/admins/{uid}` record or matching `/admin_invites/{inviteId}`; they cannot list all admins or invites.
6. **Privilege Escalation Prevention**:
   - Users cannot self-create an `/admins/{uid}` document with arbitrary `role` unless they match the bootstrapped super-admin email or a valid active `/admin_invites/{inviteId}` matching their verified email and exact assigned `role`.
   - Users cannot update their own `role` or `isActive` fields.
7. **Temporal & Immutable Field Integrity**:
   - `createdAt` must equal `request.time` on creation and remain immutable (`incoming().createdAt == existing().createdAt`) on updates.
   - `updatedAt` must equal `request.time` on creation and updates.
8. **Payload & Path Hardening**:
   - Every document ID path variable is validated with `isValidId()` (`^[a-zA-Z0-9_\\-]+$`, `<= 128` chars).
   - Every string field enforces strict `.size()` bounds.
   - Every create and update enforces strict key allowlists (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly(...)` on update).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Write to Branches**: Anonymous user attempts `create` on `/branches/comp`. Expected: `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: Signed-in user with `email: 'jaivalpandya123@gmail.com'` but `email_verified: false` attempts to write `/branches/comp`. Expected: `PERMISSION_DENIED`.
3. **Self-Assigned Super Admin Escalation**: Regular authenticated user attempts to create `/admins/attackerUid` with `{ role: 'super_admin', isActive: true }` without an invite. Expected: `PERMISSION_DENIED`.
4. **Shadow Field Injection ("Ghost Field")**: Authenticated admin sends valid branch payload plus `{ isOfficial: true }`. Expected: `PERMISSION_DENIED`.
5. **Standard Admin Writing Super-Admin Resource**: Standard `admin` attempts to modify `/website_settings/siteTitle` or `/admins/otherUid`. Expected: `PERMISSION_DENIED`.
6. **Public Scraping Inactive Papers**: Public user runs `list` query on `/papers` without `where('isActive', '==', true)`. Expected: `PERMISSION_DENIED`.
7. **PII Blanket Read on Admins**: Standard signed-in user attempts `list` on `/admins`. Expected: `PERMISSION_DENIED`.
8. **Orphaned Paper Creation**: Admin attempts to create `/papers/p1` referencing a non-existent `subjectId: 'missing-subject'`. Expected: `PERMISSION_DENIED`.
9. **Resource Poisoning via Oversized ID**: Admin attempts to create `/branches/<1500-char-id>`. Expected: `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: Admin creates a branch with `createdAt` backdated to 2020 instead of `request.time`. Expected: `PERMISSION_DENIED`.
11. **Immutable Field Mutation**: Admin updates a paper and attempts to change `createdAt` or `subjectId`. Expected: `PERMISSION_DENIED`.
12. **Invalid Enum / Value Poisoning**: Admin updates a paper setting `examSession: 'Monsoon'` or `examYear: 1800` or `fileSize: -5`. Expected: `PERMISSION_DENIED`.
