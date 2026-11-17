import { Link } from 'react-router-dom';
import { useCatalog } from '../contexts/CatalogContext';
import { STANDARD_GTU_BRANCHES } from '../services/firestoreCatalog';

export function Footer() {
  const { branches, settings } = useCatalog();
  const year = new Date().getFullYear();
  const activeBranches = branches.length > 0 ? branches : STANDARD_GTU_BRANCHES;

  return (
    <footer className="bg-[#151515] text-slate-300 border-t border-neutral-800">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link
              to="/"
              className="inline-block text-xl font-extrabold tracking-tight text-[#4D9BFF] hover:text-blue-300"
            >
              DiplomaToppers
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-400">
              {settings.siteDescription ||
                'Organized archive of GTU Diploma Engineering previous year Summer and Winter examination question papers across branches, semesters, and subjects.'}
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">Engineering Branches</h2>
            <ul className="space-y-2 text-sm">
              {activeBranches.map((br) => (
                <li key={br.id}>
                  <Link to={`/${br.slug}`} className="text-neutral-400 transition-colors hover:text-white">
                    {br.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">Navigation</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-neutral-400 transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-neutral-400 transition-colors hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-neutral-400 transition-colors hover:text-white">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-white">Legal &amp; Policies</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy-policy" className="text-neutral-400 transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/disclaimer" className="text-neutral-400 transition-colors hover:text-white">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link to="/terms-and-conditions" className="text-neutral-400 transition-colors hover:text-white">
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-neutral-800 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center">
          <p>&copy; {year} DiplomaToppers. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>GTU Diploma Question Paper Archive</span>
            <Link
              to="/admin/login"
              aria-label="Admin Portal"
              className="text-neutral-600 transition-colors hover:text-neutral-300"
            >
              ad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
