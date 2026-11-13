import React, { createContext, useContext, useEffect, useState } from 'react';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const verifySession = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch('/api/admin/session', { headers });
        const data = (await res.json()) as { authenticated?: boolean };
        if (active) {
          setIsAdmin(Boolean(data.authenticated));
          if (!data.authenticated && token) {
            window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken(null);
          }
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
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json()) as { ok?: boolean; token?: string; error?: string };
    if (!res.ok || !data.ok || !data.token) {
      const msg = data.error || 'Incorrect password.';
      setAuthError(msg);
      throw new Error(msg);
    }
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setToken(data.token);
    setIsAdmin(true);
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
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
