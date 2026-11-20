import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  Advertisement,
  BlogPost,
  Branch,
  ExamSession,
  Paper,
  Semester,
  SeoFaqItem,
  SeoMetadata,
  SeoPageType,
  Subject,
  WebsiteSettingsMap,
} from '../types/academic';
import { sanitizeId, slugify } from '../utils/slugify';
import { deleteCloudFileByPath } from './cloudFileStorage';
import {
  buildBlogIndexSeoDefaults,
  buildBlogPostSeoDefaults,
  buildBranchSeoDefaults,
  buildPaperSeoDefaults,
  buildSemesterSeoDefaults,
  buildSubjectSeoDefaults,
  collectCatalogPageDescriptors,
  getSeoDocId,
  type SeoPageDescriptor,
} from './seoDefaults';

function toIsoString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && 'seconds' in (val as Record<string, unknown>)) {
    const secs = Number((val as { seconds: number }).seconds);
    return new Date(secs * 1000).toISOString();
  }
  return undefined;
}

function mapDoc<T>(id: string, raw: Record<string, unknown>): T {
  return {
    ...raw,
    id,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  } as unknown as T;
}

export const STANDARD_GTU_BRANCHES: Array<{
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string;
  displayOrder: number;
}> = [
  {
    id: 'branch-computer-engineering',
    name: 'Diploma Computer Engineering',
    code: '07',
    slug: 'computer-engineering',
    description:
      'Access GTU Diploma Computer Engineering (Branch Code 07) previous year Summer & Winter question papers across Semesters 1 to 6.',
    displayOrder: 1,
  },
  {
    id: 'branch-civil-engineering',
    name: 'Diploma Civil Engineering',
    code: '06',
    slug: 'civil-engineering',
    description:
      'Access GTU Diploma Civil Engineering (Branch Code 06) previous year Summer & Winter question papers across Semesters 1 to 6.',
    displayOrder: 2,
  },
  {
    id: 'branch-electrical-engineering',
    name: 'Diploma Electrical Engineering',
    code: '09',
    slug: 'electrical-engineering',
    description:
      'Access GTU Diploma Electrical Engineering (Branch Code 09) previous year Summer & Winter question papers across Semesters 1 to 6.',
    displayOrder: 3,
  },
  {
    id: 'branch-mechanical-engineering',
    name: 'Diploma Mechanical Engineering',
    code: '19',
    slug: 'mechanical-engineering',
    description:
      'Access GTU Diploma Mechanical Engineering (Branch Code 19) previous year Summer & Winter question papers across Semesters 1 to 6.',
    displayOrder: 4,
  },
];

export async function initializeStandardGtuCatalog(): Promise<{ createdBranches: number; createdSemesters: number }> {
  let createdBranches = 0;
  let createdSemesters = 0;

  try {
    const existingBranches = await getDocs(collection(db, 'branches'));
    const existingBranchIds = new Set(existingBranches.docs.map((d) => d.id));

    for (const b of STANDARD_GTU_BRANCHES) {
      if (!existingBranchIds.has(b.id)) {
        await setDoc(doc(db, 'branches', b.id), {
          name: b.name,
          code: b.code,
          slug: b.slug,
          description: b.description,
          isActive: true,
          displayOrder: b.displayOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdBranches++;
      }

      for (let sem = 1; sem <= 6; sem++) {
        const semId = `${b.id}-sem-${sem}`;
        const semSnap = await getDoc(doc(db, 'semesters', semId));
        if (!semSnap.exists()) {
          await setDoc(doc(db, 'semesters', semId), {
            branchId: b.id,
            semesterNumber: sem,
            name: `Semester ${sem}`,
            isActive: true,
            displayOrder: sem,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          createdSemesters++;
        }
      }
    }

    const defaultSettings: Array<{ key: string; value: string }> = [
      { key: 'siteTitle', value: 'DiplomaToppers' },
      {
        key: 'siteDescription',
        value:
          'GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject.',
      },
      { key: 'contactEmail', value: 'support@diplomatoppers.in' },
    ];

    for (const s of defaultSettings) {
      const ref = doc(db, 'website_settings', s.key);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          settingKey: s.key,
          settingValue: s.value,
          updatedAt: serverTimestamp(),
        });
      }
    }

    if (createdBranches > 0 || createdSemesters > 0) {
      await syncAllDefaultSeo().catch(() => {});
    }

    return { createdBranches, createdSemesters };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'branches');
  }
}

// ---- Download Count Merge Helper ----
export async function fetchServerDownloadStats(): Promise<Record<string, number>> {
  const merged: Record<string, number> = {};
  try {
    const snap = await getDocs(collection(db, 'paper_stats'));
    for (const d of snap.docs) {
      const data = d.data() as { downloadCount?: unknown };
      if (typeof data.downloadCount === 'number' && data.downloadCount > 0) {
        merged[d.id] = data.downloadCount;
      }
    }
  } catch {
    // Non-fatal fallback
  }

  try {
    const res = await fetch('/api/stats/downloads');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { counts?: Record<string, number> };
        for (const [k, v] of Object.entries(json.counts || {})) {
          merged[k] = Math.max(merged[k] || 0, Number(v) || 0);
        }
      }
    }
  } catch {
    // Non-fatal fallback
  }

  return merged;
}

// ---- Public Readers (strictly filter isActive == true) ----

