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
  Branch,
  ExamSession,
  Paper,
  Semester,
  Subject,
  WebsiteSettingsMap,
} from '../types/academic';
import { sanitizeId, slugify } from '../utils/slugify';

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

    return { createdBranches, createdSemesters };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'branches');
  }
}

// ---- Download Count Merge Helper ----
export async function fetchServerDownloadStats(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/stats/downloads');
    if (!res.ok) return {};
    const json = (await res.json()) as { counts?: Record<string, number> };
    return json.counts || {};
  } catch {
    return {};
  }
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

// ---- Admin Mutations (CRUD + Validation + Safe Deletion) ----

export async function saveBranch(
  input: { name: string; code: string; slug: string; description: string; isActive: boolean; displayOrder: number },
  existingId?: string
): Promise<string> {
  const cleanSlug = slugify(input.slug || input.name);
  const cleanCode = input.code.trim().toUpperCase();
  if (!cleanSlug || cleanSlug.length < 2) throw new Error('Branch slug must be at least 2 characters.');
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

  const id = existingId || sanitizeId(`subj-${cleanCode}-${Date.now().toString(36)}`);
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
  const id = existingId || sanitizeId(`paper-${input.subjectId}-${paperSlug}-${Date.now().toString(36)}`);
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
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deletePaperRecord(paperId: string, token: string, storagePath?: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'papers', paperId));
    if (storagePath && storagePath.startsWith('/api/files/')) {
      await fetch('/api/admin/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filePath: storagePath }),
      }).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `papers/${paperId}`);
  }
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
