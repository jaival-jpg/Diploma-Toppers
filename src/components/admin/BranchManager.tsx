import { useState } from 'react';
import { Edit2, Loader2, Plus, Trash2 } from 'lucide-react';
import { deleteBranchSafe, saveBranch } from '../../services/firestoreCatalog';
import type { Branch } from '../../types/academic';
import { slugify } from '../../utils/slugify';

interface BranchManagerProps {
  branches: Branch[];
  onRefresh: () => Promise<void>;
  initialCreate?: boolean;
}

export function BranchManager({ branches, onRefresh, initialCreate = false }: BranchManagerProps) {
  const [showForm, setShowForm] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setSlug('');
    setDescription('');
    setDisplayOrder(branches.length + 1);
    setIsActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setName(b.name);
    setCode(b.code);
    setSlug(b.slug);
    setDescription(b.description);
    setDisplayOrder(b.displayOrder);
    setIsActive(b.isActive);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveBranch(
        { name, code, slug: slug || slugify(name), description, isActive, displayOrder },
        editingId || undefined
      );
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch: Branch) => {
    setError(null);
    try {
      await deleteBranchSafe(branch.id);
      setConfirmDelete(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete branch.');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">Manage Engineering Branches</h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Create, edit, activate/deactivate, or safely remove GTU Diploma branches.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1]"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Branch</span>
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
          <h3 className="text-base font-bold text-[#202124] dark:text-white">
            {editingId ? 'Edit Branch' : 'New Engineering Branch'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Branch Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingId) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g., Diploma Computer Engineering"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Branch Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., 07"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">URL Slug</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="e.g., computer-engineering"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
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
          <div>
            <label className="mb-1 block text-xs font-semibold">SEO Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short SEO-friendly branch summary..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1769D2]"
            />
            <span>Active (visible on public website and sitemap)</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{editingId ? 'Save Changes' : 'Create Branch'}</span>
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

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            Delete branch &ldquo;{confirmDelete.name}&rdquo; (Code {confirmDelete.code})?
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Branches that still contain semesters or subjects cannot be deleted.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void handleDelete(confirmDelete)}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Confirm Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-[#666666] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Branch Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 tabular-nums">{b.displayOrder}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{b.code}</td>
                  <td className="px-4 py-3 font-semibold text-[#202124] dark:text-white">{b.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#666666] dark:text-slate-400">/{b.slug}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={b.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        aria-label={`Edit ${b.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(b)}
                        aria-label={`Delete ${b.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-500 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No branches found. Click &ldquo;Add New Branch&rdquo; to create one.
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
