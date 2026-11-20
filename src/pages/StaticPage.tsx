import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { RelatedContentSection } from '../components/RelatedContentSection';
import { SeoHead } from '../components/SeoHead';
import { SeoRichContentSection } from '../components/SeoRichContentSection';
import { useCatalog } from '../contexts/CatalogContext';
import { useResolvedSeo } from '../hooks/useResolvedSeo';
import { buildStaticSeoDefaults, STATIC_PUBLIC_PAGES } from '../services/seoDefaults';

export type StaticPageKind = 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer';

const KIND_TO_SEED_ID: Record<StaticPageKind, string> = {
  about: 'about',
  contact: 'contact',
  privacy: 'privacy-policy',
  terms: 'terms-and-conditions',
  disclaimer: 'disclaimer',
};

export function StaticPage({ kind }: { kind: StaticPageKind }) {
  const { settings } = useCatalog();
  const contactEmail = settings.contactEmail || 'support@diplomatoppers.in';

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const seedId = KIND_TO_SEED_ID[kind];
  const seed = useMemo(
    () => STATIC_PUBLIC_PAGES.find((s) => s.id === seedId) || STATIC_PUBLIC_PAGES[0],
    [seedId]
  );

  const descriptor = useMemo(
    () => buildStaticSeoDefaults(seed, settings.siteUrl, origin),
    [seed, settings.siteUrl, origin]
  );
  const resolvedSeo = useResolvedSeo(descriptor);

  const introParagraph = useMemo(() => {
    if (kind === 'about' && settings.aboutContent?.trim()) {
      return settings.aboutContent.trim();
    }
    if (kind === 'contact') {
      return `${resolvedSeo.mainIntro} Direct editorial email: ${contactEmail}.`;
    }
    return resolvedSeo.mainIntro;
  }, [kind, settings.aboutContent, resolvedSeo.mainIntro, contactEmail]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={resolvedSeo.seoTitle}
        description={resolvedSeo.metaDescription}
        path={seed.path}
        keywords={[resolvedSeo.focusKeyword, resolvedSeo.secondaryKeywords].filter(Boolean).join(', ')}
        faqs={resolvedSeo.faqs}
      />
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#202124] dark:text-white">
            {resolvedSeo.h1Heading}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#4B5563] dark:text-slate-300">
            {introParagraph}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
            <Link
              to="/"
              className="inline-flex min-h-[40px] items-center rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1]"
            >
              Return to Homepage
            </Link>
            <Link
              to="/blog"
              className="inline-flex min-h-[40px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-[#202124] hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              Explore GTU Study Blog
            </Link>
          </div>
        </div>

        <SeoRichContentSection seo={resolvedSeo} />
      </main>
      <RelatedContentSection pageType="static" />
      <Footer />
    </div>
  );
}
