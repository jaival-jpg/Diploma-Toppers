import { useMemo, useState } from 'react';
import { CheckCircle2, Edit2, ExternalLink, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { deletePaperRecord, savePaper } from '../../services/firestoreCatalog';
import type { Branch, ExamSession, Paper, Semester, Subject } from '../../types/academic';
import { formatFileSize } from '../../utils/slugify';

interface PaperManagerProps {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  onRefresh: () => Promise<void>;
  initialCreate?: boolean;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function PaperManager({
  branches,
  semesters,
  subjects,
  papers,
  onRefresh,
  initialCreate = false,
}: PaperManagerProps) {
  const { getIdToken } = useAuth();

  const [showForm, setShowForm] = useState(initialCreate);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const branchSemesters = useMemo(
    () => semesters.filter((s) => s.branchId === branchId).sort((a, b) => a.semesterNumber - b.semesterNumber),
    [semesters, branchId]
  );
  const [semesterId, setSemesterId] = useState<string>('');
  const effectiveSemesterId = branchSemesters.some((s) => s.id === semesterId)
    ? semesterId
    : branchSemesters[0]?.id || '';

  const filteredSubjectsForSelect = useMemo(
    () => subjects.filter((s) => s.branchId === branchId && s.semesterId === effectiveSemesterId),
    [subjects, branchId, effectiveSemesterId]
  );
  const [subjectId, setSubjectId] = useState<string>('');
  const effectiveSubjectId = filteredSubjectsForSelect.some((s) => s.id === subjectId)
    ? subjectId
    : filteredSubjectsForSelect[0]?.id || '';

  const [examSession, setExamSession] = useState<ExamSession>('Summer');
  const [examYear, setExamYear] = useState<number>(2025);
  const [title, setTitle] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [pdfStoragePath, setPdfStoragePath] = useState('');
  const [originalFilename, setOriginalFilename] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Paper | null>(null);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const branchMap = new Map(branches.map((b) => [b.id, b]));
  const semesterMap = new Map(semesters.map((s) => [s.id, s]));

  const autoFillTitle = (subjId: string, sess: ExamSession, yr: number) => {
    const s = subjectMap.get(subjId);
    if (s) {
      setTitle(`${s.name} (${s.code}) - GTU ${sess} ${yr}`);
    }
  };

  const openCreate = () => {
    const bId = branches[0]?.id || '';
    const sem = semesters.find((s) => s.branchId === bId)?.id || '';
    const subj = subjects.find((s) => s.branchId === bId && s.semesterId === sem);
    setEditingPaper(null);
    setBranchId(bId);
    setSemesterId(sem);
    setSubjectId(subj?.id || '');
    setExamSession('Summer');
    setExamYear(2025);
    setTitle(subj ? `${subj.name} (${subj.code}) - GTU Summer 2025` : '');
    setPdfStoragePath('');
    setOriginalFilename('');
    setFileSize(0);
    setUploadProgress(null);
    setUploadStatus(null);
    setIsActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (p: Paper) => {
    setEditingPaper(p);
    setBranchId(p.branchId);
    setSemesterId(p.semesterId);
    setSubjectId(p.subjectId);
    setExamSession(p.examSession);
    setExamYear(p.examYear);
    setTitle(p.title);
    setPdfStoragePath(p.pdfStoragePath);
    setOriginalFilename(p.originalFilename);
    setFileSize(p.fileSize);
    setUploadProgress(null);
    setUploadStatus(null);
    setIsActive(p.isActive);
    setError(null);
    setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadStatus(null);

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files (.pdf) are allowed.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
      setError('PDF file size must be greater than 0 and under 25 MB.');
      return;
    }

    const token = await getIdToken();
    if (!token) {
      setError('Admin session expired. Please log in again.');
      return;
    }

    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/upload-pdf');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onload = () => {
        setUploadProgress(null);
        try {
          const json = JSON.parse(xhr.responseText) as {
            pdfStoragePath?: string;
            originalFilename?: string;
            fileSize?: number;
            error?: string;
          };
          if (xhr.status >= 200 && xhr.status < 300 && json.pdfStoragePath) {
            setPdfStoragePath(json.pdfStoragePath);
            setOriginalFilename(json.originalFilename || file.name);
            setFileSize(json.fileSize || file.size);
            setUploadStatus(`Uploaded ${json.originalFilename || file.name} (${formatFileSize(json.fileSize || file.size)})`);
          } else {
            setError(json.error || 'PDF upload failed.');
          }
        } catch {
          setError('Unexpected response during PDF upload.');
        }
        resolve();
      };

      xhr.onerror = () => {
        setUploadProgress(null);
        setError('Network error during PDF upload.');
        resolve();
      };

      xhr.send(formData);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveSubjectId) {
      setError('Please select a subject first (create a subject under Manage Subjects if none exist).');
      return;
    }
    if (!pdfStoragePath) {
      setError('Please upload a PDF file before saving the paper.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await savePaper(
        {
          subjectId: effectiveSubjectId,
          branchId,
          semesterId: effectiveSemesterId,
          title,
          examSession,
          examYear,
          pdfStoragePath,
          originalFilename,
          fileSize,
          isActive,
        },
        editingPaper?.id
      );
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question paper.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Paper) => {
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required.');
      await deletePaperRecord(p.id, token, p.pdfStoragePath);
      setConfirmDelete(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete paper.');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">Manage Question Papers</h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Upload Summer and Winter GTU examination PDFs, replace files, or update paper metadata.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={subjects.length === 0}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Paper</span>
        </button>
      </div>

      {subjects.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Add at least one subject under <strong>Manage Subjects</strong> before uploading question papers.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-bold text-[#202124] dark:text-white">
            {editingPaper ? 'Edit Question Paper & Replace PDF' : 'Upload New Question Paper'}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">1. Select Branch</label>
              <select
                required
                value={branchId}
                onChange={(e) => {
                  const bId = e.target.value;
                  setBranchId(bId);
                  const firstSem = semesters.find((s) => s.branchId === bId)?.id || '';
                  setSemesterId(firstSem);
                  const firstSubj = subjects.find((s) => s.branchId === bId && s.semesterId === firstSem)?.id || '';
                  setSubjectId(firstSubj);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">2. Select Semester</label>
              <select
                required
                value={effectiveSemesterId}
                onChange={(e) => {
                  const sId = e.target.value;
                  setSemesterId(sId);
                  const firstSubj = subjects.find((s) => s.branchId === branchId && s.semesterId === sId)?.id || '';
                  setSubjectId(firstSubj);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {branchSemesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">3. Select Subject</label>
              <select
                required
                value={effectiveSubjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  if (!editingPaper) autoFillTitle(e.target.value, examSession, examYear);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {filteredSubjectsForSelect.length === 0 ? (
                  <option value="">No subjects in this semester</option>
                ) : (
                  filteredSubjectsForSelect.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">4. Examination Session</label>
              <select
                required
                value={examSession}
                onChange={(e) => {
                  const sess = e.target.value as ExamSession;
                  setExamSession(sess);
                  if (!editingPaper) autoFillTitle(effectiveSubjectId, sess, examYear);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="Summer">Summer</option>
                <option value="Winter">Winter</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">5. Examination Year</label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                value={examYear}
                onChange={(e) => {
                  const yr = Number(e.target.value);
                  setExamYear(yr);
                  if (!editingPaper) autoFillTitle(effectiveSubjectId, examSession, yr);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">6. Paper Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Database Management System - GTU Summer 2025"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          {/* 7. PDF Upload */}
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-950/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[#202124] dark:text-white">
                  7. {editingPaper ? 'Replace or Keep PDF File' : 'Upload Question Paper PDF'}
                </div>
                <p className="mt-0.5 text-xs text-[#666666] dark:text-slate-400">
                  PDF format only · Maximum 25 MB · Select from computer or mobile storage
                </p>
              </div>
              <label className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#1769D2] bg-white px-4 py-2 text-xs font-semibold text-[#1769D2] transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-slate-900 dark:text-blue-400">
                <Upload className="h-4 w-4" />
                <span>{pdfStoragePath ? 'Choose Replacement PDF' : 'Select PDF File'}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => void handleFileChange(e)}
                  className="sr-only"
                />
              </label>
            </div>

            {uploadProgress !== null && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>Uploading PDF...</span>
                  <span className="tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-[#1769D2] transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {pdfStoragePath && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="truncate font-semibold">{originalFilename}</span>
                  <span className="tabular-nums">({formatFileSize(fileSize)})</span>
                </div>
                {uploadStatus && <span>{uploadStatus}</span>}
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1769D2]"
            />
            <span>Active (published on website and sitemap)</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || uploadProgress !== null}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{editingPaper ? 'Update Paper' : 'Save & Publish Paper'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {confirmDelete && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            Delete &ldquo;{confirmDelete.title}&rdquo;? This permanently removes the paper record and its PDF file.
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
                <th className="px-4 py-3">Paper Title</th>
                <th className="px-4 py-3">Subject &amp; Branch</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {papers.map((p) => {
                const subj = subjectMap.get(p.subjectId);
                const br = branchMap.get(p.branchId);
                const sem = semesterMap.get(p.semesterId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-[#202124] dark:text-white">
                        <FileText className="h-4 w-4 shrink-0 text-[#1769D2]" />
                        <span>{p.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#666666] dark:text-slate-400">
                      {subj ? `${subj.name} (${subj.code})` : p.subjectId} · {br?.name} · {sem?.name}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {p.examSession} {p.examYear}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-[#666666] dark:text-slate-400">
                      {formatFileSize(p.fileSize)} · {p.downloadCount} dl
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      <span className={p.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={p.pdfStoragePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View existing PDF"
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.title}`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p)}
                          aria-label={`Delete ${p.title}`}
                          className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-500 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {papers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No question papers uploaded yet.
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
