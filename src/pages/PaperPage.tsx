import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, Download, ExternalLink, FileText, Share2 } from 'lucide-react';
import { AdSlot } from '../components/AdSlot';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { RelatedContentSection } from '../components/RelatedContentSection';
import { SeoHead } from '../components/SeoHead';
import { SeoRichContentSection } from '../components/SeoRichContentSection';
import { useCatalog } from '../contexts/CatalogContext';
import { useResolvedSeo } from '../hooks/useResolvedSeo';
import { openLargeCloudPdfInBrowser, VERCEL_SAFE_DIRECT_BYTES } from '../services/cloudFileStorage';
import { buildPaperSeoDefaults } from '../services/seoDefaults';
import { buildPaperDownloadFilename, formatFileSize } from '../utils/slugify';
import { NotFoundPage } from './NotFoundPage';

export function PaperPage() {
  const { branchSlug, semSlug, subjectSlug, paperSlug } = useParams<{
    branchSlug: string;
    semSlug: string;
    subjectSlug: string;
    paperSlug: string;
  }>();
  const { branches, semesters, subjects, papers, settings, loading, refresh } = useCatalog();
  const [copied, setCopied] = useState(false);

  const semNumber = useMemo(() => {
    const match = (semSlug || '').match(/^semester-(\d+)$/);
    return match ? Number(match[1]) : NaN;
  }, [semSlug]);

  const branch = useMemo(() => branches.find((b) => b.slug === branchSlug), [branches, branchSlug]);
  const semester = useMemo(
    () => (branch && !Number.isNaN(semNumber) ? semesters.find((s) => s.branchId === branch.id && s.semesterNumber === semNumber) : undefined),
    [semesters, branch, semNumber]
  );
  const subject = useMemo(
    () =>
      branch && semester
        ? subjects.find((s) => s.branchId === branch.id && s.semesterId === semester.id && s.slug === subjectSlug)
        : undefined,
    [subjects, branch, semester, subjectSlug]
  );
  const paper = useMemo(
    () => (subject ? papers.find((p) => p.subjectId === subject.id && p.slug === paperSlug) : undefined),
    [papers, subject, paperSlug]
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const fallbackBranch = useMemo(
    () =>
      branch || {
        id: branchSlug || 'branch',
        name: 'GTU Diploma Branch',
        code: '00',
        slug: branchSlug || 'branch',
        isActive: false,
      },
    [branch, branchSlug]
  );
  const fallbackSem = useMemo(
    () =>
      semester || {
        id: semSlug || 'semester',
        semesterNumber: Number.isNaN(semNumber) ? 1 : semNumber,
        name: Number.isNaN(semNumber) ? 'Semester' : `Semester ${semNumber}`,
        isActive: false,
      },
    [semester, semSlug, semNumber]
  );
  const fallbackSubj = useMemo(
    () =>
      subject || {
        id: subjectSlug || 'subject',
        name: 'GTU Subject',
        code: '0000000',
        slug: subjectSlug || 'subject',
        isActive: false,
      },
    [subject, subjectSlug]
  );
  const fallbackPaper = useMemo(
    () =>
      paper || {
        id: paperSlug || 'paper',
        title: 'GTU Question Paper',
        examSession: 'Summer' as const,
        examYear: new Date().getFullYear(),
        slug: paperSlug || 'paper',
        isActive: false,
        updatedAt: undefined,
      },
    [paper, paperSlug]
  );
  const descriptor = useMemo(
    () =>
      buildPaperSeoDefaults(
        fallbackBranch,
        fallbackSem,
        fallbackSubj,
        fallbackPaper,
        settings.siteUrl,
        origin
      ),
    [fallbackBranch, fallbackSem, fallbackSubj, fallbackPaper, settings.siteUrl, origin]
  );
  const resolvedSeo = useResolvedSeo(descriptor);

  const relatedPapers = useMemo(() => {
    if (!subject || !paper) return [];
    return papers
      .filter((p) => p.subjectId === subject.id && p.id !== paper.id)
      .sort((a, b) => b.examYear - a.examYear)
      .slice(0, 6);
  }, [papers, subject, paper]);

  const relatedSemesterSubjects = useMemo(() => {
    if (!branch || !semester || !subject) return [];
    return subjects
      .filter((s) => s.branchId === branch.id && s.semesterId === semester.id && s.id !== subject.id)
      .slice(0, 6);
  }, [subjects, branch, semester, subject]);

  if (!loading && (!branch || !semester || !subject || !paper)) {
    return <NotFoundPage message="The requested question paper page could not be found." />;
  }

  const canonicalPath = `/${branchSlug || ''}/${semSlug || ''}/${subjectSlug || ''}/${paperSlug || ''}`;

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareTitle = resolvedSeo.seoTitle;
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: resolvedSeo.metaDescription,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share unsupported, fall back to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard permission failure
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={resolvedSeo.seoTitle}
        description={resolvedSeo.metaDescription}
        path={canonicalPath}
        keywords={[resolvedSeo.focusKeyword, resolvedSeo.secondaryKeywords].filter(Boolean).join(', ')}
        faqs={resolvedSeo.faqs}
        breadcrumbs={
          branch && semester && subject && paper
            ? [
                { name: 'Home', path: '/' },
                { name: branch.name, path: `/${branch.slug}` },
                { name: semester.name, path: `/${branch.slug}/semester-${semester.semesterNumber}` },
                { name: subject.name, path: `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}` },
                { name: `${paper.examSession} ${paper.examYear}`, path: canonicalPath },
              ]
            : undefined
        }
        paperSchema={paper ? { name: paper.title, datePublished: paper.createdAt } : undefined}
      />
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading || !branch || !semester || !subject || !paper ? (
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ) : (
          <>
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: branch.name, to: `/${branch.slug}` },
                { label: semester.name, to: `/${branch.slug}/semester-${semester.semesterNumber}` },
                {
                  label: subject.name,
                  to: `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}`,
                },
                { label: `${paper.examSession} ${paper.examYear}` },
              ]}
            />

            <div className="mb-6">
              <AdSlot placement="paper_above_details" compact />
            </div>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#1769D2] dark:text-blue-400">
                <span className="font-mono font-semibold">Subject Code: {subject.code}</span>
                <span aria-hidden="true">·</span>
                <span>{paper.examSession} {paper.examYear}</span>
              </div>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#202124] sm:text-3xl dark:text-white">
                {resolvedSeo.h1Heading}
              </h1>

              {resolvedSeo.mainIntro && (
                <p className="mt-3 text-sm leading-relaxed text-[#666666] sm:text-base dark:text-slate-300">
                  {resolvedSeo.mainIntro}
                </p>
              )}

              <dl className="mt-6 grid grid-cols-1 gap-4 border-y border-slate-200 py-5 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
                <div>
                  <dt className="text-xs font-medium text-[#666666] dark:text-slate-400">Branch</dt>
                  <dd className="mt-1 font-semibold">
                    <Link
                      to={`/${branch.slug}`}
                      className="text-[#1769D2] hover:underline dark:text-blue-400"
                    >
                      {branch.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[#666666] dark:text-slate-400">Semester &amp; Subject</dt>
                  <dd className="mt-1 font-semibold">
                    <Link
                      to={`/${branch.slug}/semester-${semester.semesterNumber}`}
                      className="text-[#1769D2] hover:underline dark:text-blue-400"
                    >
                      {semester.name}
                    </Link>
                    <span className="mx-1 text-[#666666] dark:text-slate-400">·</span>
                    <Link
                      to={`/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}`}
                      className="text-[#1769D2] hover:underline dark:text-blue-400"
                    >
                      {subject.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[#666666] dark:text-slate-400">Exam Session</dt>
                  <dd className="mt-1 font-semibold text-[#202124] dark:text-white">
                    GTU {paper.examSession} {paper.examYear}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[#666666] dark:text-slate-400">File Information</dt>
                  <dd className="mt-1 font-semibold text-[#202124] tabular-nums dark:text-white">
                    PDF · {formatFileSize(paper.fileSize)} · {paper.downloadCount} downloads
                  </dd>
                </div>
              </dl>

              <div className="mt-4 text-xs text-[#666666] dark:text-slate-400">
                Download filename:{' '}
                <span className="font-mono font-medium text-[#202124] dark:text-slate-200">
                  {buildPaperDownloadFilename(subject.code, subject.name, paper.examSession, paper.examYear)}
                </span>
              </div>

              {!paper.pdfStoragePath ? (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>
                    The PDF file for this question paper is currently missing or pending upload. Please check back later.
                  </span>
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <a
                    href={`/api/papers/${paper.id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (
                        paper.fileSize > VERCEL_SAFE_DIRECT_BYTES &&
                        paper.pdfStoragePath.startsWith('/api/pdf-files/')
                      ) {
                        e.preventDefault();
                        const fname = buildPaperDownloadFilename(
                          subject.code,
                          subject.name,
                          paper.examSession,
                          paper.examYear
                        );
                        void openLargeCloudPdfInBrowser(paper.id, paper.pdfStoragePath, fname, 'view');
                      }
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#1769D2] bg-white px-5 py-2.5 text-sm font-semibold text-[#1769D2] transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View PDF</span>
                  </a>

                  <a
                    href={`/api/papers/${paper.id}/download`}
                    onClick={(e) => {
                      if (
                        paper.fileSize > VERCEL_SAFE_DIRECT_BYTES &&
                        paper.pdfStoragePath.startsWith('/api/pdf-files/')
                      ) {
                        e.preventDefault();
                        const fname = buildPaperDownloadFilename(
                          subject.code,
                          subject.name,
                          paper.examSession,
                          paper.examYear
                        );
                        void openLargeCloudPdfInBrowser(paper.id, paper.pdfStoragePath, fname, 'download').then(() =>
                          refresh()
                        );
                      } else {
                        setTimeout(() => void refresh(), 800);
                      }
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#1769D2] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0D47A1]"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PDF</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => void handleShare()}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#202124] transition-colors hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                    <span>{copied ? 'Link Copied' : 'Share Paper'}</span>
                  </button>
                </div>
              )}
            </article>

            <div className="mt-6">
              <AdSlot placement="paper_below_details" compact />
            </div>

            {/* Related Papers from the same subject */}
            <section className="mt-10">
              <h2 className="mb-4 text-xl font-bold text-[#202124] dark:text-white">
                Related {subject.name} Question Papers
              </h2>
              {relatedPapers.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-[#666666] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  No other examination papers have been uploaded for {subject.name} yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedPapers.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}/${rel.slug}`}
                      className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-[#1769D2] dark:border-slate-800 dark:bg-slate-900"
                    >
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#1769D2] dark:text-blue-400" />
                      <div className="min-w-0">
                        <div className="font-semibold text-[#202124] group-hover:text-[#1769D2] dark:text-white dark:group-hover:text-blue-400">
                          {rel.examSession} {rel.examYear}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#666666] dark:text-slate-400">
                          {rel.title}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            {relatedSemesterSubjects.length > 0 && (
              <section className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
                <h2 className="mb-4 text-xl font-bold text-[#202124] dark:text-white">
                  More Subjects in {branch.name} {semester.name}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedSemesterSubjects.map((sib) => (
                    <Link
                      key={sib.id}
                      to={`/${branch.slug}/semester-${semester.semesterNumber}/${sib.slug}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#1769D2] dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-[#1769D2] dark:text-blue-400">
                          {sib.code}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-bold text-[#202124] group-hover:text-[#1769D2] dark:text-white dark:group-hover:text-blue-400">
                          {sib.name}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1769D2]" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <SeoRichContentSection seo={resolvedSeo} />
          </>
        )}
      </main>

      <RelatedContentSection
        pageType="paper"
        currentBranchId={branch?.id}
        currentSemesterId={semester?.id}
        currentSubjectId={subject?.id}
        currentSubjectCode={subject?.code}
        currentPaperId={paper?.id}
      />
      <Footer />
    </div>
  );
}
