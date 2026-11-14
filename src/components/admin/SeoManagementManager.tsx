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
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import {
  resetSeoMetadataToDefault,
  saveSeoMetadata,
  syncAllDefaultSeo,
} from '../../services/firestoreCatalog';
import {
  collectCatalogPageDescriptors,
  mergeDescriptorWithSeo,
  type SeoPageDescriptor,
} from '../../services/seoDefaults';
import type {
  Branch,
  Paper,
  Semester,
  SeoMetadata,
  SeoPageType,
  Subject,
  WebsiteSettingsMap,
} from '../../types/academic';

interface SeoManagementManagerProps {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  seoMetadata: SeoMetadata[];
  settings: WebsiteSettingsMap;
  onRefresh: () => Promise<void>;
}

interface CombinedSeoRow {
  descriptor: SeoPageDescriptor;
  seo: SeoMetadata;
  missingDescription: boolean;
  missingTitle: boolean;
  duplicateTitle: boolean;
}

const PAGE_TYPE_LABELS: Record<SeoPageType, string> = {
  home: 'Homepage',
  branch: 'Branch',
  semester: 'Semester',
  subject: 'Subject',
  paper: 'Paper',
  static: 'Static Page',
};

type IssueFilter = 'ALL' | 'MISSING' | 'DUPLICATE' | 'CUSTOMIZED' | 'NOINDEX';

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
  seoMetadata,
  settings,
  onRefresh,
}: SeoManagementManagerProps) {
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SeoPageType>('ALL');
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('ALL');

  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active editor state
  const [editingRow, setEditingRow] = useState<CombinedSeoRow | null>(null);
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [robotsDirective, setRobotsDirective] = useState<'index_follow' | 'noindex_nofollow'>('index_follow');

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
      siteUrl: settings.siteUrl,
      siteDescription: settings.siteDescription,
    });

    const baseList = descriptors.map((descriptor) => {
      const seo = mergeDescriptorWithSeo(descriptor, storedMap.get(descriptor.seoId));
      return { descriptor, seo };
    });

    const titleCounts = new Map<string, number>();
    for (const item of baseList) {
      const key = item.seo.seoTitle.trim().toLowerCase();
      if (key) {
        titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
      }
    }

    return baseList.map(({ descriptor, seo }) => {
      const normTitle = seo.seoTitle.trim().toLowerCase();
      return {
        descriptor,
        seo,
        missingTitle: !seo.seoTitle.trim(),
        missingDescription: !seo.metaDescription.trim(),
        duplicateTitle: Boolean(normTitle && (titleCounts.get(normTitle) || 0) > 1),
      };
    });
  }, [branches, semesters, subjects, papers, seoMetadata, settings.siteUrl, settings.siteDescription]);

  const stats = useMemo(() => {
    const total = combinedRows.length;
    const indexed = combinedRows.filter((r) => r.descriptor.isPublished && r.seo.robotsIndex).length;
    const noindex = total - indexed;
    const missingDesc = combinedRows.filter((r) => r.missingDescription || r.missingTitle).length;
    const duplicateTitles = combinedRows.filter((r) => r.duplicateTitle).length;
    const customized = combinedRows.filter((r) => r.seo.isCustomized).length;
    return { total, indexed, noindex, missingDesc, duplicateTitles, customized };
  }, [combinedRows]);

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return combinedRows.filter((row) => {
      if (typeFilter !== 'ALL' && row.descriptor.pageType !== typeFilter) return false;
      if (issueFilter === 'MISSING' && !row.missingDescription && !row.missingTitle) return false;
      if (issueFilter === 'DUPLICATE' && !row.duplicateTitle) return false;
      if (issueFilter === 'CUSTOMIZED' && !row.seo.isCustomized) return false;
      if (issueFilter === 'NOINDEX' && row.descriptor.isPublished && row.seo.robotsIndex) return false;

      if (q) {
        const hay = `${row.seo.pageName} ${row.seo.pagePath} ${row.seo.seoTitle} ${row.seo.metaDescription}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [combinedRows, searchText, typeFilter, issueFilter]);

  const openEditor = (row: CombinedSeoRow) => {
    setEditingRow(row);
    setSeoTitle(row.seo.seoTitle);
    setMetaDescription(row.seo.metaDescription);
    setCanonicalUrl(row.seo.canonicalUrl || row.descriptor.defaultCanonical);
    setOgTitle(row.seo.ogTitle || row.seo.seoTitle);
    setOgDescription(row.seo.ogDescription || row.seo.metaDescription);
    setOgImageUrl(row.seo.ogImageUrl || '');
    setRobotsDirective(
      row.seo.robotsIndex && row.seo.robotsFollow ? 'index_follow' : 'noindex_nofollow'
    );
    setError(null);
    setStatusMessage(null);
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setError(null);

    if (!seoTitle.trim()) {
      setError('SEO Title is required.');
      return;
    }
    if (!metaDescription.trim()) {
      setError('Meta Description is required.');
      return;
    }

    setSaving(true);
    try {
      const isIndexFollow = robotsDirective === 'index_follow';
      await saveSeoMetadata({
        pageType: editingRow.descriptor.pageType,
        pageReferenceId: editingRow.descriptor.pageReferenceId,
        pageName: editingRow.descriptor.pageName,
        pagePath: editingRow.descriptor.pagePath,
        seoTitle,
        metaDescription,
        canonicalUrl: canonicalUrl.trim() || editingRow.descriptor.defaultCanonical,
        ogTitle: ogTitle.trim() || seoTitle.trim(),
        ogDescription: ogDescription.trim() || metaDescription.trim(),
        ogImageUrl,
        robotsIndex: isIndexFollow,
        robotsFollow: isIndexFollow,
        isCustomized: true,
      });
      setStatusMessage(`Saved custom SEO metadata for "${editingRow.descriptor.pageName}".`);
      setEditingRow(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SEO metadata.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!editingRow) return;
    setError(null);
    setResetting(true);
    try {
      await resetSeoMetadataToDefault(editingRow.descriptor);
      setSeoTitle(editingRow.descriptor.defaultTitle);
      setMetaDescription(editingRow.descriptor.defaultDescription);
      setCanonicalUrl(editingRow.descriptor.defaultCanonical);
      setOgTitle(editingRow.descriptor.defaultTitle);
      setOgDescription(editingRow.descriptor.defaultDescription);
      setOgImageUrl('');
      setRobotsDirective(editingRow.descriptor.isPublished ? 'index_follow' : 'noindex_nofollow');
      setStatusMessage(`Reset SEO metadata for "${editingRow.descriptor.pageName}" back to auto-generated default.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset SEO metadata.');
    } finally {
      setResetting(false);
    }
  };

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
        siteUrl: settings.siteUrl,
        siteDescription: settings.siteDescription,
      });
      await onRefresh();
      setStatusMessage(
        `Default SEO sync complete: ${res.created} registered, ${res.updated} auto-updated, ${res.skippedCustomized} customized pages preserved.`
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
      'SEO Title',
      'Meta Description',
      'Canonical URL',
      'Indexing Status',
      'Customized',
      'Last Updated',
    ];
    const rows = filteredRows.map((r) => [
      r.seo.pageName,
      PAGE_TYPE_LABELS[r.descriptor.pageType],
      r.seo.pagePath,
      r.seo.seoTitle,
      r.seo.metaDescription,
      r.seo.canonicalUrl,
      !r.descriptor.isPublished
        ? 'Unpublished (Noindex)'
        : r.seo.robotsIndex
        ? 'Index, Follow'
        : 'Noindex, Nofollow',
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

  const titleLen = seoTitle.trim().length;
  const descLen = metaDescription.trim().length;

  const previewUrlFormatted = useMemo(() => {
    const raw = (canonicalUrl || editingRow?.descriptor.defaultCanonical || 'https://diplomatoppers.in').trim();
    try {
      const parsed = new URL(raw);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parts.length > 0 ? `${parsed.origin} › ${parts.join(' › ')}` : parsed.origin;
    } catch {
      return raw;
    }
  }, [canonicalUrl, editingRow]);

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
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">SEO Management</h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Configure page titles, meta descriptions, canonical URLs, Open Graph cards, and indexing directives for every public page.
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
            <span>Generate Default Metadata</span>
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

      {/* SEO Health Summary */}
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
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Missing Meta</div>
          <div className="mt-1 text-xl font-extrabold text-amber-600 tabular-nums dark:text-amber-400">
            {stats.missingDesc}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-[#666666] dark:text-slate-400">Duplicate Titles</div>
          <div className="mt-1 text-xl font-extrabold text-red-600 tabular-nums dark:text-red-400">
            {stats.duplicateTitles}
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

      {/* Individual SEO Editor + Live Mobile Google Preview */}
      {editingRow && (
        <div className="rounded-2xl border-2 border-[#1769D2]/30 bg-white p-6 shadow-sm dark:border-blue-500/30 dark:bg-slate-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="text-xs font-semibold text-[#1769D2] dark:text-blue-400">
                Editing {PAGE_TYPE_LABELS[editingRow.descriptor.pageType]} · {editingRow.descriptor.pagePath}
              </div>
              <h3 className="mt-0.5 text-lg font-bold text-[#202124] dark:text-white">
                {editingRow.descriptor.pageName}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setEditingRow(null)}
              aria-label="Close SEO editor"
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!editingRow.descriptor.isPublished && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This page is currently inactive/unpublished. Unpublished pages are automatically excluded from sitemap.xml and forced to noindex on the public site until published.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Form Column */}
            <form onSubmit={(e) => void handleSaveEditor(e)} className="space-y-4 lg:col-span-7">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <label htmlFor="seo-title-input">SEO Title</label>
                  <span
                    className={`tabular-nums ${
                      titleLen >= 30 && titleLen <= 60
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : titleLen > 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[#666666] dark:text-slate-400'
                    }`}
                  >
                    {titleLen} / 60 chars (optimal 30–60)
                  </span>
                </div>
                <input
                  id="seo-title-input"
                  type="text"
                  required
                  maxLength={200}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <label htmlFor="seo-desc-input">Meta Description</label>
                  <span
                    className={`tabular-nums ${
                      descLen >= 120 && descLen <= 160
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : descLen > 160
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[#666666] dark:text-slate-400'
                    }`}
                  >
                    {descLen} / 160 chars (optimal 120–160)
                  </span>
                </div>
                <textarea
                  id="seo-desc-input"
                  rows={3}
                  required
                  maxLength={400}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="seo-canonical-input" className="mb-1 block text-xs font-semibold">
                    Canonical URL
                  </label>
                  <input
                    id="seo-canonical-input"
                    type="url"
                    maxLength={500}
                    value={canonicalUrl}
                    onChange={(e) => setCanonicalUrl(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="seo-robots-select" className="mb-1 block text-xs font-semibold">
                    Robots Index &amp; Follow Setting
                  </label>
                  <select
                    id="seo-robots-select"
                    value={robotsDirective}
                    onChange={(e) =>
                      setRobotsDirective(e.target.value as 'index_follow' | 'noindex_nofollow')
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="index_follow">Index, Follow (Recommended for public pages)</option>
                    <option value="noindex_nofollow">Noindex, Nofollow (Exclude from sitemap &amp; search)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                    <label htmlFor="seo-og-title">Open Graph Title</label>
                    <span className="text-[11px] text-[#666666] tabular-nums dark:text-slate-400">
                      {ogTitle.trim().length} chars
                    </span>
                  </div>
                  <input
                    id="seo-og-title"
                    type="text"
                    maxLength={200}
                    value={ogTitle}
                    onChange={(e) => setOgTitle(e.target.value)}
                    placeholder="Defaults to SEO Title"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="seo-og-image" className="mb-1 block text-xs font-semibold">
                    Open Graph Image URL
                  </label>
                  <input
                    id="seo-og-image"
                    type="url"
                    maxLength={500}
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    placeholder="https://.../og-banner.jpg"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <label htmlFor="seo-og-desc">Open Graph Description</label>
                  <span className="text-[11px] text-[#666666] tabular-nums dark:text-slate-400">
                    {ogDescription.trim().length} chars
                  </span>
                </div>
                <textarea
                  id="seo-og-desc"
                  rows={2}
                  maxLength={400}
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  placeholder="Defaults to Meta Description"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Save SEO Settings</span>
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => void handleResetToDefault()}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#202124] hover:border-[#1769D2] hover:text-[#1769D2] disabled:opacity-60 dark:border-slate-700 dark:text-slate-100"
                >
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  <span>Reset to Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Right Column: Live Mobile Google Search Result Preview */}
            <div className="space-y-3 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#666666] dark:text-slate-400">
                  Mobile Google Search Preview
                </h4>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1769D2] dark:bg-blue-950/50 dark:text-blue-300">
                  Live Preview
                </span>
              </div>

              <div className="mx-auto max-w-[380px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#1f1f1f]">
                {/* Site Header & Favicon */}
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1769D2] text-[11px] font-extrabold text-white">
                    DT
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-[#202124] dark:text-[#dadce0]">
                      {settings.siteTitle?.trim() || 'DiplomaToppers'}
                    </div>
                    <div className="truncate text-[11px] text-[#4d5156] dark:text-[#bdc1c6]">
                      {previewUrlFormatted}
                    </div>
                  </div>
                </div>

                {/* Search Title */}
                <div className="mt-2.5 line-clamp-2 text-[18px] leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
                  {seoTitle.trim() || editingRow.descriptor.defaultTitle}
                </div>

                {/* Meta Description */}
                <div className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[#4d5156] dark:text-[#bdc1c6]">
                  {metaDescription.trim() || editingRow.descriptor.defaultDescription}
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[#666666] dark:text-slate-400">
                <strong>Preview Notice:</strong> This preview approximates a mobile Google Search result and is not a guarantee of Google&apos;s final snippet. Google may dynamically rewrite titles or descriptions based on search queries and page content.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by page name, URL, SEO title, or description..."
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
          <option value="static">Static Pages</option>
        </select>

        <select
          aria-label="Filter by SEO status"
          value={issueFilter}
          onChange={(e) => setIssueFilter(e.target.value as IssueFilter)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="ALL">All Statuses</option>
          <option value="MISSING">Missing Metadata</option>
          <option value="DUPLICATE">Duplicate SEO Titles</option>
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
                <th className="px-4 py-3">Page Type</th>
                <th className="px-4 py-3">Page URL</th>
                <th className="px-4 py-3">SEO Title</th>
                <th className="px-4 py-3">Meta Description</th>
                <th className="px-4 py-3">Indexing Status</th>
                <th className="px-4 py-3">Last Updated</th>
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
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.seo.isCustomized && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1769D2] dark:bg-blue-950/60 dark:text-blue-300">
                            Customized
                          </span>
                        )}
                        {row.duplicateTitle && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                            Duplicate Title
                          </span>
                        )}
                        {(row.missingDescription || row.missingTitle) && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            Missing Meta
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-medium text-[#666666] dark:text-slate-400">
                      {PAGE_TYPE_LABELS[row.descriptor.pageType]}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-[#1769D2] dark:text-blue-400">
                      <a
                        href={row.seo.pagePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <span className="max-w-[180px] truncate">{row.seo.pagePath}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#202124] dark:text-slate-200">
                      <div className="max-w-[220px] line-clamp-2">{row.seo.seoTitle || '—'}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#666666] dark:text-slate-400">
                      <div className="max-w-[260px] line-clamp-2">
                        {row.seo.metaDescription || '—'}
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
                        <span className="text-slate-500 dark:text-slate-400">Noindex, Nofollow</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#666666] tabular-nums whitespace-nowrap dark:text-slate-400">
                      {formatTimestamp(row.seo.updatedAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => openEditor(row)}
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
          Adding a page to <code className="font-mono">sitemap.xml</code> and configuring metadata provides the technical foundation for Google crawling and indexing, though it does not guarantee indexing. Admin pages (<code className="font-mono">/admin/*</code>), unpublished records, and pages set to <strong>Noindex</strong> are automatically excluded from <code className="font-mono">sitemap.xml</code>. Use Google Search Console&apos;s URL Inspection tool to test live production pages.
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
