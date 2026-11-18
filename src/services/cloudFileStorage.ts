import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { sanitizeId } from '../utils/slugify';

const CHUNK_RAW_BYTES = 480 * 1024; // ~640 KB base64 per chunk (< 1 MiB Firestore limit)
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
export const VERCEL_SAFE_DIRECT_BYTES = 3.8 * 1024 * 1024;

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 12);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const sliceSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += sliceSize) {
    const slice = bytes.subarray(i, Math.min(i + sliceSize, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function uploadChunkedBinary(
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; fileId: string; originalFilename: string; fileSize: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const totalChunks = Math.max(1, Math.ceil(bytes.length / CHUNK_RAW_BYTES));
  const prefix = contentType === 'application/pdf' ? 'pdf' : 'img';
  const fileId = sanitizeId(`${prefix}-${Date.now().toString(36)}-${randomSuffix()}`);
  const safeFilename = (file.name || 'document.pdf').trim().slice(0, 255) || 'document.pdf';

  onProgress?.(5);

  try {
    await setDoc(doc(db, 'paper_files', fileId), {
      originalFilename: safeFilename,
      contentType,
      fileSize: bytes.length,
      chunkCount: totalChunks,
      createdAt: serverTimestamp(),
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_RAW_BYTES;
      const end = Math.min(start + CHUNK_RAW_BYTES, bytes.length);
      const chunkBase64 = uint8ArrayToBase64(bytes.subarray(start, end));
      const chunkId = `chunk-${String(i).padStart(4, '0')}`;
      await setDoc(doc(db, 'paper_files', fileId, 'chunks', chunkId), {
        index: i,
        dataBase64: chunkBase64,
      });
      const pct = Math.min(99, Math.max(10, Math.round(((i + 1) / totalChunks) * 95) + 5));
      onProgress?.(pct);
    }

    onProgress?.(100);
    return {
      storagePath: `/api/pdf-files/${fileId}`,
      fileId,
      originalFilename: safeFilename,
      fileSize: bytes.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `paper_files/${fileId}`);
  }
}

export async function uploadPdfToCloud(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ pdfStoragePath: string; originalFilename: string; fileSize: number }> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files (.pdf) are allowed.');
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    throw new Error('PDF file size must be greater than 0 and under 25 MB.');
  }

  const headerText = await file.slice(0, 5).text();
  if (headerText !== '%PDF-') {
    throw new Error('Invalid file content. Please select a genuine PDF document.');
  }

  const res = await uploadChunkedBinary(file, 'application/pdf', onProgress);
  return {
    pdfStoragePath: res.storagePath,
    originalFilename: res.originalFilename,
    fileSize: res.fileSize,
  };
}

export async function uploadBannerToCloud(
  file: File
): Promise<{ imageStoragePath: string; originalFilename: string; fileSize: number }> {
  const allowedTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ]);
  if (!allowedTypes.has(file.type)) {
    throw new Error('Invalid image type. Please upload PNG, JPG, WEBP, or GIF.');
  }
  if (file.size <= 0 || file.size > MAX_BANNER_BYTES) {
    throw new Error('Banner image size must be greater than 0 and under 5 MB.');
  }

  const res = await uploadChunkedBinary(file, file.type);
  return {
    imageStoragePath: res.storagePath,
    originalFilename: res.originalFilename,
    fileSize: res.fileSize,
  };
}

export function extractCloudFileId(storagePath?: string): string | null {
  if (!storagePath || !storagePath.startsWith('/api/pdf-files/')) return null;
  const id = storagePath.slice('/api/pdf-files/'.length).trim();
  return id || null;
}

export async function deleteCloudFileByPath(storagePath?: string): Promise<void> {
  const fileId = extractCloudFileId(storagePath);
  if (!fileId) return;

  try {
    const metaSnap = await getDoc(doc(db, 'paper_files', fileId));
    if (metaSnap.exists()) {
      const chunkCount = Math.max(0, Number((metaSnap.data() as { chunkCount?: number }).chunkCount || 0));
      for (let i = 0; i < chunkCount; i++) {
        const chunkId = `chunk-${String(i).padStart(4, '0')}`;
        await deleteDoc(doc(db, 'paper_files', fileId, 'chunks', chunkId)).catch(() => {});
      }
      await deleteDoc(doc(db, 'paper_files', fileId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `paper_files/${fileId}`);
  }
}

export async function recordPaperDownloadInCloud(paperId: string): Promise<void> {
  if (!paperId) return;
  try {
    const statRef = doc(db, 'paper_stats', paperId);
    const snap = await getDoc(statRef);
    const current = snap.exists() ? Number((snap.data() as { downloadCount?: number }).downloadCount || 0) : 0;
    await setDoc(statRef, {
      paperId,
      downloadCount: current + 1,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal analytics update
  }
}

export async function fetchCloudPdfBlob(storagePath: string): Promise<{ blob: Blob; filename: string }> {
  const fileId = extractCloudFileId(storagePath);
  if (!fileId) {
    throw new Error('This paper is not stored in cloud storage.');
  }

  try {
    const metaSnap = await getDoc(doc(db, 'paper_files', fileId));
    if (!metaSnap.exists()) {
      throw new Error('PDF file metadata was not found in cloud storage.');
    }
    const meta = metaSnap.data() as {
      originalFilename?: string;
      contentType?: string;
      chunkCount?: number;
    };
    const chunkCount = Math.max(0, Number(meta.chunkCount || 0));
    if (chunkCount <= 0) {
      throw new Error('PDF file data chunks are missing.');
    }

    const chunkSnaps = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) => {
        const chunkId = `chunk-${String(i).padStart(4, '0')}`;
        return getDoc(doc(db, 'paper_files', fileId, 'chunks', chunkId));
      })
    );

    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (const snap of chunkSnaps) {
      if (!snap.exists()) {
        throw new Error('One or more PDF file chunks are missing.');
      }
      const data = snap.data() as { dataBase64?: string };
      if (!data.dataBase64) {
        throw new Error('Corrupt PDF chunk encountered.');
      }
      parts.push(base64ToUint8Array(data.dataBase64));
    }

    const blob = new Blob(parts, { type: meta.contentType || 'application/pdf' });
    return {
      blob,
      filename: meta.originalFilename || 'GTU-Question-Paper.pdf',
    };
  } catch (error) {
    if (error instanceof Error && !error.message.includes('permission')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, `paper_files/${fileId}`);
  }
}

export async function openLargeCloudPdfInBrowser(
  paperId: string,
  storagePath: string,
  downloadFilename: string,
  mode: 'view' | 'download'
): Promise<void> {
  const { blob } = await fetchCloudPdfBlob(storagePath);
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  if (mode === 'download') {
    anchor.download = downloadFilename;
    await recordPaperDownloadInCloud(paperId);
  } else {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
