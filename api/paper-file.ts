import fs from 'node:fs';
import path from 'node:path';

interface ServerlessReq {
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}

interface ServerlessRes {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  writeHead?: (code: number, headers?: Record<string, string>) => void;
  status?: (code: number) => {
    send: (body: unknown) => void;
    json: (body: unknown) => void;
  };
  end?: (body?: unknown) => void;
}

interface FirebaseWebConfig {
  projectId: string;
  firestoreDatabaseId: string;
  apiKey: string;
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
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

function getParam(req: ServerlessReq, key: string): string {
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === 'string') return fromQuery;
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0];
  if (req.url) {
    try {
      const u = new URL(req.url, 'https://diplomatoppers.vercel.app');
      return u.searchParams.get(key) || '';
    } catch {
      return '';
    }
  }
  return '';
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

function sendJson(res: ServerlessRes, statusCode: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function') {
    res.status(statusCode).json(data);
  } else {
    res.statusCode = statusCode;
    res.end?.(JSON.stringify(data));
  }
}

function sendHtml(res: ServerlessRes, statusCode: number, html: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (typeof res.status === 'function') {
    res.status(statusCode).send(html);
  } else {
    res.statusCode = statusCode;
    res.end?.(html);
  }
}

function sendBinary(
  res: ServerlessRes,
  statusCode: number,
  contentType: string,
  disposition: string,
  buffer: Buffer,
  cacheControl = 'public, max-age=3600, s-maxage=86400'
) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', cacheControl);
  if (typeof res.status === 'function') {
    res.status(statusCode).send(buffer);
  } else {
    res.statusCode = statusCode;
    res.end?.(buffer);
  }
}