export async function getActiveBranches(): Promise<Branch[]> {
  try {
    const q = query(collection(db, 'branches'), where('isActive', '==', true));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => mapDoc<Branch>(d.id, d.data()));
    return items.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'branches');
  }
}

export async function getAllBranches(): Promise<Branch[]> {
  try {
    const snap = await getDocs(collection(db, 'branches'));
    const items = snap.docs.map((d) => mapDoc<Branch>(d.id, d.data()));
    return items.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'branches');
  }
}

export async function getActiveSemesters(branchId?: string): Promise<Semester[]> {
  try {
    const q = branchId
      ? query(collection(db, 'semesters'), where('isActive', '==', true), where('branchId', '==', branchId))
      : query(collection(db, 'semesters'), where('isActive', '==', true));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => mapDoc<Semester>(d.id, d.data()));
    return items.sort((a, b) => a.semesterNumber - b.semesterNumber || a.displayOrder - b.displayOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'semesters');
  }
}

export async function getAllSemesters(): Promise<Semester[]> {
  try {
    const snap = await getDocs(collection(db, 'semesters'));
    const items = snap.docs.map((d) => mapDoc<Semester>(d.id, d.data()));
    return items.sort((a, b) => a.branchId.localeCompare(b.branchId) || a.semesterNumber - b.semesterNumber);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'semesters');
  }
}

export async function getActiveSubjects(filters?: { branchId?: string; semesterId?: string }): Promise<Subject[]> {
  try {
    const constraints = [where('isActive', '==', true)];
    if (filters?.branchId) constraints.push(where('branchId', '==', filters.branchId));
    if (filters?.semesterId) constraints.push(where('semesterId', '==', filters.semesterId));
    const snap = await getDocs(query(collection(db, 'subjects'), ...constraints));
    const items = snap.docs.map((d) => mapDoc<Subject>(d.id, d.data()));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subjects');
  }
}

export async function getAllSubjects(): Promise<Subject[]> {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    const items = snap.docs.map((d) => mapDoc<Subject>(d.id, d.data()));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subjects');
  }
}

export async function getActivePapers(filters?: { subjectId?: string; branchId?: string }): Promise<Paper[]> {
  try {
    const constraints = [where('isActive', '==', true)];
    if (filters?.subjectId) constraints.push(where('subjectId', '==', filters.subjectId));
    if (filters?.branchId) constraints.push(where('branchId', '==', filters.branchId));
    const [snap, stats] = await Promise.all([
      getDocs(query(collection(db, 'papers'), ...constraints)),
      fetchServerDownloadStats(),
    ]);
    const items = snap.docs.map((d) => {
      const p = mapDoc<Paper>(d.id, d.data());
      return {
        ...p,
        downloadCount: Math.max(p.downloadCount || 0, stats[d.id] || 0),
      };
    });
    return items.sort((a, b) => b.examYear - a.examYear || a.examSession.localeCompare(b.examSession));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'papers');
  }
}

export async function getAllPapers(): Promise<Paper[]> {
  try {
    const [snap, stats] = await Promise.all([
      getDocs(collection(db, 'papers')),
      fetchServerDownloadStats(),
    ]);
    const items = snap.docs.map((d) => {
      const p = mapDoc<Paper>(d.id, d.data());
      return {
        ...p,
        downloadCount: Math.max(p.downloadCount || 0, stats[d.id] || 0),
      };
    });
    return items.sort((a, b) => b.examYear - a.examYear || (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'papers');
  }
}

export async function getActiveAdvertisements(): Promise<Advertisement[]> {
  try {
    const snap = await getDocs(query(collection(db, 'advertisements'), where('isActive', '==', true)));
    const items = snap.docs.map((d) => mapDoc<Advertisement>(d.id, d.data()));
    return items.sort((a, b) => a.displayOrder - b.displayOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'advertisements');
  }
}

export async function getAllAdvertisements(): Promise<Advertisement[]> {
  try {
    const snap = await getDocs(collection(db, 'advertisements'));
    const items = snap.docs.map((d) => mapDoc<Advertisement>(d.id, d.data()));
    return items.sort((a, b) => a.displayOrder - b.displayOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'advertisements');
  }
}

export async function getActiveBlogPosts(): Promise<BlogPost[]> {
  try {
    const snap = await getDocs(query(collection(db, 'blog_posts'), where('isActive', '==', true)));
    const items = snap.docs.map((d) => mapDoc<BlogPost>(d.id, d.data()));
    return items.sort((a, b) =>
      (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '')
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'blog_posts');
  }
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    const snap = await getDocs(collection(db, 'blog_posts'));
    const items = snap.docs.map((d) => mapDoc<BlogPost>(d.id, d.data()));
    return items.sort((a, b) =>
      (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || '')
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'blog_posts');
  }
}

export async function getWebsiteSettings(): Promise<WebsiteSettingsMap> {
  try {
    const snap = await getDocs(collection(db, 'website_settings'));
    const map: WebsiteSettingsMap = {};
    for (const d of snap.docs) {
      const data = d.data() as { settingKey?: string; settingValue?: string };
      if (data.settingKey) {
        (map as Record<string, string>)[data.settingKey] = data.settingValue || '';
      }
    }
    return map;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'website_settings');
  }
}

