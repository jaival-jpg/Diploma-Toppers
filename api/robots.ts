import firebaseConfig from '../firebase-applet-config.json';

interface ServerlessReq {
  headers?: Record<string, string | string[] | undefined>;
}

interface ServerlessRes {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { send: (body: string) => void };
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

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  const hostHeader = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const protoHeader = req.headers?.['x-forwarded-proto'] || 'https';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || 'diplomatoppers.in';
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const origin = `${proto}://${host}`;

  let configuredOrigin: string | null = normalizeHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!configuredOrigin) {
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
      const r = await fetch(firestoreUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        configuredOrigin = normalizeHttpOrigin(val);
      }
    } catch {
      // Fallback to request origin
    }
  }

  const base = configuredOrigin || origin;
  const content = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/admin/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(content);
}
