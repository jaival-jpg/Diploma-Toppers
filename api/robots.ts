import fs from 'node:fs';
import path from 'node:path';

interface ServerlessReq {
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessRes {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  status?: (code: number) => { send: (body: string) => void };
  end?: (body: string) => void;
}

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

function sendPlainText(res: ServerlessRes, statusCode: number, body: string) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
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

  let base = normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL) || origin;

  try {
    if (!normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL)) {
      const cfg = loadFirebaseConfig();
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.firestoreDatabaseId}/documents:runQuery?key=${encodeURIComponent(cfg.apiKey)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const r = await fetch(firestoreUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'website_settings' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'settingKey' },
                  op: 'EQUAL',
                  value: { stringValue: 'siteUrl' },
                },
              },
              limit: 1,
            },
          }),
        });
        if (r.ok) {
          const rows = (await r.json()) as Array<{
            document?: { fields?: { settingValue?: { stringValue?: string } } };
          }>;
          const val = rows[0]?.document?.fields?.settingValue?.stringValue;
          const validConfigured = normalizeHttpOrigin(val);
          if (validConfigured) {
            base = validConfigured;
          }
        }
      } finally {
        clearTimeout(timer);
      }
    }
  } catch {
    // Always return valid robots.txt even if Firestore lookup fails
  }

  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/admin/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
  ].join('\n');

  sendPlainText(res, 200, content);
}
