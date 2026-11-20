import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getActiveAdvertisements,
  getActiveBlogPosts,
  getActiveBranches,
  getActivePapers,
  getActiveSemesters,
  getActiveSubjects,
  getAllBranches,
  getAllSeoMetadata,
  getWebsiteSettings,
  initializeStandardGtuCatalog,
} from '../services/firestoreCatalog';
import type {
  Advertisement,
  BlogPost,
  Branch,
  Paper,
  Semester,
  SeoMetadata,
  Subject,
  WebsiteSettingsMap,
} from '../types/academic';

interface CatalogContextValue {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  blogs: BlogPost[];
  ads: Advertisement[];
  seoMetadata: SeoMetadata[];
  settings: WebsiteSettingsMap;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue>({
  branches: [],
  semesters: [],
  subjects: [],
  papers: [],
  blogs: [],
  ads: [],
  seoMetadata: [],
  settings: {},
  loading: true,
  error: null,
  refresh: async () => {},
});

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [seoMetadata, setSeoMetadata] = useState<SeoMetadata[]>([]);
  const [settings, setSettings] = useState<WebsiteSettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let [b, sem, subj, pap, blogList, adList, seoList, siteSettings] = await Promise.all([
        getActiveBranches(),
        getActiveSemesters(),
        getActiveSubjects(),
        getActivePapers(),
        getActiveBlogPosts().catch(() => [] as BlogPost[]),
        getActiveAdvertisements(),
        getAllSeoMetadata().catch(() => [] as SeoMetadata[]),
        getWebsiteSettings(),
      ]);

      if (b.length === 0) {
        const allBranches = await getAllBranches();
        if (allBranches.length === 0) {
          await initializeStandardGtuCatalog();
          [b, sem, seoList, siteSettings] = await Promise.all([
            getActiveBranches(),
            getActiveSemesters(),
            getAllSeoMetadata().catch(() => [] as SeoMetadata[]),
            getWebsiteSettings(),
          ]);
        }
      }

      setBranches(b);
      setSemesters(sem);
      setSubjects(subj);
      setPapers(pap);
      setBlogs(blogList);
      setAds(adList);
      setSeoMetadata(seoList);
      setSettings(siteSettings);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the academic catalog. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  return (
    <CatalogContext.Provider
      value={{
        branches,
        semesters,
        subjects,
        papers,
        blogs,
        ads,
        seoMetadata,
        settings,
        loading,
        error,
        refresh: loadCatalog,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  return useContext(CatalogContext);
}
