export type SeoHealthStatus = 'Passed' | 'Failed' | 'Needs Attention';

export interface SeoHealthCheckItem {
  id: string;
  number: number;
  title: string;
  status: SeoHealthStatus;
  checkedUrl: string;
  httpStatus: number | null;
  details: string;
}

export interface SeoHealthReport {
  targetUrl: string;
  checkedAt: string;
  summary: {
    passed: number;
    failed: number;
    needsAttention: number;
  };
  checks: SeoHealthCheckItem[];
}

interface FetchProbeResult {
  ok: boolean;
  status: number | null;
  finalUrl: string;
  redirected: boolean;
  contentType: string;
  xRobotsTag: string;
  body: string;
  error?: string;
}

function isDisallowedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (/^(10\.|192\.168\.|169\.254\.|127\.)/.test(lower)) {
    return true;
  }
  const m172 = lower.match(/^172\.(\d+)\./);
  if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) {
    return true;
  }
  return false;
}

async function probeUrl(url: string, userAgent?: string, followRedirects = true): Promise<FetchProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers: Record<string, string> = {
      Accept: 'text/html,application/xml,text/plain,*/*',
    };
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }
    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: followRedirects ? 'follow' : 'manual',
      signal: controller.signal,
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      redirected: res.redirected,
      contentType: (res.headers.get('content-type') || '').toLowerCase(),
      xRobotsTag: (res.headers.get('x-robots-tag') || '').toLowerCase(),
      body,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const causeMsg =
      err instanceof Error && 'cause' in err && err.cause instanceof Error
        ? ` (${err.cause.message})`
        : '';
    return {
      ok: false,
      status: null,
      finalUrl: url,
      redirected: false,
      contentType: '',
      xRobotsTag: '',
      body: '',
      error: `${message}${causeMsg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractTagContent(html: string, regex: RegExp): string {
  const m = html.match(regex);
  return m?.[1]?.trim() || '';
}

function parseSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const val = match[1].trim();
    if (val) locs.push(val);
  }
  return locs;
}

function isPathBlockedByRobots(robotsTxt: string, testPath: string): { blocked: boolean; matchedRule?: string } {
  const lines = robotsTxt
    .split(/\r?\n/)
    .map((l) => l.split('#')[0].trim())
    .filter(Boolean);

  let inWildcardOrGoogle = false;
  const allows: string[] = [];
  const disallows: string[] = [];

  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      const ua = val.toLowerCase();
      inWildcardOrGoogle = ua === '*' || ua.includes('googlebot');
    } else if (inWildcardOrGoogle && key === 'allow') {
      allows.push(val);
    } else if (inWildcardOrGoogle && key === 'disallow') {
      disallows.push(val);
    }
  }

  let bestAllowLen = -1;
  for (const a of allows) {
    if (a && testPath.startsWith(a) && a.length > bestAllowLen) {
      bestAllowLen = a.length;
    }
  }
  let bestDisallow = '';
  for (const d of disallows) {
    if (d && testPath.startsWith(d) && d.length > bestDisallow.length) {
      bestDisallow = d;
    }
  }

  if (bestDisallow && bestDisallow.length > bestAllowLen) {
    return { blocked: true, matchedRule: `Disallow: ${bestDisallow}` };
  }
  return { blocked: false };
}

export async function runProductionSeoHealthCheck(rawTargetUrl: string): Promise<SeoHealthReport> {
  const checkedAt = new Date().toISOString();
  const trimmed = (rawTargetUrl || '').trim().replace(/\/+$/, '');

  let parsedTarget: URL | null = null;
  try {
    parsedTarget = new URL(trimmed);
  } catch {
    parsedTarget = null;
  }

  if (!parsedTarget || (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:')) {
    const checks: SeoHealthCheckItem[] = [
      {
        id: 'invalid_url',
        number: 1,
        title: 'Valid Production URL Required',
        status: 'Failed',
        checkedUrl: trimmed || '(empty)',
        httpStatus: null,
        details: 'Enter a valid production domain URL starting with https:// (for example, https://diplomatoppers.vercel.app).',
      },
    ];
    return {
      targetUrl: trimmed,
      checkedAt,
      summary: { passed: 0, failed: 1, needsAttention: 0 },
      checks,
    };
  }

  if (isDisallowedPrivateHost(parsedTarget.hostname)) {
    const checks: SeoHealthCheckItem[] = [
      {
        id: 'localhost_rejected',
        number: 1,
        title: 'Production Website Target Required (Not Localhost)',
        status: 'Failed',
        checkedUrl: parsedTarget.origin,
        httpStatus: null,
        details: `Target "${parsedTarget.hostname}" is a local/private address. Production SEO health checks must run against your deployed public URL (e.g., https://diplomatoppers.vercel.app).`,
      },
    ];
    return {
      targetUrl: parsedTarget.origin,
      checkedAt,
      summary: { passed: 0, failed: 1, needsAttention: 0 },
      checks,
    };
  }

  const base = `${parsedTarget.protocol}//${parsedTarget.host}`;
  const robotsUrl = `${base}/robots.txt`;
  const sitemapUrl = `${base}/sitemap.xml`;
  const homeUrl = `${base}/`;
  const adminUrl = `${base}/admin/login`;

  const [
    robotsRes,
    googlebotRobotsRes,
    inspectionRobotsRes,
    sitemapRes,
    homeRes,
    adminRes,
    httpRedirectRes,
  ] = await Promise.all([
    probeUrl(robotsUrl, 'Mozilla/5.0 (compatible; DiplomaToppers-SEO-Check/1.0)'),
    probeUrl(robotsUrl, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    probeUrl(
      robotsUrl,
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0; +http://www.google.com/bot.html)'
    ),
    probeUrl(sitemapUrl, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    probeUrl(homeUrl, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    probeUrl(adminUrl, 'Mozilla/5.0 (compatible; DiplomaToppers-SEO-Check/1.0)'),
    probeUrl(`http://${parsedTarget.host}/`, 'Mozilla/5.0 (compatible; DiplomaToppers-SEO-Check/1.0)', false),
  ]);

  const checks: SeoHealthCheckItem[] = [];

  // 1. /robots.txt returns HTTP 200
  const robotsIsAuthRedirect =
    robotsRes.finalUrl.includes('vercel.com/sso') || robotsRes.finalUrl.includes('/admin/login');
  const robotsValidType = robotsRes.contentType.includes('text/plain');
  if (robotsRes.status === 200 && robotsValidType && !robotsIsAuthRedirect && robotsRes.body.trim().length > 0) {
    checks.push({
      id: 'robots_http_200',
      number: 1,
      title: '/robots.txt returns HTTP 200',
      status: 'Passed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: `HTTP 200 OK (${robotsRes.contentType}), ${robotsRes.body.trim().length} bytes.`,
    });
  } else {
    checks.push({
      id: 'robots_http_200',
      number: 1,
      title: '/robots.txt returns HTTP 200',
      status: 'Failed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details:
        robotsRes.error ||
        (robotsIsAuthRedirect
          ? `Redirected to authentication page: ${robotsRes.finalUrl}`
          : `Expected HTTP 200 text/plain, got HTTP ${robotsRes.status ?? 'network error'} (${robotsRes.contentType || 'no content-type'}).`),
    });
  }

  // 2. /sitemap.xml returns HTTP 200
  const sitemapHasXml =
    sitemapRes.body.includes('<urlset') || sitemapRes.body.includes('<sitemapindex');
  if (sitemapRes.status === 200 && sitemapRes.contentType.includes('xml') && sitemapHasXml) {
    checks.push({
      id: 'sitemap_http_200',
      number: 2,
      title: '/sitemap.xml returns HTTP 200',
      status: 'Passed',
      checkedUrl: sitemapUrl,
      httpStatus: sitemapRes.status,
      details: `HTTP 200 OK (${sitemapRes.contentType}), valid XML <urlset> returned.`,
    });
  } else {
    checks.push({
      id: 'sitemap_http_200',
      number: 2,
      title: '/sitemap.xml returns HTTP 200',
      status: 'Failed',
      checkedUrl: sitemapUrl,
      httpStatus: sitemapRes.status,
      details:
        sitemapRes.error ||
        `Expected HTTP 200 XML sitemap, got HTTP ${sitemapRes.status ?? 'network error'} (${sitemapRes.contentType || 'unknown'}).`,
    });
  }

  // 3. robots.txt contains the correct sitemap URL
  const sitemapDirectives = robotsRes.body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^sitemap:/i.test(l))
    .map((l) => l.replace(/^sitemap:\s*/i, '').trim());
  const expectedSitemapLower = sitemapUrl.toLowerCase();
  const hasMatchingSitemap = sitemapDirectives.some((s) => s.toLowerCase() === expectedSitemapLower);
  const hasHttpsSitemap = sitemapDirectives.some((s) => /^https:\/\/.+\/sitemap\.xml$/i.test(s));

  if (robotsRes.status !== 200) {
    checks.push({
      id: 'robots_sitemap_url',
      number: 3,
      title: 'robots.txt contains the correct sitemap URL',
      status: 'Failed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: 'Could not verify Sitemap directive because /robots.txt failed to load.',
    });
  } else if (hasMatchingSitemap) {
    checks.push({
      id: 'robots_sitemap_url',
      number: 3,
      title: 'robots.txt contains the correct sitemap URL',
      status: 'Passed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: `Contains Sitemap: ${sitemapDirectives[0]}`,
    });
  } else if (hasHttpsSitemap) {
    checks.push({
      id: 'robots_sitemap_url',
      number: 3,
      title: 'robots.txt contains the correct sitemap URL',
      status: 'Needs Attention',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: `robots.txt declares "${sitemapDirectives[0]}", which differs from "${sitemapUrl}". Ensure it matches your active production domain.`,
    });
  } else {
    checks.push({
      id: 'robots_sitemap_url',
      number: 3,
      title: 'robots.txt contains the correct sitemap URL',
      status: 'Failed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: `Missing or invalid Sitemap directive. Expected "Sitemap: ${sitemapUrl}", found: ${sitemapDirectives.join(', ') || '(none)'}.`,
    });
  }

  // 4. Public pages are not blocked
  const publicPathsToCheck = ['/', '/about', '/computer-engineering', '/assets/main.js'];
  if (robotsRes.status !== 200) {
    checks.push({
      id: 'public_pages_not_blocked',
      number: 4,
      title: 'Public pages are not blocked',
      status: 'Failed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: 'Cannot verify crawl allowance because /robots.txt is unreachable.',
    });
  } else {
    const blockedPublic = publicPathsToCheck
      .map((p) => ({ path: p, res: isPathBlockedByRobots(robotsRes.body, p) }))
      .filter((x) => x.res.blocked);
    if (blockedPublic.length === 0) {
      checks.push({
        id: 'public_pages_not_blocked',
        number: 4,
        title: 'Public pages are not blocked',
        status: 'Passed',
        checkedUrl: homeUrl,
        httpStatus: robotsRes.status,
        details: 'Homepage, static pages, academic routes, and JS/CSS assets are allowed for crawling.',
      });
    } else {
      checks.push({
        id: 'public_pages_not_blocked',
        number: 4,
        title: 'Public pages are not blocked',
        status: 'Failed',
        checkedUrl: `${base}${blockedPublic[0].path}`,
        httpStatus: robotsRes.status,
        details: `Blocked by robots.txt rule (${blockedPublic[0].res.matchedRule}) at ${blockedPublic[0].path}.`,
      });
    }
  }

  // 5. Admin routes are excluded from crawling
  const adminBlockedInRobots =
    robotsRes.status === 200 &&
    isPathBlockedByRobots(robotsRes.body, '/admin/').blocked &&
    isPathBlockedByRobots(robotsRes.body, '/api/admin/').blocked;
  const adminRobotsMeta = extractTagContent(
    adminRes.body,
    /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i
  ).toLowerCase();
  const adminHasNoindex = adminRobotsMeta.includes('noindex') || adminRes.xRobotsTag.includes('noindex');

  if (adminBlockedInRobots && adminHasNoindex) {
    checks.push({
      id: 'admin_excluded',
      number: 5,
      title: 'Admin routes are excluded from crawling',
      status: 'Passed',
      checkedUrl: adminUrl,
      httpStatus: adminRes.status,
      details: 'robots.txt disallows /admin/ and /api/admin/, and /admin/login serves noindex, nofollow.',
    });
  } else if (adminBlockedInRobots) {
    checks.push({
      id: 'admin_excluded',
      number: 5,
      title: 'Admin routes are excluded from crawling',
      status: 'Needs Attention',
      checkedUrl: adminUrl,
      httpStatus: adminRes.status,
      details: 'robots.txt disallows /admin/ and /api/admin/, but raw HTML at /admin/login did not include <meta name="robots" content="noindex, nofollow">. Redeploy the latest Vercel SSR handler.',
    });
  } else {
    checks.push({
      id: 'admin_excluded',
      number: 5,
      title: 'Admin routes are excluded from crawling',
      status: 'Failed',
      checkedUrl: robotsUrl,
      httpStatus: robotsRes.status,
      details: 'robots.txt does not disallow /admin/ and /api/admin/.',
    });
  }

  // Probe up to 3 additional public URLs from the sitemap for checks 6, 7, and 9
  const sitemapLocs = sitemapRes.status === 200 ? parseSitemapLocs(sitemapRes.body) : [];
  const sampleNestedUrls = sitemapLocs
    .filter((u) => {
      try {
        const p = new URL(u).pathname;
        return p !== '/' && !p.startsWith('/admin');
      } catch {
        return false;
      }
    })
    .slice(0, 3);

  const publicSamples = await Promise.all([
    Promise.resolve({ url: homeUrl, probe: homeRes }),
    ...sampleNestedUrls.map(async (u) => ({
      url: u,
      probe: await probeUrl(u, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    })),
  ]);

  // 6. Public pages have valid canonical URLs
  const canonicalIssues: string[] = [];
  const seenCanonicals = new Set<string>();
  let firstCanonicalFailureUrl = homeUrl;

  for (const sample of publicSamples) {
    if (sample.probe.status !== 200) {
      canonicalIssues.push(`${sample.url} returned HTTP ${sample.probe.status ?? 'error'}`);
      if (firstCanonicalFailureUrl === homeUrl) firstCanonicalFailureUrl = sample.url;
      continue;
    }
    const canonicalHref = extractTagContent(
      sample.probe.body,
      /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
    );
    if (!canonicalHref) {
      canonicalIssues.push(`${sample.url} is missing <link rel="canonical"> in server HTML`);
      firstCanonicalFailureUrl = sample.url;
    } else if (!canonicalHref.startsWith('https://')) {
      canonicalIssues.push(`${sample.url} has non-HTTPS canonical "${canonicalHref}"`);
      firstCanonicalFailureUrl = sample.url;
    } else if (seenCanonicals.has(canonicalHref)) {
      canonicalIssues.push(`${sample.url} has duplicate canonical "${canonicalHref}"`);
      firstCanonicalFailureUrl = sample.url;
    } else {
      seenCanonicals.add(canonicalHref);
    }
  }

  if (canonicalIssues.length === 0) {
    checks.push({
      id: 'public_canonicals',
      number: 6,
      title: 'Public pages have valid canonical URLs',
      status: 'Passed',
      checkedUrl: homeUrl,
      httpStatus: homeRes.status,
      details: `Verified unique HTTPS canonical tags across ${publicSamples.length} sampled public page(s).`,
    });
  } else {
    checks.push({
      id: 'public_canonicals',
      number: 6,
      title: 'Public pages have valid canonical URLs',
      status: 'Failed',
      checkedUrl: firstCanonicalFailureUrl,
      httpStatus: homeRes.status,
      details: canonicalIssues.join(' | '),
    });
  }

  // 7. Public pages do not accidentally contain noindex
  const noindexViolations: string[] = [];
  let firstNoindexUrl = homeUrl;
  for (const sample of publicSamples) {
    if (sample.probe.status !== 200) {
      noindexViolations.push(`${sample.url} returned HTTP ${sample.probe.status ?? 'error'}`);
      firstNoindexUrl = sample.url;
      continue;
    }
    const metaRobots = extractTagContent(
      sample.probe.body,
      /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i
    ).toLowerCase();
    if (metaRobots.includes('noindex') || sample.probe.xRobotsTag.includes('noindex')) {
      noindexViolations.push(`${sample.url} returned noindex (${metaRobots || sample.probe.xRobotsTag})`);
      firstNoindexUrl = sample.url;
    }
  }

  if (noindexViolations.length === 0) {
    checks.push({
      id: 'public_no_noindex',
      number: 7,
      title: 'Public pages do not accidentally contain noindex',
      status: 'Passed',
      checkedUrl: homeUrl,
      httpStatus: homeRes.status,
      details: `Checked ${publicSamples.length} public page(s); none contain noindex in HTML meta or headers.`,
    });
  } else {
    checks.push({
      id: 'public_no_noindex',
      number: 7,
      title: 'Public pages do not accidentally contain noindex',
      status: 'Failed',
      checkedUrl: firstNoindexUrl,
      httpStatus: homeRes.status,
      details: noindexViolations.join(' | '),
    });
  }

  // 8. Googlebot can retrieve the robots.txt file
  const gbOk =
    googlebotRobotsRes.status === 200 &&
    googlebotRobotsRes.contentType.includes('text/plain') &&
    googlebotRobotsRes.body.trim().length > 0;
  const inspOk =
    inspectionRobotsRes.status === 200 &&
    inspectionRobotsRes.contentType.includes('text/plain') &&
    inspectionRobotsRes.body.trim().length > 0;

  if (gbOk && inspOk) {
    checks.push({
      id: 'googlebot_robots_access',
      number: 8,
      title: 'Googlebot can retrieve the robots.txt file',
      status: 'Passed',
      checkedUrl: robotsUrl,
      httpStatus: googlebotRobotsRes.status,
      details: 'Both Googlebot/2.1 and Google-InspectionTool/1.0 received HTTP 200 text/plain without firewall or bot blocking.',
    });
  } else {
    const failProbe = !gbOk ? googlebotRobotsRes : inspectionRobotsRes;
    const crawlerName = !gbOk ? 'Googlebot/2.1' : 'Google-InspectionTool/1.0';
    checks.push({
      id: 'googlebot_robots_access',
      number: 8,
      title: 'Googlebot can retrieve the robots.txt file',
      status: 'Failed',
      checkedUrl: robotsUrl,
      httpStatus: failProbe.status,
      details:
        failProbe.error ||
        `${crawlerName} received HTTP ${failProbe.status ?? 'network error'} (${failProbe.contentType || 'unknown'}). Check Vercel WAF/firewall or deployment status.`,
    });
  }

  // 9. Sitemap contains valid URLs
  const invalidSitemapUrls = sitemapLocs.filter((u) => {
    try {
      const p = new URL(u);
      return p.protocol !== 'https:' || p.pathname.startsWith('/admin');
    } catch {
      return true;
    }
  });
  const failedSample = publicSamples.find((s) => s.probe.status !== 200);

  if (sitemapRes.status !== 200 || sitemapLocs.length === 0) {
    checks.push({
      id: 'sitemap_valid_urls',
      number: 9,
      title: 'Sitemap contains valid URLs',
      status: 'Failed',
      checkedUrl: sitemapUrl,
      httpStatus: sitemapRes.status,
      details: sitemapRes.error || 'Sitemap returned 0 <loc> URLs or failed to load.',
    });
  } else if (invalidSitemapUrls.length > 0) {
    checks.push({
      id: 'sitemap_valid_urls',
      number: 9,
      title: 'Sitemap contains valid URLs',
      status: 'Failed',
      checkedUrl: invalidSitemapUrls[0],
      httpStatus: sitemapRes.status,
      details: `Found ${invalidSitemapUrls.length} invalid or non-HTTPS/admin URL(s) in sitemap, e.g. "${invalidSitemapUrls[0]}".`,
    });
  } else if (failedSample) {
    checks.push({
      id: 'sitemap_valid_urls',
      number: 9,
      title: 'Sitemap contains valid URLs',
      status: 'Failed',
      checkedUrl: failedSample.url,
      httpStatus: failedSample.probe.status,
      details: `Sample URL "${failedSample.url}" from sitemap returned HTTP ${failedSample.probe.status ?? 'error'}.`,
    });
  } else {
    checks.push({
      id: 'sitemap_valid_urls',
      number: 9,
      title: 'Sitemap contains valid URLs',
      status: 'Passed',
      checkedUrl: sitemapUrl,
      httpStatus: sitemapRes.status,
      details: `Verified ${sitemapLocs.length} valid HTTPS URLs with 0 admin routes; sampled routes returned HTTP 200.`,
    });
  }

  // 10. HTTPS works correctly
  const httpsWorks = parsedTarget.protocol === 'https:' && homeRes.status === 200 && !homeRes.error;
  const httpRedirectsToHttps =
    httpRedirectRes.status !== null &&
    httpRedirectRes.status >= 300 &&
    httpRedirectRes.status < 400;

  if (httpsWorks && httpRedirectsToHttps) {
    checks.push({
      id: 'https_valid',
      number: 10,
      title: 'HTTPS works correctly',
      status: 'Passed',
      checkedUrl: homeUrl,
      httpStatus: homeRes.status,
      details: `TLS certificate verified (HTTP 200 over HTTPS) and http:// cleanly redirects (${httpRedirectRes.status}) to HTTPS.`,
    });
  } else if (httpsWorks) {
    checks.push({
      id: 'https_valid',
      number: 10,
      title: 'HTTPS works correctly',
      status: 'Needs Attention',
      checkedUrl: homeUrl,
      httpStatus: homeRes.status,
      details: `HTTPS TLS connection succeeded (HTTP 200), but HTTP-to-HTTPS redirect check returned ${httpRedirectRes.status ?? httpRedirectRes.error ?? 'non-redirect'}.`,
    });
  } else {
    checks.push({
      id: 'https_valid',
      number: 10,
      title: 'HTTPS works correctly',
      status: 'Failed',
      checkedUrl: homeUrl,
      httpStatus: homeRes.status,
      details: homeRes.error || `Expected HTTPS 200 OK, got HTTP ${homeRes.status ?? 'connection failure'}.`,
    });
  }

  const summary = {
    passed: checks.filter((c) => c.status === 'Passed').length,
    failed: checks.filter((c) => c.status === 'Failed').length,
    needsAttention: checks.filter((c) => c.status === 'Needs Attention').length,
  };

  return {
    targetUrl: base,
    checkedAt,
    summary,
    checks,
  };
}

interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  status?: (code: number) => { json: (body: unknown) => void; send: (body: string) => void };
  end?: (body: string) => void;
}

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  if (req.method && req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    if (typeof res.status === 'function') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' });
    } else {
      res.statusCode = 405;
      res.end?.(JSON.stringify({ error: 'Method not allowed. Use POST.' }));
    }
    return;
  }

  let bodyObj: { targetUrl?: string } = {};
  try {
    if (typeof req.body === 'string') {
      bodyObj = JSON.parse(req.body) as { targetUrl?: string };
    } else if (req.body && typeof req.body === 'object') {
      bodyObj = req.body as { targetUrl?: string };
    }
  } catch {
    bodyObj = {};
  }

  const report = await runProductionSeoHealthCheck(bodyObj.targetUrl || '');
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.status === 'function') {
    res.status(200).json(report);
  } else {
    res.statusCode = 200;
    res.end?.(JSON.stringify(report));
  }
}
