import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';

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
}

function decodeFirestoreFields(fields?: Record<string, FirestoreValue>): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) out[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) out[k] = v.timestampValue;
  }
  return out;
}

async function firestoreGetDocument(
  collectionName: string,
  docId: string,
  bearerToken?: string
): Promise<Record<string, unknown> | null> {
  try {
    const url = `${FIRESTORE_REST_BASE}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
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

  const [branches, semesters, subjects, papers, settingsList, seoList] = await Promise.all([
    firestoreRunActiveQuery('branches'),
    firestoreRunActiveQuery('semesters'),
    firestoreRunActiveQuery('subjects'),
    firestoreRunActiveQuery('papers'),
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
    ogTitle: 'GTU Diploma Old Question Papers | DiplomaToppers',
    ogDescription:
      settingsMap.siteDescription?.trim() ||
      'Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers.',
    ogImageUrl: '',
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
    ssrFallbackHtml: `<h1>DiplomaToppers — GTU Diploma Question Papers</h1><p>Explore GTU Diploma Engineering branches, semesters, subjects, and Summer/Winter PDF papers.</p>`,
  };

  const applySeoOverride = (seoDocId: string, pagePath: string, target: typeof defaultSeo) => {
    const rec = seoById.get(seoDocId) || seoByPath.get(pagePath);
    if (!rec) {
      target.ogTitle = target.title;
      target.ogDescription = target.description;
      return target;
    }
    if (typeof rec.seoTitle === 'string' && rec.seoTitle.trim()) {
      target.title = rec.seoTitle.trim();
    }
    if (typeof rec.metaDescription === 'string' && rec.metaDescription.trim()) {
      target.description = rec.metaDescription.trim();
    }
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
      typeof rec.ogImageUrl === 'string' && rec.ogImageUrl.trim() ? rec.ogImageUrl.trim() : '';
    const rIndex = rec.robotsIndex !== false;
    const rFollow = rec.robotsFollow !== false;
    target.noindex = !rIndex;
    target.robots = `${rIndex ? 'index' : 'noindex'}, ${rFollow ? 'follow' : 'nofollow'}`;
    return target;
  };

  if (cleanPath === '/' || cleanPath === '') {
    const branchLinks = branches
      .map((b) => `<li><a href="/${escapeHtml(String(b.slug))}">${escapeHtml(String(b.name))} (Code ${escapeHtml(String(b.code))})</a></li>`)
      .join('');
    defaultSeo.ssrFallbackHtml = `<h1>Select Your Engineering Branch | DiplomaToppers</h1><ul>${branchLinks}</ul>`;
    return applySeoOverride('seo-home-home', '/', defaultSeo);
  }

  const staticTitles: Record<string, { id: string; title: string; desc: string }> = {
    '/about': {
      id: 'about',
      title: 'About Us | DiplomaToppers',
      desc: 'Learn how DiplomaToppers helps GTU Diploma Engineering students access verified previous examination question papers.',
    },
    '/contact': {
      id: 'contact',
      title: 'Contact Us | DiplomaToppers',
      desc: 'Contact DiplomaToppers for paper requests, academic corrections, or support.',
    },
    '/privacy-policy': {
      id: 'privacy-policy',
      title: 'Privacy Policy | DiplomaToppers',
      desc: 'Read the DiplomaToppers privacy policy and data protection practices.',
    },
    '/terms-and-conditions': {
      id: 'terms-and-conditions',
      title: 'Terms and Conditions | DiplomaToppers',
      desc: 'Review the terms and conditions for using GTU Diploma question papers on DiplomaToppers.',
    },
    '/disclaimer': {
      id: 'disclaimer',
      title: 'Academic Disclaimer | DiplomaToppers',
      desc: 'Academic disclaimer for DiplomaToppers GTU Diploma Engineering resources.',
    },
  };

  if (staticTitles[cleanPath]) {
    defaultSeo.title = staticTitles[cleanPath].title;
    defaultSeo.description = staticTitles[cleanPath].desc;
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(staticTitles[cleanPath].title)}</h1><p>${escapeHtml(staticTitles[cleanPath].desc)}</p>`;
    return applySeoOverride(`seo-static-${staticTitles[cleanPath].id}`, cleanPath, defaultSeo);
  }

  if (cleanPath.startsWith('/admin')) {
    defaultSeo.title = 'Admin Portal | DiplomaToppers';
    defaultSeo.description = 'Administrator authentication and academic content management for DiplomaToppers.';
    defaultSeo.ogTitle = defaultSeo.title;
    defaultSeo.ogDescription = defaultSeo.description;
    defaultSeo.noindex = true;
    defaultSeo.robots = 'noindex, nofollow';
    return defaultSeo;
  }

  const segments = cleanPath.split('/').filter(Boolean);
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
    defaultSeo.title = `GTU ${branch.name} Old Papers | DiplomaToppers`;
    defaultSeo.description =
      String(branch.description || '') ||
      `Download GTU ${branch.name} (Code ${branch.code}) Semester 1 to 6 previous year Summer and Winter question papers on DiplomaToppers.`;
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
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(branch.name))} (Code ${escapeHtml(String(branch.code))})</h1><p>${escapeHtml(defaultSeo.description)}</p>`;
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
    defaultSeo.title = `GTU ${String(branch.name).replace(/^Diploma\s+/i, '')} Semester ${semNum} Papers | DiplomaToppers`;
    defaultSeo.description = `Browse and download GTU ${branch.name} Semester ${semNum} subject-wise Summer and Winter diploma old question papers.`;
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
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(branch.name))} — Semester ${semNum}</h1><ul>${subjLinks}</ul>`;
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
    defaultSeo.title = `GTU ${subject.name} ${subject.code} Old Question Papers | DiplomaToppers`;
    defaultSeo.description =
      String(subject.description || '') ||
      `Download GTU ${subject.name} (${subject.code}) Summer and Winter diploma old question papers PDF for ${branch.name} Semester ${semNum}.`;
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
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(subject.name))} (${escapeHtml(String(subject.code))})</h1><p>${escapeHtml(defaultSeo.description)}</p>`;
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

  defaultSeo.title = `GTU ${subject.name} ${paper.examSession} ${paper.examYear} Question Paper PDF | DiplomaToppers`;
  defaultSeo.description = `View and download GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} diploma question paper PDF for ${branch.name} Semester ${semNum}.`;
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
  defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(paper.title))}</h1><p>${escapeHtml(defaultSeo.description)}</p>`;
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

  app.get('/api/stats/downloads', (_req, res) => {
    res.json({ counts: readDownloadStats() });
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
    if (storagePath.startsWith('/api/files/papers/')) {
      const filename = path.basename(storagePath.slice('/api/files/papers/'.length));
      const fullPath = path.join(PAPERS_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'PDF file is missing from storage. Please contact an administrator.' });
        return;
      }
      incrementDownloadStat(paperId);
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

  app.get('/robots.txt', async (req, res) => {
    const origin = getCanonicalOrigin(req);
    const settingsList = await firestoreListCollection('website_settings');
    const siteUrlSetting = settingsList.find((s) => s.settingKey === 'siteUrl')?.settingValue;
    const base =
      normalizeHttpOrigin(typeof siteUrlSetting === 'string' ? siteUrlSetting : undefined) || origin;
    const content = [
      'User-agent: *',
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
    const [branches, semesters, subjects, papers, settingsList, seoList] = await Promise.all([
      firestoreRunActiveQuery('branches'),
      firestoreRunActiveQuery('semesters'),
      firestoreRunActiveQuery('subjects'),
      firestoreRunActiveQuery('papers'),
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

      const metaInject = [
        `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
        `<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`,
        seo.ogImageUrl ? `<meta property="og:image" content="${escapeHtml(seo.ogImageUrl)}" />` : '',
        seo.ogImageUrl ? `<meta name="twitter:image" content="${escapeHtml(seo.ogImageUrl)}" />` : '',
        `<meta name="robots" content="${escapeHtml(seo.robots)}" />`,
        seo.googleVerification
          ? `<meta name="google-site-verification" content="${escapeHtml(seo.googleVerification)}" />`
          : '',
        ...seo.jsonLd.map(
          (ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`
        ),
      ]
        .filter(Boolean)
        .join('\n    ');

      html = html
        .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
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
  });
}

void startServer();