export async function getAllSeoMetadata(): Promise<SeoMetadata[]> {
  try {
    const snap = await getDocs(collection(db, 'seo_metadata'));
    return snap.docs.map((d) => mapDoc<SeoMetadata>(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'seo_metadata');
  }
}

async function getConfiguredSiteUrl(): Promise<string | undefined> {
  try {
    const snap = await getDoc(doc(db, 'website_settings', 'siteUrl'));
    if (snap.exists()) {
      const val = (snap.data() as { settingValue?: string }).settingValue;
      return val?.trim() || undefined;
    }
  } catch {
    // Fallback cleanly
  }
  return undefined;
}

function sanitizeStringArray(arr: string[] | undefined, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeFaqArray(faqs: SeoFaqItem[] | undefined): SeoFaqItem[] {
  if (!Array.isArray(faqs)) return [];
  return faqs
    .map((f) => ({
      question: String(f?.question || '').trim().slice(0, 300),
      answer: String(f?.answer || '').trim().slice(0, 2000),
    }))
    .filter((f) => f.question.length > 0 && f.answer.length > 0)
    .slice(0, 15);
}

function descriptorContentPayload(descriptor: SeoPageDescriptor) {
  return {
    pageName: descriptor.pageName.slice(0, 200),
    pagePath: descriptor.pagePath.slice(0, 300),
    focusKeyword: descriptor.defaultFocusKeyword.slice(0, 200),
    secondaryKeywords: descriptor.defaultSecondaryKeywords.slice(0, 500),
    seoTitle: descriptor.defaultTitle.slice(0, 200),
    metaDescription: descriptor.defaultDescription.slice(0, 400),
    h1Heading: descriptor.defaultH1Heading.slice(0, 220),
    h2Headings: sanitizeStringArray(descriptor.defaultH2Headings, 20, 220),
    h3Headings: sanitizeStringArray(descriptor.defaultH3Headings, 30, 220),
    mainIntro: descriptor.defaultMainIntro.slice(0, 2000),
    detailedContent: descriptor.defaultDetailedContent.slice(0, 15000),
    faqs: sanitizeFaqArray(descriptor.defaultFaqs),
    imageAltText: descriptor.defaultImageAltText.slice(0, 300),
    canonicalUrl: descriptor.defaultCanonical.slice(0, 500),
    ogTitle: descriptor.defaultTitle.slice(0, 200),
    ogDescription: descriptor.defaultDescription.slice(0, 400),
    robotsIndex: descriptor.isPublished,
    robotsFollow: descriptor.isPublished,
    isCustomized: false,
  };
}

async function upsertAutoSeoDescriptor(descriptor: SeoPageDescriptor): Promise<'created' | 'updated' | 'skipped'> {
  const ref = doc(db, 'seo_metadata', descriptor.seoId);
  try {
    const snap = await getDoc(ref);
    const autoFields = descriptorContentPayload(descriptor);
    if (!snap.exists()) {
      await setDoc(ref, {
        pageType: descriptor.pageType,
        pageReferenceId: descriptor.pageReferenceId,
        ...autoFields,
        ogImageUrl: '',
        updatedAt: serverTimestamp(),
      });
      return 'created';
    }

    const existing = snap.data() as Partial<SeoMetadata>;
    if (existing.isCustomized) {
      if (existing.pageName !== descriptor.pageName || existing.pagePath !== descriptor.pagePath) {
        await updateDoc(ref, {
          pageName: descriptor.pageName.slice(0, 200),
          pagePath: descriptor.pagePath.slice(0, 300),
          updatedAt: serverTimestamp(),
        });
      }
      return 'skipped';
    }

    await updateDoc(ref, {
      ...autoFields,
      updatedAt: serverTimestamp(),
    });
    return 'updated';
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `seo_metadata/${descriptor.seoId}`);
  }
}

async function deleteSeoMetadataIfPresent(pageType: SeoPageType, pageReferenceId: string): Promise<void> {
  const seoId = getSeoDocId(pageType, pageReferenceId);
  try {
    await deleteDoc(doc(db, 'seo_metadata', seoId));
  } catch {
    // Non-fatal if doc does not exist
  }
}

export async function saveSeoMetadata(input: {
  pageType: SeoPageType;
  pageReferenceId: string;
  pageName: string;
  pagePath: string;
  focusKeyword?: string;
  secondaryKeywords?: string;
  seoTitle: string;
  metaDescription: string;
  h1Heading?: string;
  h2Headings?: string[];
  h3Headings?: string[];
  mainIntro?: string;
  detailedContent?: string;
  faqs?: SeoFaqItem[];
  imageAltText?: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  isCustomized?: boolean;
}): Promise<string> {
  const seoId = getSeoDocId(input.pageType, input.pageReferenceId);
  const path = `seo_metadata/${seoId}`;
  const ref = doc(db, 'seo_metadata', seoId);

  try {
    const existingSnap = await getDoc(ref);
    const payload = {
      pageName: input.pageName.trim().slice(0, 200),
      pagePath: input.pagePath.trim().slice(0, 300),
      focusKeyword: (input.focusKeyword || '').trim().slice(0, 200),
      secondaryKeywords: (input.secondaryKeywords || '').trim().slice(0, 500),
      seoTitle: input.seoTitle.trim().slice(0, 200),
      metaDescription: input.metaDescription.trim().slice(0, 400),
      h1Heading: (input.h1Heading || '').trim().slice(0, 220),
      h2Headings: sanitizeStringArray(input.h2Headings, 20, 220),
      h3Headings: sanitizeStringArray(input.h3Headings, 30, 220),
      mainIntro: (input.mainIntro || '').trim().slice(0, 2000),
      detailedContent: (input.detailedContent || '').trim().slice(0, 15000),
      faqs: sanitizeFaqArray(input.faqs),
      imageAltText: (input.imageAltText || '').trim().slice(0, 300),
      canonicalUrl: input.canonicalUrl.trim().slice(0, 500),
      ogTitle: input.ogTitle.trim().slice(0, 200),
      ogDescription: input.ogDescription.trim().slice(0, 400),
      ogImageUrl: input.ogImageUrl.trim().slice(0, 500),
      robotsIndex: Boolean(input.robotsIndex),
      robotsFollow: Boolean(input.robotsFollow),
      isCustomized: input.isCustomized ?? true,
      updatedAt: serverTimestamp(),
    };

    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        pageType: input.pageType,
        pageReferenceId: input.pageReferenceId,
        ...payload,
      });
    }
    return seoId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function resetSeoMetadataToDefault(descriptor: SeoPageDescriptor): Promise<void> {
  await saveSeoMetadata({
    pageType: descriptor.pageType,
    pageReferenceId: descriptor.pageReferenceId,
    pageName: descriptor.pageName,
    pagePath: descriptor.pagePath,
    focusKeyword: descriptor.defaultFocusKeyword,
    secondaryKeywords: descriptor.defaultSecondaryKeywords,
    seoTitle: descriptor.defaultTitle,
    metaDescription: descriptor.defaultDescription,
    h1Heading: descriptor.defaultH1Heading,
    h2Headings: descriptor.defaultH2Headings,
    h3Headings: descriptor.defaultH3Headings,
    mainIntro: descriptor.defaultMainIntro,
    detailedContent: descriptor.defaultDetailedContent,
    faqs: descriptor.defaultFaqs,
    imageAltText: descriptor.defaultImageAltText,
    canonicalUrl: descriptor.defaultCanonical,
    ogTitle: descriptor.defaultTitle,
    ogDescription: descriptor.defaultDescription,
    ogImageUrl: '',
    robotsIndex: descriptor.isPublished,
    robotsFollow: descriptor.isPublished,
    isCustomized: false,
  });
}

