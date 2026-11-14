import firebaseConfig from '../firebase-applet-config.json';

const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
}

function decodeFields(fields?: Record<string, FirestoreValue>): Record<string, unknown> {
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

async function queryActive(collectionName: string): Promise<Array<Record<string, unknown>>> {
  try {
    const url = `${FIRESTORE_REST_BASE}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  }
}

async function listAll(collectionName: string): Promise<Array<Record<string, unknown>>> {
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
          ...decodeFields(r.document!.fields),
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
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { send: (body: string) => void };
}

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const protoHeader = req.headers?.['x-forwarded-proto'] || 'https';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || 'diplomatoppers.in';
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const origin = `${proto}://${host}`;

  const [branches, semesters, subjects, papers, settingsList, seoList] = await Promise.all([
    queryActive('branches'),
    queryActive('semesters'),
    queryActive('subjects'),
    queryActive('papers'),
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
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).send(xml);
}
