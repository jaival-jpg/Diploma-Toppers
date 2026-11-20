import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { analyzePageSeo } from '../../services/seoAnalyzer';
import { syncAllDefaultSeo } from '../../services/firestoreCatalog';
import {
  collectCatalogPageDescriptors,
  mergeDescriptorWithSeo,
  type SeoPageDescriptor,
} from '../../services/seoDefaults';
import type {
  BlogPost,
  Branch,
  Paper,
  Semester,
  SeoAnalyzerReport,
  SeoMetadata,
  SeoPageType,
  Subject,
  WebsiteSettingsMap,
} from '../../types/academic';
import { SEO_PAGE_TYPE_LABELS, SeoEditorPanel } from './SeoEditorModal';

interface SeoManagementManagerProps {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  blogs?: BlogPost[];
  seoMetadata: SeoMetadata[];
  settings: WebsiteSettingsMap;
  onRefresh: () => Promise<void>;
}

interface CombinedSeoRow {
  descriptor: SeoPageDescriptor;
  seo: SeoMetadata;
  stored?: SeoMetadata;
  missingDescription: boolean;
  missingTitle: boolean;
  duplicateTitle: boolean;
  duplicateDescription: boolean;
  report: SeoAnalyzerReport;
}

type IssueFilter = 'ALL' | 'MISSING' | 'DUPLICATE' | 'THIN_CONTENT' | 'CUSTOMIZED' | 'NOINDEX';

type SeoHealthStatus = 'Passed' | 'Failed' | 'Needs Attention';

interface SeoHealthCheckItem {
  id: string;
  number: number;
  title: string;
  status: SeoHealthStatus;
  checkedUrl: string;
  httpStatus: number | null;
  details: string;
}

interface SeoHealthReport {
  targetUrl: string;
  checkedAt: string;
  summary: {
    passed: number;
    failed: number;
    needsAttention: number;
  };
  checks: SeoHealthCheckItem[];
}

function getDefaultProductionTargetUrl(configuredSiteUrl?: string): string {
  const cleanConfigured = (configuredSiteUrl || '').trim().replace(/\/+$/, '');
  if (cleanConfigured.startsWith('https://')) {
    try {
      const host = new URL(cleanConfigured).hostname.toLowerCase();
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return cleanConfigured;
      }
    } catch {
      // Ignore malformed configured siteUrl
    }
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const lowerHost = hostname.toLowerCase();
    if (protocol === 'https:' && lowerHost !== 'localhost' && lowerHost !== '127.0.0.1') {
      return origin;
    }
  }
  return 'https://diplomatoppers.vercel.app';
}

