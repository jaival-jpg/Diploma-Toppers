import { useEffect } from 'react';
import { useCatalog } from '../contexts/CatalogContext';
import { normalizeHttpOrigin, normalizePagePath, resolveSiteOrigin } from '../services/seoDefaults';

interface BreadcrumbEntry {
  name: string;
  path: string;
}

interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  breadcrumbs?: BreadcrumbEntry[];
  noindex?: boolean;
  paperSchema?: {
    name: string;
    datePublished?: string;
  };
}

export function SeoHead({
  title,
  description,
  path,
  breadcrumbs,
  noindex = false,
  paperSchema,
}: SeoHeadProps) {
  const { settings, seoMetadata } = useCatalog();

  useEffect(() => {
    const normalizedPath = normalizePagePath(path);
    const dbRecord = noindex
      ? undefined
      : seoMetadata.find((item) => normalizePagePath(item.pagePath) === normalizedPath);

    const baseOrigin = resolveSiteOrigin(settings.siteUrl, window.location.origin);
    const defaultCanonical =
      normalizedPath === '/' ? `${baseOrigin}/` : `${baseOrigin}${normalizedPath}`;

    const effectiveTitle = (dbRecord?.seoTitle && dbRecord.seoTitle.trim()) || title;
    const effectiveDescription =
      (dbRecord?.metaDescription && dbRecord.metaDescription.trim()) || description;
    const dbCanonical = dbRecord?.canonicalUrl?.trim();
    const effectiveCanonical =
      dbCanonical && normalizeHttpOrigin(dbCanonical) ? dbCanonical : defaultCanonical;
    const effectiveOgTitle =
      (dbRecord?.ogTitle && dbRecord.ogTitle.trim()) || effectiveTitle;
    const effectiveOgDescription =
      (dbRecord?.ogDescription && dbRecord.ogDescription.trim()) || effectiveDescription;
    const effectiveOgImage = (dbRecord?.ogImageUrl && dbRecord.ogImageUrl.trim()) || '';

    const robotsDirective = noindex
      ? 'noindex, nofollow'
      : dbRecord
      ? `${dbRecord.robotsIndex ? 'index' : 'noindex'}, ${dbRecord.robotsFollow ? 'follow' : 'nofollow'}`
      : 'index, follow';

    document.title = effectiveTitle;

    const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const removeMeta = (selector: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) el.remove();
    };

    setMeta('meta[name="description"]', 'name', 'description', effectiveDescription);
    setMeta('meta[property="og:title"]', 'property', 'og:title', effectiveOgTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', effectiveOgDescription);
    setMeta('meta[property="og:url"]', 'property', 'og:url', effectiveCanonical);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', effectiveOgTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', effectiveOgDescription);
    setMeta('meta[name="robots"]', 'name', 'robots', robotsDirective);

    if (effectiveOgImage) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', effectiveOgImage);
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', effectiveOgImage);
    } else {
      removeMeta('meta[property="og:image"]');
      removeMeta('meta[name="twitter:image"]');
    }

    const rawVerif = settings.googleVerification?.trim() || '';
    const verifMatch = rawVerif.match(/content=["']([^"']+)["']/i);
    const verifToken = (verifMatch?.[1] || rawVerif).trim();
    if (verifToken && /^[a-zA-Z0-9_-]{8,128}$/.test(verifToken)) {
      setMeta(
        'meta[name="google-site-verification"]',
        'name',
        'google-site-verification',
        verifToken
      );
    } else {
      removeMeta('meta[name="google-site-verification"]');
    }

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', effectiveCanonical);

    const existingDynamic = document.querySelectorAll('script[data-dt-jsonld="true"]');
    existingDynamic.forEach((node) => node.remove());

    const schemas: Array<Record<string, unknown>> = [];
    if (breadcrumbs && breadcrumbs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.name,
          item: b.path === '/' ? `${baseOrigin}/` : `${baseOrigin}${b.path}`,
        })),
      });
    }
    if (paperSchema) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'DigitalDocument',
        name: paperSchema.name,
        encodingFormat: 'application/pdf',
        url: effectiveCanonical,
        ...(paperSchema.datePublished ? { datePublished: paperSchema.datePublished } : {}),
      });
    }

    for (const schema of schemas) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-dt-jsonld', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [title, description, path, breadcrumbs, noindex, paperSchema, settings, seoMetadata]);

  return null;
}