export async function syncAllDefaultSeo(params?: {
  branches?: Branch[];
  semesters?: Semester[];
  subjects?: Subject[];
  papers?: Paper[];
  blogs?: BlogPost[];
  siteUrl?: string;
  siteDescription?: string;
}): Promise<{ created: number; updated: number; skippedCustomized: number }> {
  const [branches, semesters, subjects, papers, blogs, settings, existingSeo] = await Promise.all([
    params?.branches ? Promise.resolve(params.branches) : getAllBranches(),
    params?.semesters ? Promise.resolve(params.semesters) : getAllSemesters(),
    params?.subjects ? Promise.resolve(params.subjects) : getAllSubjects(),
    params?.papers ? Promise.resolve(params.papers) : getAllPapers(),
    params?.blogs ? Promise.resolve(params.blogs) : getAllBlogPosts(),
    getWebsiteSettings(),
    getAllSeoMetadata(),
  ]);

  const descriptors = collectCatalogPageDescriptors({
    branches,
    semesters,
    subjects,
    papers,
    blogs,
    siteUrl: params?.siteUrl ?? settings.siteUrl,
    siteDescription: params?.siteDescription ?? settings.siteDescription,
  });

  const existingById = new Map(existingSeo.map((s) => [s.id, s]));
  let created = 0;
  let updated = 0;
  let skippedCustomized = 0;

  for (const desc of descriptors) {
    const existing = existingById.get(desc.seoId);
    if (!existing) {
      await upsertAutoSeoDescriptor(desc);
      created++;
    } else if (existing.isCustomized) {
      if (existing.pageName !== desc.pageName || existing.pagePath !== desc.pagePath) {
        await updateDoc(doc(db, 'seo_metadata', desc.seoId), {
          pageName: desc.pageName.slice(0, 200),
          pagePath: desc.pagePath.slice(0, 300),
          updatedAt: serverTimestamp(),
        });
      }
      skippedCustomized++;
    } else if (
      existing.seoTitle !== desc.defaultTitle ||
      existing.metaDescription !== desc.defaultDescription ||
      existing.canonicalUrl !== desc.defaultCanonical ||
      existing.pagePath !== desc.pagePath ||
      existing.pageName !== desc.pageName ||
      existing.robotsIndex !== desc.isPublished ||
      !existing.h1Heading ||
      !existing.detailedContent ||
      !existing.focusKeyword
    ) {
      await upsertAutoSeoDescriptor(desc);
      updated++;
    }
  }

  return { created, updated, skippedCustomized };
}

// ---- Admin Mutations (CRUD + Validation + Safe Deletion) ----

const RESERVED_BRANCH_SLUGS = new Set([
  'admin',
  'api',
  'about',
  'contact',
  'privacy-policy',
  'terms-and-conditions',
  'disclaimer',
  'blog',
  'sitemap',
  'robots',
]);

