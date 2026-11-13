import React, { createContext, useContext, useEffect, useState } from 'react';

const LOCAL_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'jaivalpandya@123';
const LOCAL_AUTH_KEY = 'dt_admin_local_auth';
const TOKEN_STORAGE_KEY = 'dt_admin_token';

interface AuthContextValue {
  authReady: boolean;
  authError: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loginWithPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  authReady: false,
  authError: null,
  isAdmin: false,
  isSuperAdmin: false,
  loginWithPassword: async () => {},
  logout: async () => {},
  getIdToken: async () => null,
});

async function safeParseJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(LOCAL_AUTH_KEY) === 'true';
  });
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const verifySession = async () => {
      const localAuthed =
        typeof window !== 'undefined' && window.sessionStorage.getItem(LOCAL_AUTH_KEY) === 'true';

      if (localAuthed) {
        if (active) {
          setIsAdmin(true);
          setAuthReady(true);
        }
        return;
      }

      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch('/api/admin/session', { headers });
        const data = await safeParseJson<{ authenticated?: boolean }>(res);
        if (active && data) {
          setIsAdmin(Boolean(data.authenticated));
          if (!data.authenticated && token) {
            window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken(null);
          }
        } else if (active) {
          setIsAdmin(false);
        }
      } catch {
        if (active) setIsAdmin(false);
      } finally {
        if (active) setAuthReady(true);
      }
    };
    void verifySession();
    return () => {
      active = false;
    };
  }, [token]);

  const loginWithPassword = async (password: string) => {
    setAuthError(null);

    if (password !== LOCAL_ADMIN_PASSWORD) {
      const msg = 'Incorrect password';
      setAuthError(msg);
      throw new Error(msg);
    }

    window.sessionStorage.setItem(LOCAL_AUTH_KEY, 'true');
    setIsAdmin(true);

    // Best-effort sync with Express server if running (for PDF/banner upload routes)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await safeParseJson<{ ok?: boolean; token?: string }>(res);
      if (res.ok && data?.ok && data.token) {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        setToken(data.token);
      }
    } catch {
      // Ignore on static hosts like Vercel where /api/admin/login is not mounted
    }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    window.sessionStorage.removeItem(LOCAL_AUTH_KEY);
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setIsAdmin(false);
    setAuthError(null);
  };

  const getIdToken = async (): Promise<string | null> => {
    return token || window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        authReady,
        authError,
        isAdmin,
        isSuperAdmin: isAdmin,
        loginWithPassword,
        logout,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
