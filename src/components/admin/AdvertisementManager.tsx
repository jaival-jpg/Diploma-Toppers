import { useState } from 'react';
import { Code2, Edit2, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { deleteAdvertisement, saveAdvertisement } from '../../services/firestoreCatalog';
import type { AdPlacement, AdType, Advertisement, BannerSize } from '../../types/academic';
import { AdSlot } from '../AdSlot';

interface AdvertisementManagerProps {
  ads: Advertisement[];
  onRefresh: () => Promise<void>;
  initialCreate?: boolean;
}

const AD_TYPES: Array<{ value: AdType; label: string; hint: string }> = [
  { value: 'banner', label: 'Banner (Adsterra)', hint: 'Paste Adsterra atOptions + invoke.js banner code' },
  { value: 'native_banner', label: 'Native Banner (Adsterra)', hint: 'Paste Adsterra Native Banner script + container div' },
  { value: 'popunder', label: 'Popunder (Adsterra)', hint: 'Paste Adsterra Popunder script (runs across all public pages)' },
  { value: 'social_bar', label: 'Social Bar (Adsterra)', hint: 'Paste Adsterra Social Bar script (runs across all public pages)' },
  { value: 'smartlink', label: 'Smartlink (Adsterra Direct Link)', hint: 'Paste your Adsterra Smartlink URL' },
  { value: 'custom', label: 'Custom Image Banner', hint: 'Upload a custom image banner + optional link' },
];

const BANNER_SIZES: BannerSize[] = ['728x90', '468x60', '320x50', '300x250', '160x300', '160x600'];

const PLACEMENTS: Array<{ value: AdPlacement; label: string }> = [
  { value: 'home_above_branches', label: 'Branch Selection Page — Above Branches' },
  { value: 'home_below_branches', label: 'Branch Selection Page — Below Branches' },
  { value: 'branch_above_semesters', label: 'Semester Selection Page — Above Semesters' },
  { value: 'branch_below_semesters', label: 'Semester Selection Page — Below Semesters' },
  { value: 'semester_above_subjects', label: 'Subject Selection Page — Above Subjects' },
  { value: 'semester_below_subjects', label: 'Subject Selection Page — Below Subjects' },
  { value: 'subject_above_papers', label: 'Papers Page — Above Papers List' },
  { value: 'subject_below_papers', label: 'Papers Page — Below Papers List' },
  { value: 'paper_above_details', label: 'Paper Details Page — Above Details' },
  { value: 'paper_below_details', label: 'Paper Details Page — Below Details' },
  { value: 'global', label: 'All Public Pages (Global Script)' },
  { value: 'admin_dashboard', label: 'Admin Dashboard' },
];

const PLACEMENT_LABELS: Record<string, string> = {
  ...Object.fromEntries(PLACEMENTS.map((p) => [p.value, p.label])),
  home_top: 'Branch Selection Page — Above Branches',
  branch: 'Semester Selection Page — Above Semesters',
  semester: 'Subject Selection Page — Above Subjects',
  subject: 'Papers Page — Above Papers List',
  paper: 'Paper Details Page — Above Details',
};

const AD_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  AD_TYPES.map((t) => [t.value, t.label.replace(' (Adsterra)', '').replace(' (Adsterra Direct Link)', '')])
);

