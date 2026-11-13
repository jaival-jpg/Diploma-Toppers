import { Link } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { SeoHead } from '../components/SeoHead';
import { useCatalog } from '../contexts/CatalogContext';

export type StaticPageKind = 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer';

export function StaticPage({ kind }: { kind: StaticPageKind }) {
  const { settings } = useCatalog();
  const contactEmail = settings.contactEmail || 'support@diplomatoppers.in';

  const contentMap: Record<
    StaticPageKind,
    { title: string; seoTitle: string; description: string; path: string; body: string[] }
  > = {
    about: {
      title: 'About DiplomaToppers',
      seoTitle: 'About Us | DiplomaToppers',
      description:
        'Learn how DiplomaToppers helps GTU Diploma Engineering students access organized previous examination question papers.',
      path: '/about',
      body: [
        settings.aboutContent ||
          'DiplomaToppers is a dedicated academic repository built for Gujarat Technological University (GTU) Diploma Engineering students across Computer, Civil, Electrical, and Mechanical branches.',
        'Every previous examination question paper is organized cleanly by engineering branch, semester (1 to 6), subject code, and Summer/Winter examination session so students can locate, view, and download PDFs effortlessly on both mobile phones and desktop computers.',
      ],
    },
    contact: {
      title: 'Contact Us',
      seoTitle: 'Contact Us | DiplomaToppers',
      description: 'Reach out to the DiplomaToppers team for question paper requests, corrections, or feedback.',
      path: '/contact',
      body: [
        `Have a missing GTU Diploma question paper, subject code correction, or general academic inquiry? Contact our editorial team directly at ${contactEmail}.`,
        'When requesting a question paper, please mention your Engineering Branch, Semester number, Subject Name, Subject Code, and Examination Session (Summer or Winter) with Year.',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      seoTitle: 'Privacy Policy | DiplomaToppers',
      description: 'Read how DiplomaToppers handles visitor privacy, analytics, and advertising cookies.',
      path: '/privacy-policy',
      body: [
        'DiplomaToppers provides free access to GTU Diploma question papers without requiring student account registration or collecting personal student data.',
        'Aggregate download counts are recorded strictly to rank popular study resources. If advertising units (such as Adsterra banners, native ads, or partner links) are enabled by the site administrator, third-party advertising networks may use cookies or standard browser technologies to serve relevant ads.',
      ],
    },
    terms: {
      title: 'Terms and Conditions',
      seoTitle: 'Terms and Conditions | DiplomaToppers',
      description: 'Review the terms and conditions for using academic resources on DiplomaToppers.',
      path: '/terms-and-conditions',
      body: [
        'Question papers hosted on DiplomaToppers are provided solely for educational reference and examination preparation for GTU Diploma Engineering students.',
        'Automated scraping, bulk redistribution for commercial resale, or unauthorized modification of site endpoints is prohibited.',
      ],
    },
    disclaimer: {
      title: 'Academic Disclaimer',
      seoTitle: 'Disclaimer | DiplomaToppers',
      description: 'Read the academic disclaimer for DiplomaToppers GTU Diploma resources.',
      path: '/disclaimer',
      body: [
        'DiplomaToppers is an independent student-focused educational resource and is not officially affiliated with Gujarat Technological University (GTU).',
        'While administrators verify uploaded question papers carefully, students should always refer to official GTU circulars and syllabus documents for authoritative examination announcements and curriculum updates.',
      ],
    },
  };

  const page = contentMap[kind];

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead title={page.seoTitle} description={page.description} path={page.path} />
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#202124] dark:text-white">
            {page.title}
          </h1>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-[#666666] dark:text-slate-300">
            {page.body.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
            <Link
              to="/"
              className="inline-flex min-h-[40px] items-center rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1]"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
