import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GlobalAdScripts } from './components/AdSlot';
import { AuthProvider } from './contexts/AuthContext';
import { CatalogProvider } from './contexts/CatalogContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BranchPage } from './pages/BranchPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PaperPage } from './pages/PaperPage';
import { SemesterPage } from './pages/SemesterPage';
import { StaticPage } from './pages/StaticPage';
import { SubjectPage } from './pages/SubjectPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CatalogProvider>
          <BrowserRouter>
            <GlobalAdScripts />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<StaticPage kind="about" />} />
              <Route path="/contact" element={<StaticPage kind="contact" />} />
              <Route path="/privacy-policy" element={<StaticPage kind="privacy" />} />
              <Route path="/terms-and-conditions" element={<StaticPage kind="terms" />} />
              <Route path="/disclaimer" element={<StaticPage kind="disclaimer" />} />

              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

              <Route path="/:branchSlug" element={<BranchPage />} />
              <Route path="/:branchSlug/:semSlug" element={<SemesterPage />} />
              <Route path="/:branchSlug/:semSlug/:subjectSlug" element={<SubjectPage />} />
              <Route path="/:branchSlug/:semSlug/:subjectSlug/:paperSlug" element={<PaperPage />} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </CatalogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
