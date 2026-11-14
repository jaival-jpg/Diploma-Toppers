import type {
  Branch,
  Paper,
  Semester,
  SeoMetadata,
  SeoPageType,
  Subject,
} from '../types/academic';

export interface StaticPageSeoSeed {
  id: string;
  name: string;
  path: string;
  seoTitle: string;
  metaDescription: string;
}

export const STATIC_PUBLIC_PAGES: StaticPageSeoSeed[] = [
  {
    id: 'about',
    name: 'About Us',
    path: '/about',
    seoTitle: 'About Us | DiplomaToppers',
    metaDescription:
      'Learn how DiplomaToppers helps GTU Diploma Engineering students access organized previous examination question papers across all branches and semesters.',
  },
  {
    id: 'contact',
    name: 'Contact Us',
    path: '/contact',
    seoTitle: 'Contact Us | DiplomaToppers',
    metaDescription:
      'Contact DiplomaToppers for GTU Diploma question paper requests, subject code corrections, or academic support.',
  },
  {
    id: 'privacy-policy',
    name: 'Privacy Policy',
    path: '/privacy-policy',
    seoTitle: 'Privacy Policy | DiplomaToppers',
    metaDescription:
      'Read how DiplomaToppers handles visitor privacy, analytics, and advertising disclosures while keeping GTU study resources free.',
  },
  {
    id: 'terms-and-conditions',
    name: 'Terms and Conditions',
    path: '/terms-and-conditions',
    seoTitle: 'Terms and Conditions | DiplomaToppers',
    metaDescription:
      'Review the terms and conditions for accessing and downloading GTU Diploma previous year question papers on DiplomaToppers.',
  },
  {
    id: 'disclaimer',
    name: 'Academic Disclaimer',
    path: '/disclaimer',
    seoTitle: 'Academic Disclaimer | DiplomaToppers',
    metaDescription:
      'Read the academic disclaimer for DiplomaToppers GTU Diploma Engineering question papers and study resources.',
  },
];

export interface SeoPageDescriptor {
  seoId: string;
  pageType: SeoPageType;
  pageReferenceId: string;
  pageName: string;
  pagePath: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultCanonical: string;
  isPublished: boolean;
  entityUpdatedAt?: string;
}

export function getSeoDocId(pageType: SeoPageType, pageReferenceId: string): string {
  const safeRef = pageReferenceId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return `seo-${pageType}-${safeRef}`.slice(0, 128);
}

export function normalizePagePath(path: string): string {
  const clean = path.trim().split('?')[0].split('#')[0];
  if (!clean || clean === '/') return '/';
  return clean.replace(/\/+$/, '');
}

export function normalizeHttpOrigin(raw?: string): string | null {
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

export function resolveSiteOrigin(siteUrl?: string, fallbackOrigin?: string): string {
  const validSiteUrl = normalizeHttpOrigin(siteUrl);
  if (validSiteUrl) return validSiteUrl;

  const validFallback = normalizeHttpOrigin(fallbackOrigin);
  if (validFallback) return validFallback;

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://diplomatoppers.in';
}

export function buildCanonicalUrl(pagePath: string, siteUrl?: string, fallbackOrigin?: string): string {
  const base = resolveSiteOrigin(siteUrl, fallbackOrigin);
  const norm = normalizePagePath(pagePath);
  return norm === '/' ? `${base}/` : `${base}${norm}`;
}

export function buildHomeSeoDefaults(siteUrl?: string, fallbackOrigin?: string, siteDescription?: string): SeoPageDescriptor {
  const pagePath = '/';
  return {
    seoId: getSeoDocId('home', 'home'),
    pageType: 'home',
    pageReferenceId: 'home',
    pageName: 'Homepage',
    pagePath,
    defaultTitle: 'GTU Diploma Old Question Papers | DiplomaToppers',
    defaultDescription:
      siteDescription?.trim() ||
      'Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers.',
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    isPublished: true,
  };
}

export function buildStaticSeoDefaults(
  seed: StaticPageSeoSeed,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  return {
    seoId: getSeoDocId('static', seed.id),
    pageType: 'static',
    pageReferenceId: seed.id,
    pageName: seed.name,
    pagePath: seed.path,
    defaultTitle: seed.seoTitle,
    defaultDescription: seed.metaDescription,
    defaultCanonical: buildCanonicalUrl(seed.path, siteUrl, fallbackOrigin),
    isPublished: true,
  };
}

export function buildBranchSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'code' | 'slug' | 'description' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}`;
  return {
    seoId: getSeoDocId('branch', branch.id),
    pageType: 'branch',
    pageReferenceId: branch.id,
    pageName: branch.name,
    pagePath,
    defaultTitle: `GTU ${branch.name} Old Papers | DiplomaToppers`,
    defaultDescription:
      branch.description?.trim() ||
      `Download GTU ${branch.name} (Code ${branch.code}) Semester 1 to 6 previous year Summer and Winter question papers on DiplomaToppers.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    isPublished: Boolean(branch.isActive),
    entityUpdatedAt: branch.updatedAt,
  };
}