export function AdvertisementManager({
  ads,
  onRefresh,
  initialCreate = false,
}: AdvertisementManagerProps) {
  const { getIdToken } = useAuth();
  const [showForm, setShowForm] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [adType, setAdType] = useState<AdType>('banner');
  const [bannerSize, setBannerSize] = useState<BannerSize>('300x250');
  const [placement, setPlacement] = useState<AdPlacement>('home_above_branches');
  const [adCode, setAdCode] = useState('');
  const [imageStoragePath, setImageStoragePath] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<AdPlacement>('home_above_branches');

  const isGlobalScriptType = adType === 'popunder' || adType === 'social_bar';
  const usesCodeInput =
    adType === 'banner' || adType === 'native_banner' || adType === 'popunder' || adType === 'social_bar';

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setAdType('banner');
    setBannerSize('300x250');
    setPlacement('home_above_branches');
    setAdCode('');
    setImageStoragePath('');
    setDestinationUrl('');
    setStartDate('');
    setEndDate('');
    setDisplayOrder(ads.length + 1);
    setIsActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (ad: Advertisement) => {
    setEditingId(ad.id);
    setTitle(ad.title);
    setAdType(ad.adType);
    setBannerSize((ad.bannerSize as BannerSize) || '300x250');
    setPlacement(ad.placement);
    setAdCode(ad.adCode || '');
    setImageStoragePath(ad.imageStoragePath || '');
    setDestinationUrl(ad.destinationUrl || '');
    setStartDate(ad.startDate || '');
    setEndDate(ad.endDate || '');
    setDisplayOrder(ad.displayOrder);
    setIsActive(ad.isActive);
    setError(null);
    setShowForm(true);
  };

  const handleTypeChange = (nextType: AdType) => {
    setAdType(nextType);
    if (nextType === 'popunder' || nextType === 'social_bar') {
      setPlacement('global');
    } else if (placement === 'global') {
      setPlacement('home_above_branches');
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingBanner(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Admin session expired. Please log in again.');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload-banner', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Banner upload requires the backend server. You can paste an image URL directly.');
      }
      const json = (await res.json()) as { imageStoragePath?: string; error?: string };
      if (!res.ok || !json.imageStoragePath) {
        throw new Error(json.error || 'Banner upload failed.');
      }
      setImageStoragePath(json.imageStoragePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner image.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (usesCodeInput && !adCode.trim()) {
      setError('Please paste the Adsterra code snippet for this advertisement.');
      return;
    }
    if (adType === 'smartlink' && !destinationUrl.trim()) {
      setError('Please enter your Adsterra Smartlink URL.');
      return;
    }
    if (adType === 'custom' && !imageStoragePath.trim() && !destinationUrl.trim()) {
      setError('Custom banner ads require an image or destination URL.');
      return;
    }

    setSaving(true);
    try {
      await saveAdvertisement(
        {
          title,
          adType,
          bannerSize: adType === 'banner' ? bannerSize : '',
          placement: isGlobalScriptType ? 'global' : placement,
          adCode: usesCodeInput ? adCode : '',
          imageStoragePath: adType === 'custom' || adType === 'smartlink' ? imageStoragePath : '',
          destinationUrl: adType === 'smartlink' || adType === 'custom' ? destinationUrl : '',
          startDate,
          endDate,
          displayOrder,
          isActive,
        },
        editingId || undefined
      );
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save advertisement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteAdvertisement(id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete advertisement.');
    }
  };

  const currentTypeHint = AD_TYPES.find((t) => t.value === adType)?.hint;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">
            Manage Adsterra Advertisements
          </h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Configure Adsterra Banner (468x60, 300x250, 160x300, 160x600, 320x50, 728x90), Native Banner, Popunder, Social Bar, and Smartlink ads.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1]"
        >
          <Plus className="h-4 w-4" />
          <span>Add Advertisement</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#202124] dark:text-white">
              {editingId ? 'Edit Advertisement' : 'New Adsterra Advertisement'}
            </h3>
            {currentTypeHint && (
              <span className="text-xs text-[#666666] dark:text-slate-400">{currentTypeHint}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Advertisement Name</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Home Top Banner 728x90"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Adsterra Ad Format</label>
              <select
                value={adType}
                onChange={(e) => handleTypeChange(e.target.value as AdType)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {AD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {adType === 'banner' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold">Banner Size</label>
                <select
                  value={bannerSize}
                  onChange={(e) => setBannerSize(e.target.value as BannerSize)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {BANNER_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold">Placement</label>
                <select
                  value={isGlobalScriptType ? 'global' : placement}
                  disabled={isGlobalScriptType}
                  onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {adType === 'banner' && (
            <div>
              <label className="mb-1 block text-xs font-semibold">Placement Container</label>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as AdPlacement)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {PLACEMENTS.filter((p) => p.value !== 'global').map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {usesCodeInput && (
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                <Code2 className="h-3.5 w-3.5 text-[#1769D2]" />
                <span>Paste Adsterra Code ({AD_TYPE_LABELS[adType]})</span>
              </label>
              <textarea
                rows={5}
                required
                value={adCode}
                onChange={(e) => setAdCode(e.target.value)}
                placeholder={
                  adType === 'banner'
                    ? `<script type="text/javascript">\n  atOptions = { 'key': '...', 'format': 'iframe', 'height': 250, 'width': 300, 'params': {} };\n</script>\n<script type="text/javascript" src="//www.highperformanceformat.com/.../invoke.js"></script>`
                    : adType === 'native_banner'
                    ? `<script async="async" data-cfasync="false" src="//pl...effectivegatecpm.com/.../invoke.js"></script>\n<div id="container-..."></div>`
                    : `<script type="text/javascript" src="//pl...effectivegatecpm.com/.../....js"></script>`
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-[#202124] focus:border-[#1769D2] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          {(adType === 'smartlink' || adType === 'custom') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  {adType === 'smartlink' ? 'Adsterra Smartlink Direct URL' : 'Destination URL'}
                </label>
                <input
                  type="url"
                  required={adType === 'smartlink'}
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Banner Image {adType === 'smartlink' ? '(Optional)' : ''}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={imageStoragePath}
                    onChange={(e) => setImageStoragePath(e.target.value)}
                    placeholder="Upload image or paste URL"
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[#1769D2] px-3 text-xs font-semibold text-[#1769D2] hover:bg-blue-50">
                    {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => void handleBannerUpload(e)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Start Date (Optional)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">End Date (Optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Display Order</label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1769D2]"
            />
            <span>Active</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{editingId ? 'Save Changes' : 'Save Advertisement'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[40px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Live Preview of Configured Slot Ads */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#202124] dark:text-white">Live Placement Preview</h3>
          <select
            value={previewPlacement}
            onChange={(e) => setPreviewPlacement(e.target.value as AdPlacement)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            {PLACEMENTS.filter((p) => p.value !== 'global').map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <AdSlot placement={previewPlacement} overrideAds={ads} compact />
        {!ads.some(
          (a) =>
            a.isActive &&
            a.placement === previewPlacement &&
            a.adType !== 'popunder' &&
            a.adType !== 'social_bar'
        ) && (
          <p className="text-xs text-[#666666] dark:text-slate-400">
            No active slot advertisement for this placement (hidden cleanly on public pages).
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-[#666666] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Placement</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ads.map((ad) => (
                <tr key={ad.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-[#202124] dark:text-white">{ad.title}</td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {AD_TYPE_LABELS[ad.adType] || ad.adType}
                    {ad.adType === 'banner' && ad.bannerSize ? ` · ${ad.bannerSize}` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666666] dark:text-slate-400">
                    {PLACEMENT_LABELS[ad.placement] || ad.placement}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={ad.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {ad.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(ad)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(ad.id)}
                        className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-500 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {ads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No Adsterra advertisements configured yet. Empty ad containers stay hidden on public pages.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