async function firestoreGetDoc(
  cfg: FirebaseWebConfig,
  docPath: string
): Promise<Record<string, unknown> | null> {
  const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents`;
  const url = `${base}/${docPath}?key=${encodeURIComponent(cfg.apiKey)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const json = (await r.json()) as { name?: string; fields?: Record<string, FirestoreValue> };
  if (!json.fields) return null;
  return {
    id: json.name?.split('/').pop() || docPath.split('/').pop() || '',
    ...decodeFields(json.fields),
  };
}

async function fetchCloudFileBuffer(
  cfg: FirebaseWebConfig,
  fileId: string
): Promise<{ buffer: Buffer; contentType: string; originalFilename: string } | null> {
  const meta = await firestoreGetDoc(cfg, `paper_files/${encodeURIComponent(fileId)}`);
  if (!meta) return null;

  const chunkCount = Math.max(0, Number(meta.chunkCount || 0));
  if (chunkCount <= 0 || chunkCount > 60) return null;

  const chunkDocs = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => {
      const chunkId = `chunk-${String(i).padStart(4, '0')}`;
      return firestoreGetDoc(
        cfg,
        `paper_files/${encodeURIComponent(fileId)}/chunks/${encodeURIComponent(chunkId)}`
      );
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
}

async function incrementDownloadStatInFirestore(cfg: FirebaseWebConfig, paperId: string): Promise<void> {
  try {
    const docName = `projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents/paper_stats/${paperId}`;
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents:commit?key=${encodeURIComponent(cfg.apiKey)}`;
    await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: docName,
              fields: {
                paperId: { stringValue: paperId },
              },
            },
            updateMask: {
              fieldPaths: ['paperId'],
            },
            updateTransforms: [
              {
                fieldPath: 'downloadCount',
                increment: { integerValue: '1' },
              },
              {
                fieldPath: 'updatedAt',
                setToServerValue: 'REQUEST_TIME',
              },
            ],
          },
        ],
      }),
    });
  } catch {
    // Non-fatal counter error
  }
}

async function listPaperStats(cfg: FirebaseWebConfig): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents:runQuery?key=${encodeURIComponent(cfg.apiKey)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'paper_stats' }],
          limit: 1000,
        },
      }),
    });
    if (!r.ok) return counts;
    const rows = (await r.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreValue> };
    }>;
    for (const row of rows) {
      if (!row.document?.fields) continue;
      const id = row.document.name?.split('/').pop() || '';
      const decoded = decodeFields(row.document.fields);
      if (id && typeof decoded.downloadCount === 'number') {
        counts[id] = decoded.downloadCount;
      }
    }
  } catch {
    // Fallback cleanly
  }
  return counts;
}

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  const cfg = loadFirebaseConfig();
  const action = getParam(req, 'action');

  if (action === 'stats') {
    const counts = await listPaperStats(cfg);
    res.setHeader('Cache-Control', 'no-store');
    sendJson(res, 200, { counts });
    return;
  }

  if (action === 'file') {
    const fileId = getParam(req, 'fileId').trim();
    if (!fileId) {
      sendJson(res, 400, { error: 'Missing fileId parameter.' });
      return;
    }
    const file = await fetchCloudFileBuffer(cfg, fileId);
    if (!file) {
      sendJson(res, 404, { error: 'File not found in cloud storage.' });
      return;
    }
    sendBinary(
      res,
      200,
      file.contentType,
      `inline; filename="${file.originalFilename}"`,
      file.buffer,
      'public, max-age=86400, immutable'
    );
    return;
  }

  if (action === 'view' || action === 'download') {
    const paperId = getParam(req, 'paperId').trim();
    if (!paperId) {
      sendJson(res, 400, { error: 'Missing paperId parameter.' });
      return;
    }

    const paper = await firestoreGetDoc(cfg, `papers/${encodeURIComponent(paperId)}`);
    if (!paper) {
      if (action === 'view') {
        sendHtml(res, 404, '<h1>Paper Not Found</h1><p>The requested question paper record does not exist.</p>');
      } else {
        sendJson(res, 404, { error: 'Question paper not found.' });
      }
      return;
    }

    if (paper.isActive !== true) {
      if (action === 'view') {
        sendHtml(res, 403, '<h1>Paper Unavailable</h1><p>This question paper is currently inactive.</p>');
      } else {
        sendJson(res, 403, { error: 'Question paper is inactive.' });
      }
      return;
    }

    const storagePath = String(paper.pdfStoragePath || '');

    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      res.setHeader('Location', storagePath);
      if (typeof res.writeHead === 'function') {
        res.writeHead(302, { Location: storagePath });
        res.end?.();
      } else if (typeof res.status === 'function') {
        res.status(302).send('');
      }
      return;
    }

    if (!storagePath.startsWith('/api/pdf-files/')) {
      const msg =
        'This paper references a legacy local preview file that was not synced to cloud storage yet. Please re-upload its PDF in the Admin Panel.';
      if (action === 'view') {
        sendHtml(res, 404, `<h1>PDF Not Synced to Cloud</h1><p>${msg}</p>`);
      } else {
        sendJson(res, 404, { error: msg });
      }
      return;
    }

    const fileId = storagePath.slice('/api/pdf-files/'.length).trim();
    const file = await fetchCloudFileBuffer(cfg, fileId);
    if (!file) {
      if (action === 'view') {
        sendHtml(res, 404, '<h1>PDF Missing</h1><p>The uploaded PDF could not be located in cloud storage.</p>');
      } else {
        sendJson(res, 404, { error: 'PDF file is missing from cloud storage.' });
      }
      return;
    }

    if (action === 'view') {
      const cleanOrig = String(paper.originalFilename || file.originalFilename || 'GTU-Question-Paper.pdf').replace(
        /"/g,
        ''
      );
      sendBinary(res, 200, 'application/pdf', `inline; filename="${cleanOrig}"`, file.buffer);
      return;
    }

    const subject = paper.subjectId
      ? await firestoreGetDoc(cfg, `subjects/${encodeURIComponent(String(paper.subjectId))}`)
      : null;
    const code = String(subject?.code || 'GTU').replace(/[^a-zA-Z0-9-]/g, '');
    const session = String(paper.examSession || 'Exam').replace(/[^a-zA-Z]/g, '');
    const year = String(paper.examYear || '');
    const downloadName = `GTU-${code}-${session}-${year}.pdf`;

    await incrementDownloadStatInFirestore(cfg, paperId);
    sendBinary(
      res,
      200,
      'application/pdf',
      `attachment; filename="${downloadName}"`,
      file.buffer,
      'no-store'
    );
    return;
  }

  sendJson(res, 400, { error: 'Unsupported action.' });
}
