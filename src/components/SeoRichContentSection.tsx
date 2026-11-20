import { useState } from 'react';
import { BookOpen, ChevronDown, HelpCircle } from 'lucide-react';
import type { SeoMetadata } from '../types/academic';

interface SeoRichContentSectionProps {
  seo: SeoMetadata;
  showIntro?: boolean;
  compactTopBorder?: boolean;
}

export function SeoRichContentSection({
  seo,
  showIntro = false,
  compactTopBorder = true,
}: SeoRichContentSectionProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const paragraphs = seo.detailedContent
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const validFaqs = (seo.faqs || []).filter(
    (f) => f && f.question.trim() && f.answer.trim()
  );

  const h2List = (seo.h2Headings || []).map((h) => h.trim()).filter(Boolean);
  const h3List = (seo.h3Headings || []).map((h) => h.trim()).filter(Boolean);

  const hasAnyContent =
    (showIntro && Boolean(seo.mainIntro?.trim())) ||
    paragraphs.length > 0 ||
    h2List.length > 0 ||
    validFaqs.length > 0;

  if (!hasAnyContent) return null;

  return (
    <section
      aria-label="Academic Study Guide and Frequently Asked Questions"
      className={
        compactTopBorder
          ? 'mt-12 border-t border-slate-200 pt-10 dark:border-slate-800'
          : 'py-12 sm:py-16 border-t border-slate-100 dark:border-slate-800/80'
      }
    >
      <div className="space-y-8">
        {showIntro && seo.mainIntro?.trim() && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-base leading-relaxed text-[#202124] dark:text-slate-200">
              {seo.mainIntro}
            </p>
          </div>
        )}

        {(paragraphs.length > 0 || h2List.length > 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#1769D2] dark:text-blue-400">
              <BookOpen className="h-4 w-4" />
              <span>GTU Diploma Study Notes &amp; Exam Guide</span>
            </div>

            <div className="mt-4 space-y-6">
              {h2List.length > 0 ? (
                h2List.map((h2, idx) => {
                  const para = paragraphs[idx] || (idx === 0 && paragraphs.length === 0 ? seo.mainIntro : '');
                  const subH3 = h3List[idx];
                  return (
                    <div key={`${h2}-${idx}`} className="space-y-2.5">
                      <h2 className="text-xl font-bold tracking-tight text-[#202124] sm:text-2xl dark:text-white">
                        {h2}
                      </h2>
                      {para && (
                        <p className="text-sm leading-relaxed text-[#4B5563] sm:text-base dark:text-slate-300">
                          {para}
                        </p>
                      )}
                      {subH3 && (
                        <h3 className="pt-1 text-base font-bold text-[#202124] dark:text-slate-100">
                          {subH3}
                        </h3>
                      )}
                    </div>
                  );
                })
              ) : null}

              {/* Render any leftover paragraphs beyond h2 count, or all paragraphs when no h2Headings */}
              {paragraphs.slice(h2List.length).map((para, idx) => (
                <div key={`extra-${idx}`} className="space-y-2">
                  {h3List[h2List.length + idx] && (
                    <h3 className="text-base font-bold text-[#202124] dark:text-slate-100">
                      {h3List[h2List.length + idx]}
                    </h3>
                  )}
                  <p className="text-sm leading-relaxed text-[#4B5563] sm:text-base dark:text-slate-300">
                    {para}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {validFaqs.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#1769D2] dark:text-blue-400">
              <HelpCircle className="h-4 w-4" />
              <span>Frequently Asked Questions</span>
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-[#202124] sm:text-2xl dark:text-white">
              Common Student Questions
            </h2>

            <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {validFaqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={`${faq.question}-${idx}`} className="py-4">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="flex w-full items-start justify-between gap-4 text-left"
                    >
                      <h3 className="text-sm font-bold text-[#202124] sm:text-base dark:text-slate-100">
                        {faq.question}
                      </h3>
                      <ChevronDown
                        className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
                          isOpen ? 'rotate-180 text-[#1769D2]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-2.5 text-sm leading-relaxed text-[#4B5563] dark:text-slate-300">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
