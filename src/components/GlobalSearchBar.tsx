import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Search, X } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';

export function GlobalSearchBar() {
  const { branches, semesters, subjects, papers } = useCatalog();
  const [queryText, setQueryText] = useState('');

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const semesterMap = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const trimmed = queryText.trim().toLowerCase();

  const results = useMemo(() => {
    if (trimmed.length < 2) return { matchedSubjects: [], matchedPapers: [] };

    const matchedSubjects = subjects
      .filter((s) => {
        const branch = branchMap.get(s.branchId);
        const sem = semesterMap.get(s.semesterId);
        if (!branch || !sem) return false;
        return (
          s.name.toLowerCase().includes(trimmed) ||
          s.code.toLowerCase().includes(trimmed)
        );
      })
      .slice(0, 5)
      .map((s) => {
        const branch = branchMap.get(s.branchId)!;
        const sem = semesterMap.get(s.semesterId)!;
        return {
          subject: s,
          branch,
          sem,
          href: `/${branch.slug}/semester-${sem.semesterNumber}/${s.slug}`,
        };
      });

    const matchedPapers = papers
      .filter((p) => {
        const branch = branchMap.get(p.branchId);
        const sem = semesterMap.get(p.semesterId);
        const subj = subjectMap.get(p.subjectId);
        if (!branch || !sem || !subj) return false;
        return (
          p.title.toLowerCase().includes(trimmed) ||
          String(p.examYear).includes(trimmed) ||
          p.examSession.toLowerCase().includes(trimmed) ||
          subj.name.toLowerCase().includes(trimmed) ||
          subj.code.toLowerCase().includes(trimmed)
        );
      })
      .slice(0, 6)
      .map((p) => {
        const branch = branchMap.get(p.branchId)!;
        const sem = semesterMap.get(p.semesterId)!;
        const subj = subjectMap.get(p.subjectId)!;
        return {
          paper: p,
          subject: subj,
          branch,
          sem,
          href: `/${branch.slug}/semester-${sem.semesterNumber}/${subj.slug}/${p.slug}`,
        };
      });

    return { matchedSubjects, matchedPapers };
  }, [trimmed, subjects, papers, branchMap, semesterMap, subjectMap]);

  const hasResults = results.matchedSubjects.length > 0 || results.matchedPapers.length > 0;

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-5 w-5 text-[#666666] dark:text-slate-400" />
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search subject name, subject code (e.g. 4331602), or exam year..."
          aria-label="Search GTU subjects and question papers"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-[#202124] shadow-sm transition-colors placeholder:text-[#666666] focus:border-[#1769D2] focus:outline-none focus:ring-2 focus:ring-[#1769D2]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
        />
        {queryText && (
          <button
            type="button"
            onClick={() => setQueryText('')}
            aria-label="Clear search"
            className="absolute right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {trimmed.length >= 2 && (
        <div className="absolute left-0 right-0 top-14 z-30 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {!hasResults ? (
            <p className="px-3 py-4 text-center text-sm text-[#666666] dark:text-slate-400">
              No subjects or papers matched &ldquo;{queryText.trim()}&rdquo;.
            </p>
          ) : (
            <div className="space-y-3">
              {results.matchedSubjects.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-xs font-semibold text-[#666666] dark:text-slate-400">
                    Subjects
                  </div>
                  <ul className="space-y-1">
                    {results.matchedSubjects.map(({ subject, branch, sem, href }) => (
                      <li key={subject.id}>
                        <Link
                          to={href}
                          onClick={() => setQueryText('')}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-blue-50 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BookOpen className="h-4 w-4 shrink-0 text-[#1769D2] dark:text-blue-400" />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[#202124] dark:text-slate-100">
                                {subject.name}
                              </div>
                              <div className="truncate text-xs text-[#666666] dark:text-slate-400">
                                {subject.code} · {branch.name} · Sem {sem.semesterNumber}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {results.matchedPapers.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-xs font-semibold text-[#666666] dark:text-slate-400">
                    Question Papers
                  </div>
                  <ul className="space-y-1">
                    {results.matchedPapers.map(({ paper, subject, branch, sem, href }) => (
                      <li key={paper.id}>
                        <Link
                          to={href}
                          onClick={() => setQueryText('')}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-blue-50 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-[#0D47A1] dark:text-blue-400" />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[#202124] dark:text-slate-100">
                                {paper.title}
                              </div>
                              <div className="truncate text-xs text-[#666666] dark:text-slate-400">
                                {paper.examSession} {paper.examYear} · {subject.code} · {branch.name} · Sem {sem.semesterNumber}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
