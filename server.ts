import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import { runProductionSeoHealthCheck } from './api/seo-health-check';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const PAPERS_DIR = path.join(UPLOADS_ROOT, 'papers');
const BANNERS_DIR = path.join(UPLOADS_ROOT, 'banners');
const DOWNLOAD_STATS_FILE = path.join(UPLOADS_ROOT, 'download-stats.json');

fs.mkdirSync(PAPERS_DIR, { recursive: true });
fs.mkdirSync(BANNERS_DIR, { recursive: true });
if (!fs.existsSync(DOWNLOAD_STATS_FILE)) {
  fs.writeFileSync(DOWNLOAD_STATS_FILE, JSON.stringify({}, null, 2), 'utf8');
}

function readDownloadStats(): Record<string, number> {
  try {
    const raw = fs.readFileSync(DOWNLOAD_STATS_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function incrementDownloadStat(paperId: string): number {
  const stats = readDownloadStats();
  const next = (stats[paperId] || 0) + 1;
  stats[paperId] = next;
  fs.writeFileSync(DOWNLOAD_STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  return next;
}

// ---- Firestore REST Helpers (Zero external service account key required) ----
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

function decodeFirestoreValue(v?: FirestoreValue): unknown {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) {
    return (v.arrayValue.values || [])
      .map((item) => decodeFirestoreValue(item))
      .filter((item) => item !== undefined);
  }
  if (v.mapValue) {
    return decodeFirestoreFields(v.mapValue.fields);
  }
  return undefined;
}

function decodeFirestoreFields(fields?: Record<string, FirestoreValue>): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    const decoded = decodeFirestoreValue(v);
    if (decoded !== undefined) {
      out[k] = decoded;
    }
  }
  return out;
}

async function firestoreGetDocument(
  collectionName: string,
  docId: string,
  bearerToken?: string
): Promise<Record<string, unknown> | null> {
  try {
    const encodedPath = collectionName.split('/').map(encodeURIComponent).join('/');
    const url = `${FIRESTORE_REST_BASE}/${encodedPath}/${encodeURIComponent(docId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const headers: Record<string, string> = {};
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string; fields?: Record<string, FirestoreValue> };
    if (!json.fields) return null;
    const id = json.name?.split('/').pop() || docId;
    return { id, ...decodeFirestoreFields(json.fields) };
  } catch {
    return null;
  }
}

async function fetchCloudFileFromFirestore(
  fileId: string
): Promise<{ buffer: Buffer; contentType: string; originalFilename: string } | null> {
  const meta = await firestoreGetDocument('paper_files', fileId);
  if (!meta) return null;

  const chunkCount = Math.max(0, Number(meta.chunkCount || 0));
  if (chunkCount <= 0 || chunkCount > 60) return null;

  try {
    const chunkDocs = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => {
        const chunkId = `chunk-${String(i).padStart(4, '0')}`;
        return firestoreGetDocument(`paper_files/${encodeURIComponent(fileId)}/chunks`, chunkId);
      })
    );

    const buffers: Buffer[] = [];
    for (const chunkDoc of chunkDocs) {
      if (!chunkDoc || typeof chunkDoc.dataBase64 !== 'string') {
        return null;
      }
      buffers.push(Buffer.from(chunkDoc.dataBase64, 'base64'));
    }

    return {
      buffer: Buffer.concat(buffers),
      contentType: String(meta.contentType || 'application/pdf'),
      originalFilename: String(meta.originalFilename || 'GTU-Question-Paper.pdf').replace(/"/g, ''),
    };
  } catch {
    return null;
  }
}

async function incrementDownloadStatFirestore(paperId: string): Promise<void> {
  try {
    const docName = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/paper_stats/${paperId}`;
    const commitUrl = `${FIRESTORE_REST_BASE}:commit?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: docName,
              fields: { paperId: { stringValue: paperId } },
            },
            updateMask: { fieldPaths: ['paperId'] },
            updateTransforms: [
              { fieldPath: 'downloadCount', increment: { integerValue: '1' } },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
          },
        ],
      }),
    });
  } catch {
    // Non-fatal
  }
}

async function uploadBufferToFirestoreCloud(
  fileBuffer: Buffer,
  originalFilename: string,
  contentType = 'application/pdf'
): Promise<string | null> {
  const CHUNK_BYTES = 480 * 1024;
  const chunkCount = Math.max(1, Math.ceil(fileBuffer.length / CHUNK_BYTES));
  const fileId = `pdf-mig-${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const commitUrl = `${FIRESTORE_REST_BASE}:commit?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const fileDocName = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/paper_files/${fileId}`;

  const createMetaRes = await fetch(commitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        {
          currentDocument: { exists: false },
          update: {
            name: fileDocName,
            fields: {
              originalFilename: { stringValue: originalFilename.slice(0, 255) || 'question-paper.pdf' },
              contentType: { stringValue: contentType },
              fileSize: { integerValue: String(fileBuffer.length) },
              chunkCount: { integerValue: String(chunkCount) },
            },
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ],
    }),
  });
  if (!createMetaRes.ok) {
    const errText = await createMetaRes.text().catch(() => '');
    console.error('Cloud migration metadata write failed:', createMetaRes.status, errText);
    return null;
  }

  for (let i = 0; i < chunkCount; i++) {
    const slice = fileBuffer.subarray(i * CHUNK_BYTES, Math.min((i + 1) * CHUNK_BYTES, fileBuffer.length));
    const chunkId = `chunk-${String(i).padStart(4, '0')}`;
    const chunkDocName = `${fileDocName}/chunks/${chunkId}`;
    const chunkRes = await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [
          {
            currentDocument: { exists: false },
            update: {
              name: chunkDocName,
              fields: {
                index: { integerValue: String(i) },
                dataBase64: { stringValue: slice.toString('base64') },
              },
            },
          },
        ],
      }),
    });
    if (!chunkRes.ok) {
      const errText = await chunkRes.text().catch(() => '');
      console.error('Cloud migration chunk write failed:', chunkRes.status, errText);
      return null;
    }
  }

  return `/api/pdf-files/${fileId}`;
}

async function syncLocalDiskPdfsToCloudStorage(): Promise<void> {
  try {
    const papers = await firestoreListCollection('papers');
    const legacyPapers = papers.filter((p) =>
      String(p.pdfStoragePath || '').startsWith('/api/files/papers/')
    );
    if (legacyPapers.length === 0) return;

    const uploadedByLocalPath = new Map<string, string>();
    const commitUrl = `${FIRESTORE_REST_BASE}:commit?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    let migratedCount = 0;

    for (const p of legacyPapers) {
      const localStoragePath = String(p.pdfStoragePath || '');
      const filename = path.basename(localStoragePath.slice('/api/files/papers/'.length));
      const fullPath = path.join(PAPERS_DIR, filename);
      if (!fs.existsSync(fullPath)) continue;

      let cloudPath = uploadedByLocalPath.get(localStoragePath);
      if (!cloudPath) {
        const buf = fs.readFileSync(fullPath);
        const orig = String(p.originalFilename || filename);
        const created = await uploadBufferToFirestoreCloud(buf, orig, 'application/pdf');
        if (!created) continue;
        cloudPath = created;
        uploadedByLocalPath.set(localStoragePath, cloudPath);
      }

      const paperDocName = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/papers/${String(p.id)}`;
      const updateRes = await fetch(commitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: paperDocName,
                fields: {
                  pdfStoragePath: { stringValue: cloudPath },
                },
              },
              updateMask: { fieldPaths: ['pdfStoragePath'] },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
        }),
      });
      if (updateRes.ok) {
        migratedCount++;
      } else {
        const errText = await updateRes.text().catch(() => '');
        console.error(`Failed to update paper ${String(p.id)} path:`, updateRes.status, errText);
      }
    }

    if (migratedCount > 0) {
      console.log(`Synced ${migratedCount} local preview paper(s) to shared Firestore cloud storage.`);
    }
  } catch (err) {
    console.error('Local PDF cloud sync error:', err);
  }
}