export async function saveBranch(
  input: { name: string; code: string; slug: string; description: string; isActive: boolean; displayOrder: number },
  existingId?: string
): Promise<string> {
  const cleanSlug = slugify(input.slug || input.name);
  const cleanCode = input.code.trim().toUpperCase();
  if (!cleanSlug || cleanSlug.length < 2) throw new Error('Branch slug must be at least 2 characters.');
  if (RESERVED_BRANCH_SLUGS.has(cleanSlug)) {
    throw new Error(`"${cleanSlug}" is a reserved route slug. Please choose another branch slug.`);
  }
  if (!cleanCode) throw new Error('Branch code is required.');

  const all = await getAllBranches();
  const duplicate = all.find(
    (b) => b.id !== existingId && (b.slug === cleanSlug || b.code.toLowerCase() === cleanCode.toLowerCase())
  );
  if (duplicate) {
    throw new Error(`A branch with code "${cleanCode}" or slug "${cleanSlug}" already exists.`);
  }

  const id = existingId || sanitizeId(`branch-${cleanSlug}-${Date.now().toString(36)}`);
  const path = `branches/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'branches', existingId), {
        name: input.name.trim(),
        code: cleanCode,
        slug: cleanSlug,
        description: input.description.trim(),
        isActive: input.isActive,
        displayOrder: Number(input.displayOrder) || 0,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'branches', id), {
        name: input.name.trim(),
        code: cleanCode,
        slug: cleanSlug,
        description: input.description.trim(),
        isActive: input.isActive,
        displayOrder: Number(input.displayOrder) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const [semesters, subjects, papers, siteUrl] = await Promise.all([
      getAllSemesters(),
      getAllSubjects(),
      getAllPapers(),
      getConfiguredSiteUrl(),
    ]);
    await upsertAutoSeoDescriptor(
      buildBranchSeoDefaults(
        {
          id,
          name: input.name.trim(),
          code: cleanCode,
          slug: cleanSlug,
          description: input.description.trim(),
          isActive: input.isActive,
        },
        siteUrl,
        undefined,
        { semesters, subjects, papers }
      )
    );
    if (existingId) {
      await syncAllDefaultSeo().catch(() => {});
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteBranchSafe(branchId: string): Promise<void> {
  const [semesters, subjects] = await Promise.all([getAllSemesters(), getAllSubjects()]);
  if (semesters.some((s) => s.branchId === branchId)) {
    throw new Error('Cannot delete branch because it still contains semesters. Delete or reassign its semesters first.');
  }
  if (subjects.some((s) => s.branchId === branchId)) {
    throw new Error('Cannot delete branch because it still contains subjects.');
  }
  try {
    await deleteDoc(doc(db, 'branches', branchId));
    await deleteSeoMetadataIfPresent('branch', branchId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `branches/${branchId}`);
  }
}

export async function saveSemester(
  input: { branchId: string; semesterNumber: number; name: string; isActive: boolean; displayOrder: number },
  existingId?: string
): Promise<string> {
  const semNum = Number(input.semesterNumber);
  if (!Number.isInteger(semNum) || semNum < 1 || semNum > 6) {
    throw new Error('Semester number must be an integer between 1 and 6.');
  }

  const all = await getAllSemesters();
  const duplicate = all.find(
    (s) => s.id !== existingId && s.branchId === input.branchId && s.semesterNumber === semNum
  );
  if (duplicate) {
    throw new Error(`Semester ${semNum} already exists for this branch.`);
  }

  const id = existingId || sanitizeId(`${input.branchId}-sem-${semNum}`);
  const path = `semesters/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'semesters', existingId), {
        semesterNumber: semNum,
        name: input.name.trim() || `Semester ${semNum}`,
        isActive: input.isActive,
        displayOrder: Number(input.displayOrder) || semNum,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'semesters', id), {
        branchId: input.branchId,
        semesterNumber: semNum,
        name: input.name.trim() || `Semester ${semNum}`,
        isActive: input.isActive,
        displayOrder: Number(input.displayOrder) || semNum,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const [branches, subjects, papers, siteUrl] = await Promise.all([
      getAllBranches(),
      getAllSubjects(),
      getAllPapers(),
      getConfiguredSiteUrl(),
    ]);
    const parentBranch = branches.find((b) => b.id === input.branchId);
    if (parentBranch) {
      await upsertAutoSeoDescriptor(
        buildSemesterSeoDefaults(
          parentBranch,
          {
            id,
            semesterNumber: semNum,
            name: input.name.trim() || `Semester ${semNum}`,
            isActive: input.isActive,
          },
          siteUrl,
          undefined,
          { subjects, papers }
        )
      );
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteSemesterSafe(semesterId: string): Promise<void> {
  const subjects = await getAllSubjects();
  if (subjects.some((s) => s.semesterId === semesterId)) {
    throw new Error('Cannot delete semester because it contains subjects. Delete its subjects first.');
  }
  try {
    await deleteDoc(doc(db, 'semesters', semesterId));
    await deleteSeoMetadataIfPresent('semester', semesterId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `semesters/${semesterId}`);
  }
}

export async function saveSubject(
  input: {
    branchId: string;
    semesterId: string;
    name: string;
    code: string;
    slug: string;
    description: string;
    isActive: boolean;
  },
  existingId?: string
): Promise<string> {
  const cleanSlug = slugify(input.slug || input.name);
  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleanSlug || cleanSlug.length < 2) throw new Error('Subject slug must be at least 2 characters.');
  if (!cleanCode || cleanCode.length < 2) throw new Error('Valid subject code is required (alphanumeric).');

  const all = await getAllSubjects();
  const duplicateCode = all.find(
    (s) =>
      s.id !== existingId &&
      s.branchId === input.branchId &&
      s.semesterId === input.semesterId &&
      s.code.toUpperCase() === cleanCode
  );
  if (duplicateCode) {
    throw new Error(`Subject code "${cleanCode}" already exists in the selected branch and semester.`);
  }
  const duplicateSlug = all.find(
    (s) =>
      s.id !== existingId &&
      s.branchId === input.branchId &&
      s.semesterId === input.semesterId &&
      s.slug === cleanSlug
  );
  if (duplicateSlug) {
    throw new Error(`Subject slug "${cleanSlug}" already exists in the selected branch and semester.`);
  }

  const rand = Math.random().toString(36).slice(2, 7);
  const id = existingId || sanitizeId(`subj-${cleanCode}-${Date.now().toString(36)}-${rand}`);
  const path = `subjects/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'subjects', existingId), {
        branchId: input.branchId,
        semesterId: input.semesterId,
        name: input.name.trim(),
        code: cleanCode,
        slug: cleanSlug,
        description: input.description.trim(),
        isActive: input.isActive,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'subjects', id), {
        branchId: input.branchId,
        semesterId: input.semesterId,
        name: input.name.trim(),
        code: cleanCode,
        slug: cleanSlug,
        description: input.description.trim(),
        isActive: input.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const [branches, semesters, papers, siteUrl] = await Promise.all([
      getAllBranches(),
      getAllSemesters(),
      getAllPapers(),
      getConfiguredSiteUrl(),
    ]);
    const parentBranch = branches.find((b) => b.id === input.branchId);
    const parentSem = semesters.find((s) => s.id === input.semesterId);
    if (parentBranch && parentSem) {
      await upsertAutoSeoDescriptor(
        buildSubjectSeoDefaults(
          parentBranch,
          parentSem,
          {
            id,
            name: input.name.trim(),
            code: cleanCode,
            slug: cleanSlug,
            description: input.description.trim(),
            isActive: input.isActive,
          },
          siteUrl,
          undefined,
          { papers }
        )
      );
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteSubjectSafe(subjectId: string): Promise<void> {
  const papers = await getAllPapers();
  if (papers.some((p) => p.subjectId === subjectId)) {
    throw new Error('Cannot delete subject because it has uploaded question papers. Delete those papers first.');
  }
  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
    await deleteSeoMetadataIfPresent('subject', subjectId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `subjects/${subjectId}`);
  }
}

export async function savePaper(
  input: {
    subjectId: string;
    branchId: string;
    semesterId: string;
    title: string;
    examSession: ExamSession;
    examYear: number;
    pdfStoragePath: string;
    originalFilename: string;
    fileSize: number;
    isActive: boolean;
  },
  existingId?: string
): Promise<string> {
  const yearNum = Number(input.examYear);
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    throw new Error('Examination year must be between 2000 and 2100.');
  }
  if (input.examSession !== 'Summer' && input.examSession !== 'Winter') {
    throw new Error('Examination session must be Summer or Winter.');
  }
  if (!input.pdfStoragePath) {
    throw new Error('A valid PDF document must be uploaded.');
  }

  const all = await getAllPapers();
  const duplicate = all.find(
    (p) =>
      p.id !== existingId &&
      p.subjectId === input.subjectId &&
      p.examSession === input.examSession &&
      p.examYear === yearNum
  );
  if (duplicate) {
    throw new Error(
      `A ${input.examSession} ${yearNum} paper already exists for this subject. Edit the existing record to replace its PDF.`
    );
  }

  const paperSlug = `${input.examSession.toLowerCase()}-${yearNum}`;
  const rand = Math.random().toString(36).slice(2, 7);
  const id = existingId || sanitizeId(`paper-${input.subjectId}-${paperSlug}-${Date.now().toString(36)}-${rand}`);
  const path = `papers/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'papers', existingId), {
        subjectId: input.subjectId,
        branchId: input.branchId,
        semesterId: input.semesterId,
        title: input.title.trim(),
        examSession: input.examSession,
        examYear: yearNum,
        pdfStoragePath: input.pdfStoragePath,
        originalFilename: input.originalFilename,
        fileSize: Number(input.fileSize),
        slug: paperSlug,
        isActive: input.isActive,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'papers', id), {
        subjectId: input.subjectId,
        branchId: input.branchId,
        semesterId: input.semesterId,
        title: input.title.trim(),
        examSession: input.examSession,
        examYear: yearNum,
        pdfStoragePath: input.pdfStoragePath,
        originalFilename: input.originalFilename,
        fileSize: Number(input.fileSize),
        slug: paperSlug,
        isActive: input.isActive,
        downloadCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const [branches, semesters, subjects, siteUrl] = await Promise.all([
      getAllBranches(),
      getAllSemesters(),
      getAllSubjects(),
      getConfiguredSiteUrl(),
    ]);
    const parentBranch = branches.find((b) => b.id === input.branchId);
    const parentSem = semesters.find((s) => s.id === input.semesterId);
    const parentSubj = subjects.find((s) => s.id === input.subjectId);
    if (parentBranch && parentSem && parentSubj) {
      await upsertAutoSeoDescriptor(
        buildPaperSeoDefaults(
          parentBranch,
          parentSem,
          parentSubj,
          {
            id,
            title: input.title.trim(),
            examSession: input.examSession,
            examYear: yearNum,
            slug: paperSlug,
            isActive: input.isActive,
          },
          siteUrl
        )
      );
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deletePaperRecord(
  paperId: string,
  token?: string | null,
  storagePath?: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'papers', paperId));
    await deleteSeoMetadataIfPresent('paper', paperId);
    await deleteDoc(doc(db, 'paper_stats', paperId)).catch(() => {});

    if (storagePath) {
      const remaining = await getAllPapers();
      const stillInUse = remaining.some((p) => p.id !== paperId && p.pdfStoragePath === storagePath);
      if (!stillInUse) {
        if (storagePath.startsWith('/api/pdf-files/')) {
          await deleteCloudFileByPath(storagePath).catch(() => {});
        } else if (token && storagePath.startsWith('/api/files/')) {
          await fetch('/api/admin/files', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ filePath: storagePath }),
          }).catch(() => {});
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `papers/${paperId}`);
  }
}

