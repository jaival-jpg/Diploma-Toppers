import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { analyzePageSeo } from '../../services/seoAnalyzer';
import { resetSeoMetadataToDefault, saveSeoMetadata } from '../../services/firestoreCatalog';
import { mergeDescriptorWithSeo, type SeoPageDescriptor } from '../../services/seoDefaults';
import type { SeoFaqItem, SeoMetadata, SeoPageType, WebsiteSettingsMap } from '../../types/academic';

export const SEO_PAGE_TYPE_LABELS: Record<SeoPageType, string> = {
  home: 'Homepage',
  branch: 'Branch',
  semester: 'Semester',
  subject: 'Subject',
  paper: 'Paper',
  blog: 'Blog',
  static: 'Static Page',
};

interface SeoEditorPanelProps {
  descriptor: SeoPageDescriptor;
  storedSeo?: SeoMetadata;
  otherTitles: Set<string>;
  otherDescriptions: Set<string>;
  settings: WebsiteSettingsMap;
  onSaved: (message: string) => Promise<void> | void;
  onClose: () => void;
  asModal?: boolean;
}

export function SeoEditorPanel({
  descriptor,
  storedSeo,
  otherTitles,
  otherDescriptions,
  settings,
  onSaved,
  onClose,
  asModal = false,
}: SeoEditorPanelProps) {
  const initialMerged = useMemo(
    () => mergeDescriptorWithSeo(descriptor, storedSeo),
    [descriptor, storedSeo]
  );

  const [focusKeyword, setFocusKeyword] = useState(initialMerged.focusKeyword);
  const [secondaryKeywords, setSecondaryKeywords] = useState(initialMerged.secondaryKeywords);
  const [seoTitle, setSeoTitle] = useState(initialMerged.seoTitle);
  const [metaDescription, setMetaDescription] = useState(initialMerged.metaDescription);
  const [h1Heading, setH1Heading] = useState(initialMerged.h1Heading);
  const [h2Headings, setH2Headings] = useState<string[]>(initialMerged.h2Headings);
  const [h3Headings, setH3Headings] = useState<string[]>(initialMerged.h3Headings);
  const [mainIntro, setMainIntro] = useState(initialMerged.mainIntro);
  const [detailedContent, setDetailedContent] = useState(initialMerged.detailedContent);
  const [faqs, setFaqs] = useState<SeoFaqItem[]>(initialMerged.faqs);
  const [imageAltText, setImageAltText] = useState(initialMerged.imageAltText);
  const [canonicalUrl, setCanonicalUrl] = useState(initialMerged.canonicalUrl);
  const [ogTitle, setOgTitle] = useState(initialMerged.ogTitle);
  const [ogDescription, setOgDescription] = useState(initialMerged.ogDescription);
  const [ogImageUrl, setOgImageUrl] = useState(initialMerged.ogImageUrl);
  const [robotsIndex, setRobotsIndex] = useState<boolean>(initialMerged.robotsIndex);
  const [robotsFollow, setRobotsFollow] = useState<boolean>(initialMerged.robotsFollow);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const merged = mergeDescriptorWithSeo(descriptor, storedSeo);
    setFocusKeyword(merged.focusKeyword);
    setSecondaryKeywords(merged.secondaryKeywords);
    setSeoTitle(merged.seoTitle);
    setMetaDescription(merged.metaDescription);
    setH1Heading(merged.h1Heading);
    setH2Headings(merged.h2Headings);
    setH3Headings(merged.h3Headings);
    setMainIntro(merged.mainIntro);
    setDetailedContent(merged.detailedContent);
    setFaqs(merged.faqs);
    setImageAltText(merged.imageAltText);
    setCanonicalUrl(merged.canonicalUrl);
    setOgTitle(merged.ogTitle);
    setOgDescription(merged.ogDescription);
    setOgImageUrl(merged.ogImageUrl);
    setRobotsIndex(merged.robotsIndex);
    setRobotsFollow(merged.robotsFollow);
    setError(null);
  }, [descriptor, storedSeo]);

  const analyzerReport = useMemo(() => {
    const normTitle = seoTitle.trim().toLowerCase();
    const normDesc = metaDescription.trim().toLowerCase();
    return analyzePageSeo({
      seo: {
        focusKeyword,
        secondaryKeywords,
        seoTitle,
        metaDescription,
        h1Heading,
        h2Headings,
        mainIntro,
        detailedContent,
        faqs,
        imageAltText,
        canonicalUrl,
      },
      descriptor,
      duplicateTitle: Boolean(normTitle && otherTitles.has(normTitle)),
      duplicateDescription: Boolean(normDesc && otherDescriptions.has(normDesc)),
    });
  }, [
    focusKeyword,
    secondaryKeywords,
    seoTitle,
    metaDescription,
    h1Heading,
    h2Headings,
    mainIntro,
    detailedContent,
    faqs,
    imageAltText,
    canonicalUrl,
    descriptor,
    otherTitles,
    otherDescriptions,
  ]);

  const titleLen = seoTitle.trim().length;
  const descLen = metaDescription.trim().length;

  const previewUrlFormatted = useMemo(() => {
    const raw = (canonicalUrl || descriptor.defaultCanonical || 'https://diplomatoppers.vercel.app').trim();
    try {
      const parsed = new URL(raw);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts.length > 0 ? `${parsed.origin} › ${parts.join(' › ')}` : parsed.origin;
    } catch {
      return raw;
    }
  }, [canonicalUrl, descriptor]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!seoTitle.trim()) {
      setError('SEO Title is required.');
      return;
    }
    if (!metaDescription.trim()) {
      setError('Meta Description is required.');
      return;
    }

    setSaving(true);
    try {
      await saveSeoMetadata({
        pageType: descriptor.pageType,
        pageReferenceId: descriptor.pageReferenceId,
        pageName: descriptor.pageName,
        pagePath: descriptor.pagePath,
        focusKeyword,
        secondaryKeywords,
        seoTitle,
        metaDescription,
        h1Heading: h1Heading.trim() || descriptor.defaultH1Heading,
        h2Headings: h2Headings.map((h) => h.trim()).filter(Boolean),
        h3Headings: h3Headings.map((h) => h.trim()).filter(Boolean),
        mainIntro,
        detailedContent,
        faqs: faqs
          .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
          .filter((f) => f.question && f.answer),
        imageAltText,
        canonicalUrl: canonicalUrl.trim() || descriptor.defaultCanonical,
        ogTitle: ogTitle.trim() || seoTitle.trim(),
        ogDescription: ogDescription.trim() || metaDescription.trim(),
        ogImageUrl,
        robotsIndex,
        robotsFollow,
        isCustomized: true,
      });
      await onSaved(`Saved custom SEO & On-Page content for "${descriptor.pageName}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SEO settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setResetting(true);
    try {
      await resetSeoMetadataToDefault(descriptor);
      setFocusKeyword(descriptor.defaultFocusKeyword);
      setSecondaryKeywords(descriptor.defaultSecondaryKeywords);
      setSeoTitle(descriptor.defaultTitle);
      setMetaDescription(descriptor.defaultDescription);
      setH1Heading(descriptor.defaultH1Heading);
      setH2Headings(descriptor.defaultH2Headings);
      setH3Headings(descriptor.defaultH3Headings);
      setMainIntro(descriptor.defaultMainIntro);
      setDetailedContent(descriptor.defaultDetailedContent);
      setFaqs(descriptor.defaultFaqs);
      setImageAltText(descriptor.defaultImageAltText);
      setCanonicalUrl(descriptor.defaultCanonical);
      setOgTitle(descriptor.defaultTitle);
      setOgDescription(descriptor.defaultDescription);
      setOgImageUrl('');
      setRobotsIndex(descriptor.isPublished);
      setRobotsFollow(descriptor.isPublished);
      await onSaved(`Reset SEO & content for "${descriptor.pageName}" to auto-generated defaults.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset SEO metadata.');
    } finally {
      setResetting(false);
    }
  };

  const panelContent = (
    <div className="rounded-2xl border-2 border-[#1769D2]/30 bg-white p-5 sm:p-6 shadow-sm dark:border-blue-500/30 dark:bg-slate-900">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="text-xs font-semibold text-[#1769D2] dark:text-blue-400">
            On-Page SEO &amp; Content Editor · {SEO_PAGE_TYPE_LABELS[descriptor.pageType]} · {descriptor.pagePath}
          </div>
          <h3 className="mt-0.5 text-lg font-bold text-[#202124] dark:text-white">
            {descriptor.pageName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close SEO editor"
          className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!descriptor.isPublished && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This page is currently inactive/unpublished. Unpublished pages are automatically excluded from sitemap.xml and set to noindex until published.
          </span>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Form: All 16 Fields */}
        <form onSubmit={(e) => void handleSave(e)} className="space-y-5 lg:col-span-7">
          {/* Keywords (Fields 1 & 2) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="text-xs font-bold uppercase tracking-wide text-[#1769D2] dark:text-blue-400">
              Target Keywords
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="seo-focus-kw" className="mb-1 block text-xs font-semibold">
                  1. Focus Keyword
                </label>
                <input
                  id="seo-focus-kw"
                  type="text"
                  maxLength={200}
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g., GTU diploma sem 3 computer engineering DBMS question papers"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label htmlFor="seo-secondary-kw" className="mb-1 block text-xs font-semibold">
                  2. Secondary Keywords
                </label>
                <input
                  id="seo-secondary-kw"
                  type="text"
                  maxLength={400}
                  value={secondaryKeywords}
                  onChange={(e) => setSecondaryKeywords(e.target.value)}
                  placeholder="Comma-separated related GTU queries"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          {/* Search Snippet (Fields 3 & 4) */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                <label htmlFor="seo-title-input">3. SEO Title</label>
                <span
                  className={`tabular-nums ${
                    titleLen >= 30 && titleLen <= 65
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : titleLen > 65
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[#666666] dark:text-slate-400'
                  }`}
                >
                  {titleLen} chars (30–65 recommended)
                </span>
              </div>
              <input
                id="seo-title-input"
                type="text"
                required
                maxLength={200}
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                <label htmlFor="seo-desc-input">4. Meta Description</label>
                <span
                  className={`tabular-nums ${
                    descLen >= 120 && descLen <= 160
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : descLen > 160
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[#666666] dark:text-slate-400'
                  }`}
                >
                  {descLen} chars (120–160 recommended)
                </span>
              </div>
              <textarea
                id="seo-desc-input"
                rows={3}
                required
                maxLength={400}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          {/* Headings & Structured Content (Fields 5, 6, 7, 8, 9) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="text-xs font-bold uppercase tracking-wide text-[#1769D2] dark:text-blue-400">
              Visible Page Headings &amp; Study Content
            </div>

            <div>
              <label htmlFor="seo-h1-input" className="mb-1 block text-xs font-semibold">
                5. H1 Main Heading
              </label>
              <input
                id="seo-h1-input"
                type="text"
                maxLength={220}
                value={h1Heading}
                onChange={(e) => setH1Heading(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            {/* 6. H2 Headings */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold">6. H2 Section Headings ({h2Headings.length})</label>
                <button
                  type="button"
                  onClick={() => setH2Headings((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1769D2] hover:border-[#1769D2] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add H2</span>
                </button>
              </div>
              <div className="space-y-2">
                {h2Headings.map((h2, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={200}
                      value={h2}
                      onChange={(e) => {
                        const val = e.target.value;
                        setH2Headings((prev) => prev.map((item, i) => (i === idx ? val : item)));
                      }}
                      placeholder={`H2 heading #${idx + 1}`}
                      className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => setH2Headings((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove H2 heading ${idx + 1}`}
                      className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. H3 Headings */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold">7. H3 Subheadings ({h3Headings.length})</label>
                <button
                  type="button"
                  onClick={() => setH3Headings((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1769D2] hover:border-[#1769D2] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add H3</span>
                </button>
              </div>
              <div className="space-y-2">
                {h3Headings.map((h3, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={200}
                      value={h3}
                      onChange={(e) => {
                        const val = e.target.value;
                        setH3Headings((prev) => prev.map((item, i) => (i === idx ? val : item)));
                      }}
                      placeholder={`H3 subheading #${idx + 1}`}
                      className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => setH3Headings((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove H3 subheading ${idx + 1}`}
                      className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Main Introduction */}
            <div>
              <label htmlFor="seo-main-intro" className="mb-1 block text-xs font-semibold">
                8. Main Page Introduction
              </label>
              <textarea
                id="seo-main-intro"
                rows={2}
                maxLength={1200}
                value={mainIntro}
                onChange={(e) => setMainIntro(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            {/* 9. Detailed Content */}
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                <label htmlFor="seo-detailed-content">
                  9. Detailed Page Content (use blank line between sections)
                </label>
                <span className="tabular-nums text-[#666666] dark:text-slate-400">
                  {analyzerReport.wordCount} total words
                </span>
              </div>
              <textarea
                id="seo-detailed-content"
                rows={5}
                maxLength={12000}
                value={detailedContent}
                onChange={(e) => setDetailedContent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          {/* 10. FAQ Questions & Answers */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide text-[#1769D2] dark:text-blue-400">
                10. FAQ Questions &amp; Answers ({faqs.length})
              </div>
              <button
                type="button"
                disabled={faqs.length >= 15}
                onClick={() => setFaqs((prev) => [...prev, { question: '', answer: '' }])}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1769D2] hover:border-[#1769D2] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
              >
                <Plus className="h-3 w-3" />
                <span>Add FAQ</span>
              </button>
            </div>
            {faqs.length === 0 ? (
              <p className="text-xs text-[#666666] dark:text-slate-400">
                No FAQs added. Adding 2–3 helpful student Q&amp;As emits Schema.org FAQPage markup.
              </p>
            ) : (
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#666666] dark:text-slate-400">
                        FAQ #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={300}
                      value={faq.question}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFaqs((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, question: val } : item))
                        );
                      }}
                      placeholder="Question..."
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                    />
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={faq.answer}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFaqs((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, answer: val } : item))
                        );
                      }}
                      placeholder="Clear, accurate answer..."
                      className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Technical, Alt Text, Open Graph & Robots (Fields 11-16) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="seo-img-alt" className="mb-1 block text-xs font-semibold">
                11. Image Alt Text
              </label>
              <input
                id="seo-img-alt"
                type="text"
                maxLength={300}
                value={imageAltText}
                onChange={(e) => setImageAltText(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="seo-canonical-input" className="mb-1 block text-xs font-semibold">
                12. Canonical URL
              </label>
              <input
                id="seo-canonical-input"
                type="url"
                maxLength={500}
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="seo-og-title" className="mb-1 block text-xs font-semibold">
                13. Open Graph Title
              </label>
              <input
                id="seo-og-title"
                type="text"
                maxLength={200}
                value={ogTitle}
                onChange={(e) => setOgTitle(e.target.value)}
                placeholder="Defaults to SEO Title"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="seo-og-image" className="mb-1 block text-xs font-semibold">
                Open Graph Image URL
              </label>
              <input
                id="seo-og-image"
                type="url"
                maxLength={500}
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                placeholder="https://.../banner.jpg"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label htmlFor="seo-og-desc" className="mb-1 block text-xs font-semibold">
              14. Open Graph Description
            </label>
            <textarea
              id="seo-og-desc"
              rows={2}
              maxLength={400}
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
              placeholder="Defaults to Meta Description"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="seo-index-select" className="mb-1 block text-xs font-semibold">
                15. Indexing Directive (Index / Noindex)
              </label>
              <select
                id="seo-index-select"
                value={robotsIndex ? 'index' : 'noindex'}
                onChange={(e) => setRobotsIndex(e.target.value === 'index')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="index">Index (Allow search indexing)</option>
                <option value="noindex">Noindex (Hide from Google &amp; sitemap)</option>
              </select>
            </div>

            <div>
              <label htmlFor="seo-follow-select" className="mb-1 block text-xs font-semibold">
                16. Link Following Directive (Follow / Nofollow)
              </label>
              <select
                id="seo-follow-select"
                value={robotsFollow ? 'follow' : 'nofollow'}
                onChange={(e) => setRobotsFollow(e.target.value === 'follow')}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="follow">Follow (Crawl internal links)</option>
                <option value="nofollow">Nofollow (Do not follow links)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save SEO &amp; Content</span>
            </button>
            <button
              type="button"
              disabled={resetting}
              onClick={() => void handleReset()}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#202124] hover:border-[#1769D2] hover:text-[#1769D2] disabled:opacity-60 dark:border-slate-700 dark:text-slate-100"
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              <span>Reset to Auto Default</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Right Column: Live Mobile Google Preview + Live On-Page SEO Analyzer */}
        <div className="space-y-6 lg:col-span-5">
          {/* Mobile Google Search Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#666666] dark:text-slate-400">
                Mobile Google Search Preview
              </h4>
              <span className="text-[11px] font-semibold text-[#1769D2] dark:text-blue-400">
                Live Preview
              </span>
            </div>

            <div className="mx-auto max-w-[390px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#1f1f1f]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1769D2] text-[11px] font-extrabold text-white">
                  DT
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-[#202124] dark:text-[#dadce0]">
                    {settings.siteTitle?.trim() || 'DiplomaToppers'}
                  </div>
                  <div className="truncate text-[11px] text-[#4d5156] dark:text-[#bdc1c6]">
                    {previewUrlFormatted}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 line-clamp-2 text-[18px] leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
                {seoTitle.trim() || descriptor.defaultTitle}
              </div>

              <div className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
                {metaDescription.trim() || descriptor.defaultDescription}
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[#666666] dark:text-slate-400">
              Preview approximates a mobile snippet and is not guaranteed; search engines may rewrite titles or snippets dynamically.
            </p>
          </div>

          {/* On-Page SEO Readiness Analyzer */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#202124] dark:text-white">
                  <Sparkles className="h-3.5 w-3.5 text-[#1769D2]" />
                  <span>On-Page SEO Readiness Analyzer</span>
                </div>
                <p className="mt-1 text-[11px] text-[#666666] dark:text-slate-400">
                  Technical &amp; content completeness checklist (does not predict search rankings).
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <div className="text-base font-extrabold text-[#1769D2] dark:text-blue-400">
                  {analyzerReport.passedCount}/{analyzerReport.totalChecks}
                </div>
                <div className="text-[10px] font-semibold text-[#666666] dark:text-slate-400">
                  Checks Passed
                </div>
              </div>
            </div>

            {/* Keyword Placement Summary */}
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              {[
                { label: 'Title', hit: analyzerReport.keywordInTitle },
                { label: 'Desc', hit: analyzerReport.keywordInDescription },
                { label: 'H1', hit: analyzerReport.keywordInH1 },
                { label: 'Body', hit: analyzerReport.keywordInContent },
              ].map((kw) => (
                <div
                  key={kw.label}
                  className={`rounded-lg border px-2 py-1.5 font-semibold ${
                    kw.hit
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {kw.label}: {kw.hit ? 'Matched' : 'Miss'}
                </div>
              ))}
            </div>

            {/* 12-Item Diagnostic Checklist */}
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {analyzerReport.checks.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  {item.status === 'pass' && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {item.status === 'warning' && (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  {item.status === 'fail' && (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-[#202124] dark:text-white">{item.label}</div>
                    <div className="mt-0.5 leading-relaxed text-[#666666] dark:text-slate-400">
                      {item.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!asModal) return panelContent;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit SEO for ${descriptor.pageName}`}
    >
      <div className="mx-auto max-w-6xl">{panelContent}</div>
    </div>
  );
}
