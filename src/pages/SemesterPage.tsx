import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { AdSlot } from '../components/AdSlot';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { SeoHead } from '../components/SeoHead';
import { useCatalog } from '../contexts/CatalogContext';
import { NotFoundPage } from './NotFoundPage';

export function SemesterPage() {
  const { branchSlug, semSlug } = useParams<{ branchSlug: string; semSlug: string }>();
  const { branches, semesters, subjects, papers, loading } = useCatalog();

  const semNumber = useMemo(() => {
    const match = (semSlug || '').match(/^semester-(\d+)$/);
    return match ? Number(match[1]) : NaN;
  }, [semSlug]);

  const branch = useMemo(
    () => branches.find((b) => b.slug === branchSlug),
    [branches, branchSlug]
  );

  const semester = useMemo(() => {
    if (!branch || Number.isNaN(semNumber)) return undefined;
    return semesters.find((s) => s.branchId === branch.id && s.semesterNumber === semNumber);
  }, [semesters, branch, semNumber]);

  const semSubjects = useMemo(() => {
    if (!branch || !semester) return [];
    return subjects.filter((s) => s.branchId === branch.id && s.semesterId === semester.id);
  }, [subjects, branch, semester]);

  if (!loading && (!branch || !semester)) {
    return <NotFoundPage message="The requested semester page could not be found." />;
  }

  const shortBranch = branch ? branch.name.replace(/^Diploma\s+/i, '') : '';
  const pageTitle =
    branch && semester
      ? `GTU ${shortBranch} ${semester.name} Papers | DiplomaToppers`
      : 'Semester | DiplomaToppers';
  const pageDesc =
    branch && semester
      ? `Browse all active subjects and GTU Summer & Winter question papers for ${branch.name} ${semester.name}.`
      : 'GTU Diploma Semester Subjects';

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={pageTitle}
        description={pageDesc}
        path={`/${branchSlug || ''}/${semSlug || ''}`}
        breadcrumbs={
          branch && semester
            ? [
                { name: 'Home', path: '/' },
                { name: branch.name, path: `/${branch.slug}` },
                { name: semester.name, path: `/${branch.slug}/semester-${semester.semesterNumber}` },
              ]
            : undefined
        }
      />
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading || !branch || !semester ? (
          <div className="space-y-4">
            <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: branch.name, to: `/${branch.slug}` },
                { label: semester.name },
              ]}
            />

            <div className="mb-10 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div className="text-sm font-semibold text-[#1769D2] dark:text-blue-400">
                {branch.name} · Branch Code {branch.code}
              </div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#202124] sm:text-4xl dark:text-white">
                {semester.name} Subjects
              </h1>
              <p className="mt-2 text-base text-[#666666] dark:text-slate-400">
                Select a subject below to view and download GTU Summer and Winter examination question papers.
              </p>
            </div>

            <div className="mb-6">
              <AdSlot placement="semester_above_subjects" compact />
            </div>

            {semSubjects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900">
                <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-3 text-lg font-bold text-[#202124] dark:text-white">
                  No Subjects Added Yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#666666] dark:text-slate-400">
                  No subjects have been activated for {branch.name} {semester.name} yet. Please check back after an administrator adds subjects.
                </p>
                <Link
                  to={`/${branch.slug}`}
                  className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#202124] hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <span>Back to {branch.name}</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {semSubjects.map((subj) => {
                  const paperCount = papers.filter((p) => p.subjectId === subj.id).length;
                  const subjUrl = `/${branch.slug}/semester-${semester.semesterNumber}/${subj.slug}`;
                  return (
                    <Link
                      key={subj.id}
                      to={subjUrl}
                      className="group flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#1769D2] to-[#0D47A1] p-5 text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <div>
                        <div className="text-xs font-medium text-blue-100 tabular-nums">
                          Subject Code: {subj.code} · {paperCount} {paperCount === 1 ? 'Paper' : 'Papers'}
                        </div>
                        <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-white">
                          {subj.name}
                        </h2>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-2.5 text-sm font-semibold text-white">
                        <span>View Papers</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-8">
              <AdSlot placement="semester_below_subjects" compact />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
