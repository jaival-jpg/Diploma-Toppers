import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getActiveAdvertisements,
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
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [seoMetadata, setSeoMetadata] = useState<SeoMetadata[]>([]);
  const [settings, setSettings] = useState<WebsiteSettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let [b, sem, subj, pap, adList, seoList, siteSettings] = await Promise.all([
        getActiveBranches(),
        getActiveSemesters(),
        getActiveSubjects(),
        getActivePapers(),
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
