import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { RelatedContentSection } from '../components/RelatedContentSection';
import { SeoHead } from '../components/SeoHead';

export function NotFoundPage({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title="Page Not Found | DiplomaToppers"
        description="The requested GTU Diploma page or question paper could not be found."
        path="/404"
        noindex
      />
      <Header />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#1769D2] dark:bg-blue-950/60 dark:text-blue-400">
          <FileQuestion className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold text-[#202124] dark:text-white">
          Page Not Found
        </h1>
        <p className="mt-3 max-w-md text-base text-[#666666] dark:text-slate-400">
          {message || 'The branch, semester, subject, or question paper you requested does not exist or is currently inactive.'}
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex min-h-[44px] items-center rounded-xl bg-[#1769D2] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0D47A1]"
        >
          Go to Homepage
        </Link>
      </main>
      <RelatedContentSection pageType="static" />
      <Footer />
    </div>
  );
}