export async function saveSubjectAcrossAllBranches(input: {
  semesterNumber: number;
  name: string;
  code: string;
  slug: string;
  description: string;
  isActive: boolean;
}): Promise<{ createdCount: number; skippedBranches: string[] }> {
  const cleanSlug = slugify(input.slug || input.name);
  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!cleanSlug || cleanSlug.length < 2) throw new Error('Subject slug must be at least 2 characters.');
  if (!cleanCode || cleanCode.length < 2) throw new Error('Valid subject code is required (alphanumeric).');

  const [branches, semesters, existingSubjects] = await Promise.all([
    getAllBranches(),
    getAllSemesters(),
    getAllSubjects(),
  ]);

  if (branches.length === 0) {
    throw new Error('No branches exist yet. Create or initialize branches first.');
  }

  let createdCount = 0;
  const skippedBranches: string[] = [];

  for (const branch of branches) {
    const sem = semesters.find(
      (s) => s.branchId === branch.id && s.semesterNumber === Number(input.semesterNumber)
    );
    if (!sem) {
      skippedBranches.push(`${branch.name} (no Semester ${input.semesterNumber})`);
      continue;
    }

    const alreadyExists = existingSubjects.some(
      (s) =>
        s.branchId === branch.id &&
        s.semesterId === sem.id &&
        (s.code.toUpperCase() === cleanCode || s.slug === cleanSlug)
    );
    if (alreadyExists) {
      skippedBranches.push(`${branch.name} (already exists)`);
      continue;
    }

    await saveSubject({
      branchId: branch.id,
      semesterId: sem.id,
      name: input.name,
      code: cleanCode,
      slug: cleanSlug,
      description: input.description,
      isActive: input.isActive,
    });
    createdCount++;
  }

  if (createdCount === 0) {
    throw new Error(
      `Could not create subject in any branch (${skippedBranches.join(', ') || 'no matching semesters'}).`
    );
  }

  return { createdCount, skippedBranches };
}

