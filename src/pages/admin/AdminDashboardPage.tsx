import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { SeoHead } from '../../components/SeoHead';
import { AdminOverview, type AdminSection } from '../../components/admin/AdminOverview';
import { AdvertisementManager } from '../../components/admin/AdvertisementManager';
import { BranchManager } from '../../components/admin/BranchManager';
import { PaperManager } from '../../components/admin/PaperManager';
import { SemesterManager } from '../../components/admin/SemesterManager';
import { SeoManagementManager } from '../../components/admin/SeoManagementManager';
import { SubjectManager } from '../../components/admin/SubjectManager';
import { WebsiteSettingsManager } from '../../components/admin/WebsiteSettingsManager';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalog } from '../../contexts/CatalogContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getAllAdvertisements,
  getAllBranches,
  getAllPapers,
  getAllSemesters,
  getAllSeoMetadata,
  getAllSubjects,
  getWebsiteSettings,
  initializeStandardGtuCatalog,
} from '../../services/firestoreCatalog';
import type { Advertisement, Branch, Paper, Semester, SeoMetadata, Subject, WebsiteSettingsMap } from '../../types/academic';

export function AdminDashboardPage() {
  const { authReady, isAdmin, isSuperAdmin, logout } = useAuth();
  const { refresh: refreshPublicCatalog } = useCatalog();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [section, setSection] = useState<AdminSection>('overview');
  const [openCreateOnSwitch, setOpenCreateOnSwitch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [seoMetadata, setSeoMetadata] = useState<SeoMetadata[]>([]);
  const [settings, setSettings] = useState<WebsiteSettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && !isAdmin) {
      navigate('/admin/login', { replace: true });
    }
  }, [authReady, isAdmin, navigate]);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      let [b, sem, subj, pap, adList, seoList, siteSet] = await Promise.all([
        getAllBranches(),
        getAllSemesters(),
        getAllSubjects(),
        getAllPapers(),
        getAllAdvertisements(),
        getAllSeoMetadata().catch(() => [] as SeoMetadata[]),
        getWebsiteSettings(),
      ]);
      if (b.length === 0) {
        await initializeStandardGtuCatalog();
        [b, sem, seoList] = await Promise.all([
          getAllBranches(),
          getAllSemesters(),
          getAllSeoMetadata().catch(() => [] as SeoMetadata[]),
        ]);
      }
      setBranches(b);
      setSemesters(sem);
      setSubjects(subj);
      setPapers(pap);
      setAds(adList);
      setSeoMetadata(seoList);
      setSettings(siteSet);
      await refreshPublicCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, refreshPublicCatalog]);

  useEffect(() => {
    if (authReady && isAdmin) {
      void loadAdminData();
    }
  }, [authReady, isAdmin, loadAdminData]);

  const handleNavigate = (next: AdminSection, openCreate = false) => {
    setOpenCreateOnSwitch(openCreate);
    setSection(next);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  if (!authReady || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F8FD] dark:bg-[#0B1120]">
        <div className="text-sm font-medium text-[#666666] dark:text-slate-400">
          Verifying administrator authorization...
        </div>
      </div>
    );
  }

  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: typeof LayoutDashboard;
    superOnly?: boolean;
  }> = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'branches', label: 'Manage Branches', icon: GitBranch },
    { id: 'semesters', label: 'Manage Semesters', icon: Layers },
    { id: 'subjects', label: 'Manage Subjects', icon: BookOpen },
    { id: 'papers', label: 'Manage Papers', icon: FileText },
    { id: 'ads', label: 'Manage Advertisements', icon: Megaphone, superOnly: true },
    { id: 'seo', label: 'SEO Management', icon: Globe },
    { id: 'settings', label: 'Website Settings', icon: Settings, superOnly: true },
  ];

  const visibleNav = navItems.filter((item) => !item.superOnly || isSuperAdmin);

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <div className="px-3 py-3">
          <div className="text-lg font-extrabold text-[#1769D2] dark:text-blue-400">
            DiplomaToppers
          </div>
          <div className="mt-0.5 text-xs text-[#666666] dark:text-slate-400">
            Admin Console
          </div>
        </div>

        <nav className="mt-4 space-y-1" aria-label="Admin navigation">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id, false)}
                className={`flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[#1769D2] text-white'
                    : 'text-[#202124] hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2 dark:border-slate-800">
        <div className="px-3 text-xs text-[#666666] truncate dark:text-slate-400">
          Administrator
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title="Admin Dashboard | DiplomaToppers"
        description="DiplomaToppers administration console."
        path="/admin/dashboard"
        noindex
      />

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <div className="sticky top-0 h-screen overflow-y-auto">{renderSidebarContent()}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 bg-white shadow-xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open admin sidebar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden dark:border-slate-700"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-bold text-[#202124] dark:text-white">
              {visibleNav.find((n) => n.id === section)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-[#1769D2] dark:border-slate-700 dark:text-slate-300"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-[#202124] hover:border-[#1769D2] hover:text-[#1769D2] whitespace-nowrap dark:border-slate-700 dark:text-slate-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>View Site</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <AdminOverview
                  branches={branches}
                  semesters={semesters}
                  subjects={subjects}
                  papers={papers}
                  ads={ads}
                  isSuperAdmin={isSuperAdmin}
                  onNavigate={handleNavigate}
                />
              )}
              {section === 'branches' && (
                <BranchManager
                  branches={branches}
                  onRefresh={loadAdminData}
                  initialCreate={openCreateOnSwitch}
                />
              )}
              {section === 'semesters' && (
                <SemesterManager
                  branches={branches}
                  semesters={semesters}
                  onRefresh={loadAdminData}
                  initialCreate={openCreateOnSwitch}
                />
              )}
              {section === 'subjects' && (
                <SubjectManager
                  branches={branches}
                  semesters={semesters}
                  subjects={subjects}
                  onRefresh={loadAdminData}
                  initialCreate={openCreateOnSwitch}
                />
              )}
              {section === 'papers' && (
                <PaperManager
                  branches={branches}
                  semesters={semesters}
                  subjects={subjects}
                  papers={papers}
                  onRefresh={loadAdminData}
                  initialCreate={openCreateOnSwitch}
                />
              )}
              {section === 'ads' && isSuperAdmin && (
                <AdvertisementManager
                  ads={ads}
                  onRefresh={loadAdminData}
                  initialCreate={openCreateOnSwitch}
                />
              )}
              {section === 'seo' && (
                <SeoManagementManager
                  branches={branches}
                  semesters={semesters}
                  subjects={subjects}
                  papers={papers}
                  seoMetadata={seoMetadata}
                  settings={settings}
                  onRefresh={loadAdminData}
                />
              )}
              {section === 'settings' && isSuperAdmin && (
                <WebsiteSettingsManager settings={settings} onRefresh={loadAdminData} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