function formatTimestamp(iso?: string): string {
  if (!iso) return 'Auto';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Auto';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCheckDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function escapeCsvCell(value: string): string {
  const safe = value.replace(/"/g, '""');
  return `"${safe}"`;
}

export function SeoManagementManager({
  branches,
  semesters,
  subjects,
  papers,
  blogs = [],
  seoMetadata,
  settings,
  onRefresh,
}: SeoManagementManagerProps) {
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SeoPageType>('ALL');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('ALL');

  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingSeoId, setEditingSeoId] = useState<string | null>(null);

  // Automated Production SEO Health Check state
  const [healthTargetUrl, setHealthTargetUrl] = useState(() =>
    getDefaultProductionTargetUrl(settings.siteUrl)
  );
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const [healthReport, setHealthReport] = useState<SeoHealthReport | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const isRunningLocally =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname.toLowerCase());

  const combinedRows = useMemo<CombinedSeoRow[]>(() => {
    const storedMap = new Map(seoMetadata.map((item) => [item.id, item]));
    const descriptors = collectCatalogPageDescriptors({
      branches,
      semesters,
      subjects,
      papers,
      blogs,
      siteUrl: settings.siteUrl,
      siteDescription: settings.siteDescription,
    });

    const baseList = descriptors.map((descriptor) => {
      const stored = storedMap.get(descriptor.seoId);
      const seo = mergeDescriptorWithSeo(descriptor, stored);
      return { descriptor, seo, stored };
    });

    const titleCounts = new Map<string, number>();
    const descCounts = new Map<string, number>();
    for (const item of baseList) {
      const tKey = item.seo.seoTitle.trim().toLowerCase();
      if (tKey) titleCounts.set(tKey, (titleCounts.get(tKey) || 0) + 1);
      const dKey = item.seo.metaDescription.trim().toLowerCase();
      if (dKey) descCounts.set(dKey, (descCounts.get(dKey) || 0) + 1);
    }

    return baseList.map(({ descriptor, seo, stored }) => {
      const normTitle = seo.seoTitle.trim().toLowerCase();
      const normDesc = seo.metaDescription.trim().toLowerCase();
      const duplicateTitle = Boolean(normTitle && (titleCounts.get(normTitle) || 0) > 1);
      const duplicateDescription = Boolean(normDesc && (descCounts.get(normDesc) || 0) > 1);
      const report = analyzePageSeo({
        seo,
        descriptor,
        duplicateTitle,
        duplicateDescription,
      });

      return {
        descriptor,
        seo,
        stored,
        missingTitle: !seo.seoTitle.trim(),
        missingDescription: !seo.metaDescription.trim(),
        duplicateTitle,
        duplicateDescription,
        report,
      };
    });
  }, [branches, semesters, subjects, papers, blogs, seoMetadata, settings.siteUrl, settings.siteDescription]);

  const editingRow = useMemo(
    () => (editingSeoId ? combinedRows.find((r) => r.descriptor.seoId === editingSeoId) || null : null),
    [editingSeoId, combinedRows]
  );

  const otherSetsForEditor = useMemo(() => {
    const otherTitles = new Set<string>();
    const otherDescriptions = new Set<string>();
    for (const r of combinedRows) {
      if (editingRow && r.descriptor.seoId === editingRow.descriptor.seoId) continue;
      const t = r.seo.seoTitle.trim().toLowerCase();
      const d = r.seo.metaDescription.trim().toLowerCase();
      if (t) otherTitles.add(t);
      if (d) otherDescriptions.add(d);
    }
    return { otherTitles, otherDescriptions };
  }, [combinedRows, editingRow]);

  const stats = useMemo(() => {
    const total = combinedRows.length;
    const indexed = combinedRows.filter((r) => r.descriptor.isPublished && r.seo.robotsIndex).length;
    const noindex = total - indexed;
    const issues = combinedRows.filter((r) => r.report.failedCount > 0).length;
    const duplicates = combinedRows.filter((r) => r.duplicateTitle || r.duplicateDescription).length;
    const customized = combinedRows.filter((r) => r.seo.isCustomized).length;
    return { total, indexed, noindex, issues, duplicates, customized };
  }, [combinedRows]);

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return combinedRows.filter((row) => {
      if (typeFilter !== 'ALL' && row.descriptor.pageType !== typeFilter) return false;
      if (issueFilter === 'MISSING' && !row.missingDescription && !row.missingTitle) return false;
      if (issueFilter === 'DUPLICATE' && !row.duplicateTitle && !row.duplicateDescription) return false;
      if (issueFilter === 'THIN_CONTENT' && row.report.wordCount >= 75) return false;
      if (issueFilter === 'CUSTOMIZED' && !row.seo.isCustomized) return false;
      if (issueFilter === 'NOINDEX' && row.descriptor.isPublished && row.seo.robotsIndex) return false;

      if (q) {
        const hay = `${row.seo.pageName} ${row.seo.pagePath} ${row.seo.focusKeyword} ${row.seo.seoTitle} ${row.seo.metaDescription}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [combinedRows, searchText, typeFilter, issueFilter]);

  const handleBulkGenerateDefaults = async () => {
    setError(null);
    setStatusMessage(null);
    setSyncing(true);
    try {
      const res = await syncAllDefaultSeo({
        branches,
        semesters,
        subjects,
        papers,
        blogs,
        siteUrl: settings.siteUrl,
        siteDescription: settings.siteDescription,
      });
      await onRefresh();
      setStatusMessage(
        `On-Page SEO & content sync complete: ${res.created} registered, ${res.updated} auto-updated, ${res.skippedCustomized} customized pages preserved.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate default SEO metadata.');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Page Name',
      'Page Type',
      'Page URL',
      'Focus Keyword',
      'SEO Title',
      'Meta Description',
      'H1 Heading',
      'Word Count',
      'Checklist Passed',
      'Canonical URL',
      'Indexing Status',
      'Customized',
      'Last Updated',
    ];
    const rows = filteredRows.map((r) => [
      r.seo.pageName,
      SEO_PAGE_TYPE_LABELS[r.descriptor.pageType],
      r.seo.pagePath,
      r.seo.focusKeyword,
      r.seo.seoTitle,
      r.seo.metaDescription,
      r.seo.h1Heading,
      String(r.report.wordCount),
      `${r.report.passedCount}/${r.report.totalChecks}`,
      r.seo.canonicalUrl,
      !r.descriptor.isPublished
        ? 'Unpublished (Noindex)'
        : `${r.seo.robotsIndex ? 'Index' : 'Noindex'}, ${r.seo.robotsFollow ? 'Follow' : 'Nofollow'}`,
      r.seo.isCustomized ? 'Yes' : 'Auto',
      formatTimestamp(r.seo.updatedAt),
    ]);

    const csvContent = [headers, ...rows]
      .map((cols) => cols.map((c) => escapeCsvCell(String(c || ''))).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diplomatoppers-seo-pages-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleRunHealthCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHealthError(null);
    setRunningHealthCheck(true);
    try {
      const response = await fetch('/api/seo-health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: healthTargetUrl.trim() }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          `Health check endpoint returned HTTP ${response.status} instead of JSON: ${text.slice(0, 140)}`
        );
      }

      const payload = (await response.json()) as SeoHealthReport & { error?: string };
      if (!response.ok && payload.error) {
        throw new Error(payload.error);
      }
      setHealthReport(payload);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Failed to run production SEO health check.');
    } finally {
      setRunningHealthCheck(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">
            On-Page SEO &amp; Content Management
          </h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Configure focus keywords, titles, descriptions, H1–H3 headings, study guide content, FAQs, and indexing settings across all 7 public page types.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void handleBulkGenerateDefaults()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0D47A1] disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>Sync Auto SEO &amp; Content</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#202124] transition-colors hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <Download className="h-4 w-4" />
            <span>Export SEO List</span>
          </button>
        </div>
      </div>

      {/* SEO Inventory Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Public Pages</div>
          <div className="mt-1 text-xl font-extrabold tabular-nums">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Index, Follow</div>
          <div className="mt-1 text-xl font-extrabold text-emerald-600 tabular-nums dark:text-emerald-400">
            {stats.indexed}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Noindex Pages</div>
          <div className="mt-1 text-xl font-extrabold text-slate-600 tabular-nums dark:text-slate-300">
            {stats.noindex}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Customized</div>
          <div className="mt-1 text-xl font-extrabold text-[#1769D2] tabular-nums dark:text-blue-400">
            {stats.customized}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Checklist Issues</div>
          <div className="mt-1 text-xl font-extrabold text-amber-600 tabular-nums dark:text-amber-400">
            {stats.issues}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Duplicates</div>
          <div className="mt-1 text-xl font-extrabold text-red-600 tabular-nums dark:text-red-400">
            {stats.duplicates}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {statusMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Full 16-Field Individual SEO & Content Editor + Live Preview + Analyzer */}
      {editingRow && (
        <SeoEditorPanel
          descriptor={editingRow.descriptor}
          storedSeo={editingRow.stored}
          otherTitles={otherSetsForEditor.otherTitles}
          otherDescriptions={otherSetsForEditor.otherDescriptions}
          settings={settings}
          onSaved={async (msg) => {
            setStatusMessage(msg);
            setEditingSeoId(null);
            await onRefresh();
          }}
          onClose={() => setEditingSeoId(null)}
        />
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by page name, URL, focus keyword, title, or description..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <select
          aria-label="Filter by page type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'ALL' | SeoPageType)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="ALL">All Page Types</option>
          <option value="home">Homepage</option>
          <option value="branch">Branches</option>
          <option value="semester">Semesters</option>
          <option value="subject">Subjects</option>
          <option value="paper">Papers</option>
          <option value="blog">Blog Pages</option>
          <option value="static">Static Pages</option>
        </select>

        <select
          aria-label="Filter by SEO status"
          value={issueFilter}
          onChange={(e) => setIssueFilter(e.target.value as IssueFilter)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="ALL">All Statuses</option>
          <option value="MISSING">Missing Title / Description</option>
          <option value="DUPLICATE">Duplicate Title / Description</option>
          <option value="THIN_CONTENT">Short On-Page Content (&lt;75 words)</option>
          <option value="CUSTOMIZED">Customized Only</option>
          <option value="NOINDEX">Noindex Pages</option>
        </select>
      </div>

      {/* SEO Inventory Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-[#666666] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3">Page Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Page URL</th>
                <th className="px-4 py-3">SEO Title &amp; Keyword</th>
                <th className="px-4 py-3">On-Page Readiness</th>
                <th className="px-4 py-3">Indexing</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Edit SEO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((row) => {
                const effectivelyIndexed = row.descriptor.isPublished && row.seo.robotsIndex;
                return (
                  <tr key={row.descriptor.seoId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-[#202124] dark:text-white">
                        {row.seo.pageName}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[#666666] dark:text-slate-400">
                        {row.seo.isCustomized ? 'Custom SEO' : 'Auto-Generated'}
                        {row.duplicateTitle && ' · Duplicate Title'}
                        {row.duplicateDescription && ' · Duplicate Desc'}
                        {(row.missingDescription || row.missingTitle) && ' · Missing Meta'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-[#666666] dark:text-slate-400">
                      {SEO_PAGE_TYPE_LABELS[row.descriptor.pageType]}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-[#1769D2] dark:text-blue-400">
                      <a
                        href={row.seo.pagePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="max-w-[160px] truncate">{row.seo.pagePath}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#202124] dark:text-slate-200">
                      <div className="max-w-[240px] line-clamp-2 font-medium">{row.seo.seoTitle || '—'}</div>
                      <div className="mt-0.5 max-w-[240px] truncate text-[11px] text-[#666666] dark:text-slate-400">
                        KW: {row.seo.focusKeyword || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs tabular-nums">
                      <div
                        className={`font-bold ${
                          row.report.failedCount > 0
                            ? 'text-red-600 dark:text-red-400'
                            : row.report.warningCount > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {row.report.passedCount}/{row.report.totalChecks} checks
                      </div>
                      <div className="text-[11px] text-[#666666] dark:text-slate-400">
                        {row.report.wordCount} words · {row.seo.faqs.length} FAQs
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-semibold whitespace-nowrap">
                      {!row.descriptor.isPublished ? (
                        <span className="text-amber-600 dark:text-amber-400">Unpublished (Noindex)</span>
                      ) : effectivelyIndexed ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {row.seo.robotsFollow ? 'Index, Follow' : 'Index, Nofollow'}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          Noindex, {row.seo.robotsFollow ? 'Follow' : 'Nofollow'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#666666] tabular-nums whitespace-nowrap dark:text-slate-400">
                      {formatTimestamp(row.seo.updatedAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSeoId(row.descriptor.seoId);
                          setStatusMessage(null);
                          setError(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#202124] transition-colors hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-200"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit SEO</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No public pages match your current SEO filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automated Production SEO Health Check */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#1769D2]" />
              <h3 className="text-lg font-bold text-[#202124] dark:text-white">
                Automated Production SEO Health Check
              </h3>
              {!healthReport && !runningHealthCheck && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Not Checked Yet
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#666666] dark:text-slate-400">
              Runs 10 live HTTP probes directly against your deployed production website (using standard browsers, <code className="font-mono">Googlebot/2.1</code>, and <code className="font-mono">Google-InspectionTool/1.0</code> user agents) to verify <code className="font-mono">/robots.txt</code>, <code className="font-mono">/sitemap.xml</code>, canonicals, noindex directives, and HTTPS behavior.
            </p>
            {isRunningLocally && (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Running in local preview: checks strictly target your deployed production URL below (never localhost).
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => void handleRunHealthCheck(e)}
            className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[430px]"
          >
            <input
              type="url"
              required
              aria-label="Deployed production domain URL"
              value={healthTargetUrl}
              onChange={(e) => setHealthTargetUrl(e.target.value)}
              placeholder="https://diplomatoppers.vercel.app"
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={runningHealthCheck}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1769D2] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {runningHealthCheck ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Running 10 Checks...</span>
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  <span>Run Production Health Check</span>
                </>
              )}
            </button>
          </form>
        </div>

        {healthError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{healthError}</span>
          </div>
        )}

        {healthReport && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{healthReport.summary.passed} Passed</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{healthReport.summary.failed} Failed</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{healthReport.summary.needsAttention} Needs Attention</span>
                </span>
              </div>
              <div className="text-[11px] text-[#666666] tabular-nums dark:text-slate-400">
                Target: <span className="font-mono font-semibold">{healthReport.targetUrl}</span> · Checked {formatCheckDateTime(healthReport.checkedAt)}
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {healthReport.checks.map((item) => {
                const badgeClass =
                  item.status === 'Passed'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : item.status === 'Needs Attention'
                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300';

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#666666] tabular-nums dark:text-slate-400">
                          #{item.number}
                        </span>
                        <span className="text-sm font-semibold text-[#202124] dark:text-white">
                          {item.title}
                        </span>
                        {item.httpStatus !== null && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            HTTP {item.httpStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-[#555555] dark:text-slate-300">
                        {item.details}
                      </p>
                      <div className="truncate font-mono text-[11px] text-[#1769D2] dark:text-blue-400">
                        {item.checkedUrl.startsWith('http') ? (
                          <a
                            href={item.checkedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <span className="truncate">{item.checkedUrl}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span>{item.checkedUrl}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${badgeClass}`}
                      >
                        {item.status === 'Passed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {item.status === 'Needs Attention' && <AlertTriangle className="h-3.5 w-3.5" />}
                        {item.status === 'Failed' && <XCircle className="h-3.5 w-3.5" />}
                        <span>{item.status}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Technical SEO Notes */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-xs leading-relaxed text-[#666666] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <div className="mb-1.5 flex items-center gap-2 font-bold text-[#202124] dark:text-white">
          <Globe className="h-4 w-4 text-[#1769D2]" />
          <span>Technical Indexing &amp; Search Console Guidance</span>
        </div>
        <p>
          Adding a page to <code className="font-mono">sitemap.xml</code> and configuring metadata provides the technical foundation for Google crawling and indexing, though it does not guarantee indexing or specific search positions. Admin pages (<code className="font-mono">/admin/*</code>), unpublished records, and pages set to <strong>Noindex</strong> are automatically excluded from <code className="font-mono">sitemap.xml</code>.
        </p>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[#1769D2] hover:underline dark:text-blue-400"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh SEO Inventory</span>
        </button>
      </div>
    </div>
  );
}
