import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { AdSlot } from '../components/AdSlot';
import { Footer } from '../components/Footer';
import { GlobalSearchBar } from '../components/GlobalSearchBar';
import { GtuSearchInsights } from '../components/GtuSearchInsights';
import { Header } from '../components/Header';
import { SeoHead } from '../components/SeoHead';
import { useCatalog } from '../contexts/CatalogContext';
import { STANDARD_GTU_BRANCHES } from '../services/firestoreCatalog';
import { formatFileSize } from '../utils/slugify';

export function HomePage() {
  const { branches, semesters, subjects, papers, settings, loading, error, refresh } = useCatalog();

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const semesterMap = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const recentPapers = useMemo(() => {
    return [...papers]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 6);
  }, [papers]);

  const mostDownloadedPapers = useMemo(() => {
    return [...papers]
      .filter((p) => p.downloadCount > 0)
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, 6);
  }, [papers]);

  const renderPaperRow = (paper: typeof papers[number]) => {
    const branch = branchMap.get(paper.branchId);
    const sem = semesterMap.get(paper.semesterId);
    const subject = subjectMap.get(paper.subjectId);
    if (!branch || !sem || !subject) return null;

    const paperUrl = `/${branch.slug}/semester-${sem.semesterNumber}/${subject.slug}/${paper.slug}`;
    return (
      <article
        key={paper.id}
        className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#666666] dark:text-slate-400">
            <span className="font-mono font-medium text-[#1769D2] dark:text-blue-400">{subject.code}</span>
            <span aria-hidden="true">·</span>
            <span>{branch.name}</span>
            <span aria-hidden="true">·</span>
            <span>Semester {sem.semesterNumber}</span>
          </div>
          <Link to={paperUrl} className="mt-2 block group">
            <h3 className="text-base font-bold text-[#202124] transition-colors group-hover:text-[#1769D2] dark:text-slate-100 dark:group-hover:text-blue-400">
              {paper.title}
            </h3>
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#666666] dark:text-slate-400 tabular-nums">
            <span>{paper.examSession} {paper.examYear}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(paper.fileSize)}</span>
            <span aria-hidden="true">·</span>
            <span>{paper.downloadCount} downloads</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <a
            href={`/api/papers/${paper.id}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#202124] transition-colors hover:border-[#1769D2] hover:text-[#1769D2] whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View Paper</span>
          </a>
          <a
            href={`/api/papers/${paper.id}/download`}
            onClick={() => setTimeout(() => void refresh(), 800)}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1769D2] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D47A1] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF</span>
          </a>
        </div>
      </article>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title="GTU Diploma Old Question Papers | DiplomaToppers"
        description={
          settings.siteDescription ||
          'Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject on DiplomaToppers.'
        }
        path="/"
      />
      <Header />

      <main className="flex-1">
        {/* Hero & Search */}
        <section className="border-b border-slate-100 bg-gradient-to-b from-[#F4F8FD] to-white py-12 sm:py-16 dark:border-slate-800/80 dark:from-slate-900/70 dark:to-[#0B1120]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold text-[#1769D2] dark:text-blue-400">
                Gujarat Technological University · Diploma Engineering
              </p>
              <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-[#202124] sm:text-4xl lg:text-5xl dark:text-white">
                GTU Diploma Old Question Papers
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#666666] sm:text-lg dark:text-slate-300">
                Browse verified GTU Diploma Summer and Winter examination question papers organized cleanly by engineering branch, semester, and subject code.
              </p>

              <div className="mt-7 max-w-2xl">
                <GlobalSearchBar />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a
                  href="#branches"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0D47A1]"
                >
                  <span>Browse Branches</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#gtu-updates"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#202124] transition-colors hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <span>Search GTU Syllabus</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Error banner if database unavailable */}
        {error && (
          <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Ad Container Above Branch Selection */}
        <AdSlot placement="home_above_branches" />

        {/* Branch Selection Section */}
        <section id="branches" className="py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl dark:text-white">
                  Select Your Engineering Branch
                </h2>
                <p className="mt-1.5 text-sm text-[#666666] dark:text-slate-400">
                  Choose your GTU Diploma branch to view semesters 1 through 6 and subject question papers.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(branches.length > 0 ? branches : STANDARD_GTU_BRANCHES).map((branch) => (
                  <Link
                    key={branch.id}
                    to={`/${branch.slug}`}
                    className="group flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#1769D2] to-[#0D47A1] p-5 text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <div>
                      <div className="text-xs font-medium text-blue-100 tabular-nums">
                        Branch Code: {branch.code}
                      </div>
                      <h3 className="mt-1.5 text-lg font-extrabold tracking-tight text-white">
                        {branch.name}
                      </h3>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-2.5 text-sm font-semibold text-white">
                      <span>Explore Semesters</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Ad Container Below Branch Selection */}
        <AdSlot placement="home_below_branches" />

        {/* Recently Uploaded Papers */}
        <section id="recent-papers" className="border-t border-slate-100 bg-slate-50/60 py-12 sm:py-16 dark:border-slate-800/80 dark:bg-slate-900/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl dark:text-white">
                Recently Uploaded Question Papers
              </h2>
              <p className="mt-1.5 text-sm text-[#666666] dark:text-slate-400">
                Latest GTU Diploma Summer &amp; Winter examination PDFs added by administrators.
              </p>
            </div>

            {recentPapers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <FileText className="mx-auto h-9 w-9 text-slate-400" />
                <p className="mt-3 text-sm text-[#666666] dark:text-slate-400">
                  No question papers have been uploaded yet. Select a branch above or check back soon.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {recentPapers.map(renderPaperRow)}
              </div>
            )}
          </div>
        </section>

        {/* Most Downloaded Papers (only rendered if real downloads exist) */}
        {mostDownloadedPapers.length > 0 && (
          <section className="py-12 sm:py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl dark:text-white">
                  Most Downloaded Papers
                </h2>
                <p className="mt-1.5 text-sm text-[#666666] dark:text-slate-400">
                  Top GTU Diploma question papers ranked by verified student PDF downloads.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {mostDownloadedPapers.map(renderPaperRow)}
              </div>
            </div>
          </section>
        )}

        {/* Live GTU Search Grounding */}
        <section className="border-t border-slate-100 py-12 sm:py-16 dark:border-slate-800/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <GtuSearchInsights mode="global" />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
