/**
 * Firestore Security Rules Test Specification ("Dirty Dozen" Verification)
 * Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid?: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write to Branches',
    collection: '/branches/comp',
    operation: 'create',
    auth: null,
    payload: { name: 'Computer', code: '07', slug: 'computer', description: '', isActive: true, displayOrder: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: '/branches/comp',
    operation: 'create',
    auth: { uid: 'spoof', email: 'jaivalpandya123@gmail.com', email_verified: false },
    payload: { name: 'Computer', code: '07', slug: 'computer', description: '', isActive: true, displayOrder: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Assigned Super Admin Escalation',
    collection: '/admins/attackerUid',
    operation: 'create',
    auth: { uid: 'attackerUid', email: 'attacker@example.com', email_verified: true },
    payload: { uid: 'attackerUid', email: 'attacker@example.com', role: 'super_admin', isActive: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection (Ghost Field)',
    collection: '/branches/comp',
    operation: 'create',
    auth: { uid: 'super1', email: 'jaivalpandya123@gmail.com', email_verified: true },
    payload: { name: 'Computer', code: '07', slug: 'computer', description: '', isActive: true, displayOrder: 1, isOfficial: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Standard Admin Writing Super-Admin Resource',
    collection: '/website_settings/siteTitle',
    operation: 'create',
    auth: { uid: 'regularAdmin', email: 'helper@diplomatoppers.in', email_verified: true },
    payload: { settingKey: 'siteTitle', settingValue: 'Hacked' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Public Scraping Inactive Papers',
    collection: '/papers',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'PII Blanket Read on Admins',
    collection: '/admins',
    operation: 'list',
    auth: { uid: 'regularUser', email: 'student@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Orphaned Paper Creation',
    collection: '/papers/p1',
    operation: 'create',
    auth: { uid: 'super1', email: 'jaivalpandya123@gmail.com', email_verified: true },
    payload: { subjectId: 'missing-subject', branchId: 'missing-branch', semesterId: 'missing-sem', title: 'Orphan', examSession: 'Summer', examYear: 2025, pdfStoragePath: '/api/files/p1.pdf', originalFilename: 'p1.pdf', fileSize: 1024, slug: 'summer-2025', isActive: true, downloadCount: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Resource Poisoning via Oversized ID',
    collection: `/branches/${'a'.repeat(1500)}`,
    operation: 'create',
    auth: { uid: 'super1', email: 'jaivalpandya123@gmail.com', email_verified: true },
    payload: { name: 'Oversized', code: '99', slug: 'oversized', description: '', isActive: true, displayOrder: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery',
    collection: '/branches/comp',
    operation: 'create',
    auth: { uid: 'super1', email: 'jaivalpandya123@gmail.com', email_verified: true },
    payload: { name: 'Computer', code: '07', slug: 'computer', description: '', isActive: true, displayOrder: 1, createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Immutable Field Mutation',
    collection: '/papers/p1',
    operation: 'update',
    auth: { uid: 'super1', email: 'jaivalpandya123@gmail.com', email_verified: true },
    payload: { downloadCount: 99999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid Enum / Value Poisoning',
    collection: '/papers/p1',
    operation: 'update',
    auth: { uid: 'super1', email: 'jaivalpandya123@gmail.com', email_verified: true },
    payload: { examSession: 'Monsoon', examYear: 1800, fileSize: -5 },
    expected: 'PERMISSION_DENIED',
  },
];
