import { useState } from 'react';
import { CheckCircle2, Database, Loader2, Save } from 'lucide-react';
import { initializeStandardGtuCatalog, saveWebsiteSetting } from '../../services/firestoreCatalog';
import type { WebsiteSettingsMap } from '../../types/academic';

interface WebsiteSettingsManagerProps {
  settings: WebsiteSettingsMap;
  onRefresh: () => Promise<void>;
}

export function WebsiteSettingsManager({ settings, onRefresh }: WebsiteSettingsManagerProps) {
  const [siteTitle, setSiteTitle] = useState(settings.siteTitle || 'DiplomaToppers');
  const [siteDescription, setSiteDescription] = useState(
    settings.siteDescription ||
      'GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject.'
  );
  const [siteUrl, setSiteUrl] = useState(settings.siteUrl || '');
  const [googleVerification, setGoogleVerification] = useState(settings.googleVerification || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || 'support@diplomatoppers.in');
  const [aboutContent, setAboutContent] = useState(settings.aboutContent || '');

  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await Promise.all([
        saveWebsiteSetting('siteTitle', siteTitle.trim()),
        saveWebsiteSetting('siteDescription', siteDescription.trim()),
        saveWebsiteSetting('siteUrl', siteUrl.trim()),
        saveWebsiteSetting('googleVerification', googleVerification.trim()),
        saveWebsiteSetting('contactEmail', contactEmail.trim()),
        saveWebsiteSetting('aboutContent', aboutContent.trim()),
      ]);
      await onRefresh();
      setMessage('Website settings saved and synced to SEO metadata.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save website settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeCatalog = async () => {
    setSeeding(true);
    setMessage(null);
    setError(null);
    try {
      const res = await initializeStandardGtuCatalog();
      await onRefresh();
      setMessage(
        `GTU catalog verified: ${res.createdBranches} branches and ${res.createdSemesters} semesters added.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize catalog.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#202124] dark:text-white">Website &amp; SEO Settings</h2>
        <p className="text-sm text-[#666666] dark:text-slate-400">
          Configure canonical domain, Google Search Console verification, and public SEO metadata.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSave(e)}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold">Website Title</label>
            <input
              type="text"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Production Canonical Domain URL</label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://diplomatoppers.in"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Google Search Console Verification Code</label>
            <input
              type="text"
              value={googleVerification}
              onChange={(e) => setGoogleVerification(e.target.value)}
              placeholder="google-site-verification token value"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Contact Support Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold">Homepage SEO Meta Description</label>
            <textarea
              rows={2}
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold">About Us Content</label>
            <textarea
              rows={3}
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              placeholder="Custom About Us narrative for /about page..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Save Settings</span>
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-[#202124] dark:text-white">
          Standard GTU Branch &amp; Semester Setup
        </h3>
        <p className="mt-1 text-sm text-[#666666] dark:text-slate-400">
          Ensure all four GTU Diploma branches (Computer 07, Civil 06, Electrical 09, Mechanical 19) and their Semesters 1–6 exist in the database without overwriting custom edits.
        </p>
        <button
          type="button"
          disabled={seeding}
          onClick={() => void handleInitializeCatalog()}
          className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[#1769D2] px-4 py-2 text-sm font-semibold text-[#1769D2] hover:bg-blue-50 disabled:opacity-60 dark:border-blue-500 dark:text-blue-400"
        >
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          <span>Verify / Initialize GTU Branches &amp; Semesters</span>
        </button>
      </div>
    </div>
  );
}