export function buildSemesterSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'slug' | 'isActive'>,
  semester: Pick<Semester, 'id' | 'semesterNumber' | 'name' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}/semester-${semester.semesterNumber}`;
  const shortBranch = branch.name.replace(/^Diploma\s+/i, '');
  return {
    seoId: getSeoDocId('semester', semester.id),
    pageType: 'semester',
    pageReferenceId: semester.id,
    pageName: `${branch.name} — ${semester.name}`,
    pagePath,
    defaultTitle: `GTU ${shortBranch} Semester ${semester.semesterNumber} Papers | DiplomaToppers`,
    defaultDescription: `Browse and download GTU ${branch.name} Semester ${semester.semesterNumber} subject-wise Summer and Winter diploma old question papers.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    isPublished: Boolean(branch.isActive && semester.isActive),
    entityUpdatedAt: semester.updatedAt,
  };
}

export function buildSubjectSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'slug' | 'isActive'>,
  semester: Pick<Semester, 'id' | 'semesterNumber' | 'isActive'>,
  subject: Pick<Subject, 'id' | 'name' | 'code' | 'slug' | 'description' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}`;
  return {
    seoId: getSeoDocId('subject', subject.id),
    pageType: 'subject',
    pageReferenceId: subject.id,
    pageName: `${subject.name} (${subject.code})`,
    pagePath,
    defaultTitle: `GTU ${subject.name} ${subject.code} Old Question Papers | DiplomaToppers`,
    defaultDescription:
      subject.description?.trim() ||
      `Download GTU ${subject.name} (${subject.code}) Summer and Winter diploma old question papers PDF for ${branch.name} Semester ${semester.semesterNumber}.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    isPublished: Boolean(branch.isActive && semester.isActive && subject.isActive),
    entityUpdatedAt: subject.updatedAt,
  };
}

export function buildPaperSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'slug' | 'isActive'>,
  semester: Pick<Semester, 'id' | 'semesterNumber' | 'isActive'>,
  subject: Pick<Subject, 'id' | 'name' | 'code' | 'slug' | 'isActive'>,
  paper: Pick<Paper, 'id' | 'title' | 'examSession' | 'examYear' | 'slug' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}/${paper.slug}`;
  return {
    seoId: getSeoDocId('paper', paper.id),
    pageType: 'paper',
    pageReferenceId: paper.id,
    pageName: `${subject.name} — ${paper.examSession} ${paper.examYear}`,
    pagePath,
    defaultTitle: `GTU ${subject.name} ${paper.examSession} ${paper.examYear} Question Paper PDF | DiplomaToppers`,
    defaultDescription: `View and download GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} diploma question paper PDF for ${branch.name} Semester ${semester.semesterNumber}.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    isPublished: Boolean(branch.isActive && semester.isActive && subject.isActive && paper.isActive),
    entityUpdatedAt: paper.updatedAt,
  };
}

export function collectCatalogPageDescriptors(params: {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  siteUrl?: string;
  fallbackOrigin?: string;
  siteDescription?: string;
}): SeoPageDescriptor[] {
  const { branches, semesters, subjects, papers, siteUrl, fallbackOrigin, siteDescription } = params;
  const descriptors: SeoPageDescriptor[] = [];

  descriptors.push(buildHomeSeoDefaults(siteUrl, fallbackOrigin, siteDescription));

  for (const seed of STATIC_PUBLIC_PAGES) {
    descriptors.push(buildStaticSeoDefaults(seed, siteUrl, fallbackOrigin));
  }

  const branchById = new Map(branches.map((b) => [b.id, b]));
  const semById = new Map(semesters.map((s) => [s.id, s]));
  const subjById = new Map(subjects.map((s) => [s.id, s]));

  for (const b of branches) {
    descriptors.push(buildBranchSeoDefaults(b, siteUrl, fallbackOrigin));
  }

  for (const sem of semesters) {
    const b = branchById.get(sem.branchId);
    if (!b) continue;
    descriptors.push(buildSemesterSeoDefaults(b, sem, siteUrl, fallbackOrigin));
  }

  for (const subj of subjects) {
    const b = branchById.get(subj.branchId);
    const sem = semById.get(subj.semesterId);
    if (!b || !sem) continue;
    descriptors.push(buildSubjectSeoDefaults(b, sem, subj, siteUrl, fallbackOrigin));
  }

  for (const pap of papers) {
    const subj = subjById.get(pap.subjectId);
    const b = branchById.get(pap.branchId);
    const sem = semById.get(pap.semesterId);
    if (!subj || !b || !sem) continue;
    descriptors.push(buildPaperSeoDefaults(b, sem, subj, pap, siteUrl, fallbackOrigin));
  }

  return descriptors;
}

export function mergeDescriptorWithSeo(
  descriptor: SeoPageDescriptor,
  stored?: SeoMetadata
): SeoMetadata {
  if (!stored) {
    return {
      id: descriptor.seoId,
      pageType: descriptor.pageType,
      pageReferenceId: descriptor.pageReferenceId,
      pageName: descriptor.pageName,
      pagePath: descriptor.pagePath,
      seoTitle: descriptor.defaultTitle,
      metaDescription: descriptor.defaultDescription,
      canonicalUrl: descriptor.defaultCanonical,
      ogTitle: descriptor.defaultTitle,
      ogDescription: descriptor.defaultDescription,
      ogImageUrl: '',
      robotsIndex: descriptor.isPublished,
      robotsFollow: descriptor.isPublished,
      isCustomized: false,
      updatedAt: descriptor.entityUpdatedAt,
    };
  }
  return {
    ...stored,
    pageName: descriptor.pageName,
    pagePath: descriptor.pagePath,
  };
}
