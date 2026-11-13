import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SeoHead } from '../../components/SeoHead';
import { useAuth } from '../../contexts/AuthContext';

export function AdminLoginPage() {
  const { isAdmin, authReady, loginWithPassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [authReady, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithPassword(password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F8FD] px-4 py-12 dark:bg-[#0B1120]">
      <SeoHead
        title="Admin Login | DiplomaToppers"
        description="DiplomaToppers administration access."
        path="/admin/login"
        noindex
      />

      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <input
            id="admin-password"
            type="password"
            aria-label="Password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-[#202124] focus:border-[#1769D2] focus:outline-none focus:ring-2 focus:ring-[#1769D2]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !authReady}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[#1769D2] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0D47A1] disabled:opacity-60"
          >
            {submitting ? 'Checking...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
