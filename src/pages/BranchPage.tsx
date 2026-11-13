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

export function BranchPage() {
  const { branchSlug } = useParams<{ branchSlug: string }>();
  const { branches, semesters, subjects, loading } = useCatalog();

  const branch = useMemo(
    () => branches.find((b) => b.slug === branchSlug),
    [branches, branchSlug]
  );

  const branchSemesters = useMemo(() => {
    if (!branch) return [];
    return semesters
      .filter((s) => s.branchId === branch.id)
      .sort((a, b) => a.semesterNumber - b.semesterNumber);
  }, [semesters, branch]);

  if (!loading && !branch) {
    return <NotFoundPage message="The requested engineering branch could not be found." />;
  }

  const branchTitle = branch ? `GTU ${branch.name} Old Papers | DiplomaToppers` : 'Branch | DiplomaToppers';
  const branchDesc = branch
    ? branch.description ||
      `Download GTU ${branch.name} (Code ${branch.code}) Semester 1 to 6 previous year Summer and Winter question papers.`
    : 'GTU Diploma Engineering Branch Question Papers';

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={branchTitle}
        description={branchDesc}
        path={`/${branchSlug || ''}`}
        breadcrumbs={
          branch
            ? [
                { name: 'Home', path: '/' },
                { name: branch.name, path: `/${branch.slug}` },
              ]
            : undefined
        }
      />
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading || !branch ? (
          <div className="space-y-4">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: branch.name }]} />

            <div className="mb-10 border-b border-slate-200 pb-6 dark:border-slate-800">
              <div className="font-mono text-sm font-semibold text-[#1769D2] dark:text-blue-400">
                Branch Code: {branch.code}
              </div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#202124] sm:text-4xl dark:text-white">
                {branch.name}
              </h1>
              <p className="mt-3 max-w-3xl text-base text-[#666666] dark:text-slate-400">
                {branchDesc}
              </p>
            </div>

            <div className="mb-6">
              <AdSlot placement="branch_above_semesters" compact />
            </div>

            <section aria-labelledby="semester-heading">
              <h2 id="semester-heading" className="mb-6 text-xl font-bold text-[#202124] sm:text-2xl dark:text-white">
                Select Semester
              </h2>

              {branchSemesters.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                  <BookOpen className="mx-auto h-9 w-9 text-slate-400" />
                  <p className="mt-3 text-sm text-[#666666] dark:text-slate-400">
                    No active semesters have been configured for {branch.name} yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {branchSemesters.map((sem) => {
                    const subjCount = subjects.filter(
                      (s) => s.branchId === branch.id && s.semesterId === sem.id
                    ).length;
                    return (
                      <Link
                        key={sem.id}
                        to={`/${branch.slug}/semester-${sem.semesterNumber}`}
                        className="group flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#1769D2] to-[#0D47A1] p-5 text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <div>
                          <div className="text-xs font-medium text-blue-100 tabular-nums">
                            {branch.name} · {subjCount} {subjCount === 1 ? 'Subject' : 'Subjects'}
                          </div>
                          <h3 className="mt-1.5 text-xl font-extrabold tracking-tight text-white">
                            {sem.name}
                          </h3>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-2.5 text-sm font-semibold text-white">
                          <span>View Subjects</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="mt-8">
              <AdSlot placement="branch_below_semesters" compact />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
