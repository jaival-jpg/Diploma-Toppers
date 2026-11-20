import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, FileText, User } from 'lucide-react';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { RelatedContentSection } from '../components/RelatedContentSection';
import { SeoHead } from '../components/SeoHead';
import { SeoRichContentSection } from '../components/SeoRichContentSection';
import { useCatalog } from '../contexts/CatalogContext';
import { useResolvedSeo } from '../hooks/useResolvedSeo';
import { buildBlogPostSeoDefaults } from '../services/seoDefaults';
import { NotFoundPage } from './NotFoundPage';

export function BlogPostPage() {
  const { blogSlug } = useParams<{ blogSlug: string }>();
  const { blogs, branches, papers, settings, loading } = useCatalog();

  const post = useMemo(() => blogs.find((b) => b.slug === blogSlug), [blogs, blogSlug]);

  const relatedBranch = useMemo(
    () => (post?.relatedBranchId ? branches.find((b) => b.id === post.relatedBranchId) : undefined),
    [branches, post]
  );

  const otherPosts = useMemo(
    () => blogs.filter((b) => b.id !== post?.id).slice(0, 3),
    [blogs, post]
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;

  const fallbackPost = useMemo(
    () =>
      post || {
        id: blogSlug || 'blog-post',
        title: 'GTU Diploma Study Guide',
        slug: blogSlug || 'blog-post',
        excerpt: 'Read GTU Diploma exam preparation strategies on DiplomaToppers.',
        content: '',
        category: 'Study Guide',
        coverImageAlt: 'DiplomaToppers study guide',
        isActive: false,
        updatedAt: undefined,
      },
    [post, blogSlug]
  );

  const descriptor = useMemo(
    () => buildBlogPostSeoDefaults(fallbackPost, settings.siteUrl, origin),
    [fallbackPost, settings.siteUrl, origin]
  );
  const resolvedSeo = useResolvedSeo(descriptor);

  if (!loading && !post) {
    return <NotFoundPage message="The requested blog article could not be found." />;
  }

  const branchPapersCount = relatedBranch
    ? papers.filter((p) => p.branchId === relatedBranch.id).length
    : 0;
  const displayDate = post ? (post.publishedAt || post.createdAt || '').slice(0, 10) : '';

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124] dark:bg-[#0B1120] dark:text-slate-100">
      <SeoHead
        title={resolvedSeo.seoTitle}
        description={resolvedSeo.metaDescription}
        path={post ? `/blog/${post.slug}` : `/blog/${blogSlug || ''}`}
        keywords={[resolvedSeo.focusKeyword, resolvedSeo.secondaryKeywords].filter(Boolean).join(', ')}
        faqs={resolvedSeo.faqs}
        breadcrumbs={
          post
            ? [
                { name: 'Home', path: '/' },
                { name: 'Blog', path: '/blog' },
                { name: post.title, path: `/blog/${post.slug}` },
              ]
            : undefined
        }
        articleSchema={
          post
            ? {
                headline: resolvedSeo.h1Heading,
                description: resolvedSeo.metaDescription,
                datePublished: post.publishedAt || post.createdAt,
                dateModified: post.updatedAt || post.createdAt,
                authorName: post.authorName || 'DiplomaToppers Editorial',
                image: post.coverImageUrl || undefined,
              }
            : undefined
        }
      />
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading || !post ? (
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : (
          <>
            <Breadcrumbs
              items={[
                { label: 'Home', to: '/' },
                { label: 'Blog', to: '/blog' },
                { label: post.title },
              ]}
            />

            <article>
              <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#666666] dark:text-slate-400">
                  <span className="font-semibold text-[#1769D2] dark:text-blue-400">
                    {post.category || 'Exam Guide'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {post.authorName || 'DiplomaToppers Editorial'}
                  </span>
                  {displayDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="h-3.5 w-3.5" />
                        {displayDate}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#202124] sm:text-4xl dark:text-white">
                  {resolvedSeo.h1Heading}
                </h1>

                {resolvedSeo.mainIntro && (
                  <p className="mt-4 text-base leading-relaxed text-[#4B5563] sm:text-lg dark:text-slate-300">
                    {resolvedSeo.mainIntro}
                  </p>
                )}

                {post.coverImageUrl && (
                  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                    <img
                      src={post.coverImageUrl}
                      alt={resolvedSeo.imageAltText || post.coverImageAlt || post.title}
                      className="max-h-[420px] w-full object-cover"
                    />
                  </div>
                )}
              </header>

              <SeoRichContentSection seo={resolvedSeo} compactTopBorder={false} />
            </article>

            {relatedBranch && (
              <section className="mt-10 rounded-2xl border border-blue-200 bg-blue-50/70 p-6 dark:border-blue-900/50 dark:bg-blue-950/30">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-xs font-semibold text-[#1769D2] dark:text-blue-400">
                      Related Engineering Stream · Code {relatedBranch.code}
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-[#202124] dark:text-white">
                      {relatedBranch.name} Question Papers
                    </h2>
                    <p className="mt-1 text-sm text-[#4B5563] dark:text-slate-300">
                      Apply this guide by practicing {branchPapersCount > 0 ? `${branchPapersCount} published` : 'latest'} Summer and Winter GTU examination papers.
                    </p>
                  </div>
                  <Link
                    to={`/${relatedBranch.slug}`}
                    className="inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-xl bg-[#1769D2] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0D47A1]"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Open Branch Archive</span>
                  </Link>
                </div>
              </section>
            )}

            {otherPosts.length > 0 && (
              <section className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
                <h2 className="mb-4 text-xl font-bold text-[#202124] dark:text-white">
                  More GTU Study Guides
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {otherPosts.map((item) => (
                    <Link
                      key={item.id}
                      to={`/blog/${item.slug}`}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#1769D2] dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div>
                        <div className="text-xs font-medium text-[#1769D2] dark:text-blue-400">
                          {item.category || 'Guide'}
                        </div>
                        <div className="mt-1 text-sm font-bold text-[#202124] group-hover:text-[#1769D2] dark:text-white dark:group-hover:text-blue-400">
                          {item.title}
                        </div>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#666666] group-hover:text-[#1769D2] dark:text-slate-400">
                        <span>Read Article</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-8">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1769D2] hover:underline dark:text-blue-400"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to All Study Guides</span>
              </Link>
            </div>
          </>
        )}
      </main>

      <RelatedContentSection
        pageType="blog"
        currentBranchId={relatedBranch?.id}
      />
      <Footer />
    </div>
  );
}
