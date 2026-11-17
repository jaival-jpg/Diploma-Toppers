import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import { STANDARD_GTU_BRANCHES } from '../services/firestoreCatalog';

export interface RelatedContentSectionProps {
  pageType?: 'home' | 'branch' | 'semester' | 'subject' | 'paper' | 'static';
  currentBranchId?: string;
  currentSemesterId?: string;
  currentSubjectId?: string;
  currentSubjectCode?: string;
  currentPaperId?: string;
}

interface InternalLinkItem {
  label: string;
  sublabel?: string;
  to: string;
}

export function RelatedContentSection({
  pageType = 'home',
  currentBranchId,
  currentSemesterId,
  currentSubjectId,
  currentSubjectCode,
  currentPaperId,
}: RelatedContentSectionProps) {
  const { branches, semesters, subjects, papers } = useCatalog();

  const effectiveBranches = useMemo(
    () => (branches.length > 0 ? branches : STANDARD_GTU_BRANCHES),
    [branches]
  );
  const branchMap = useMemo(() => new Map(effectiveBranches.map((b) => [b.id, b])), [effectiveBranches]);
  const semesterMap = useMemo(() => new Map(semesters.map((s) => [s.id, s])), [semesters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const currentBranch = currentBranchId ? branchMap.get(currentBranchId) : undefined;
  const currentSemester = currentSemesterId ? semesterMap.get(currentSemesterId) : undefined;
  const currentSubject = currentSubjectId ? subjectMap.get(currentSubjectId) : undefined;

  const relatedSubjectLinks = useMemo<InternalLinkItem[]>(() => {
    const items: InternalLinkItem[] = [];
    const seenPaths = new Set<string>();

    const pushSubject = (s: typeof subjects[number], notePrefix?: string) => {
      const br = branchMap.get(s.branchId);
      const sem = semesterMap.get(s.semesterId);
      if (!br || !sem) return;
      const path = `/${br.slug}/semester-${sem.semesterNumber}/${s.slug}`;
      if (seenPaths.has(path)) return;
      seenPaths.add(path);
      const shortBranch = br.name.replace(/^Diploma\s+/i, '');
      items.push({
        label: `${s.name} (${s.code})`,
        sublabel: notePrefix ? `${notePrefix} · ${shortBranch} Sem ${sem.semesterNumber}` : `${shortBranch} · Sem ${sem.semesterNumber}`,
        to: path,
      });
    };

    // 1. Same subject code in other branches (high-relevance cross-branch SEO links)
    if (currentSubjectCode) {
      const normCode = currentSubjectCode.trim().toUpperCase();
      for (const s of subjects) {
        if (s.id !== currentSubjectId && s.code.trim().toUpperCase() === normCode) {
          pushSubject(s, 'Same Code');
        }
      }
    }

    // 2. Sibling subjects in the same branch & semester
    if (currentBranchId && currentSemesterId) {
      for (const s of subjects) {
        if (s.id !== currentSubjectId && s.branchId === currentBranchId && s.semesterId === currentSemesterId) {
          pushSubject(s);
        }
      }
    }

    // 3. Other subjects in the same branch
    if (currentBranchId) {
      for (const s of subjects) {
        if (s.id !== currentSubjectId && s.branchId === currentBranchId && items.length < 8) {
          pushSubject(s);
        }
      }
    }

    // 4. Fill remaining slots with active subjects that have papers (newest/most relevant)
    const paperCountBySubj = new Map<string, number>();
    for (const p of papers) {
      paperCountBySubj.set(p.subjectId, (paperCountBySubj.get(p.subjectId) || 0) + 1);
    }
    const rankedSubjects = [...subjects].sort((a, b) => {
      const diff = (paperCountBySubj.get(b.id) || 0) - (paperCountBySubj.get(a.id) || 0);
      if (diff !== 0) return diff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    for (const s of rankedSubjects) {
      if (items.length >= 8) break;
      if (s.id === currentSubjectId) continue;
      pushSubject(s);
    }

    return items.slice(0, 8);
  }, [subjects, papers, branchMap, semesterMap, currentBranchId, currentSemesterId, currentSubjectId, currentSubjectCode]);

  const relatedPaperLinks = useMemo<InternalLinkItem[]>(() => {
    const items: InternalLinkItem[] = [];
    const seenPaths = new Set<string>();

    const pushPaper = (p: typeof papers[number]) => {
      if (p.id === currentPaperId) return;
      const br = branchMap.get(p.branchId);
      const sem = semesterMap.get(p.semesterId);
      const subj = subjectMap.get(p.subjectId);
      if (!br || !sem || !subj) return;
      const path = `/${br.slug}/semester-${sem.semesterNumber}/${subj.slug}/${p.slug}`;
      if (seenPaths.has(path)) return;
      seenPaths.add(path);
      items.push({
        label: `${subj.name} ${p.examSession} ${p.examYear}`,
        sublabel: `${subj.code} · ${br.name.replace(/^Diploma\s+/i, '')} Sem ${sem.semesterNumber}`,
        to: path,
      });
    };

    const sortedPapers = [...papers].sort(
      (a, b) => b.examYear - a.examYear || (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    // 1. Papers from the same subject
    if (currentSubjectId) {
      for (const p of sortedPapers) {
        if (p.subjectId === currentSubjectId) pushPaper(p);
      }
    }

    // 2. Papers with matching subject code across branches
    if (currentSubjectCode) {
      const normCode = currentSubjectCode.trim().toUpperCase();
      for (const p of sortedPapers) {
        const subj = subjectMap.get(p.subjectId);
        if (subj && subj.code.trim().toUpperCase() === normCode) pushPaper(p);
      }
    }

    // 3. Papers in the same semester/branch
    if (currentBranchId && currentSemesterId) {
      for (const p of sortedPapers) {
        if (p.branchId === currentBranchId && p.semesterId === currentSemesterId) {
          pushPaper(p);
        }
      }
    } else if (currentBranchId) {
      for (const p of sortedPapers) {
        if (p.branchId === currentBranchId) pushPaper(p);
      }
    }

    // 4. Fill with latest papers site-wide
    for (const p of sortedPapers) {
      if (items.length >= 8) break;
      pushPaper(p);
    }

    return items.slice(0, 8);
  }, [papers, branchMap, semesterMap, subjectMap, currentBranchId, currentSemesterId, currentSubjectId, currentSubjectCode, currentPaperId]);

  const branchAndSemesterLinks = useMemo<InternalLinkItem[]>(() => {
    const items: InternalLinkItem[] = [];
    for (const br of effectiveBranches) {
      items.push({
        label: br.name,
        sublabel: `Branch Code ${br.code}`,
        to: `/${br.slug}`,
      });
    }

    if (currentBranch) {
      const brSems = semesters
        .filter((s) => s.branchId === currentBranch.id)
        .sort((a, b) => a.semesterNumber - b.semesterNumber);
      for (const sem of brSems) {
        if (sem.id === currentSemesterId) continue;
        items.push({
          label: `${currentBranch.name.replace(/^Diploma\s+/i, '')} ${sem.name}`,
          sublabel: 'All Subjects',
          to: `/${currentBranch.slug}/semester-${sem.semesterNumber}`,
        });
      }
    } else {
      // On home/static pages, include top active semester links so crawlers reach deep pages quickly
      const firstBranch = effectiveBranches[0];
      if (firstBranch) {
        const firstSems = semesters
          .filter((s) => s.branchId === firstBranch.id)
          .sort((a, b) => a.semesterNumber - b.semesterNumber)
          .slice(0, 4);
        for (const sem of firstSems) {
          items.push({
            label: `${firstBranch.name.replace(/^Diploma\s+/i, '')} ${sem.name}`,
            sublabel: 'Browse Papers',
            to: `/${firstBranch.slug}/semester-${sem.semesterNumber}`,
          });
        }
      }
    }

    return items.slice(0, 10);
  }, [effectiveBranches, semesters, currentBranch, currentSemesterId]);

  const contextualSummary = useMemo(() => {
    if (pageType === 'paper' && currentSubject && currentBranch && currentSemester) {
      return `Preparing for ${currentSubject.name} (${currentSubject.code}) in ${currentBranch.name} ${currentSemester.name}? Explore previous Summer and Winter GTU Diploma question papers, related subjects in ${currentSemester.name}, and study archives across other GTU branches below.`;
    }
    if (pageType === 'subject' && currentSubject && currentBranch && currentSemester) {
      return `Explore additional GTU Diploma Engineering subjects in ${currentBranch.name} ${currentSemester.name}, compare common ${currentSubject.code} papers across branches, or jump directly to recently uploaded question papers.`;
    }
    if (pageType === 'semester' && currentBranch && currentSemester) {
      return `Switching semesters or checking other engineering streams? Use these quick internal links to browse other semesters in ${currentBranch.name}, active subjects, and recent GTU Diploma PDF uploads.`;
    }
    if (pageType === 'branch' && currentBranch) {
      return `Navigate ${currentBranch.name} (Code ${currentBranch.code}) semesters, jump straight into popular subjects, or explore GTU Diploma question papers across Civil, Computer, Electrical, and Mechanical engineering.`;
    }
    return 'Explore verified GTU Diploma Engineering previous year Summer and Winter question papers across all branches, semesters 1 to 6, and active subject codes on DiplomaToppers.';
  }, [pageType, currentBranch, currentSemester, currentSubject]);

  const otherSiteLinks: Array<{ label: string; to: string; external?: boolean }> = [
    { label: 'All GTU Diploma Branches', to: '/' },
    { label: 'About DiplomaToppers', to: '/about' },
    { label: 'Request Missing Paper / Contact', to: '/contact' },
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Terms & Conditions', to: '/terms-and-conditions' },
    { label: 'Academic Disclaimer', to: '/disclaimer' },
    { label: 'XML Sitemap', to: '/sitemap.xml', external: true },
  ];

  return (
    <section
      aria-labelledby="related-content-heading"
      className="border-t border-slate-200 bg-slate-50/80 py-12 dark:border-slate-800 dark:bg-slate-900/50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <h2
            id="related-content-heading"
            className="text-xl font-bold tracking-tight text-[#202124] sm:text-2xl dark:text-white"
          >
            Related Content &amp; Quick Internal Links
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#666666] dark:text-slate-400">
            {contextualSummary}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Related & Active Subjects */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-[#202124] dark:text-white">
              {currentSemester ? `Related Subjects & Cross-Branch` : 'Popular GTU Subjects'}
            </h3>
            {relatedSubjectLinks.length === 0 ? (
              <p className="text-xs leading-relaxed text-[#666666] dark:text-slate-400">
                Subjects added from the Admin Panel will appear here automatically for quick navigation.
              </p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {relatedSubjectLinks.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group block text-[#1769D2] hover:underline dark:text-blue-400"
                    >
                      <span className="font-medium text-[#202124] transition-colors group-hover:text-[#1769D2] dark:text-slate-200 dark:group-hover:text-blue-400">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="block text-xs text-[#666666] dark:text-slate-400 tabular-nums">
                          {item.sublabel}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 2: Related & Recent Papers */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-[#202124] dark:text-white">
              {currentSubject ? 'Related Question Papers' : 'Latest Uploaded Papers'}
            </h3>
            {relatedPaperLinks.length === 0 ? (
              <p className="text-xs leading-relaxed text-[#666666] dark:text-slate-400">
                Newly uploaded Summer and Winter question papers will be linked here automatically.
              </p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {relatedPaperLinks.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group block text-[#1769D2] hover:underline dark:text-blue-400"
                    >
                      <span className="font-medium text-[#202124] transition-colors group-hover:text-[#1769D2] dark:text-slate-200 dark:group-hover:text-blue-400">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="block text-xs text-[#666666] dark:text-slate-400 tabular-nums">
                          {item.sublabel}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Column 3: Branches & Semesters */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-[#202124] dark:text-white">
              Engineering Branches &amp; Semesters
            </h3>
            <ul className="space-y-2 text-sm">
              {branchAndSemesterLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="inline-flex items-center gap-1.5 font-medium text-[#202124] transition-colors hover:text-[#1769D2] hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                  >
                    <span>{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs font-normal text-[#666666] dark:text-slate-400">
                        · {item.sublabel}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Other Links & Resources */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-[#202124] dark:text-white">
              Other Helpful Links
            </h3>
            <ul className="space-y-2 text-sm">
              {otherSiteLinks.map((item) => (
                <li key={item.to}>
                  {item.external ? (
                    <a
                      href={item.to}
                      className="inline-flex items-center gap-1 font-medium text-[#202124] transition-colors hover:text-[#1769D2] hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <Link
                      to={item.to}
                      className="inline-flex items-center gap-1 font-medium text-[#202124] transition-colors hover:text-[#1769D2] hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-3 w-3 opacity-60" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
