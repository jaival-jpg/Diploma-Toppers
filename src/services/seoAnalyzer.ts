import type { SeoAnalyzerReport, SeoCheckItem, SeoMetadata } from '../types/academic';
import { normalizeHttpOrigin, type SeoPageDescriptor } from './seoDefaults';

export interface SeoAnalyzerInput {
  seo: Pick<
    SeoMetadata,
    | 'focusKeyword'
    | 'secondaryKeywords'
    | 'seoTitle'
    | 'metaDescription'
    | 'h1Heading'
    | 'h2Headings'
    | 'mainIntro'
    | 'detailedContent'
    | 'faqs'
    | 'imageAltText'
    | 'canonicalUrl'
  >;
  descriptor: SeoPageDescriptor;
  duplicateTitle: boolean;
  duplicateDescription: boolean;
}

function countWords(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function includesKeyword(haystack: string, keyword: string): boolean {
  const h = haystack.toLowerCase();
  const k = keyword.trim().toLowerCase();
  if (!k) return false;
  if (h.includes(k)) return true;
  const tokens = k
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => h.includes(t));
  return matched.length >= Math.max(2, Math.ceil(tokens.length * 0.65));
}

export function analyzePageSeo(input: SeoAnalyzerInput): SeoAnalyzerReport {
  const { seo, descriptor, duplicateTitle, duplicateDescription } = input;
  const title = seo.seoTitle.trim();
  const desc = seo.metaDescription.trim();
  const h1 = seo.h1Heading.trim();
  const intro = seo.mainIntro.trim();
  const detail = seo.detailedContent.trim();
  const fullContent = `${intro} ${detail}`.trim();
  const focusKw = seo.focusKeyword.trim();
  const canonical = seo.canonicalUrl.trim();
  const altText = seo.imageAltText.trim();
  const wordCount = countWords(fullContent);

  const keywordInTitle = Boolean(focusKw && includesKeyword(title, focusKw));
  const keywordInDescription = Boolean(focusKw && includesKeyword(desc, focusKw));
  const keywordInH1 = Boolean(focusKw && includesKeyword(h1, focusKw));
  const keywordInContent = Boolean(focusKw && includesKeyword(fullContent, focusKw));

  const checks: SeoCheckItem[] = [];

  // 1. Missing / length SEO Title
  if (!title) {
    checks.push({
      id: 'missing-title',
      label: 'SEO Title',
      status: 'fail',
      detail: 'SEO Title is missing. Add a clear, descriptive page title (30–65 characters recommended).',
    });
  } else if (title.length < 30 || title.length > 75) {
    checks.push({
      id: 'missing-title',
      label: 'SEO Title',
      status: 'warning',
      detail: `SEO Title is ${title.length} characters. Keep titles concise and descriptive (around 30–65 characters) so mobile results avoid truncation.`,
    });
  } else {
    checks.push({
      id: 'missing-title',
      label: 'SEO Title',
      status: 'pass',
      detail: `SEO Title is present (${title.length} characters).`,
    });
  }

  // 2. Missing / length Meta Description
  if (!desc) {
    checks.push({
      id: 'missing-description',
      label: 'Meta Description',
      status: 'fail',
      detail: 'Meta Description is missing. Summarize the page in 120–160 characters.',
    });
  } else if (desc.length < 90 || desc.length > 175) {
    checks.push({
      id: 'missing-description',
      label: 'Meta Description',
      status: 'warning',
      detail: `Meta Description is ${desc.length} characters. Aim for 120–160 characters for clear search snippets.`,
    });
  } else {
    checks.push({
      id: 'missing-description',
      label: 'Meta Description',
      status: 'pass',
      detail: `Meta Description is present (${desc.length} characters).`,
    });
  }

  // 3. Duplicate Title
  checks.push(
    duplicateTitle
      ? {
          id: 'duplicate-title',
          label: 'Unique SEO Title',
          status: 'fail',
          detail: 'Another public page uses this exact SEO Title. Customize it to avoid duplicate titles.',
        }
      : {
          id: 'duplicate-title',
          label: 'Unique SEO Title',
          status: 'pass',
          detail: 'SEO Title is unique across all catalog pages.',
        }
  );

  // 4. Duplicate Meta Description
  checks.push(
    duplicateDescription
      ? {
          id: 'duplicate-description',
          label: 'Unique Meta Description',
          status: 'fail',
          detail: 'Another public page shares this exact Meta Description. Write a unique summary for this page.',
        }
      : {
          id: 'duplicate-description',
          label: 'Unique Meta Description',
          status: 'pass',
          detail: 'Meta Description is unique across all catalog pages.',
        }
  );

  // 5. Missing H1 Heading
  checks.push(
    !h1
      ? {
          id: 'missing-h1',
          label: 'H1 Main Heading',
          status: 'fail',
          detail: 'H1 heading is missing. Every page should render one descriptive H1 heading.',
        }
      : {
          id: 'missing-h1',
          label: 'H1 Main Heading',
          status: 'pass',
          detail: 'Descriptive H1 heading is configured.',
        }
  );

  // 6. Content Depth Check
  if (wordCount === 0) {
    checks.push({
      id: 'missing-content',
      label: 'On-Page Content Depth',
      status: 'fail',
      detail: 'Main Introduction and Detailed Content are empty. Add useful academic guidance for students.',
    });
  } else if (wordCount < 75) {
    checks.push({
      id: 'missing-content',
      label: 'On-Page Content Depth',
      status: 'warning',
      detail: `Page content is ${wordCount} words. Expanding detailed study notes and H2/H3 sections above 100+ words improves helpfulness.`,
    });
  } else {
    checks.push({
      id: 'missing-content',
      label: 'On-Page Content Depth',
      status: 'pass',
      detail: `Rich on-page content configured (${wordCount} words across introduction and study guide).`,
    });
  }

  // 7. Focus Keyword Relevance
  if (!focusKw) {
    checks.push({
      id: 'keyword-relevance',
      label: 'Focus Keyword Relevance',
      status: 'warning',
      detail: 'No focus keyword set. Define the primary GTU student search query for this page.',
    });
  } else {
    const hits = [keywordInTitle, keywordInDescription, keywordInH1, keywordInContent].filter(Boolean).length;
    if (hits >= 3) {
      checks.push({
        id: 'keyword-relevance',
        label: 'Focus Keyword Relevance',
        status: 'pass',
        detail: `Focus keyword appears naturally in ${hits}/4 key elements (Title, Description, H1, Content).`,
      });
    } else if (hits >= 1) {
      checks.push({
        id: 'keyword-relevance',
        label: 'Focus Keyword Relevance',
        status: 'warning',
        detail: `Focus keyword matches ${hits}/4 key elements. Include it naturally in your Title, Description, H1, and Intro.`,
      });
    } else {
      checks.push({
        id: 'keyword-relevance',
        label: 'Focus Keyword Relevance',
        status: 'fail',
        detail: 'Focus keyword is not reflected in Title, Description, H1, or Content yet.',
      });
    }
  }

  // 8. Canonical URL
  checks.push(
    canonical && normalizeHttpOrigin(canonical)
      ? {
          id: 'canonical-url',
          label: 'Canonical URL',
          status: 'pass',
          detail: 'Valid HTTPS/HTTP canonical URL is set.',
        }
      : {
          id: 'canonical-url',
          label: 'Canonical URL',
          status: 'fail',
          detail: 'Canonical URL is missing or invalid. Enter a full https:// URL.',
        }
  );

  // 9. Image Alt Text
  checks.push(
    altText.length >= 6
      ? {
          id: 'image-alt',
          label: 'Image Alt Text',
          status: 'pass',
          detail: 'Descriptive image alt text is configured.',
        }
      : {
          id: 'image-alt',
          label: 'Image Alt Text',
          status: 'warning',
          detail: 'Image alt text is missing or too short. Add clear descriptive alt text.',
        }
  );

  // 10. Breadcrumbs
  checks.push(
    descriptor.hasBreadcrumbs || descriptor.pageType === 'home'
      ? {
          id: 'breadcrumbs',
          label: 'Breadcrumb Navigation',
          status: 'pass',
          detail:
            descriptor.pageType === 'home'
              ? 'Homepage root navigation is active.'
              : 'Hierarchical breadcrumbs (Home › Branch › Semester › Subject) render automatically.',
        }
      : {
          id: 'breadcrumbs',
          label: 'Breadcrumb Navigation',
          status: 'warning',
          detail: 'Breadcrumbs are not configured for this route.',
        }
  );

  // 11. Internal Links
  checks.push(
    descriptor.hasInternalLinks
      ? {
          id: 'internal-links',
          label: 'Internal Linking',
          status: 'pass',
          detail: 'Contextual related subjects, papers, branches, and footer links are rendered on this page.',
        }
      : {
          id: 'internal-links',
          label: 'Internal Linking',
          status: 'warning',
          detail: 'Internal links section is missing on this route.',
        }
  );

  // 12. Structured Data (Schema.org JSON-LD + FAQPage)
  const hasFaqs = Array.isArray(seo.faqs) && seo.faqs.some((f) => f.question.trim() && f.answer.trim());
  if (descriptor.hasStructuredData && hasFaqs) {
    checks.push({
      id: 'structured-data',
      label: 'Structured Data (JSON-LD)',
      status: 'pass',
      detail: 'Schema.org JSON-LD (BreadcrumbList / Document / Article + FAQPage) is active.',
    });
  } else if (descriptor.hasStructuredData) {
    checks.push({
      id: 'structured-data',
      label: 'Structured Data (JSON-LD)',
      status: 'warning',
      detail: 'Base Schema.org JSON-LD is active; add at least 1 FAQ pair to emit FAQPage schema.',
    });
  } else {
    checks.push({
      id: 'structured-data',
      label: 'Structured Data (JSON-LD)',
      status: 'fail',
      detail: 'Structured data markup is not configured for this page.',
    });
  }

  const passedCount = checks.filter((c) => c.status === 'pass').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const failedCount = checks.filter((c) => c.status === 'fail').length;

  return {
    passedCount,
    warningCount,
    failedCount,
    totalChecks: checks.length,
    wordCount,
    keywordInTitle,
    keywordInDescription,
    keywordInH1,
    keywordInContent,
    checks,
  };
}