export async function savePaperAcrossAllBranches(input: {
  semesterNumber: number;
  subjectCode: string;
  subjectName: string;
  subjectSlug: string;
  subjectDescription: string;
  createMissingSubjects: boolean;
  title: string;
  examSession: ExamSession;
  examYear: number;
  pdfStoragePath: string;
  originalFilename: string;
  fileSize: number;
  isActive: boolean;
}): Promise<{ createdCount: number; createdSubjectsCount: number; skippedBranches: string[] }> {
  const cleanCode = input.subjectCode.trim().toUpperCase();
  const cleanSlug = slugify(input.subjectSlug || input.subjectName);

  const [branches, semesters, allSubjects, allPapers] = await Promise.all([
    getAllBranches(),
    getAllSemesters(),
    getAllSubjects(),
    getAllPapers(),
  ]);

  if (branches.length === 0) {
    throw new Error('No branches exist yet.');
  }

  let createdCount = 0;
  let createdSubjectsCount = 0;
  const skippedBranches: string[] = [];

  for (const branch of branches) {
    const sem = semesters.find(
      (s) => s.branchId === branch.id && s.semesterNumber === Number(input.semesterNumber)
    );
    if (!sem) {
      skippedBranches.push(`${branch.name} (no Semester ${input.semesterNumber})`);
      continue;
    }

    let targetSubject = allSubjects.find(
      (s) =>
        s.branchId === branch.id &&
        s.semesterId === sem.id &&
        (s.code.toUpperCase() === cleanCode || s.slug === cleanSlug)
    );

    if (!targetSubject) {
      if (!input.createMissingSubjects) {
        skippedBranches.push(`${branch.name} (subject ${cleanCode} not added)`);
        continue;
      }
      const newSubjId = await saveSubject({
        branchId: branch.id,
        semesterId: sem.id,
        name: input.subjectName,
        code: cleanCode,
        slug: cleanSlug,
        description: input.subjectDescription,
        isActive: input.isActive,
      });
      targetSubject = {
        id: newSubjId,
        branchId: branch.id,
        semesterId: sem.id,
        name: input.subjectName,
        code: cleanCode,
        slug: cleanSlug,
        description: input.subjectDescription,
        isActive: input.isActive,
      };
      createdSubjectsCount++;
    }

    const paperExists = allPapers.some(
      (p) =>
        p.subjectId === targetSubject!.id &&
        p.examSession === input.examSession &&
        p.examYear === Number(input.examYear)
    );
    if (paperExists) {
      skippedBranches.push(`${branch.name} (${input.examSession} ${input.examYear} already exists)`);
      continue;
    }

    await savePaper({
      subjectId: targetSubject.id,
      branchId: branch.id,
      semesterId: sem.id,
      title: input.title,
      examSession: input.examSession,
      examYear: input.examYear,
      pdfStoragePath: input.pdfStoragePath,
      originalFilename: input.originalFilename,
      fileSize: input.fileSize,
      isActive: input.isActive,
    });
    createdCount++;
  }

  if (createdCount === 0) {
    throw new Error(
      `Could not upload paper to any branch (${skippedBranches.join(', ') || 'no matching branch/subject'}).`
    );
  }

  return { createdCount, createdSubjectsCount, skippedBranches };
}

