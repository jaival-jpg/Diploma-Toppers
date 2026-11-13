import { useState } from 'react';
import { Edit2, Loader2, Plus, Trash2 } from 'lucide-react';
import { deleteSemesterSafe, saveSemester } from '../../services/firestoreCatalog';
import type { Branch, Semester } from '../../types/academic';

interface SemesterManagerProps {
  branches: Branch[];
  semesters: Semester[];
  onRefresh: () => Promise<void>;
  initialCreate?: boolean;
}

export function SemesterManager({
  branches,
  semesters,
  onRefresh,
  initialCreate = false,
}: SemesterManagerProps) {
  const [showForm, setShowForm] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [semesterNumber, setSemesterNumber] = useState<number>(1);
  const [name, setName] = useState('Semester 1');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Semester | null>(null);

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const filteredSemesters = semesters.filter(
    (s) => branchFilter === 'ALL' || s.branchId === branchFilter
  );

  const openCreate = () => {
    setEditingId(null);
    setBranchId(branches[0]?.id || '');
    setSemesterNumber(1);
    setName('Semester 1');
    setDisplayOrder(1);
    setIsActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (sem: Semester) => {
    setEditingId(sem.id);
    setBranchId(sem.branchId);
    setSemesterNumber(sem.semesterNumber);
    setName(sem.name);
    setDisplayOrder(sem.displayOrder);
    setIsActive(sem.isActive);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveSemester(
        { branchId, semesterNumber, name, isActive, displayOrder },
        editingId || undefined
      );
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save semester.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sem: Semester) => {
    setError(null);
    try {
      await deleteSemesterSafe(sem.id);
      setConfirmDelete(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete semester.');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">Manage Semesters</h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Configure Semesters 1 through 6 for each engineering branch.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={branches.length === 0}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Semester</span>
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
            {editingId ? 'Edit Semester' : 'New Semester'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">Branch</label>
              <select
                required
                disabled={Boolean(editingId)}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Semester Number (1–6)</label>
              <input
                type="number"
                required
                min={1}
                max={6}
                value={semesterNumber}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSemesterNumber(n);
                  if (!editingId) {
                    setName(`Semester ${n}`);
                    setDisplayOrder(n);
                  }
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Semester Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Display Order</label>
              <input
                type="number"
                min={1}
                max={6}
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
              <span>{editingId ? 'Save Changes' : 'Create Semester'}</span>
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

      {confirmDelete && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            Delete {confirmDelete.name} ({branchMap.get(confirmDelete.branchId)?.name})?
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

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-[#666666] dark:text-slate-400">Filter by Branch:</label>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="ALL">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-[#666666] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Sem #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSemesters.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{branchMap.get(s.branchId)?.name || s.branchId}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{s.semesterNumber}</td>
                  <td className="px-4 py-3 font-semibold text-[#202124] dark:text-white">{s.name}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={s.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        aria-label={`Edit ${s.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(s)}
                        aria-label={`Delete ${s.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-500 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSemesters.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No semesters found.
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
