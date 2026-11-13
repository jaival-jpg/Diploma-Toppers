import { useEffect } from 'react';
import { useCatalog } from '../contexts/CatalogContext';

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
  const { settings } = useCatalog();

  useEffect(() => {
    const baseOrigin =
      settings.siteUrl && settings.siteUrl.trim()
        ? settings.siteUrl.trim().replace(/\/+$/, '')
        : window.location.origin;
    const cleanPath = path === '/' ? '' : path;
    const canonicalUrl = `${baseOrigin}${cleanPath}`;

    document.title = title;

    const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    if (settings.googleVerification && settings.googleVerification.trim()) {
      setMeta(
        'meta[name="google-site-verification"]',
        'name',
        'google-site-verification',
        settings.googleVerification.trim()
      );
    }

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

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
          item: `${baseOrigin}${b.path === '/' ? '' : b.path}`,
        })),
      });
    }
    if (paperSchema) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'DigitalDocument',
        name: paperSchema.name,
        encodingFormat: 'application/pdf',
        url: canonicalUrl,
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
  }, [title, description, path, breadcrumbs, noindex, paperSchema, settings]);

  return null;
}
