import { ArrowRight, BookOpen, FileText, GitBranch, Globe, Layers, Megaphone, Newspaper } from 'lucide-react';
import { AdSlot } from '../AdSlot';
import type { Advertisement, BlogPost, Branch, Paper, Semester, Subject } from '../../types/academic';
import { formatFileSize } from '../../utils/slugify';

export type AdminSection =
  | 'overview'
  | 'branches'
  | 'semesters'
  | 'subjects'
  | 'papers'
  | 'blogs'
  | 'ads'
  | 'seo'
  | 'settings';

interface AdminOverviewProps {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  blogs?: BlogPost[];
  ads: Advertisement[];
  isSuperAdmin: boolean;
  onNavigate: (section: AdminSection, openCreate?: boolean) => void;
}

export function AdminOverview({
  branches,
  semesters,
  subjects,
  papers,
  blogs = [],
  ads,
  isSuperAdmin,
  onNavigate,
}: AdminOverviewProps) {
  const activeAdsCount = ads.filter((a) => a.isActive).length;
  const recentUploads = [...papers]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 6);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const stats = [
    { label: 'Total Branches', value: branches.length },
    { label: 'Total Semesters', value: semesters.length },
    { label: 'Total Subjects', value: subjects.length },
    { label: 'Uploaded Papers', value: papers.length },
    { label: 'Blog Articles', value: blogs.length },
    { label: 'Active Ads', value: activeAdsCount },
  ];

  const actionCards: Array<{
    title: string;
    description: string;
    section: AdminSection;
    icon: typeof GitBranch;
    superOnly?: boolean;
  }> = [
    {
      title: 'Add New Branch',
      description: 'Create or configure a GTU Diploma engineering branch and code.',
      section: 'branches',
      icon: GitBranch,
    },
    {
      title: 'Add New Semester',
      description: 'Add and organize Semesters 1 to 6 under any branch.',
      section: 'semesters',
      icon: Layers,
    },
    {
      title: 'Add New Subject',
      description: 'Add a subject with GTU subject code and SEO slug.',
      section: 'subjects',
      icon: BookOpen,
    },
    {
      title: 'Add New Paper',
      description: 'Upload a Summer or Winter GTU question paper PDF.',
      section: 'papers',
      icon: FileText,
    },
    {
      title: 'Write Study Blog Post',
      description: 'Publish GTU exam strategy articles & study guides under /blog.',
      section: 'blogs',
      icon: Newspaper,
    },
    {
      title: 'Manage Advertisements',
      description: 'Configure Adsterra Banner, Native Banner, Popunder, Social Bar, and Smartlink ads.',
      section: 'ads',
      icon: Megaphone,
      superOnly: true,
    },
    {
      title: 'SEO & Content Manager',
      description: 'Edit focus keywords, headings, study content, FAQs, and run the On-Page SEO analyzer.',
      section: 'seo',
      icon: Globe,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Live Database Statistics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((st) => (
          <div
            key={st.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="text-xs font-medium text-[#666666] dark:text-slate-400">{st.label}</div>
            <div className="mt-2 text-2xl font-extrabold text-[#202124] tabular-nums dark:text-white">
              {st.value}
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard Action Cards */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-[#202124] dark:text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {actionCards
            .filter((c) => !c.superOnly || isSuperAdmin)
            .map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => onNavigate(card.section, true)}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-[#1769D2] hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
                >
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1769D2] transition-colors group-hover:bg-[#1769D2] group-hover:text-white dark:bg-blue-950/60 dark:text-blue-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-[#202124] dark:text-white">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#666666] dark:text-slate-400">
                      {card.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#1769D2] dark:text-blue-400">
                    <span>Open</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      {/* Admin Dashboard Advertisement Preview */}
      <AdSlot placement="admin_dashboard" overrideAds={ads} />

      {/* Recent Uploads */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#202124] dark:text-white">Recent Paper Uploads</h2>
          <button
            type="button"
            onClick={() => onNavigate('papers')}
            className="text-xs font-semibold text-[#1769D2] hover:underline dark:text-blue-400"
          >
            View All Papers
          </button>
        </div>

        {recentUploads.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#666666] dark:text-slate-400">
            No question papers uploaded yet. Click &ldquo;Add New Paper&rdquo; above to upload your first GTU PDF.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-[#666666] dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2.5 pr-4">Title</th>
                  <th className="py-2.5 pr-4">Subject</th>
                  <th className="py-2.5 pr-4">Session</th>
                  <th className="py-2.5 pr-4 text-right">Size</th>
                  <th className="py-2.5 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentUploads.map((p) => {
                  const subj = subjectMap.get(p.subjectId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-4 font-medium text-[#202124] dark:text-slate-100">{p.title}</td>
                      <td className="py-3 pr-4 text-[#666666] dark:text-slate-400">
                        {subj ? `${subj.name} (${subj.code})` : p.subjectId}
                      </td>
                      <td className="py-3 pr-4 text-[#666666] tabular-nums dark:text-slate-400">
                        {p.examSession} {p.examYear}
                      </td>
                      <td className="py-3 pr-4 text-right text-[#666666] tabular-nums dark:text-slate-400">
                        {formatFileSize(p.fileSize)}
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums text-[#202124] dark:text-slate-100">
                        {p.downloadCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
