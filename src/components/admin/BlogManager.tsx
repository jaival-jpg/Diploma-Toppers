import { useState } from 'react';
import {
  CheckCircle2,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { uploadBannerToCloud } from '../../services/cloudFileStorage';
import { deleteBlogPost, saveBlogPost } from '../../services/firestoreCatalog';
import { buildBlogPostSeoDefaults, type SeoPageDescriptor } from '../../services/seoDefaults';
import type { BlogPost, Branch, WebsiteSettingsMap } from '../../types/academic';
import { slugify } from '../../utils/slugify';

interface BlogManagerProps {
  blogs: BlogPost[];
  branches: Branch[];
  settings: WebsiteSettingsMap;
  onRefresh: () => Promise<void>;
  onOpenSeoEditor?: (descriptor: SeoPageDescriptor) => void;
  initialCreate?: boolean;
}

export function BlogManager({
  blogs,
  branches,
  settings,
  onRefresh,
  onOpenSeoEditor,
  initialCreate = false,
}: BlogManagerProps) {
  const [showForm, setShowForm] = useState(initialCreate);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Exam Strategy');
  const [authorName, setAuthorName] = useState('DiplomaToppers Editorial');
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [relatedBranchId, setRelatedBranchId] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageAlt, setCoverImageAlt] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BlogPost | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setCategory('Exam Strategy');
    setAuthorName('DiplomaToppers Editorial');
    setPublishedAt(new Date().toISOString().slice(0, 10));
    setRelatedBranchId('');
    setCoverImageUrl('');
    setCoverImageAlt('');
    setExcerpt('');
    setContent('');
    setIsActive(true);
    setError(null);
    setSuccessMessage(null);
    setShowForm(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setCategory(post.category || 'Exam Strategy');
    setAuthorName(post.authorName || 'DiplomaToppers Editorial');
    setPublishedAt((post.publishedAt || post.createdAt || new Date().toISOString()).slice(0, 10));
    setRelatedBranchId(post.relatedBranchId || '');
    setCoverImageUrl(post.coverImageUrl || '');
    setCoverImageAlt(post.coverImageAlt || '');
    setExcerpt(post.excerpt);
    setContent(post.content);
    setIsActive(post.isActive);
    setError(null);
    setSuccessMessage(null);
    setShowForm(true);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingCover(true);
    try {
      const uploaded = await uploadBannerToCloud(file);
      setCoverImageUrl(uploaded.imageStoragePath);
      if (!coverImageAlt.trim() && title.trim()) {
        setCoverImageAlt(`${title.trim()} — GTU Diploma study guide cover`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cover image upload failed.');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const cleanSlug = slugify(slug || title);
      await saveBlogPost(
        {
          title: title.trim(),
          slug: cleanSlug,
          excerpt: excerpt.trim(),
          content: content.trim(),
          category: category.trim() || 'Exam Strategy',
          authorName: authorName.trim() || 'DiplomaToppers Editorial',
          coverImageUrl: coverImageUrl.trim(),
          coverImageAlt: coverImageAlt.trim() || `${title.trim()} — GTU Diploma guide`,
          relatedBranchId,
          isActive,
          publishedAt,
        },
        editingId || undefined
      );
      setShowForm(false);
      setSuccessMessage(
        `${editingId ? 'Blog guide updated' : 'Blog guide published'} at /blog/${cleanSlug} with automatic On-Page SEO metadata.`
      );
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save blog post.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteBlogPost(post.id);
      setConfirmDelete(null);
      setSuccessMessage(`Deleted blog post "${post.title}".`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete blog post.');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#202124] dark:text-white">Manage Study Blog</h2>
          <p className="text-sm text-[#666666] dark:text-slate-400">
            Publish GTU Diploma exam guides, semester tips, and question paper study strategies indexed at <code className="font-mono">/blog</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1]"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Blog Post</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3 className="text-base font-bold text-[#202124] dark:text-white">
            {editingId ? 'Edit Blog Post' : 'New GTU Study Guide'}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Article Title</label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!editingId) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g., How to Prepare for GTU Diploma Semester 3 Computer Exams"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">URL Slug (/blog/...)</label>
              <input
                type="text"
                required
                maxLength={200}
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="gtu-diploma-sem-3-exam-preparation"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Category</label>
              <input
                type="text"
                required
                maxLength={80}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Exam Strategy / Syllabus Guide / Subject Tips"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Author Name</label>
              <input
                type="text"
                maxLength={100}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Publish Date</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Related Branch (optional CTA)</label>
              <select
                value={relatedBranchId}
                onChange={(e) => setRelatedBranchId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">None (General GTU Guide)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Cover Image URL or Upload</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={500}
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="/api/pdf-files/... or https://..."
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[#1769D2] px-3 text-xs font-semibold text-[#1769D2] hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400">
                  {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => void handleCoverUpload(e)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Cover Image Alt Text</label>
              <input
                type="text"
                maxLength={300}
                value={coverImageAlt}
                onChange={(e) => setCoverImageAlt(e.target.value)}
                placeholder="Descriptive alt text for search & accessibility"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Short Excerpt / Introduction</label>
            <textarea
              rows={2}
              required
              maxLength={600}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Concise 1–2 sentence summary shown on /blog cards and article intro..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">
              Full Article Body (separate paragraphs with blank lines)
            </label>
            <textarea
              rows={7}
              required
              maxLength={15000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write detailed GTU Diploma exam tips, unit revision breakdowns, and past paper practice guidance..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1769D2]"
            />
            <span>Active (published on /blog and sitemap.xml)</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || uploadingCover}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{editingId ? 'Save Changes' : 'Publish Blog Post'}</span>
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
            Delete blog article &ldquo;{confirmDelete.title}&rdquo;?
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
                <th className="px-4 py-3">Title &amp; Slug</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {blogs.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#202124] dark:text-white">{post.title}</div>
                    <div className="font-mono text-xs text-[#666666] dark:text-slate-400">
                      /blog/{post.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#666666] dark:text-slate-400">
                    {post.category}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-[#666666] dark:text-slate-400">
                    {(post.publishedAt || post.createdAt || '').slice(0, 10) || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span className={post.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {post.isActive ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View live blog post"
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {onOpenSeoEditor && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenSeoEditor(
                              buildBlogPostSeoDefaults(
                                post,
                                settings.siteUrl,
                                typeof window !== 'undefined' ? window.location.origin : undefined
                              )
                            )
                          }
                          title="Edit SEO & On-Page Content"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-[#1769D2] hover:border-[#1769D2] dark:border-slate-700 dark:text-blue-400"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          <span>SEO</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(post)}
                        aria-label={`Edit ${post.title}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-[#1769D2] hover:text-[#1769D2] dark:border-slate-700 dark:text-slate-300"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(post)}
                        aria-label={`Delete ${post.title}`}
                        className="rounded-lg border border-slate-200 p-2 text-red-600 hover:border-red-500 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {blogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#666666] dark:text-slate-400">
                    No blog posts published yet. Click &ldquo;Add New Blog Post&rdquo; to publish your first GTU study guide.
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
