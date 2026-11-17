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
    // Fallback cleanly
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const url = `${FIRESTORE_REST_BASE}:runQuery?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionName }],
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

function sanitizeVerificationToken(raw?: unknown): string {
  if (!raw || typeof raw !== 'string') return '';
  let token = raw.trim();
  const metaMatch = token.match(/content=["']([^"']+)["']/i);
  if (metaMatch?.[1]) token = metaMatch[1].trim();
  if (!token || !/^[a-zA-Z0-9_-]{8,128}$/.test(token)) return '';
  return token;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSsrRelatedLinksHtml(params: {
  branches: Array<Record<string, unknown>>;
  semesters: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  papers: Array<Record<string, unknown>>;
  currentBranch?: Record<string, unknown>;
  currentSemester?: Record<string, unknown>;
  currentSubject?: Record<string, unknown>;
  currentPaper?: Record<string, unknown>;
}): string {
  const { branches, semesters, subjects, papers, currentBranch, currentSemester, currentSubject, currentPaper } = params;
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

  const siteLinks = [
    '<li><a href="/">Home</a></li>',
    '<li><a href="/about">About Us</a></li>',
    '<li><a href="/contact">Contact Us</a></li>',
    '<li><a href="/privacy-policy">Privacy Policy</a></li>',
    '<li><a href="/terms-and-conditions">Terms &amp; Conditions</a></li>',
    '<li><a href="/disclaimer">Academic Disclaimer</a></li>',
    '<li><a href="/sitemap.xml">XML Sitemap</a></li>',
  ].join('');

  return `<nav aria-label="Related Content and Internal Links"><h2>Related Content &amp; Internal Links</h2><ul>${branchLinks}</ul>${subjectLinks.length ? `<ul>${subjectLinks.join('')}</ul>` : ''}${paperLinks.length ? `<ul>${paperLinks.join('')}</ul>` : ''}<ul>${siteLinks}</ul></nav>`;
}

async function loadIndexTemplate(origin: string): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'dist', 'index.html'),
    path.resolve(process.cwd(), 'index.html'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch {
      // Continue
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const r = await fetch(`${origin}/index.html`, { signal: controller.signal });
      if (r.ok) return await r.text();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Fallback minimal shell if static template fetch fails
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GTU Diploma Old Question Papers | DiplomaToppers</title>
    <meta name="description" content="Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers." />
    <meta property="og:title" content="GTU Diploma Old Question Papers | DiplomaToppers" />
    <meta property="og:description" content="Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers." />
    <meta name="twitter:title" content="GTU Diploma Old Question Papers | DiplomaToppers" />
    <meta name="twitter:description" content="Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers." />
    <!-- SEO_META_INJECT -->
  </head>
  <body>
    <div id="root"></div>
    <!-- SSR_SEO_FALLBACK -->
  </body>
</html>`;
}

