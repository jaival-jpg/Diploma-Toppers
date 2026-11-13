import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getActiveAdvertisements,
  getActiveBranches,
  getActivePapers,
  getActiveSemesters,
  getActiveSubjects,
  getAllBranches,
  getWebsiteSettings,
  initializeStandardGtuCatalog,
} from '../services/firestoreCatalog';
import type {
  Advertisement,
  Branch,
  Paper,
  Semester,
  Subject,
  WebsiteSettingsMap,
} from '../types/academic';

interface CatalogContextValue {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  ads: Advertisement[];
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
  const [settings, setSettings] = useState<WebsiteSettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let [b, sem, subj, pap, adList, siteSettings] = await Promise.all([
        getActiveBranches(),
        getActiveSemesters(),
        getActiveSubjects(),
        getActivePapers(),
        getActiveAdvertisements(),
        getWebsiteSettings(),
      ]);

      if (b.length === 0) {
        const allBranches = await getAllBranches();
        if (allBranches.length === 0) {
          await initializeStandardGtuCatalog();
          [b, sem, siteSettings] = await Promise.all([
            getActiveBranches(),
            getActiveSemesters(),
            getWebsiteSettings(),
          ]);
        }
      }

      setBranches(b);
      setSemesters(sem);
      setSubjects(subj);
      setPapers(pap);
      setAds(adList);
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
