import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Download, FileText, Search, Sun, Snowflake } from 'lucide-react';
import { AdSlot } from '../components/AdSlot';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Footer } from '../components/Footer';
import { GtuSearchInsights } from '../components/GtuSearchInsights';
import { Header } from '../components/Header';
import { RelatedContentSection } from '../components/RelatedContentSection';
import { SeoHead } from '../components/SeoHead';
import { useCatalog } from '../contexts/CatalogContext';
import type { Paper } from '../types/academic';
import { formatFileSize } from '../utils/slugify';
import { NotFoundPage } from './NotFoundPage';

export function SubjectPage() {
  const { branchSlug, semSlug, subjectSlug } = useParams<{
    branchSlug: string;
    semSlug: string;
    subjectSlug: string;
  }>();
  const { branches, semesters, subjects, papers, loading, refresh } = useCatalog();

  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'Summer' | 'Winter'>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');

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

  const subjectPapers = useMemo(() => {
    if (!subject) return [];
    return papers
      .filter((p) => p.subjectId === subject.id)
      .sort((a, b) => b.examYear - a.examYear);
  }, [papers, subject]);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(subjectPapers.map((p) => p.examYear)));
    return years.sort((a, b) => b - a);
  }, [subjectPapers]);

  const filteredPapers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return subjectPapers.filter((p) => {
      if (sessionFilter !== 'ALL' && p.examSession !== sessionFilter) return false;
      if (yearFilter !== 'ALL' && String(p.examYear) !== yearFilter) return false;
      if (q) {
        const hit =
          p.title.toLowerCase().includes(q) ||
          String(p.examYear).includes(q) ||
          p.examSession.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [subjectPapers, sessionFilter, yearFilter, searchText]);

  const summerPapers = useMemo(
    () => filteredPapers.filter((p) => p.examSession === 'Summer').sort((a, b) => b.examYear - a.examYear),
    [filteredPapers]
  );
  const winterPapers = useMemo(
    () => filteredPapers.filter((p) => p.examSession === 'Winter').sort((a, b) => b.examYear - a.examYear),
    [filteredPapers]
  );

  const siblingSubjects = useMemo(() => {
    if (!branch || !semester || !subject) return [];
    return subjects.filter(
      (s) => s.branchId === branch.id && s.semesterId === semester.id && s.id !== subject.id
    );
  }, [subjects, branch, semester, subject]);

  const crossBranchSubjects = useMemo(() => {
    if (!subject) return [];
    const normCode = subject.code.trim().toUpperCase();
    return subjects
      .filter((s) => s.id !== subject.id && s.code.trim().toUpperCase() === normCode)
      .map((s) => {
        const br = branches.find((b) => b.id === s.branchId);
        const sem = semesters.find((sm) => sm.id === s.semesterId);
        return br && sem ? { subject: s, branch: br, semester: sem } : null;
      })
      .filter((x): x is { subject: typeof subject; branch: typeof branches[number]; semester: typeof semesters[number] } => Boolean(x));
  }, [subjects, branches, semesters, subject]);

  if (!loading && (!branch || !semester || !subject)) {
    return <NotFoundPage message="The requested subject page could not be found." />;
  }

  const pageTitle = subject
    ? `${subject.name} (${subject.code}) GTU Old Papers | DiplomaToppers`
    : 'Subject | DiplomaToppers';
  const pageDesc =
    subject && branch && semester
      ? `Download ${subject.name} (${subject.code}) GTU Summer and Winter Diploma question papers PDF for ${branch.name} ${semester.name}.`
      : 'GTU Diploma Subject Question Papers';

  const renderPaperCard = (paper: Paper) => {
    if (!branch || !semester || !subject) return null;
    const paperHref = `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}/${paper.slug}`;
    const hasPdf = Boolean(paper.pdfStoragePath);

    return (
      <article
        key={paper.id}
        className="flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#1769D2] to-[#0D47A1] p-5 text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-100 tabular-nums">
            <span className="font-semibold text-white">
              {paper.examSession} {paper.examYear}
            </span>
            <span aria-hidden="true">·</span>
            <span>{hasPdf ? `PDF Ready (${formatFileSize(paper.fileSize)})` : 'PDF Unavailable'}</span>
            <span aria-hidden="true">·</span>
            <span>{paper.downloadCount} downloads</span>
          </div>
          <Link to={paperHref} className="block group">
            <h3 className="text-lg font-extrabold tracking-tight text-white transition-opacity group-hover:opacity-90">
              {paper.title}
            </h3>
          </Link>
        </div>

        <div className="border-t border-white/20 pt-3">
          {hasPdf ? (
            <a
              href={`/api/papers/${paper.id}/download`}
              onClick={() => setTimeout(() => void refresh(), 800)}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#1769D2] shadow-sm transition-colors hover:bg-blue-50 whitespace-nowrap"
            >
              <Download className="h-4 w-4 text-[#1769D2]" />
              <span>Download</span>
            </a>
          ) : (
            <span className="inline-block text-xs font-medium text-blue-100">
              PDF file missing
            </span>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={pageTitle}
        description={pageDesc}
        path={`/${branchSlug || ''}/${semSlug || ''}/${subjectSlug || ''}`}
        breadcrumbs={
          branch && semester && subject
            ? [
                { name: 'Home', path: '/' },
                { name: branch.name, path: `/${branch.slug}` },
                { name: semester.name, path: `/${branch.slug}/semester-${semester.semesterNumber}` },
                { name: subject.name, path: `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}` },
              ]
            : undefined
        }
      />
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading || !branch || !semester || !subject ? (
          <div className="space-y-4">
            <div className="h-10 w-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : (
          <>
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: branch.name, to: `/${branch.slug}` },
                { label: semester.name, to: `/${branch.slug}/semester-${semester.semesterNumber}` },
                { label: subject.name },
              ]}
            />

            <div className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#1769D2] dark:text-blue-400">
                <span className="font-mono font-semibold">Subject Code: {subject.code}</span>
                <span aria-hidden="true">·</span>
                <span>{branch.name}</span>
                <span aria-hidden="true">·</span>
                <span>{semester.name}</span>
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#202124] sm:text-4xl dark:text-white">
                {subject.name}
              </h1>
              {subject.description && (
                <p className="mt-3 max-w-3xl text-base text-[#666666] dark:text-slate-400">
                  {subject.description}
                </p>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-1 rounded-xl bg-white p-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-950">
                {(['ALL', 'Summer', 'Winter'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSessionFilter(tab)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      sessionFilter === tab
                        ? 'bg-[#1769D2] text-white'
                        : 'text-[#666666] hover:text-[#202124] dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tab === 'ALL' ? 'All Sessions' : tab}
                  </button>
                ))}
              </div>

              <div className="flex flex-1 flex-col gap-3 sm:max-w-lg sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Filter papers by title or year..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-[#202124] focus:border-[#1769D2] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <select
                  aria-label="Filter by examination year"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#202124] focus:border-[#1769D2] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-6">
              <AdSlot placement="subject_above_papers" compact />
            </div>

            {subjectPapers.length === 0 ? (
              <div className="mb-10 rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900">
                <FileText className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-3 text-lg font-bold text-[#202124] dark:text-white">
                  No Question Papers Uploaded Yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#666666] dark:text-slate-400">
                  No Summer or Winter PDF papers have been uploaded for {subject.name} ({subject.code}) yet.
                </p>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="mb-10 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-[#666666] dark:text-slate-400">
                  No papers match your active filter selection.
                </p>
              </div>
            ) : (
              <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* GTU Summer Examination */}
                <section aria-labelledby="summer-heading" className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <Sun className="h-5 w-5 text-amber-500" />
                    <h2 id="summer-heading" className="text-lg font-bold tracking-tight text-[#202124] dark:text-white">
                      GTU Summer Examination
                    </h2>
                  </div>
                  {summerPapers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-[#666666] dark:border-slate-800 dark:text-slate-400">
                      No Summer papers available for this filter.
                    </p>
                  ) : (
                    <div className="space-y-3">{summerPapers.map(renderPaperCard)}</div>
                  )}
                </section>

                {/* GTU Winter Examination */}
                <section aria-labelledby="winter-heading" className="space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <Snowflake className="h-5 w-5 text-[#1769D2] dark:text-blue-400" />
                    <h2 id="winter-heading" className="text-lg font-bold tracking-tight text-[#202124] dark:text-white">
                      GTU Winter Examination
                    </h2>
                  </div>
                  {winterPapers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-[#666666] dark:border-slate-800 dark:text-slate-400">
                      No Winter papers available for this filter.
                    </p>
                  ) : (
                    <div className="space-y-3">{winterPapers.map(renderPaperCard)}</div>
                  )}
                </section>
              </div>
            )}

            <div className="mb-10">
              <AdSlot placement="subject_below_papers" compact />
            </div>

            {/* Related Subjects & Same Subject in Other Branches */}
            {(siblingSubjects.length > 0 || crossBranchSubjects.length > 0) && (
              <section className="mb-10 space-y-8 border-t border-slate-200 pt-10 dark:border-slate-800">
                {siblingSubjects.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-xl font-bold text-[#202124] dark:text-white">
                      Related Subjects in {branch.name} {semester.name}
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {siblingSubjects.map((sib) => {
                        const count = papers.filter((p) => p.subjectId === sib.id).length;
                        return (
                          <Link
                            key={sib.id}
                            to={`/${branch.slug}/semester-${semester.semesterNumber}/${sib.slug}`}
                            className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#1769D2] dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="min-w-0">
                              <div className="text-xs text-[#666666] dark:text-slate-400 tabular-nums">
                                <span className="font-mono font-semibold text-[#1769D2] dark:text-blue-400">
                                  {sib.code}
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>{count} {count === 1 ? 'Paper' : 'Papers'}</span>
                              </div>
                              <div className="mt-1 truncate text-sm font-bold text-[#202124] group-hover:text-[#1769D2] dark:text-white dark:group-hover:text-blue-400">
                                {sib.name}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1769D2]" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {crossBranchSubjects.length > 0 && (
                  <div>
                    <h2 className="mb-4 text-xl font-bold text-[#202124] dark:text-white">
                      {subject.name} ({subject.code}) in Other Branches
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {crossBranchSubjects.map((item) => (
                        <Link
                          key={item.subject.id}
                          to={`/${item.branch.slug}/semester-${item.semester.semesterNumber}/${item.subject.slug}`}
                          className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#1769D2] dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="min-w-0">
                            <div className="text-xs text-[#666666] dark:text-slate-400">
                              {item.semester.name} · Code {item.subject.code}
                            </div>
                            <div className="mt-1 truncate text-sm font-bold text-[#202124] group-hover:text-[#1769D2] dark:text-white dark:group-hover:text-blue-400">
                              {item.branch.name}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1769D2]" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Live GTU Syllabus & Exam Pattern Grounding */}
            <GtuSearchInsights
              mode="subject"
              branchName={branch.name}
              semesterNumber={semester.semesterNumber}
              subjectName={subject.name}
              subjectCode={subject.code}
            />
          </>
        )}
      </main>

      <RelatedContentSection
        pageType="subject"
        currentBranchId={branch?.id}
        currentSemesterId={semester?.id}
        currentSubjectId={subject?.id}
        currentSubjectCode={subject?.code}
      />
      <Footer />
    </div>
  );
}