async function firestoreRunActiveQuery(collectionName: string): Promise<Array<Record<string, unknown>>> {
  try {
    const url = `${FIRESTORE_REST_BASE}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'isActive' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
        limit: 500,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreValue> };
    }>;
    return rows
      .filter((r) => r.document?.fields)
      .map((r) => ({
        id: r.document!.name?.split('/').pop() || '',
        ...decodeFirestoreFields(r.document!.fields),
      }));
  } catch {
    return [];
  }
}

async function firestoreListCollection(collectionName: string): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = [];
  const batchSize = 500;
  let offset = 0;
  try {
    while (true) {
      const url = `${FIRESTORE_REST_BASE}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collectionName }],
            limit: batchSize,
            offset,
          },
        }),
      });
      if (!res.ok) break;
      const rows = (await res.json()) as Array<{
        document?: { name?: string; fields?: Record<string, FirestoreValue> };
      }>;
      const docs = rows
        .filter((r) => r.document?.fields)
        .map((r) => ({
          id: r.document!.name?.split('/').pop() || '',
          ...decodeFirestoreFields(r.document!.fields),
        }));
      results.push(...docs);
      if (docs.length < batchSize) break;
      offset += docs.length;
    }
    return results;
  } catch {
    return results;
  }
}

// ---- Admin Session & Auth Middleware ----
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jaivalpandya@123';
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto.createHmac('sha256', 'diplomatoppers-session-key').update(ADMIN_PASSWORD + firebaseConfig.projectId).digest('hex');

function createAdminSessionToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminSessionToken(token?: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function extractAdminToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 'dt_admin_session') {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }
  return undefined;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractAdminToken(req);
  if (!verifyAdminSessionToken(token)) {
    res.status(401).json({ error: 'Unauthorized: Valid administrator session required.' });
    return;
  }
  next();
}

