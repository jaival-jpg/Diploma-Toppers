import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Calendar, Search, User } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { RelatedContentSection } from '../components/RelatedContentSection';
import { SeoHead } from '../components/SeoHead';
import { SeoRichContentSection } from '../components/SeoRichContentSection';
import { useCatalog } from '../contexts/CatalogContext';
import { useResolvedSeo } from '../hooks/useResolvedSeo';
import { buildBlogIndexSeoDefaults } from '../services/seoDefaults';

export function BlogIndexPage() {
  const { blogs, settings, loading } = useCatalog();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const descriptor = useMemo(
    () => buildBlogIndexSeoDefaults(settings.siteUrl, origin, blogs.length),
    [settings.siteUrl, origin, blogs.length]
  );
  const resolvedSeo = useResolvedSeo(descriptor);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const post of blogs) {
      if (post.category?.trim()) set.add(post.category.trim());
    }
    return ['ALL', ...Array.from(set)];
  }, [blogs]);

  const filteredBlogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return blogs.filter((post) => {
      if (selectedCategory !== 'ALL' && post.category.trim() !== selectedCategory) return false;
      if (q) {
        const hit =
          post.title.toLowerCase().includes(q) ||
          post.excerpt.toLowerCase().includes(q) ||
          post.category.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [blogs, selectedCategory, searchQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={resolvedSeo.seoTitle}
        description={resolvedSeo.metaDescription}
        path="/blog"
        keywords={[resolvedSeo.focusKeyword, resolvedSeo.secondaryKeywords].filter(Boolean).join(', ')}
        faqs={resolvedSeo.faqs}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
        ]}
      />
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Blog' }]} />

        <div className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
          <p className="text-sm font-semibold text-[#1769D2] dark:text-blue-400">
            GTU Diploma Study Guides &amp; Exam Resources
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-[#202124] sm:text-4xl dark:text-white">
            {resolvedSeo.h1Heading}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#666666] dark:text-slate-300">
            {resolvedSeo.mainIntro}
          </p>
        </div>

        {/* Category Filter & Search */}
        <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-950">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#1769D2] text-white'
                    : 'text-[#666666] hover:text-[#202124] dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Guides' : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search study articles..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-[#202124] focus:border-[#1769D2] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60"
              />
            ))}
          </div>
        ) : filteredBlogs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <BookOpen className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-lg font-bold text-[#202124] dark:text-white">
              {blogs.length === 0 ? 'No Study Articles Published Yet' : 'No Matching Articles Found'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#666666] dark:text-slate-400">
              {blogs.length === 0
                ? 'Administrators can publish GTU exam preparation guides and semester strategies directly from the Admin Panel.'
                : 'Try selecting All Guides or clearing your search filter.'}
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1769D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D47A1]"
            >
              <span>Browse GTU Question Papers</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredBlogs.map((post) => {
              const displayDate = (post.publishedAt || post.createdAt || '').slice(0, 10);
              return (
                <article
                  key={post.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {post.coverImageUrl ? (
                    <Link to={`/blog/${post.slug}`} className="block aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={post.coverImageUrl}
                        alt={post.coverImageAlt || post.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </Link>
                  ) : (
                    <Link
                      to={`/blog/${post.slug}`}
                      className="flex aspect-video items-end bg-gradient-to-br from-[#1769D2] to-[#0D47A1] p-5 text-white"
                    >
                      <span className="text-xs font-semibold tracking-wide text-blue-100">
                        {post.category || 'GTU Study Guide'}
                      </span>
                    </Link>
                  )}

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#666666] dark:text-slate-400">
                        <span className="font-semibold text-[#1769D2] dark:text-blue-400">
                          {post.category || 'Exam Guide'}
                        </span>
                        {displayDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar className="h-3 w-3" />
                              {displayDate}
                            </span>
                          </>
                        )}
                      </div>

                      <Link to={`/blog/${post.slug}`} className="mt-2 block">
                        <h2 className="text-lg font-bold tracking-tight text-[#202124] transition-colors group-hover:text-[#1769D2] dark:text-white dark:group-hover:text-blue-400">
                          {post.title}
                        </h2>
                      </Link>

                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#666666] dark:text-slate-300">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs dark:border-slate-800">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#666666] dark:text-slate-400">
                        <User className="h-3.5 w-3.5" />
                        {post.authorName || 'DiplomaToppers Editorial'}
                      </span>
                      <Link
                        to={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#1769D2] hover:underline dark:text-blue-400"
                      >
                        <span>Read Guide</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <SeoRichContentSection seo={resolvedSeo} />
      </main>

      <RelatedContentSection pageType="blog" />
      <Footer />
    </div>
  );
}