export async function saveAdvertisement(
  input: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || sanitizeId(`ad-${input.placement}-${Date.now().toString(36)}`);
  const path = `advertisements/${id}`;
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    adType: input.adType,
    placement: input.placement,
    isActive: input.isActive,
    displayOrder: Number(input.displayOrder) || 0,
    bannerSize: input.bannerSize?.trim() || '',
    adCode: input.adCode?.trim() || '',
    imageStoragePath: input.imageStoragePath?.trim() || '',
    destinationUrl: input.destinationUrl?.trim() || '',
    startDate: input.startDate || '',
    endDate: input.endDate || '',
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'advertisements', existingId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'advertisements', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAdvertisement(adId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'advertisements', adId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `advertisements/${adId}`);
  }
}

export async function saveBlogPost(
  input: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    authorName: string;
    coverImageUrl: string;
    coverImageAlt: string;
    relatedBranchId?: string;
    isActive: boolean;
    publishedAt?: string;
  },
  existingId?: string
): Promise<string> {
  const cleanTitle = input.title.trim();
  const cleanSlug = slugify(input.slug || cleanTitle);
  const cleanExcerpt = input.excerpt.trim();
  const cleanContent = input.content.trim();
  const cleanCategory = input.category.trim() || 'GTU Study Guide';
  const cleanAuthor = input.authorName.trim() || 'DiplomaToppers Editorial';

  if (cleanTitle.length < 3) throw new Error('Blog post title must be at least 3 characters.');
  if (cleanSlug.length < 2) throw new Error('Blog URL slug must be at least 2 characters.');
  if (cleanExcerpt.length < 10) throw new Error('Blog excerpt must be at least 10 characters.');
  if (cleanContent.length < 20) throw new Error('Blog article content must be at least 20 characters.');

  const all = await getAllBlogPosts();
  const duplicate = all.find((p) => p.id !== existingId && p.slug === cleanSlug);
  if (duplicate) {
    throw new Error(`A blog post with slug "${cleanSlug}" already exists.`);
  }

  const rand = Math.random().toString(36).slice(2, 6);
  const id = existingId || sanitizeId(`blog-${cleanSlug}-${Date.now().toString(36)}-${rand}`);
  const docPath = `blog_posts/${id}`;
  const publishedAtValue =
    input.publishedAt?.trim() || new Date().toISOString().split('T')[0];

  const payload = {
    title: cleanTitle.slice(0, 200),
    slug: cleanSlug.slice(0, 160),
    excerpt: cleanExcerpt.slice(0, 500),
    content: cleanContent.slice(0, 25000),
    category: cleanCategory.slice(0, 80),
    authorName: cleanAuthor.slice(0, 80),
    coverImageUrl: (input.coverImageUrl || '').trim().slice(0, 500),
    coverImageAlt: (input.coverImageAlt || cleanTitle).trim().slice(0, 300),
    relatedBranchId: (input.relatedBranchId || '').trim().slice(0, 128),
    publishedAt: publishedAtValue.slice(0, 40),
    isActive: Boolean(input.isActive),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'blog_posts', existingId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'blog_posts', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const [siteUrl, updatedPosts] = await Promise.all([
      getConfiguredSiteUrl(),
      getAllBlogPosts().catch(() => [] as BlogPost[]),
    ]);
    await upsertAutoSeoDescriptor(
      buildBlogPostSeoDefaults(
        {
          id,
          title: payload.title,
          slug: payload.slug,
          excerpt: payload.excerpt,
          content: payload.content,
          category: payload.category,
          coverImageAlt: payload.coverImageAlt,
          isActive: payload.isActive,
        },
        siteUrl
      )
    );
    await upsertAutoSeoDescriptor(
      buildBlogIndexSeoDefaults(
        siteUrl,
        undefined,
        updatedPosts.filter((p) => p.isActive).length
      )
    );
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, docPath);
  }
}

export async function deleteBlogPost(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'blog_posts', postId));
    await deleteSeoMetadataIfPresent('blog', postId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `blog_posts/${postId}`);
  }
}

export async function saveWebsiteSetting(settingKey: string, settingValue: string): Promise<void> {
  const cleanKey = sanitizeId(settingKey);
  try {
    await setDoc(doc(db, 'website_settings', cleanKey), {
      settingKey: cleanKey,
      settingValue,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `website_settings/${cleanKey}`);
  }
}
