import { useState } from 'react';
import { ExternalLink, Globe, Loader2, Search } from 'lucide-react';
import type { GtuInsightsResponse } from '../types/academic';

interface GtuSearchInsightsProps {
  branchName?: string;
  semesterNumber?: number;
  subjectName?: string;
  subjectCode?: string;
  mode?: 'subject' | 'global';
}

export function GtuSearchInsights({
  branchName,
  semesterNumber,
  subjectName,
  subjectCode,
  mode = 'global',
}: GtuSearchInsightsProps) {
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GtuInsightsResponse | null>(null);

  const runSearch = async (customQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gemini/gtu-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: customQuery ?? queryText,
          branchName,
          semesterNumber,
          subjectName,
          subjectCode,
        }),
      });
      const json = (await res.json()) as GtuInsightsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Unable to retrieve live GTU search results.');
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while searching GTU updates.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="gtu-updates"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1769D2] dark:text-blue-400">
            <Globe className="h-4 w-4" />
            <span>Live GTU Search Grounding</span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-[#202124] dark:text-slate-100">
            {mode === 'subject' && subjectName
              ? `Syllabus & Exam Pattern: ${subjectName}`
              : 'Search Official GTU Diploma Updates & Syllabi'}
          </h3>
          <p className="mt-1 text-sm text-[#666666] dark:text-slate-400">
            {mode === 'subject'
              ? 'Fetch verified GTU Diploma syllabus units, marking weightage, and official curriculum references.'
              : 'Look up current GTU Diploma exam timetables, syllabus circulars, or branch guidelines with cited web sources.'}
          </p>
        </div>

        {mode === 'subject' && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void runSearch()}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0D47A1] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>{data ? 'Refresh Syllabus Guide' : 'Load Live GTU Syllabus'}</span>
          </button>
        )}
      </div>

      {mode === 'global' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!queryText.trim()) return;
            void runSearch(queryText);
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="e.g., GTU Diploma Computer Sem 3 4331602 DBMS syllabus weightage or exam timetable"
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#202124] focus:border-[#1769D2] focus:outline-none focus:ring-2 focus:ring-[#1769D2]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !queryText.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1769D2] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0D47A1] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>Search GTU</span>
          </button>
        </form>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="whitespace-pre-line text-sm leading-relaxed text-[#202124] dark:text-slate-200">
            {data.summary}
          </div>

          {data.sources && data.sources.length > 0 && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="mb-2 text-xs font-semibold text-[#666666] dark:text-slate-400">
                Verified Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {data.sources.slice(0, 6).map((src, idx) => (
                  <a
                    key={`${src.uri}-${idx}`}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-[#1769D2] transition-colors hover:border-[#1769D2] hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
                  >
                    <span className="max-w-[220px] truncate">{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