async function resolveRouteSeo(pathname: string, origin: string) {
  const cleanPath = !pathname || pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

  if (cleanPath.startsWith('/admin')) {
    return {
      title: 'Admin Portal | DiplomaToppers',
      description: 'Administrator authentication and academic content management for DiplomaToppers.',
      ogTitle: 'Admin Portal | DiplomaToppers',
      ogDescription: 'Administrator authentication and academic content management for DiplomaToppers.',
      ogImageUrl: '',
      canonical: `${origin}${cleanPath}`,
      robots: 'noindex, nofollow',
      googleVerification: '',
      jsonLd: [] as Array<Record<string, unknown>>,
      ssrFallbackHtml: '<h1>Admin Portal | DiplomaToppers</h1>',
    };
  }

  const [branches, semesters, subjects, papers, settingsList, seoList] = await Promise.all([
    queryActive('branches'),
    queryActive('semesters'),
    queryActive('subjects'),
    queryActive('papers'),
    listAll('website_settings'),
    listAll('seo_metadata'),
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

  const effectiveOrigin =
    normalizeHttpOrigin(settingsMap.siteUrl) ||
    normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    origin;
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
    robots: 'index, follow',
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
      },
    ] as Array<Record<string, unknown>>,
    ssrFallbackHtml:
      '<h1>DiplomaToppers — GTU Diploma Question Papers</h1><p>Explore GTU Diploma Engineering branches, semesters, subjects, and Summer/Winter PDF papers.</p>',
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
    if (typeof rec.canonicalUrl === 'string' && normalizeHttpOrigin(rec.canonicalUrl)) {
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
    target.robots = `${rIndex ? 'index' : 'noindex'}, ${rFollow ? 'follow' : 'nofollow'}`;
    return target;
  };

  if (cleanPath === '/') {
    const branchLinks = branches
      .map(
        (b) =>
          `<li><a href="/${escapeHtml(String(b.slug))}">${escapeHtml(String(b.name))} (Code ${escapeHtml(String(b.code))})</a></li>`
      )
      .join('');
    defaultSeo.ssrFallbackHtml = `<h1>Select Your Engineering Branch | DiplomaToppers</h1><ul>${branchLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers })}`;
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
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(staticTitles[cleanPath].title)}</h1><p>${escapeHtml(staticTitles[cleanPath].desc)}</p>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers })}`;
    return applySeoOverride(`seo-static-${staticTitles[cleanPath].id}`, cleanPath, defaultSeo);
  }

  // If Firestore returned no branches (network issue), still return indexable fallback cleanly for known paths
  const segments = cleanPath.split('/').filter(Boolean);
  const branchSlug = segments[0];
  const branch = branches.find((b) => b.slug === branchSlug);
  if (!branch) {
    if (branches.length === 0) {
      return defaultSeo;
    }
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
    const branchSemLinks = semesters
      .filter((s) => s.branchId === branch.id)
      .sort((a, b) => Number(a.semesterNumber) - Number(b.semesterNumber))
      .map(
        (s) =>
          `<li><a href="/${escapeHtml(String(branch.slug))}/semester-${Number(s.semesterNumber)}">${escapeHtml(String(s.name))}</a></li>`
      )
      .join('');
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(branch.name))} (Code ${escapeHtml(String(branch.code))})</h1><p>${escapeHtml(defaultSeo.description)}</p><ul>${branchSemLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, currentBranch: branch })}`;
    return applySeoOverride(`seo-branch-${String(branch.id)}`, cleanPath, defaultSeo);
  }

  const semMatch = segments[1].match(/^semester-(\d+)$/);
  const semNum = semMatch ? Number(semMatch[1]) : 0;
  const semester = semesters.find((s) => s.branchId === branch.id && s.semesterNumber === semNum);
  if (!semester) {
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
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(branch.name))} — Semester ${semNum}</h1><ul>${subjLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, currentBranch: branch, currentSemester: semester })}`;
    return applySeoOverride(`seo-semester-${String(semester.id)}`, cleanPath, defaultSeo);
  }

  const subjectSlug = segments[2];
  const subject = subjects.find(
    (s) => s.branchId === branch.id && s.semesterId === semester.id && s.slug === subjectSlug
  );
  if (!subject) {
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
    const subjectPaperLinks = papers
      .filter((p) => p.subjectId === subject.id)
      .map(
        (p) =>
          `<li><a href="/${escapeHtml(String(branch.slug))}/semester-${semNum}/${escapeHtml(String(subject.slug))}/${escapeHtml(String(p.slug))}">${escapeHtml(String(p.title))}</a></li>`
      )
      .join('');
    defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(subject.name))} (${escapeHtml(String(subject.code))})</h1><p>${escapeHtml(defaultSeo.description)}</p><ul>${subjectPaperLinks}</ul>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, currentBranch: branch, currentSemester: semester, currentSubject: subject })}`;
    return applySeoOverride(`seo-subject-${String(subject.id)}`, cleanPath, defaultSeo);
  }

  const paperSlug = segments[3];
  const paper = papers.find((p) => p.subjectId === subject.id && p.slug === paperSlug);
  if (!paper) {
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
  defaultSeo.ssrFallbackHtml = `<h1>${escapeHtml(String(paper.title))}</h1><p>${escapeHtml(defaultSeo.description)}</p><p><a href="/${escapeHtml(String(branch.slug))}/semester-${semNum}/${escapeHtml(String(subject.slug))}">All ${escapeHtml(String(subject.name))} Papers</a></p>${buildSsrRelatedLinksHtml({ branches, semesters, subjects, papers, currentBranch: branch, currentSemester: semester, currentSubject: subject, currentPaper: paper })}`;
  return applySeoOverride(`seo-paper-${String(paper.id)}`, cleanPath, defaultSeo);
}

interface ServerlessReq {
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessRes {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  status?: (code: number) => { send: (body: string) => void };
  end?: (body: string) => void;
}

function sendHtml(res: ServerlessRes, statusCode: number, body: string, isAdmin = false) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (isAdmin) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  }
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

  let routePath = '/';
  const rawRouteParam = req?.query?.route;
  if (typeof rawRouteParam === 'string' && rawRouteParam) {
    routePath = rawRouteParam.startsWith('/') ? rawRouteParam : `/${rawRouteParam}`;
  } else if (Array.isArray(rawRouteParam) && rawRouteParam[0]) {
    routePath = rawRouteParam[0].startsWith('/') ? rawRouteParam[0] : `/${rawRouteParam[0]}`;
  } else if (req?.url) {
    try {
      const parsed = new URL(req.url, origin);
      const qp = parsed.searchParams.get('route');
      routePath = qp ? (qp.startsWith('/') ? qp : `/${qp}`) : parsed.pathname;
    } catch {
      routePath = '/';
    }
  }

  const isAdminRoute = routePath.startsWith('/admin');
  let html = await loadIndexTemplate(origin);
  try {
    const seo = await resolveRouteSeo(routePath, origin);
    const hasExistingGoogleVerif = /<meta\s+name=["']google-site-verification["']/i.test(html);
    const metaInject = [
      `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
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
        /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
        `<meta name="twitter:title" content="${escapeHtml(seo.ogTitle)}" />`
      )
      .replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
        `<meta name="twitter:description" content="${escapeHtml(seo.ogDescription)}" />`
      )
      .replace('<!-- SEO_META_INJECT -->', metaInject)
      .replace('<!-- SSR_SEO_FALLBACK -->', `<noscript><main>${seo.ssrFallbackHtml}</main></noscript>`);
  } catch {
    // Serve index.html cleanly even if SEO enrichment throws
  }

  sendHtml(res, 200, html, isAdminRoute);
}
