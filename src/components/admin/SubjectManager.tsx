import { useMemo, useState } from 'react';
import { CheckCircle2, Edit2, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  deleteSubjectSafe,
  saveSubject,
  saveSubjectAcrossAllBranches,
} from '../../services/firestoreCatalog';
import type { Branch, Semester, Subject } from '../../types/academic';
import { slugify } from '../../utils/slugify';

interface SubjectManagerProps {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  onRefresh: () => Promise<void>;
  initialCreate?: boolean;
}

const ALL_BRANCHES_VALUE = '__ALL_BRANCHES__';

export function SubjectManager({
  branches,
  semesters,
  subjects,
  onRefresh,
  initialCreate = false,
}: SubjectManagerProps) {
  const [showForm, setShowForm] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>('ALL');

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const isAllBranches = !editingId && branchId === ALL_BRANCHES_VALUE;

  const branchSemesters = useMemo(
    () => semesters.filter((s) => s.branchId === branchId).sort((a, b) => a.semesterNumber - b.semesterNumber),
    [semesters, branchId]
  );
  const availableSemesterNumbers = useMemo(
    () =>
      Array.from(new Set(semesters.map((s) => s.semesterNumber))).sort((a, b) => a - b),
    [semesters]
  );

  const [semesterId, setSemesterId] = useState<string>('');
  const [semesterNumber, setSemesterNumber] = useState<number>(availableSemesterNumbers[0] || 1);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdSubjectUrl, setCreatedSubjectUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Subject | null>(null);

  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const semesterMap = new Map(semesters.map((s) => [s.id, s]));

  const effectiveSemesterId =
    branchSemesters.some((s) => s.id === semesterId) ? semesterId : branchSemesters[0]?.id || '';
  const effectiveSemesterNumber = availableSemesterNumbers.includes(semesterNumber)
    ? semesterNumber
    : availableSemesterNumbers[0] || 1;

  const openCreate = () => {
    const defaultBranch = branches[0]?.id || '';
    const firstSem = semesters.find((s) => s.branchId === defaultBranch);
    setEditingId(null);
    setBranchId(defaultBranch);
    setSemesterId(firstSem?.id || '');
    setSemesterNumber(firstSem?.semesterNumber || availableSemesterNumbers[0] || 1);
    setName('');
    setCode('');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setError(null);
    setSuccessMessage(null);
    setShowForm(true);
  };

  const openEdit = (subj: Subject) => {
    setEditingId(subj.id);
    setBranchId(subj.branchId);
    setSemesterId(subj.semesterId);
    setName(subj.name);
    setCode(subj.code);
    setSlug(subj.slug);
    setDescription(subj.description);
    setIsActive(subj.isActive);
    setError(null);
    setSuccessMessage(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllBranches && !effectiveSemesterId) {
      setError('Please select a valid semester.');
      return;
    }
    if (isAllBranches && availableSemesterNumbers.length === 0) {
      setError('No semesters exist yet. Create semesters first.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setCreatedSubjectUrl(null);
    try {
      const cleanSlug = slug || slugify(name);
      if (isAllBranches) {
        const res = await saveSubjectAcrossAllBranches({
          semesterNumber: effectiveSemesterNumber,
          name,
          code,
          slug: cleanSlug,
          description,
          isActive,
        });
        const skippedNote =
          res.skippedBranches.length > 0 ? ` Skipped: ${res.skippedBranches.join(', ')}.` : '';
        const firstMatchingBranch = branches.find((b) =>
          semesters.some((s) => s.branchId === b.id && s.semesterNumber === effectiveSemesterNumber)
        );
        if (firstMatchingBranch) {
          setCreatedSubjectUrl(
            `/${firstMatchingBranch.slug}/semester-${effectiveSemesterNumber}/${cleanSlug}`
          );
        }
        setSuccessMessage(
          `Subject created in ${res.createdCount} branch${res.createdCount === 1 ? '' : 'es'} for Semester ${effectiveSemesterNumber}. Related internal links across the homepage, branch, semester, and footer sections updated automatically.${skippedNote}`
        );
      } else {
        await saveSubject(
          {
            branchId,
            semesterId: effectiveSemesterId,
            name,
            code,
            slug: cleanSlug,
            description,
            isActive,
          },
          editingId || undefined
        );
        const br = branchMap.get(branchId);
        const sem = semesterMap.get(effectiveSemesterId);
        if (br && sem) {
          setCreatedSubjectUrl(`/${br.slug}/semester-${sem.semesterNumber}/${cleanSlug}`);
        }
        setSuccessMessage(
          `${editingId ? 'Subject updated' : 'Subject created'} successfully. Internal links across the homepage, related subjects, and footer section updated automatically.`
        );
      }
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subj: Subject) => {
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteSubjectSafe(subj.id);
      setConfirmDelete(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subject.');
      setConfirmDelete(null);
    }
  };

  const filteredSubjects = subjects.filter((s) => filterBranch === 'ALL' || s.branchId === filterBranch);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">Manage Subjects</h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Add subjects with GTU codes and SEO-friendly slugs to any branch or all branches at once.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={branches.length === 0 || semesters.length === 0}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Subject</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          {createdSubjectUrl && (
            <a
              href={createdSubjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline hover:opacity-80"
            >
              <span>View Subject Page</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-bold text-[#202124] dark:text-white">
            {editingId ? 'Edit Subject' : 'New Subject'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Branch</label>
              <select
                required
                value={branchId}
                onChange={(e) => {
                  const next = e.target.value;
                  setBranchId(next);
                  if (next !== ALL_BRANCHES_VALUE) {
                    const first = semesters.find((s) => s.branchId === next);
                    setSemesterId(first?.id || '');
                  }
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {!editingId && (
                  <option value={ALL_BRANCHES_VALUE}>
                    All Branches ({branches.length} branches)
                  </option>
                )}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Semester</label>
              {isAllBranches ? (
                <select
                  required
                  value={effectiveSemesterNumber}
                  onChange={(e) => setSemesterNumber(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {availableSemesterNumbers.map((num) => (
                    <option key={num} value={num}>
                      Semester {num}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  required
                  value={effectiveSemesterId}
                  onChange={(e) => setSemesterId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {branchSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {isAllBranches && (
              <div className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                This subject will be created in <strong>all branches</strong> that have{' '}
                <strong>Semester {effectiveSemesterNumber}</strong>, along with automatic SEO metadata for each branch.
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold">Subject Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingId) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g., Database Management System"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">GTU Subject Code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., 4331602"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">URL Slug</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="e.g., database-management-system"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief subject overview for students and search engines..."
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
            <span>Active (visible to students)</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {editingId
                  ? 'Save Changes'
                  : isAllBranches
                  ? 'Create Subject in All Branches'
                  : 'Create Subject'}
              </span>
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
            Delete subject &ldquo;{confirmDelete.name}&rdquo; ({confirmDelete.code})?
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
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
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
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Subject Name</th>
                <th className="px-4 py-3">Branch / Semester</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSubjects.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-semibold">{s.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#202124] dark:text-white">{s.name}</div>
                    <div className="font-mono text-xs text-[#666666] dark:text-slate-400">/{s.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666666] dark:text-slate-400">
                    {branchMap.get(s.branchId)?.name} · {semesterMap.get(s.semesterId)?.name}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={s.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {(() => {
                        const br = branchMap.get(s.branchId);
                        const sem = semesterMap.get(s.semesterId);
                        if (!br || !sem) return null;
                        return (
                          <a
                            href={`/${br.slug}/semester-${sem.semesterNumber}/${s.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open live subject page"
                            aria-label={`Open ${s.name} public page`}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        );
                      })()}
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
              {filteredSubjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No subjects created yet. Click &ldquo;Add New Subject&rdquo; to add a subject.
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
