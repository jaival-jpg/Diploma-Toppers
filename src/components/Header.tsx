import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'Branches', href: '/#branches' },
    { label: 'Recent Papers', href: '/#recent-papers' },
    { label: 'GTU Updates', href: '/#gtu-updates' },
    { label: 'About', href: '/about' },
  ];

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('/#') && location.pathname === '/') {
      const id = href.slice(2);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-black">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark ("Diploma" in blue, "Toppers" in white Agbalumo font) */}
        <Link
          to="/"
          className="inline-flex items-baseline whitespace-nowrap shrink-0 tracking-tight transition-opacity hover:opacity-90"
        >
          <span className="text-xl font-extrabold text-[#4D9BFF]">Diploma</span>
          <span className="font-agbalumo text-[1.375rem] tracking-normal text-white">Toppers</span>
        </Link>

        {/* Zone 2: Single-line navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              onClick={() => handleNavClick(item.href)}
              className="text-sm font-medium text-[#4D9BFF] underline-offset-4 transition-colors hover:text-blue-300 hover:underline whitespace-nowrap shrink-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: Dark mode toggle & mobile three-line menu (white text/icons) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 text-sm font-medium text-white transition-colors hover:border-neutral-600 hover:bg-neutral-900 whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-white" />}
            <span className="hidden sm:inline text-white">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 text-white transition-colors hover:border-neutral-600 hover:bg-neutral-900 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-neutral-800 bg-black px-4 py-4 md:hidden">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => handleNavClick(item.href)}
                className="flex min-h-[44px] items-center rounded-xl px-3 text-base font-medium text-[#4D9BFF] transition-colors hover:bg-neutral-900 hover:text-blue-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