// ---- Multer Config ----
const uploadPdfMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadBannerMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function normalizeHttpOrigin(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.includes('MY_APP_URL') || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeVerificationToken(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let token = raw.trim();
  const metaMatch = token.match(/content=["']([^"']+)["']/i);
  if (metaMatch?.[1]) {
    token = metaMatch[1].trim();
  }
  if (!token || token === ADMIN_PASSWORD || !/^[a-zA-Z0-9_-]{8,128}$/.test(token)) {
    return '';
  }
  return token;
}

function getCanonicalOrigin(req: Request): string {
  const configured =
    normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeHttpOrigin(process.env.APP_URL);
  if (configured) {
    return configured;
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SsrFaqItem {
  question: string;
  answer: string;
}

function normalizeStringList(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

function normalizeFaqs(val: unknown): SsrFaqItem[] {
  if (!Array.isArray(val)) return [];
  const items: SsrFaqItem[] = [];
  for (const raw of val) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const q = typeof obj.question === 'string' ? obj.question.trim() : '';
    const a = typeof obj.answer === 'string' ? obj.answer.trim() : '';
    if (q && a) {
      items.push({ question: q, answer: a });
    }
  }
  return items;
}

function combineKeywords(focus?: string, secondary?: string): string {
  const parts = [focus, secondary]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(p);
    }
  }
  return unique.join(', ');
}

function buildSsrRelatedLinksHtml(params: {
  branches: Array<Record<string, unknown>>;
  semesters: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  papers: Array<Record<string, unknown>>;
  blogs?: Array<Record<string, unknown>>;
  currentBranch?: Record<string, unknown>;
  currentSemester?: Record<string, unknown>;
  currentSubject?: Record<string, unknown>;
  currentPaper?: Record<string, unknown>;
}): string {
  const {
    branches,
    semesters,
    subjects,
    papers,
    blogs = [],
    currentBranch,
    currentSemester,
    currentSubject,
    currentPaper,
  } = params;
  const branchById = new Map(branches.map((b) => [String(b.id), b]));
  const semById = new Map(semesters.map((s) => [String(s.id), s]));
  const subjById = new Map(subjects.map((s) => [String(s.id), s]));

  const branchLinks = branches
    .map((b) => `<li><a href="/${escapeHtml(String(b.slug))}">${escapeHtml(String(b.name))}</a></li>`)
    .join('');

  const subjectLinks: string[] = [];
  const seenSubj = new Set<string>();
  const addSubjLink = (s: Record<string, unknown>) => {
    const br = branchById.get(String(s.branchId));
    const sem = semById.get(String(s.semesterId));
    if (!br || !sem) return;
    const href = `/${String(br.slug)}/semester-${Number(sem.semesterNumber)}/${String(s.slug)}`;
    if (seenSubj.has(href)) return;
    seenSubj.add(href);
    subjectLinks.push(`<li><a href="${escapeHtml(href)}">${escapeHtml(String(s.name))} (${escapeHtml(String(s.code))})</a></li>`);
  };

  if (currentSubject) {
    const code = String(currentSubject.code || '').toUpperCase();
    for (const s of subjects) {
      if (String(s.id) !== String(currentSubject.id) && String(s.code || '').toUpperCase() === code) addSubjLink(s);
    }
  }
  if (currentBranch && currentSemester) {
    for (const s of subjects) {
      if (String(s.branchId) === String(currentBranch.id) && String(s.semesterId) === String(currentSemester.id) && String(s.id) !== String(currentSubject?.id || '')) {
        addSubjLink(s);
      }
    }
  }
  for (const s of subjects) {
    if (subjectLinks.length >= 10) break;
    if (String(s.id) !== String(currentSubject?.id || '')) addSubjLink(s);
  }

  const paperLinks: string[] = [];
  const seenPaper = new Set<string>();
  const addPaperLink = (p: Record<string, unknown>) => {
    if (currentPaper && String(p.id) === String(currentPaper.id)) return;
    const br = branchById.get(String(p.branchId));
    const sem = semById.get(String(p.semesterId));
    const subj = subjById.get(String(p.subjectId));
    if (!br || !sem || !subj) return;
    const href = `/${String(br.slug)}/semester-${Number(sem.semesterNumber)}/${String(subj.slug)}/${String(p.slug)}`;
    if (seenPaper.has(href)) return;
    seenPaper.add(href);
    paperLinks.push(`<li><a href="${escapeHtml(href)}">${escapeHtml(String(p.title))}</a></li>`);
  };

  if (currentSubject) {
    for (const p of papers) {
      if (String(p.subjectId) === String(currentSubject.id)) addPaperLink(p);
    }
  }
  for (const p of papers) {
    if (paperLinks.length >= 10) break;
    addPaperLink(p);
  }

  const recentBlogLinks = blogs
    .slice(0, 2)
    .map(
      (post) =>
        `<li><a href="/blog/${escapeHtml(String(post.slug))}">${escapeHtml(String(post.title))}</a></li>`
    )
    .join('');

  const siteLinks = [
    '<li><a href="/">Home</a></li>',
    '<li><a href="/blog">Study Blog</a></li>',
    recentBlogLinks,
    '<li><a href="/about">About Us</a></li>',
    '<li><a href="/contact">Contact Us</a></li>',
    '<li><a href="/privacy-policy">Privacy Policy</a></li>',
    '<li><a href="/terms-and-conditions">Terms &amp; Conditions</a></li>',
    '<li><a href="/disclaimer">Academic Disclaimer</a></li>',
    '<li><a href="/sitemap.xml">XML Sitemap</a></li>',
  ].join('');

  return `<nav aria-label="Related Content and Internal Links"><h2>Related Content &amp; Internal Links</h2><ul>${branchLinks}</ul>${subjectLinks.length ? `<ul>${subjectLinks.join('')}</ul>` : ''}${paperLinks.length ? `<ul>${paperLinks.join('')}</ul>` : ''}<ul>${siteLinks}</ul></nav>`;
}

function buildSsrRichContentHtml(params: {
  h2Headings: string[];
  h3Headings: string[];
  detailedContent: string;
  faqs: SsrFaqItem[];
}): string {
  const { h2Headings, h3Headings, detailedContent, faqs } = params;
  const parts: string[] = [];

  const paragraphs = detailedContent
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (h2Headings.length > 0 || paragraphs.length > 0 || h3Headings.length > 0) {
    parts.push('<section>');
    if (h2Headings[0]) parts.push(`<h2>${escapeHtml(h2Headings[0])}</h2>`);
    if (paragraphs[0]) parts.push(`<p>${escapeHtml(paragraphs[0])}</p>`);
    if (h2Headings[1]) parts.push(`<h2>${escapeHtml(h2Headings[1])}</h2>`);
    for (const para of paragraphs.slice(1)) {
      parts.push(`<p>${escapeHtml(para)}</p>`);
    }
    for (const extraH2 of h2Headings.slice(2)) {
      parts.push(`<h2>${escapeHtml(extraH2)}</h2>`);
    }
    for (const h3 of h3Headings) {
      parts.push(`<h3>${escapeHtml(h3)}</h3>`);
    }
    parts.push('</section>');
  }

  if (faqs.length > 0) {
    parts.push('<section><h2>Frequently Asked Questions</h2><dl>');
    for (const faq of faqs) {
      parts.push(`<dt>${escapeHtml(faq.question)}</dt><dd>${escapeHtml(faq.answer)}</dd>`);
    }
    parts.push('</dl></section>');
  }

  return parts.join('');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function resolveRouteSeo(pathname: string, origin: string) {
  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  const [branches, semesters, subjects, papers, blogs, settingsList, seoList] = await Promise.all([
    firestoreRunActiveQuery('branches'),
    firestoreRunActiveQuery('semesters'),
    firestoreRunActiveQuery('subjects'),
    firestoreRunActiveQuery('papers'),
    firestoreRunActiveQuery('blog_posts'),
    firestoreListCollection('website_settings'),
    firestoreListCollection('seo_metadata'),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const s of settingsList) {
    if (typeof s.settingKey === 'string') {
      settingsMap[s.settingKey] = String(s.settingValue || '');
    }
  }

  const seoById = new Map<string, Record<string, unknown>>();
  const seoByPath = new Map<string, Record<string, unknown>>();
  for (const item of seoList) {
    if (item.id) seoById.set(String(item.id), item);
    if (typeof item.pagePath === 'string' && item.pagePath) {
      const norm = item.pagePath === '/' ? '/' : item.pagePath.replace(/\/+$/, '');
      seoByPath.set(norm, item);
    }
  }

  const effectiveOrigin = normalizeHttpOrigin(settingsMap.siteUrl) || origin;
  const canonical = `${effectiveOrigin}${cleanPath === '/' ? '/' : cleanPath}`;
  const googleVerification = sanitizeVerificationToken(
    settingsMap.googleVerification?.trim() || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  );

  const defaultSeo = {
    title: 'GTU Diploma Old Question Papers | DiplomaToppers',
    description:
      settingsMap.siteDescription?.trim() ||
      'Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers.',
    keywords: 'GTU diploma previous year question papers, gtu old paper pdf',
    h1Heading: 'GTU Diploma Old Question Papers',
    h2Headings: [] as string[],
    h3Headings: [] as string[],
    mainIntro:
      'Explore GTU Diploma Engineering branches, semesters, subjects, and Summer/Winter PDF papers on DiplomaToppers.',
    detailedContent: '',
    faqs: [] as SsrFaqItem[],
    ogTitle: 'GTU Diploma Old Question Papers | DiplomaToppers',
    ogDescription:
      settingsMap.siteDescription?.trim() ||
      'Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers.',
    ogImageUrl: '',
    ogType: 'website',
    canonical,
    noindex: cleanPath.startsWith('/admin'),
    robots: cleanPath.startsWith('/admin') ? 'noindex, nofollow' : 'index, follow',
    googleVerification,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'DiplomaToppers',
        url: effectiveOrigin,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'DiplomaToppers',
        url: effectiveOrigin,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${effectiveOrigin}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ] as Array<Record<string, unknown>>,
    ssrCoreLinksHtml: '',
    ssrFallbackHtml: `<h1>DiplomaToppers — GTU Diploma Question Papers</h1><p>Explore GTU Diploma Engineering branches, semesters, subjects, and Summer/Winter PDF papers.</p>`,
  };

  const applySeoOverride = (seoDocId: string, pagePath: string, target: typeof defaultSeo) => {
    const rec = seoById.get(seoDocId) || seoByPath.get(pagePath);
    if (rec) {
      if (typeof rec.seoTitle === 'string' && rec.seoTitle.trim()) {
        target.title = rec.seoTitle.trim();
      }
      if (typeof rec.metaDescription === 'string' && rec.metaDescription.trim()) {
        target.description = rec.metaDescription.trim();
      }
      const focusKw = typeof rec.focusKeyword === 'string' ? rec.focusKeyword.trim() : '';
      const secKw = typeof rec.secondaryKeywords === 'string' ? rec.secondaryKeywords.trim() : '';
      const combinedKw = combineKeywords(focusKw, secKw);
      if (combinedKw) {
        target.keywords = combinedKw;
      }
      if (typeof rec.h1Heading === 'string' && rec.h1Heading.trim()) {
        target.h1Heading = rec.h1Heading.trim();
      }
      const h2Override = normalizeStringList(rec.h2Headings);
      if (h2Override.length > 0) target.h2Headings = h2Override;
      const h3Override = normalizeStringList(rec.h3Headings);
      if (h3Override.length > 0) target.h3Headings = h3Override;
      if (typeof rec.mainIntro === 'string' && rec.mainIntro.trim()) {
        target.mainIntro = rec.mainIntro.trim();
      }
      if (typeof rec.detailedContent === 'string' && rec.detailedContent.trim()) {
        target.detailedContent = rec.detailedContent.trim();
      }
      const faqsOverride = normalizeFaqs(rec.faqs);
      if (faqsOverride.length > 0) target.faqs = faqsOverride;

      if (typeof rec.canonicalUrl === 'string' && rec.canonicalUrl.trim()) {
        target.canonical = rec.canonicalUrl.trim();
      }
      target.ogTitle =
        typeof rec.ogTitle === 'string' && rec.ogTitle.trim() ? rec.ogTitle.trim() : target.title;
      target.ogDescription =
        typeof rec.ogDescription === 'string' && rec.ogDescription.trim()
          ? rec.ogDescription.trim()
          : target.description;
      target.ogImageUrl =
        typeof rec.ogImageUrl === 'string' && rec.ogImageUrl.trim() ? rec.ogImageUrl.trim() : target.ogImageUrl;
      const rIndex = rec.robotsIndex !== false;
      const rFollow = rec.robotsFollow !== false;
      target.noindex = !rIndex;
      target.robots = `${rIndex ? 'index' : 'noindex'}, ${rFollow ? 'follow' : 'nofollow'}`;
    } else {
      target.ogTitle = target.title;
      target.ogDescription = target.description;
    }

    if (
      target.faqs.length > 0 &&
      !target.jsonLd.some((ld) => ld['@type'] === 'FAQPage')
    ) {
      target.jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: target.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    const richBodyHtml = buildSsrRichContentHtml({
      h2Headings: target.h2Headings,
      h3Headings: target.h3Headings,
      detailedContent: target.detailedContent,
      faqs: target.faqs,
    });

    target.ssrFallbackHtml = `<h1>${escapeHtml(target.h1Heading || target.title)}</h1><p>${escapeHtml(target.mainIntro || target.description)}</p>${target.ssrCoreLinksHtml}${richBodyHtml}`;
    return target;
  };

  if (cleanPath === '/' || cleanPath === '') {
    const branchLinks = branches
      .map((b) => `<li><a href="/${escapeHtml(String(b.slug))}">${escapeHtml(String(b.name))} (Code ${escapeHtml(String(b.code))})</a></li>`)
      .join('');
    defaultSeo.h1Heading = 'GTU Diploma Old Question Papers';
    defaultSeo.h2Headings = [
      'How to Prepare Effectively with GTU Previous Year Question Papers',
      'Branch-Wise Semester 1 to Semester 6 Study Archive',
    ];
    defaultSeo.detailedContent =
      'DiplomaToppers organizes verified Gujarat Technological University (GTU) Diploma Engineering previous year Summer and Winter question papers cleanly by branch, semester (Semesters 1 to 6), and subject code.';
    defaultSeo.faqs = [
      {
        question: 'How can I download GTU Diploma previous year question papers on DiplomaToppers?',
        answer:
          'Select your engineering branch from the directory above, choose your semester (1 to 6), open your subject code page, and click View Paper or Download PDF.',
      },
    ];
    defaultSeo.ssrCoreLinksHtml = `<ul>${branchLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs })}`;
    return applySeoOverride('seo-home-home', '/', defaultSeo);
  }

  const staticTitles: Record<string, { id: string; title: string; h1: string; desc: string }> = {
    '/about': {
      id: 'about',
      title: 'About Us | DiplomaToppers — GTU Diploma Question Papers',
      h1: 'About DiplomaToppers',
      desc: 'Learn how DiplomaToppers helps GTU Diploma Engineering students access verified previous examination question papers.',
    },
    '/contact': {
      id: 'contact',
      title: 'Contact Us | DiplomaToppers Paper Requests & Support',
      h1: 'Contact DiplomaToppers',
      desc: 'Contact DiplomaToppers for paper requests, academic corrections, or support.',
    },
    '/privacy-policy': {
      id: 'privacy-policy',
      title: 'Privacy Policy | DiplomaToppers',
      h1: 'Privacy Policy',
      desc: 'Read the DiplomaToppers privacy policy and data protection practices.',
    },
    '/terms-and-conditions': {
      id: 'terms-and-conditions',
      title: 'Terms and Conditions | DiplomaToppers',
      h1: 'Terms and Conditions',
      desc: 'Review the terms and conditions for using GTU Diploma question papers on DiplomaToppers.',
    },
    '/disclaimer': {
      id: 'disclaimer',
      title: 'Academic Disclaimer | DiplomaToppers',
      h1: 'Academic Disclaimer',
      desc: 'Academic disclaimer for DiplomaToppers GTU Diploma Engineering resources.',
    },
  };

  if (staticTitles[cleanPath]) {
    defaultSeo.title = staticTitles[cleanPath].title;
    defaultSeo.h1Heading = staticTitles[cleanPath].h1;
    defaultSeo.description = staticTitles[cleanPath].desc;
    defaultSeo.mainIntro = staticTitles[cleanPath].desc;
    defaultSeo.ssrCoreLinksHtml = buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs });
    return applySeoOverride(`seo-static-${staticTitles[cleanPath].id}`, cleanPath, defaultSeo);
  }

  if (cleanPath.startsWith('/admin')) {
    defaultSeo.title = 'Admin Portal | DiplomaToppers';
    defaultSeo.description = 'Administrator authentication and academic content management for DiplomaToppers.';
    defaultSeo.keywords = '';
    defaultSeo.ogTitle = defaultSeo.title;
    defaultSeo.ogDescription = defaultSeo.description;
    defaultSeo.noindex = true;
    defaultSeo.robots = 'noindex, nofollow';
    defaultSeo.ssrFallbackHtml = '<h1>Admin Portal | DiplomaToppers</h1>';
    return defaultSeo;
  }

  if (cleanPath === '/blog') {
    defaultSeo.title = 'GTU Diploma Study Guides & Exam Preparation Blog | DiplomaToppers';
    defaultSeo.description =
      'Read practical GTU Diploma Engineering study guides, previous paper preparation strategies, subject analysis, and semester tips on DiplomaToppers.';
    defaultSeo.keywords = 'GTU diploma exam preparation guide, gtu diploma study tips, gtu previous year paper strategy';
    defaultSeo.h1Heading = 'GTU Diploma Study Guides & Exam Preparation Blog';
    defaultSeo.mainIntro =
      'Explore practical GTU Diploma Engineering study guides, exam strategy notes, and subject preparation articles linked directly to question paper archives.';
    defaultSeo.jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${effectiveOrigin}/` },
        { '@type': 'ListItem', position: 2, name: 'Study Blog', item: `${effectiveOrigin}/blog` },
      ],
    });
    const blogLinks = blogs
      .map(
        (post) =>
          `<li><a href="/blog/${escapeHtml(String(post.slug))}">${escapeHtml(String(post.title))}</a> — ${escapeHtml(String(post.excerpt || ''))}</li>`
      )
      .join('');
    defaultSeo.ssrCoreLinksHtml = `<ul>${blogLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs })}`;
    return applySeoOverride('seo-blog-index', '/blog', defaultSeo);
  }

  const segments = cleanPath.split('/').filter(Boolean);

  if (segments[0] === 'blog' && segments.length === 2) {
    const blogSlug = segments[1];
    const post = blogs.find((p) => p.slug === blogSlug);
    if (!post) {
      defaultSeo.noindex = true;
      defaultSeo.robots = 'noindex, nofollow';
      return defaultSeo;
    }

    defaultSeo.ogType = 'article';
    defaultSeo.title = `${String(post.title)} | DiplomaToppers`;
    defaultSeo.description = String(post.excerpt || defaultSeo.description).slice(0, 160);
    defaultSeo.keywords = `${String(post.title).toLowerCase()}, ${String(post.category || 'gtu study guide').toLowerCase()}, gtu diploma previous year question papers`;
    defaultSeo.h1Heading = String(post.title);
    defaultSeo.mainIntro = String(post.excerpt || '');
    defaultSeo.detailedContent = String(post.content || '');
    defaultSeo.ogImageUrl = typeof post.coverImageUrl === 'string' ? post.coverImageUrl : '';
    defaultSeo.jsonLd.push(
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${effectiveOrigin}/` },
          { '@type': 'ListItem', position: 2, name: 'Study Blog', item: `${effectiveOrigin}/blog` },
          { '@type': 'ListItem', position: 3, name: String(post.title), item: canonical },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: String(post.title),
        description: defaultSeo.description,
        datePublished: String(post.publishedAt || post.createdAt || ''),
        dateModified: String(post.updatedAt || post.publishedAt || ''),
        author: { '@type': 'Person', name: String(post.authorName || 'DiplomaToppers Editorial') },
        publisher: { '@type': 'Organization', name: 'DiplomaToppers' },
        mainEntityOfPage: canonical,
        ...(defaultSeo.ogImageUrl ? { image: defaultSeo.ogImageUrl } : {}),
      }
    );

    const relatedBranch = post.relatedBranchSlug
      ? branches.find((b) => b.slug === post.relatedBranchSlug)
      : undefined;
    const branchCta = relatedBranch
      ? `<p><a href="/${escapeHtml(String(relatedBranch.slug))}">Browse ${escapeHtml(String(relatedBranch.name))} Question Papers</a></p>`
      : '';

    defaultSeo.ssrCoreLinksHtml = `${branchCta}${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs, currentBranch: relatedBranch })}`;
    return applySeoOverride(`seo-blog-${String(post.id)}`, cleanPath, defaultSeo);
  }

  const branchSlug = segments[0];
  const branch = branches.find((b) => b.slug === branchSlug);
  if (!branch) {
    defaultSeo.noindex = true;
    defaultSeo.robots = 'noindex, nofollow';
    return defaultSeo;
  }

  const breadcrumbs: Array<{ name: string; item: string }> = [
    { name: 'Home', item: `${effectiveOrigin}/` },
    { name: String(branch.name), item: `${effectiveOrigin}/${branch.slug}` },
  ];

  if (segments.length === 1) {
    defaultSeo.title = `GTU ${branch.name} Previous Year Question Papers (Code ${branch.code}) | DiplomaToppers`;
    defaultSeo.description =
      String(branch.description || '') ||
      `Download GTU ${branch.name} (Branch Code ${branch.code}) Semester 1 to 6 previous year Summer and Winter question papers PDF on DiplomaToppers.`;
    defaultSeo.keywords = `GTU ${branch.name} previous year question papers, gtu branch ${branch.code} question papers`;
    defaultSeo.h1Heading = `${branch.name} GTU Question Papers`;
    defaultSeo.mainIntro = defaultSeo.description;
    defaultSeo.detailedContent = `${branch.name} (GTU Branch Code ${branch.code}) students can select their semester below to access subject-wise Summer and Winter examination question papers.`;
    defaultSeo.jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.item,
      })),
    });
    const branchSemLinks = semesters
      .filter((s) => s.branchId === branch.id)
      .sort((a, b) => Number(a.semesterNumber) - Number(b.semesterNumber))
      .map(
        (s) =>
          `<li><a href="/${escapeHtml(String(branch.slug))}/semester-${Number(s.semesterNumber)}">${escapeHtml(String(s.name))}</a></li>`
      )
      .join('');
    defaultSeo.ssrCoreLinksHtml = `<ul>${branchSemLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs, currentBranch: branch })}`;
    return applySeoOverride(`seo-branch-${String(branch.id)}`, cleanPath, defaultSeo);
  }

  const semMatch = segments[1].match(/^semester-(\d+)$/);
  const semNum = semMatch ? Number(semMatch[1]) : 0;
  const semester = semesters.find((s) => s.branchId === branch.id && s.semesterNumber === semNum);
  if (!semester) {
    defaultSeo.noindex = true;
    defaultSeo.robots = 'noindex, nofollow';
    return defaultSeo;
  }

  breadcrumbs.push({
    name: String(semester.name),
    item: `${effectiveOrigin}/${branch.slug}/semester-${semNum}`,
  });

  if (segments.length === 2) {
    const shortBranch = String(branch.name).replace(/^Diploma\s+/i, '');
    defaultSeo.title = `GTU Diploma Sem ${semNum} ${shortBranch} Previous Year Question Papers | DiplomaToppers`;
    defaultSeo.description = `Browse and download GTU ${branch.name} Semester ${semNum} subject-wise Summer and Winter diploma old question papers.`;
    defaultSeo.keywords = `GTU Diploma Sem ${semNum} ${shortBranch} previous year question papers, gtu diploma previous year question papers`;
    defaultSeo.h1Heading = `${branch.name} Semester ${semNum} Question Papers`;
    defaultSeo.mainIntro = defaultSeo.description;
    defaultSeo.jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.item,
      })),
    });
    const semSubjects = subjects.filter((s) => s.branchId === branch.id && s.semesterId === semester.id);
    const subjLinks = semSubjects
      .map(
        (s) =>
          `<li><a href="/${escapeHtml(String(branch.slug))}/semester-${semNum}/${escapeHtml(String(s.slug))}">${escapeHtml(String(s.name))} (${escapeHtml(String(s.code))})</a></li>`
      )
      .join('');
    defaultSeo.ssrCoreLinksHtml = `<ul>${subjLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs, currentBranch: branch, currentSemester: semester })}`;
    return applySeoOverride(`seo-semester-${String(semester.id)}`, cleanPath, defaultSeo);
  }

  const subjectSlug = segments[2];
  const subject = subjects.find(
    (s) => s.branchId === branch.id && s.semesterId === semester.id && s.slug === subjectSlug
  );
  if (!subject) {
    defaultSeo.noindex = true;
    defaultSeo.robots = 'noindex, nofollow';
    return defaultSeo;
  }

  breadcrumbs.push({
    name: String(subject.name),
    item: `${effectiveOrigin}/${branch.slug}/semester-${semNum}/${subject.slug}`,
  });

  if (segments.length === 3) {
    const shortBranch = String(branch.name).replace(/^Diploma\s+/i, '');
    defaultSeo.title = `GTU Diploma Sem ${semNum} ${shortBranch} ${subject.name} (${subject.code}) Previous Year Question Papers`;
    defaultSeo.description =
      String(subject.description || '') ||
      `Download GTU ${subject.name} (${subject.code}) Summer and Winter diploma old question papers PDF for ${branch.name} Semester ${semNum}.`;
    defaultSeo.keywords = `GTU diploma sem ${semNum} ${shortBranch} ${subject.name} previous year question papers, gtu diploma previous year question papers, ${subject.code} question paper pdf`;
    defaultSeo.h1Heading = `${subject.name} (${subject.code}) — GTU Question Papers`;
    defaultSeo.mainIntro = defaultSeo.description;
    defaultSeo.detailedContent = `Explore previous year Summer and Winter question papers for ${subject.name} (${subject.code}) in ${branch.name} Semester ${semNum}.`;
    defaultSeo.jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.item,
      })),
    });
    const subjectPaperLinks = papers
      .filter((p) => p.subjectId === subject.id)
      .map(
        (p) =>
          `<li><a href="/${escapeHtml(String(branch.slug))}/semester-${semNum}/${escapeHtml(String(subject.slug))}/${escapeHtml(String(p.slug))}">${escapeHtml(String(p.title))}</a></li>`
      )
      .join('');
    defaultSeo.ssrCoreLinksHtml = `<ul>${subjectPaperLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs, currentBranch: branch, currentSemester: semester, currentSubject: subject })}`;
    return applySeoOverride(`seo-subject-${String(subject.id)}`, cleanPath, defaultSeo);
  }

  const paperSlug = segments[3];
  const paper = papers.find((p) => p.subjectId === subject.id && p.slug === paperSlug);
  if (!paper) {
    defaultSeo.noindex = true;
    defaultSeo.robots = 'noindex, nofollow';
    return defaultSeo;
  }

  breadcrumbs.push({
    name: `${paper.examSession} ${paper.examYear}`,
    item: `${effectiveOrigin}/${branch.slug}/semester-${semNum}/${subject.slug}/${paper.slug}`,
  });

  defaultSeo.title = `GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} Question Paper PDF | DiplomaToppers`;
  defaultSeo.description = `Download the GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} question paper PDF for ${branch.name} Semester ${semNum}.`;
  defaultSeo.keywords = `GTU ${subject.name} ${paper.examSession} ${paper.examYear} question paper PDF, ${subject.code} question paper, gtu diploma previous year question papers`;
  defaultSeo.h1Heading = `${subject.name} (${subject.code}) — GTU ${paper.examSession} ${paper.examYear} Question Paper`;
  defaultSeo.mainIntro = defaultSeo.description;
  defaultSeo.jsonLd.push(
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.item,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DigitalDocument',
      name: String(paper.title),
      encodingFormat: 'application/pdf',
      url: canonical,
      datePublished: String(paper.createdAt || ''),
    }
  );
  defaultSeo.ssrCoreLinksHtml = `<p><a href="/${escapeHtml(String(branch.slug))}/semester-${semNum}/${escapeHtml(String(subject.slug))}">All ${escapeHtml(String(subject.name))} Papers</a></p>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, blogs, currentBranch: branch, currentSemester: semester, currentSubject: subject, currentPaper: paper })}`;
  return applySeoOverride(`seo-paper-${String(paper.id)}`, cleanPath, defaultSeo);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  // ---- API Routes ----

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ---- Basic Password Admin Auth Endpoints ----
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { password } = (req.body || {}) as { password?: unknown };
    if (typeof password !== 'string' || !password) {
      res.status(401).json({ error: 'Incorrect password. Please try again.' });
      return;
    }

    const inputHash = crypto.createHash('sha256').update(password, 'utf8').digest();
    const expectedHash = crypto.createHash('sha256').update(ADMIN_PASSWORD, 'utf8').digest();

    if (!crypto.timingSafeEqual(inputHash, expectedHash)) {
      res.status(401).json({ error: 'Incorrect password. Please try again.' });
      return;
    }

    const token = createAdminSessionToken();
    res.setHeader(
      'Set-Cookie',
      `dt_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );
    res.json({ ok: true, token });
  });

  app.get('/api/admin/session', (req: Request, res: Response) => {
    const token = extractAdminToken(req);
    res.json({ authenticated: verifyAdminSessionToken(token) });
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    res.setHeader(
      'Set-Cookie',
      'dt_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );
    res.json({ ok: true });
  });

  app.get('/api/stats/downloads', async (_req, res) => {
    const localStats = readDownloadStats();
    const docs = await firestoreListCollection('paper_stats');
    const merged: Record<string, number> = { ...localStats };
    for (const d of docs) {
      const id = String(d.id || '');
      const cnt = Number(d.downloadCount || 0);
      if (id && cnt > 0) {
        merged[id] = Math.max(merged[id] || 0, cnt);
      }
    }
    res.json({ counts: merged });
  });

  // Protected Admin PDF Upload
  app.post('/api/admin/upload-pdf', requireAdmin, uploadPdfMulter.single('file'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No PDF file provided.' });
      return;
    }

    const isPdfMagic = file.buffer.length >= 5 && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (file.mimetype !== 'application/pdf' && !isPdfMagic) {
      res.status(400).json({ error: 'Invalid file format. Only authentic PDF files are allowed.' });
      return;
    }
    if (!isPdfMagic) {
      res.status(400).json({ error: 'File content is not a valid PDF document (%PDF- header missing).' });
      return;
    }

    const safeName = `${Date.now()}-${crypto.randomUUID()}.pdf`;
    const destPath = path.join(PAPERS_DIR, safeName);
    fs.writeFileSync(destPath, file.buffer);

    res.json({
      pdfStoragePath: `/api/files/papers/${safeName}`,
      originalFilename: file.originalname || 'question-paper.pdf',
      fileSize: file.size,
    });
  });

  // Protected Admin Banner Upload
  app.post('/api/admin/upload-banner', requireAdmin, uploadBannerMulter.single('file'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No banner image file provided.' });
      return;
    }

    const allowed: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = allowed[file.mimetype];
    if (!ext) {
      res.status(400).json({ error: 'Invalid image type. Please upload PNG, JPG, WEBP, or GIF.' });
      return;
    }

    const safeName = `banner-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const destPath = path.join(BANNERS_DIR, safeName);
    fs.writeFileSync(destPath, file.buffer);

    res.json({
      imageStoragePath: `/api/files/banners/${safeName}`,
      originalFilename: file.originalname || safeName,
      fileSize: file.size,
    });
  });

  // Protected File Cleanup
  app.delete('/api/admin/files', requireAdmin, (req: Request, res: Response) => {
    const { filePath } = (req.body || {}) as { filePath?: string };
    if (!filePath || typeof filePath !== 'string') {
      res.status(400).json({ error: 'filePath is required.' });
      return;
    }

    const prefixPaper = '/api/files/papers/';
    const prefixBanner = '/api/files/banners/';
    let resolved: string | null = null;
    if (filePath.startsWith(prefixPaper)) {
      const filename = path.basename(filePath.slice(prefixPaper.length));
      resolved = path.join(PAPERS_DIR, filename);
    } else if (filePath.startsWith(prefixBanner)) {
      const filename = path.basename(filePath.slice(prefixBanner.length));
      resolved = path.join(BANNERS_DIR, filename);
    }

    if (!resolved) {
      res.status(400).json({ error: 'Invalid storage path.' });
      return;
    }

    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    res.json({ deleted: true });
  });

  // Public Uploaded Banner Asset Serving
  app.get('/api/files/banners/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(BANNERS_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Banner image not found.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(fullPath);
  });

  // Public Uploaded PDF Direct Serving (for inline reference if needed)
  app.get('/api/files/papers/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(PAPERS_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('PDF file not found.');
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.sendFile(fullPath);
  });

  // Public Cloud PDF/Asset Direct Serving (Firestore chunked storage)
  app.get('/api/pdf-files/:fileId', async (req, res) => {
    const fileId = String(req.params.fileId || '').trim();
    if (!fileId) {
      res.status(400).json({ error: 'Invalid file ID.' });
      return;
    }
    const file = await fetchCloudFileFromFirestore(fileId);
    if (!file) {
      res.status(404).send('File not found in cloud storage.');
      return;
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.buffer.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${file.originalFilename}"`);
    res.send(file.buffer);
  });

  // View Paper (opens inline in new tab, does NOT increment download count)
  app.get('/api/papers/:paperId/view', async (req, res) => {
    const { paperId } = req.params;
    const isAdminSession = verifyAdminSessionToken(extractAdminToken(req));

    const paper = await firestoreGetDocument('papers', paperId);
    if (!paper) {
      res.status(404).send('<h1>Paper Not Found</h1><p>The requested question paper record does not exist.</p>');
      return;
    }
    if (paper.isActive !== true && !isAdminSession) {
      res.status(403).send('<h1>Paper Unavailable</h1><p>This question paper is currently inactive.</p>');
      return;
    }

    const storagePath = String(paper.pdfStoragePath || '');
    if (storagePath.startsWith('/api/pdf-files/')) {
      const fileId = storagePath.slice('/api/pdf-files/'.length).trim();
      const cloudFile = await fetchCloudFileFromFirestore(fileId);
      if (!cloudFile) {
        res.status(404).send('<h1>PDF Missing</h1><p>The uploaded PDF could not be located in cloud storage.</p>');
        return;
      }
      const cleanOrig = String(paper.originalFilename || cloudFile.originalFilename || 'GTU-Question-Paper.pdf').replace(/"/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(cloudFile.buffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `inline; filename="${cleanOrig}"`);
      res.send(cloudFile.buffer);
      return;
    }

    if (storagePath.startsWith('/api/files/papers/')) {
      const filename = path.basename(storagePath.slice('/api/files/papers/'.length));
      const fullPath = path.join(PAPERS_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        res.status(404).send('<h1>PDF Missing</h1><p>The uploaded PDF file could not be located on the server.</p>');
        return;
      }
      const cleanOrig = String(paper.originalFilename || 'GTU-Question-Paper.pdf').replace(/"/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${cleanOrig}"`);
      res.sendFile(fullPath);
      return;
    }

    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      res.redirect(storagePath);
      return;
    }

    res.status(404).send('<h1>PDF Missing</h1><p>No valid PDF file is attached to this paper.</p>');
  });

  // Download Paper (triggers meaningful filename download AND increments download count)
  app.get('/api/papers/:paperId/download', async (req, res) => {
    const { paperId } = req.params;
    const paper = await firestoreGetDocument('papers', paperId);
    if (!paper || paper.isActive !== true) {
      res.status(404).json({ error: 'Question paper not found or inactive.' });
      return;
    }

    const subject = paper.subjectId
      ? await firestoreGetDocument('subjects', String(paper.subjectId))
      : null;

    const code = String(subject?.code || 'GTU').replace(/[^a-zA-Z0-9-]/g, '');
    const session = String(paper.examSession || 'Exam').replace(/[^a-zA-Z]/g, '');
    const year = String(paper.examYear || '');
    const downloadName = `GTU-${code}-${session}-${year}.pdf`;

    const storagePath = String(paper.pdfStoragePath || '');
    if (storagePath.startsWith('/api/pdf-files/')) {
      const fileId = storagePath.slice('/api/pdf-files/'.length).trim();
      const cloudFile = await fetchCloudFileFromFirestore(fileId);
      if (!cloudFile) {
        res.status(404).json({ error: 'PDF file is missing from cloud storage. Please contact an administrator.' });
        return;
      }
      incrementDownloadStat(paperId);
      void incrementDownloadStatFirestore(paperId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(cloudFile.buffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.send(cloudFile.buffer);
      return;
    }

    if (storagePath.startsWith('/api/files/papers/')) {
      const filename = path.basename(storagePath.slice('/api/files/papers/'.length));
      const fullPath = path.join(PAPERS_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'PDF file is missing from storage. Please contact an administrator.' });
        return;
      }
      incrementDownloadStat(paperId);
      void incrementDownloadStatFirestore(paperId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.sendFile(fullPath);
      return;
    }

    res.status(404).json({ error: 'No downloadable PDF file is attached to this paper.' });
  });

  // Gemini 4 Hydrogen + Google Search Grounding for live GTU syllabus & circulars
  app.post('/api/gemini/gtu-insights', async (req, res) => {
    try {
      const { query, branchName, semesterNumber, subjectName, subjectCode } = (req.body || {}) as {
        query?: string;
        branchName?: string;
        semesterNumber?: number;
        subjectName?: string;
        subjectCode?: string;
      };

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'Search grounding service is temporarily unavailable because GEMINI_API_KEY is not configured.',
        });
        return;
      }

      const contextParts = [
        subjectName ? `Subject: ${subjectName}` : '',
        subjectCode ? `Subject Code: ${subjectCode}` : '',
        branchName ? `Branch: ${branchName}` : '',
        semesterNumber ? `Semester: ${semesterNumber}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      const prompt = query?.trim()
        ? `Answer this Gujarat Technological University (GTU) Diploma Engineering student query accurately using live web search: "${query.trim()}". ${contextParts ? `Academic context: ${contextParts}.` : ''} Focus on official GTU syllabus units, exam marking schemes, recent circulars, or preparation tips.`
        : `Provide an accurate, structured GTU Diploma Engineering exam and syllabus guide for ${contextParts}. Include key syllabus modules/units, GTU question paper pattern (marks weightage), and important exam preparation focus areas based on official GTU curriculum resources.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction:
            'You are an academic research assistant for Gujarat Technological University (GTU) Diploma Engineering students. Provide concise, accurate, structured syllabus summaries, exam patterns, and verified updates grounded in official GTU resources. Do not invent subject codes or circulars.',
        },
      });

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seen = new Set<string>();
      const sources: Array<{ uri: string; title: string }> = [];
      for (const chunk of rawChunks) {
        const web = (chunk as { web?: { uri?: string; title?: string } }).web;
        if (web?.uri && !seen.has(web.uri)) {
          seen.add(web.uri);
          sources.push({
            uri: web.uri,
            title: web.title || web.uri,
          });
        }
      }

      res.json({
        summary: response.text || 'No grounded GTU details found for this query.',
        sources,
      });
    } catch (error) {
      console.error('Gemini Search Grounding error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch live GTU search results.',
      });
    }
  });

  // ---- Technical SEO Endpoints ----

  app.post('/api/seo-health-check', async (req, res) => {
    try {
      const { targetUrl } = (req.body || {}) as { targetUrl?: string };
      const report = await runProductionSeoHealthCheck(targetUrl || '');
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'SEO health check failed unexpectedly.',
      });
    }
  });

  app.get('/robots.txt', async (req, res) => {
    const origin = getCanonicalOrigin(req);
    const settingsList = await firestoreListCollection('website_settings');
    const siteUrlSetting = settingsList.find((s) => s.settingKey === 'siteUrl')?.settingValue;
    const base =
      normalizeHttpOrigin(typeof siteUrlSetting === 'string' ? siteUrlSetting : undefined) || origin;
    const content = [
      'User-Agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/admin/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  });

  app.get('/sitemap.xml', async (req, res) => {
    const origin = getCanonicalOrigin(req);
    const [branches, semesters, subjects, papers, blogs, settingsList, seoList] = await Promise.all([
      firestoreRunActiveQuery('branches'),
      firestoreRunActiveQuery('semesters'),
      firestoreRunActiveQuery('subjects'),
      firestoreRunActiveQuery('papers'),
      firestoreRunActiveQuery('blog_posts'),
      firestoreListCollection('website_settings'),
      firestoreListCollection('seo_metadata'),
    ]);

    const siteUrlSetting = settingsList.find((s) => s.settingKey === 'siteUrl')?.settingValue;
    const base =
      normalizeHttpOrigin(typeof siteUrlSetting === 'string' ? siteUrlSetting : undefined) || origin;

    const seoById = new Map(seoList.map((s) => [String(s.id), s]));
    const today = new Date().toISOString().split('T')[0];

    const isIndexable = (seoId: string): boolean => {
      const rec = seoById.get(seoId);
      return !(rec && rec.robotsIndex === false);
    };

    const pickLastMod = (seoId: string, entityUpdated?: unknown): string => {
      const rec = seoById.get(seoId);
      const candidates = [rec?.updatedAt, entityUpdated]
        .map((v) => (typeof v === 'string' && v ? v.split('T')[0] : ''))
        .filter(Boolean)
        .sort();
      return candidates.length > 0 ? candidates[candidates.length - 1] : today;
    };

    const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [];

    if (isIndexable('seo-home-home')) {
      urls.push({
        loc: `${base}/`,
        lastmod: pickLastMod('seo-home-home'),
        changefreq: 'daily',
        priority: '1.0',
      });
    }

    if (isIndexable('seo-blog-index')) {
      urls.push({
        loc: `${base}/blog`,
        lastmod: pickLastMod('seo-blog-index'),
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    const staticEntries = [
      { id: 'about', path: '/about', freq: 'monthly', prio: '0.5' },
      { id: 'contact', path: '/contact', freq: 'monthly', prio: '0.5' },
      { id: 'privacy-policy', path: '/privacy-policy', freq: 'yearly', prio: '0.3' },
      { id: 'terms-and-conditions', path: '/terms-and-conditions', freq: 'yearly', prio: '0.3' },
      { id: 'disclaimer', path: '/disclaimer', freq: 'yearly', prio: '0.3' },
    ];
    for (const st of staticEntries) {
      const seoId = `seo-static-${st.id}`;
      if (isIndexable(seoId)) {
        urls.push({
          loc: `${base}${st.path}`,
          lastmod: pickLastMod(seoId),
          changefreq: st.freq,
          priority: st.prio,
        });
      }
    }

    const branchById = new Map(branches.map((b) => [String(b.id), b]));
    const semById = new Map(semesters.map((s) => [String(s.id), s]));
    const subjById = new Map(subjects.map((s) => [String(s.id), s]));

    for (const b of branches) {
      const seoId = `seo-branch-${String(b.id)}`;
      if (!isIndexable(seoId)) continue;
      urls.push({
        loc: `${base}/${b.slug}`,
        lastmod: pickLastMod(seoId, b.updatedAt),
        changefreq: 'weekly',
        priority: '0.9',
      });
    }

    for (const sem of semesters) {
      const b = branchById.get(String(sem.branchId));
      const seoId = `seo-semester-${String(sem.id)}`;
      if (!b || !isIndexable(seoId)) continue;
      urls.push({
        loc: `${base}/${b.slug}/semester-${sem.semesterNumber}`,
        lastmod: pickLastMod(seoId, sem.updatedAt),
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    for (const subj of subjects) {
      const b = branchById.get(String(subj.branchId));
      const sem = semById.get(String(subj.semesterId));
      const seoId = `seo-subject-${String(subj.id)}`;
      if (!b || !sem || !isIndexable(seoId)) continue;
      urls.push({
        loc: `${base}/${b.slug}/semester-${sem.semesterNumber}/${subj.slug}`,
        lastmod: pickLastMod(seoId, subj.updatedAt),
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    for (const pap of papers) {
      const subj = subjById.get(String(pap.subjectId));
      const b = branchById.get(String(pap.branchId));
      const sem = semById.get(String(pap.semesterId));
      const seoId = `seo-paper-${String(pap.id)}`;
      if (!subj || !b || !sem || !isIndexable(seoId)) continue;
      urls.push({
        loc: `${base}/${b.slug}/semester-${sem.semesterNumber}/${subj.slug}/${pap.slug}`,
        lastmod: pickLastMod(seoId, pap.updatedAt),
        changefreq: 'monthly',
        priority: '0.7',
      });
    }

    for (const post of blogs) {
      const seoId = `seo-blog-${String(post.id)}`;
      if (!post.slug || !isIndexable(seoId)) continue;
      urls.push({
        loc: `${base}/blog/${post.slug}`,
        lastmod: pickLastMod(seoId, post.updatedAt || post.publishedAt),
        changefreq: 'monthly',
        priority: '0.7',
      });
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (u) =>
          `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      ),
      '</urlset>',
    ].join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  });

  // ---- Vite Dev or Production Static Serving with Dynamic SSR SEO Metadata ----
  let vite: Awaited<ReturnType<typeof import('vite')['createServer']>> | null = null;
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
  }

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    try {
      const templatePath = IS_PROD
        ? path.resolve(process.cwd(), 'dist', 'index.html')
        : path.resolve(process.cwd(), 'index.html');
      let html = fs.readFileSync(templatePath, 'utf8');

      if (vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }

      const origin = getCanonicalOrigin(req);
      const seo = await resolveRouteSeo(req.path, origin);

      const hasExistingGoogleVerif = /<meta\s+name=["']google-site-verification["']/i.test(html);
      const metaInject = [
        `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
        seo.keywords ? `<meta name="keywords" content="${escapeHtml(seo.keywords)}" />` : '',
        `<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`,
        seo.ogImageUrl ? `<meta property="og:image" content="${escapeHtml(seo.ogImageUrl)}" />` : '',
        seo.ogImageUrl ? `<meta name="twitter:image" content="${escapeHtml(seo.ogImageUrl)}" />` : '',
        `<meta name="robots" content="${escapeHtml(seo.robots)}" />`,
        seo.googleVerification && !hasExistingGoogleVerif
          ? `<meta name="google-site-verification" content="${escapeHtml(seo.googleVerification)}" />`
          : '',
        ...seo.jsonLd.map(
          (ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`
        ),
      ]
        .filter(Boolean)
        .join('\n    ');

      html = html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
        .replace(
          /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
          `<meta name="description" content="${escapeHtml(seo.description)}" />`
        )
        .replace(
          /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
          `<meta property="og:title" content="${escapeHtml(seo.ogTitle)}" />`
        )
        .replace(
          /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
          `<meta property="og:description" content="${escapeHtml(seo.ogDescription)}" />`
        )
        .replace(
          /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/,
          `<meta property="og:type" content="${escapeHtml(seo.ogType)}" />`
        )
        .replace(
          /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
          `<meta name="twitter:title" content="${escapeHtml(seo.ogTitle)}" />`
        )
        .replace(
          /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
          `<meta name="twitter:description" content="${escapeHtml(seo.ogDescription)}" />`
        )
        .replace('<!-- SEO_META_INJECT -->', metaInject)
        .replace('<!-- SSR_SEO_FALLBACK -->', `<noscript><main>${seo.ssrFallbackHtml}</main></noscript>`);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (err) {
      if (vite && err instanceof Error) {
        vite.ssrFixStacktrace(err);
      }
      next(err);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DiplomaToppers server listening on http://0.0.0.0:${PORT}`);
    void syncLocalDiskPdfsToCloudStorage();
  });
}

void startServer();
