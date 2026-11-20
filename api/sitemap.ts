import fs from 'node:fs';
import path from 'node:path';

interface FirebaseWebConfig {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey: string;
}

const FALLBACK_FIREBASE_CONFIG: FirebaseWebConfig = {
  projectId: 'gen-lang-client-0269851131',
  firestoreDatabaseId: 'ai-studio-7e1940ca-1935-4d34-bd9e-62e5ff5de8bf',
  apiKey: 'AIzaSyC0nRinRASGi7Fjq5q7fgcWWFD7WYv7i20',
};

function loadFirebaseConfig(): FirebaseWebConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<FirebaseWebConfig>;
      if (parsed.projectId && parsed.firestoreDatabaseId && parsed.apiKey) {
        return {
          projectId: parsed.projectId,
          firestoreDatabaseId: parsed.firestoreDatabaseId,
          apiKey: parsed.apiKey,
        };
      }
    }
  } catch {
    // Fallback cleanly in serverless environments
  }
  return FALLBACK_FIREBASE_CONFIG;
}

const cfg = loadFirebaseConfig();
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;

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

function decodeValue(v?: FirestoreValue): unknown {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) {
    return (v.arrayValue.values || [])
      .map((item) => decodeValue(item))
      .filter((item) => item !== undefined);
  }
  if (v.mapValue) {
    return decodeFields(v.mapValue.fields);
  }
  return undefined;
}

function decodeFields(fields?: Record<string, FirestoreValue>): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    const decoded = decodeValue(v);
    if (decoded !== undefined) {
      out[k] = decoded;
    }
  }
  return out;
}

async function queryActive(collectionName: string): Promise<Array<Record<string, unknown>>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `${FIRESTORE_REST_BASE}:runQuery?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'isActive' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          limit: 1000,
        },
      }),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreValue> };
    }>;
    return rows
      .filter((r) => r.document?.fields)
      .map((r) => ({
        id: r.document!.name?.split('/').pop() || '',
        ...decodeFields(r.document!.fields),
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function listAll(collectionName: string): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = [];
  const batchSize = 500;
  let offset = 0;
  try {
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const url = `${FIRESTORE_REST_BASE}:runQuery?key=${encodeURIComponent(cfg.apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
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
            ...decodeFields(r.document!.fields),
          }));
        results.push(...docs);
        if (docs.length < batchSize) break;
        offset += docs.length;
      } finally {
        clearTimeout(timer);
      }
    }
    return results;
  } catch {
    return results;
  }
}

function normalizeHttpOrigin(raw?: unknown): string | null {
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface ServerlessReq {
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessRes {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  status?: (code: number) => { send: (body: string) => void };
  end?: (body: string) => void;
}

function sendXml(res: ServerlessRes, statusCode: number, body: string) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  if (typeof res.status === 'function') {
    res.status(statusCode).send(body);
  } else {
    res.statusCode = statusCode;
    res.end?.(body);
  }
}

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  const hostHeader = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const protoHeader = req?.headers?.['x-forwarded-proto'] || 'https';
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) || 'diplomatoppers.vercel.app';
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'https';
  const origin = `${proto}://${host}`;

  const [branches, semesters, subjects, papers, blogs, settingsList, seoList] = await Promise.all([
    queryActive('branches'),
    queryActive('semesters'),
    queryActive('subjects'),
    queryActive('papers'),
    queryActive('blog_posts'),
    listAll('website_settings'),
    listAll('seo_metadata'),
  ]);

  const siteUrlSetting = settingsList.find((s) => s.settingKey === 'siteUrl')?.settingValue;
  const envSiteUrl = normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const base = normalizeHttpOrigin(siteUrlSetting) || envSiteUrl || origin;

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

  sendXml(res, 200, xml);
}
