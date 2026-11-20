import type {
  BlogPost,
  Branch,
  Paper,
  Semester,
  SeoFaqItem,
  SeoMetadata,
  SeoPageType,
  Subject,
} from '../types/academic';

export interface StaticPageSeoSeed {
  id: string;
  name: string;
  path: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string;
  h1Heading: string;
  h2Headings: string[];
  h3Headings: string[];
  mainIntro: string;
  detailedContent: string;
  faqs: SeoFaqItem[];
  imageAltText: string;
}

export const STATIC_PUBLIC_PAGES: StaticPageSeoSeed[] = [
  {
    id: 'about',
    name: 'About Us',
    path: '/about',
    seoTitle: 'About Us | DiplomaToppers — GTU Diploma Question Papers',
    metaDescription:
      'Learn how DiplomaToppers organizes GTU Diploma Engineering previous year Summer and Winter question papers by branch, semester, and subject code.',
    focusKeyword: 'DiplomaToppers GTU Diploma question papers',
    secondaryKeywords: 'gtu diploma previous year question papers, gtu old paper pdf archive',
    h1Heading: 'About DiplomaToppers',
    h2Headings: [
      'Why DiplomaToppers Was Built for GTU Students',
      'How Our Question Paper Archive Is Organized',
    ],
    h3Headings: [
      'Branch and Semester Structure',
      'Direct Summer and Winter PDF Access',
    ],
    mainIntro:
      'DiplomaToppers is a student-focused academic archive built for Gujarat Technological University (GTU) Diploma Engineering students across Gujarat.',
    detailedContent:
      'Preparing for GTU semester examinations becomes significantly clearer when students can review authentic past question papers instead of guessing question formats. DiplomaToppers indexes verified Summer and Winter examination PDFs cleanly under each engineering branch, semester (Semesters 1 through 6), and subject code.\n\nEvery subject page separates Summer and Winter sessions chronologically and connects related subjects across branches so students studying common GTU courses can locate practice papers without broken links or registration walls.',
    faqs: [
      {
        question: 'Is DiplomaToppers free for GTU Diploma students?',
        answer:
          'Yes. All published GTU Diploma Engineering question papers can be viewed online and downloaded as PDF files without student registration or subscription fees.',
      },
      {
        question: 'Which engineering branches are covered on DiplomaToppers?',
        answer:
          'DiplomaToppers covers active GTU Diploma Engineering branches configured by administrators, including Computer, Civil, Electrical, and Mechanical Engineering across Semesters 1 to 6.',
      },
    ],
    imageAltText: 'DiplomaToppers academic repository banner for GTU Diploma Engineering students',
  },
  {
    id: 'contact',
    name: 'Contact Us',
    path: '/contact',
    seoTitle: 'Contact Us | DiplomaToppers Paper Requests & Support',
    metaDescription:
      'Contact DiplomaToppers to request missing GTU Diploma question papers, report subject code corrections, or submit academic feedback.',
    focusKeyword: 'Contact DiplomaToppers GTU paper request',
    secondaryKeywords: 'request gtu diploma question paper, gtu old paper support',
    h1Heading: 'Contact DiplomaToppers',
    h2Headings: [
      'Request a Missing GTU Question Paper',
      'Report Subject Code or PDF Corrections',
    ],
    h3Headings: [
      'Details to Include in Your Request',
      'Editorial Review Process',
    ],
    mainIntro:
      'Reach out to our academic team if you need a specific GTU Diploma Summer or Winter paper uploaded or spot a subject metadata issue.',
    detailedContent:
      'To help us locate and publish the exact question paper quickly, include your Engineering Branch name, Semester number (1 to 6), Subject Name, GTU Subject Code, and Examination Session (Summer or Winter along with the year).\n\nRequests are reviewed regularly so active subjects receive complete historical paper sets across both Summer and Winter GTU examination cycles.',
    faqs: [
      {
        question: 'What details should I send when requesting a missing question paper?',
        answer:
          'Please include the engineering branch, semester number, subject name, official GTU subject code, and examination session with year (for example, Summer 2025).',
      },
      {
        question: 'How do I report an incorrect PDF or subject code?',
        answer:
          'Send the exact page URL and the correct GTU subject code or paper details to our listed support email so an administrator can update the record.',
      },
    ],
    imageAltText: 'Contact DiplomaToppers editorial support for GTU Diploma paper requests',
  },
  {
    id: 'privacy-policy',
    name: 'Privacy Policy',
    path: '/privacy-policy',
    seoTitle: 'Privacy Policy | DiplomaToppers',
    metaDescription:
      'Read how DiplomaToppers protects visitor privacy, handles download counters, and discloses third-party advertising cookies.',
    focusKeyword: 'DiplomaToppers privacy policy',
    secondaryKeywords: 'gtu question paper website privacy, diploma toppers cookies policy',
    h1Heading: 'Privacy Policy',
    h2Headings: [
      'Information We Do Not Collect',
      'Download Metrics and Advertising Disclosures',
    ],
    h3Headings: [
      'No Student Registration Required',
      'Third-Party Ad Network Cookies',
    ],
    mainIntro:
      'DiplomaToppers provides free public access to GTU Diploma study resources without requiring student login accounts or collecting personal profiles.',
    detailedContent:
      'Students can browse branches, semesters, subjects, study guides, and download examination PDFs anonymously. We record only aggregate per-paper download counts so popular subjects and recent exam papers remain visible.\n\nIf third-party advertising banners are enabled on public pages, advertising partners may use standard browser cookies in accordance with their own privacy policies to deliver relevant ad creatives.',
    faqs: [
      {
        question: 'Do I need to create an account or share my email to download papers?',
        answer:
          'No. Question paper PDFs on DiplomaToppers are openly accessible to students without creating an account or submitting personal details.',
      },
    ],
    imageAltText: 'DiplomaToppers visitor privacy policy information',
  },
  {
    id: 'terms-and-conditions',
    name: 'Terms and Conditions',
    path: '/terms-and-conditions',
    seoTitle: 'Terms and Conditions | DiplomaToppers',
    metaDescription:
      'Review the terms and conditions governing educational use of GTU Diploma question papers and study guides on DiplomaToppers.',
    focusKeyword: 'DiplomaToppers terms and conditions',
    secondaryKeywords: 'gtu paper archive usage terms, educational use guidelines',
    h1Heading: 'Terms and Conditions',
    h2Headings: [
      'Permitted Educational Reference Use',
      'Prohibited Automated Scraping and Resale',
    ],
    h3Headings: [
      'Student Study Rights',
      'Respecting Infrastructure Fair Use',
    ],
    mainIntro:
      'By browsing or downloading study resources on DiplomaToppers, you agree to use hosted question papers strictly for personal academic study and exam preparation.',
    detailedContent:
      'All question papers, subject directories, and study articles published on DiplomaToppers are organized to help Gujarat Technological University Diploma Engineering students practice real exam formats.\n\nAutomated scraping bots, bulk commercial redistribution, or attempts to tamper with server endpoints are prohibited to keep download speeds fast and reliable for genuine students.',
    faqs: [
      {
        question: 'Can students share paper links with classmates or study groups?',
        answer:
          'Yes. Sharing direct DiplomaToppers subject or paper links with classmates and teachers for educational study is encouraged.',
      },
    ],
    imageAltText: 'DiplomaToppers terms and conditions for educational paper downloads',
  },
  {
    id: 'disclaimer',
    name: 'Academic Disclaimer',
    path: '/disclaimer',
    seoTitle: 'Academic Disclaimer | DiplomaToppers',
    metaDescription:
      'Read the academic disclaimer clarifying DiplomaToppers independent educational status and official GTU circular verification guidance.',
    focusKeyword: 'DiplomaToppers GTU academic disclaimer',
    secondaryKeywords: 'gtu unofficial study archive disclaimer, gtu circular verification',
    h1Heading: 'Academic Disclaimer',
    h2Headings: [
      'Independent Educational Resource Notice',
      'Verifying Official GTU Syllabus and Circulars',
    ],
    h3Headings: [
      'Official University Authority',
      'Accuracy of Archived Question Papers',
    ],
    mainIntro:
      'DiplomaToppers is an independent student educational platform and is not officially affiliated with Gujarat Technological University (GTU).',
    detailedContent:
      'While administrators carefully organize question papers by branch, semester, and subject code, curriculum revisions, syllabus updates, and exam timetables are issued exclusively by Gujarat Technological University.\n\nStudents should cross-check current subject codes, updated syllabus weightage, and examination schedules with official GTU university circulars before final exam preparation.',
    faqs: [
      {
        question: 'Is DiplomaToppers an official GTU website?',
        answer:
          'No. DiplomaToppers is an independent educational archive built to help GTU Diploma Engineering students access past question papers more easily.',
      },
    ],
    imageAltText: 'DiplomaToppers GTU academic disclaimer notice',
  },
];

export interface SeoPageDescriptor {
  seoId: string;
  pageType: SeoPageType;
  pageReferenceId: string;
  pageName: string;
  pagePath: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultCanonical: string;
  defaultFocusKeyword: string;
  defaultSecondaryKeywords: string;
  defaultH1Heading: string;
  defaultH2Headings: string[];
  defaultH3Headings: string[];
  defaultMainIntro: string;
  defaultDetailedContent: string;
  defaultFaqs: SeoFaqItem[];
  defaultImageAltText: string;
  hasBreadcrumbs: boolean;
  hasStructuredData: boolean;
  hasInternalLinks: boolean;
  isPublished: boolean;
  entityUpdatedAt?: string;
}

export function getSeoDocId(pageType: SeoPageType, pageReferenceId: string): string {
  const safeRef = pageReferenceId.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return `seo-${pageType}-${safeRef}`.slice(0, 128);
}

export function normalizePagePath(path: string): string {
  const clean = path.trim().split('?')[0].split('#')[0];
  if (!clean || clean === '/') return '/';
  return clean.replace(/\/+$/, '');
}

export function normalizeHttpOrigin(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed.includes('MY_APP_URL') || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveSiteOrigin(siteUrl?: string, fallbackOrigin?: string): string {
  const validSiteUrl = normalizeHttpOrigin(siteUrl);
  if (validSiteUrl) return validSiteUrl;

  const validFallback = normalizeHttpOrigin(fallbackOrigin);
  if (validFallback) return validFallback;

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://diplomatoppers.vercel.app';
}

export function buildCanonicalUrl(
  pagePath: string,
  siteUrl?: string,
  fallbackOrigin?: string
): string {
  const base = resolveSiteOrigin(siteUrl, fallbackOrigin);
  const norm = normalizePagePath(pagePath);
  return norm === '/' ? `${base}/` : `${base}${norm}`;
}

function summarizeSessions(papers: Paper[]): string {
  if (papers.length === 0) return 'Summer and Winter';
  const labels = Array.from(
    new Set(
      [...papers]
        .sort((a, b) => b.examYear - a.examYear)
        .slice(0, 6)
        .map((p) => `${p.examSession} ${p.examYear}`)
    )
  );
  return labels.join(', ');
}

export function buildHomeSeoDefaults(
  siteUrl?: string,
  fallbackOrigin?: string,
  siteDescription?: string,
  stats?: {
    branchCount?: number;
    subjectCount?: number;
    paperCount?: number;
    branchNames?: string[];
  }
): SeoPageDescriptor {
  const pagePath = '/';
  const branchCount = stats?.branchCount ?? 4;
  const subjectCount = stats?.subjectCount ?? 0;
  const paperCount = stats?.paperCount ?? 0;
  const branchSample =
    stats?.branchNames && stats.branchNames.length > 0
      ? stats.branchNames.join(', ')
      : 'Computer, Civil, Electrical, and Mechanical Engineering';

  const description =
    siteDescription?.trim() ||
    'Download GTU Diploma Engineering previous year Summer and Winter question papers organized by branch, semester, and subject code on DiplomaToppers.';

  const catalogSentence =
    paperCount > 0
      ? `Currently indexing ${paperCount} verified question papers across ${subjectCount} subjects in ${branchCount} engineering branches (${branchSample}).`
      : `Organizes GTU Diploma question papers across ${branchSample} for Semesters 1 through 6.`;

  return {
    seoId: getSeoDocId('home', 'home'),
    pageType: 'home',
    pageReferenceId: 'home',
    pageName: 'Homepage',
    pagePath,
    defaultTitle: 'GTU Diploma Previous Year Question Papers PDF | DiplomaToppers',
    defaultDescription: description,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: 'GTU diploma previous year question papers',
    defaultSecondaryKeywords:
      'gtu diploma old question papers, gtu summer winter paper pdf, gtu computer engineering question papers',
    defaultH1Heading: 'GTU Diploma Old Question Papers',
    defaultH2Headings: [
      'How to Prepare Effectively with GTU Previous Year Question Papers',
      'Branch-Wise Semester 1 to Semester 6 Study Archive',
    ],
    defaultH3Headings: [
      'Summer and Winter Examination Session Organization',
      'Common Subjects Across Engineering Branches',
    ],
    defaultMainIntro:
      'Browse verified Gujarat Technological University (GTU) Diploma Engineering Summer and Winter previous year question papers organized cleanly by branch, semester, and subject code.',
    defaultDetailedContent: `${catalogSentence} Instead of searching scattered folders or broken links, DiplomaToppers structures every engineering stream from Semester 1 to Semester 6 with dedicated subject pages and direct PDF downloads.\n\nSolving past GTU examination papers helps diploma students identify frequently tested theoretical concepts, numerical problem styles, diagram questions, and time management strategies across Summer and Winter exam cycles. Each subject archive groups papers chronologically so you can trace recurring patterns across multiple exam sessions.`,
    defaultFaqs: [
      {
        question: 'How can I download GTU Diploma previous year question papers on DiplomaToppers?',
        answer:
          'Select your engineering branch from the directory above, choose your semester (1 to 6), open your subject code page, and click View Paper or Download PDF on any Summer or Winter examination session.',
      },
      {
        question: 'Are both Summer and Winter GTU examination papers available?',
        answer:
          'Yes. Subject pages separate GTU Summer Examination and GTU Winter Examination papers clearly so you can filter by session and year.',
      },
      {
        question: 'Do common Semester 1 and 2 subjects appear across multiple branches?',
        answer:
          'Yes. Shared GTU subjects such as Communication Skills in English, Applied Mathematics, and Basic Engineering courses are cross-linked across applicable Diploma branches.',
      },
    ],
    defaultImageAltText:
      'DiplomaToppers GTU Diploma previous year question papers directory across engineering branches',
    hasBreadcrumbs: false,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: true,
  };
}

export function buildStaticSeoDefaults(
  seed: StaticPageSeoSeed,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  return {
    seoId: getSeoDocId('static', seed.id),
    pageType: 'static',
    pageReferenceId: seed.id,
    pageName: seed.name,
    pagePath: seed.path,
    defaultTitle: seed.seoTitle,
    defaultDescription: seed.metaDescription,
    defaultCanonical: buildCanonicalUrl(seed.path, siteUrl, fallbackOrigin),
    defaultFocusKeyword: seed.focusKeyword,
    defaultSecondaryKeywords: seed.secondaryKeywords,
    defaultH1Heading: seed.h1Heading,
    defaultH2Headings: seed.h2Headings,
    defaultH3Headings: seed.h3Headings,
    defaultMainIntro: seed.mainIntro,
    defaultDetailedContent: seed.detailedContent,
    defaultFaqs: seed.faqs,
    defaultImageAltText: seed.imageAltText,
    hasBreadcrumbs: false,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: true,
  };
}

export function buildBlogIndexSeoDefaults(
  siteUrl?: string,
  fallbackOrigin?: string,
  postCount = 0
): SeoPageDescriptor {
  const pagePath = '/blog';
  return {
    seoId: getSeoDocId('blog', 'index'),
    pageType: 'blog',
    pageReferenceId: 'index',
    pageName: 'GTU Study Blog & Exam Guides',
    pagePath,
    defaultTitle: 'GTU Diploma Study Guides & Exam Preparation Blog | DiplomaToppers',
    defaultDescription:
      'Read practical GTU Diploma Engineering study guides, previous paper preparation strategies, subject analysis, and semester tips on DiplomaToppers.',
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: 'GTU diploma exam preparation guide',
    defaultSecondaryKeywords:
      'gtu diploma study tips, gtu previous year paper strategy, gtu diploma blog',
    defaultH1Heading: 'GTU Diploma Study Guides & Exam Preparation Blog',
    defaultH2Headings: [
      'Practical Preparation Guides for GTU Diploma Students',
      'Connecting Study Articles with Question Paper Archives',
    ],
    defaultH3Headings: [
      'Semester-Wise Revision Checklists',
      'Solving Previous Papers Strategically',
    ],
    defaultMainIntro:
      postCount > 0
        ? `Explore ${postCount} academic guide${postCount === 1 ? '' : 's'} covering GTU Diploma question paper analysis, semester preparation methods, and subject-wise revision strategies.`
        : 'Explore practical GTU Diploma Engineering study guides, exam strategy notes, and subject preparation articles linked directly to question paper archives.',
    defaultDetailedContent:
      'Our educational blog complements the DiplomaToppers question paper archive with actionable study techniques tailored to GTU Diploma Engineering students. Each article explains how to analyze previous Summer and Winter papers, prioritize repeated high-weightage concepts, and organize semester revision notes cleanly.\n\nUse the internal branch and subject links alongside each article to jump straight to official subject paper PDFs after reviewing a study method.',
    defaultFaqs: [
      {
        question: 'What topics are covered in the DiplomaToppers Blog?',
        answer:
          'Articles focus on GTU Diploma exam preparation strategies, how to study using previous year question papers, branch-specific subject guidance, and effective semester revision workflows.',
      },
      {
        question: 'Are blog guides linked to downloadable GTU question papers?',
        answer:
          'Yes. Every article connects directly to relevant engineering branches, semesters, and subject question paper archives on DiplomaToppers.',
      },
    ],
    defaultImageAltText: 'GTU Diploma Engineering study guides and exam preparation blog on DiplomaToppers',
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: true,
  };
}

export function buildBlogPostSeoDefaults(
  post: Pick<
    BlogPost,
    'id' | 'title' | 'slug' | 'excerpt' | 'content' | 'category' | 'coverImageAlt' | 'isActive' | 'updatedAt'
  >,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  const pagePath = `/blog/${post.slug}`;
  const cleanExcerpt = post.excerpt.trim();
  return {
    seoId: getSeoDocId('blog', post.id),
    pageType: 'blog',
    pageReferenceId: post.id,
    pageName: `Blog: ${post.title}`,
    pagePath,
    defaultTitle: `${post.title} | DiplomaToppers`,
    defaultDescription:
      cleanExcerpt.length >= 60
        ? cleanExcerpt.slice(0, 160)
        : `${cleanExcerpt} Read the full GTU Diploma study guide on DiplomaToppers.`.slice(0, 160),
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: post.title.toLowerCase().slice(0, 120),
    defaultSecondaryKeywords: `${post.category.toLowerCase()}, gtu diploma study guide, gtu diploma previous year question papers`,
    defaultH1Heading: post.title,
    defaultH2Headings: [
      `Key Takeaways: ${post.category}`,
      'Recommended GTU Question Paper Practice Next Steps',
    ],
    defaultH3Headings: ['How to Apply This Guide Before GTU Exams'],
    defaultMainIntro: cleanExcerpt,
    defaultDetailedContent: post.content.trim(),
    defaultFaqs: [
      {
        question: `How does this ${post.category} guide help with GTU Diploma exams?`,
        answer:
          'Combine the study methods outlined in this article with at least 3 to 5 previous Summer and Winter GTU question papers from your subject archive to build exam familiarity.',
      },
    ],
    defaultImageAltText:
      post.coverImageAlt?.trim() || `${post.title} — DiplomaToppers GTU Diploma study guide`,
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: Boolean(post.isActive),
    entityUpdatedAt: post.updatedAt,
  };
}

export function buildBranchSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'code' | 'slug' | 'description' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string,
  context?: { semesters?: Semester[]; subjects?: Subject[]; papers?: Paper[] }
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}`;
  const shortBranch = branch.name.replace(/^Diploma\s+/i, '');
  const branchSemesters = (context?.semesters || []).filter((s) => s.branchId === branch.id);
  const branchSubjects = (context?.subjects || []).filter((s) => s.branchId === branch.id);
  const branchPapers = (context?.papers || []).filter((p) => p.branchId === branch.id);

  const semSummary =
    branchSemesters.length > 0
      ? `Semesters ${branchSemesters
          .map((s) => s.semesterNumber)
          .sort((a, b) => a - b)
          .join(', ')}`
      : 'Semesters 1 to 6';

  const subjectSample =
    branchSubjects.length > 0
      ? branchSubjects
          .slice(0, 6)
          .map((s) => `${s.name} (${s.code})`)
          .join(', ')
      : '';

  const inventoryDetail =
    branchSubjects.length > 0
      ? `Currently covers ${branchSubjects.length} active ${shortBranch} subjects (${subjectSample}) and ${branchPapers.length} published Summer/Winter question paper PDF${branchPapers.length === 1 ? '' : 's'}.`
      : `Structured across ${semSummary} so new subject archives and examination PDFs appear cleanly as they are published.`;

  return {
    seoId: getSeoDocId('branch', branch.id),
    pageType: 'branch',
    pageReferenceId: branch.id,
    pageName: branch.name,
    pagePath,
    defaultTitle: `GTU ${branch.name} Previous Year Question Papers (Code ${branch.code}) | DiplomaToppers`,
    defaultDescription:
      branch.description?.trim() ||
      `Download GTU ${branch.name} (Branch Code ${branch.code}) Semester 1 to 6 previous year Summer and Winter question papers PDF on DiplomaToppers.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: `GTU ${branch.name} previous year question papers`,
    defaultSecondaryKeywords: `gtu diploma ${shortBranch.toLowerCase()} old papers, gtu branch ${branch.code} question papers, gtu diploma previous year question papers`,
    defaultH1Heading: `${branch.name} GTU Question Papers`,
    defaultH2Headings: [
      `${branch.name} Semester-Wise Question Paper Directory`,
      `Exam Preparation Guide for GTU ${shortBranch} Students`,
    ],
    defaultH3Headings: [
      `Navigating Branch Code ${branch.code} Subjects`,
      'Comparing Summer and Winter Exam Papers',
    ],
    defaultMainIntro:
      branch.description?.trim() ||
      `Access GTU ${branch.name} (Branch Code ${branch.code}) previous year Summer and Winter examination question papers organized across ${semSummary}.`,
    defaultDetailedContent: `${branch.name} (GTU Branch Code ${branch.code}) students can browse semester-by-semester subject question paper archives on this page. ${inventoryDetail}\n\nTo make the most of past papers in ${shortBranch}, select your current semester card above, open each core subject code, and practice timed mock tests using alternating Summer and Winter GTU examination sessions.`,
    defaultFaqs: [
      {
        question: `Which semesters are available for GTU ${branch.name} (Code ${branch.code})?`,
        answer: `${branch.name} is organized across ${semSummary}. Click any semester card on this page to view active subjects and downloadable PDF papers.`,
      },
      {
        question: `How do I find a specific subject paper in ${shortBranch}?`,
        answer:
          'Open your semester first, then select the subject by its GTU subject name or numeric subject code to view all uploaded Summer and Winter PDFs.',
      },
    ],
    defaultImageAltText: `GTU ${branch.name} Branch Code ${branch.code} Semester 1 to 6 question papers`,
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: Boolean(branch.isActive),
    entityUpdatedAt: branch.updatedAt,
  };
}

export function buildSemesterSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'code' | 'slug' | 'isActive'>,
  semester: Pick<Semester, 'id' | 'semesterNumber' | 'name' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string,
  context?: { subjects?: Subject[]; papers?: Paper[] }
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}/semester-${semester.semesterNumber}`;
  const shortBranch = branch.name.replace(/^Diploma\s+/i, '');
  const semSubjects = (context?.subjects || []).filter(
    (s) => s.branchId === branch.id && s.semesterId === semester.id
  );
  const semPapers = (context?.papers || []).filter(
    (p) => p.branchId === branch.id && p.semesterId === semester.id
  );

  const subjectNamesText =
    semSubjects.length > 0
      ? semSubjects.map((s) => `${s.name} (${s.code})`).join(', ')
      : `core ${shortBranch} Semester ${semester.semesterNumber} subjects`;

  return {
    seoId: getSeoDocId('semester', semester.id),
    pageType: 'semester',
    pageReferenceId: semester.id,
    pageName: `${branch.name} — ${semester.name}`,
    pagePath,
    defaultTitle: `GTU Diploma Sem ${semester.semesterNumber} ${shortBranch} Previous Year Question Papers | DiplomaToppers`,
    defaultDescription: `Browse and download GTU ${branch.name} ${semester.name} subject-wise Summer and Winter diploma previous year question papers PDF.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: `GTU Diploma Sem ${semester.semesterNumber} ${shortBranch} previous year question papers`,
    defaultSecondaryKeywords: `gtu sem ${semester.semesterNumber} ${shortBranch.toLowerCase()} papers, gtu diploma previous year question papers`,
    defaultH1Heading: `${branch.name} ${semester.name} Question Papers`,
    defaultH2Headings: [
      `Subjects Covered in ${shortBranch} ${semester.name}`,
      `How to Use ${semester.name} Past Papers for GTU Revision`,
    ],
    defaultH3Headings: [
      `Subject Code Directory for Branch ${branch.code || ''}`.trim(),
      'Balancing Summer and Winter Practice Sets',
    ],
    defaultMainIntro: `Explore active subjects and downloadable GTU Summer & Winter examination question paper PDFs for ${branch.name} ${semester.name}.`,
    defaultDetailedContent: `This ${semester.name} hub lists ${semSubjects.length > 0 ? `${semSubjects.length} active subject${semSubjects.length === 1 ? '' : 's'} (${subjectNamesText})` : subjectNamesText} for ${branch.name}${semPapers.length > 0 ? `, with ${semPapers.length} verified question paper PDF${semPapers.length === 1 ? '' : 's'} ready for online preview and download` : ''}.\n\nReviewing all subjects of ${semester.name} together helps GTU Diploma students plan revision schedules before mid-sem and end-semester GTU exams. Open any subject card above to filter papers by Summer or Winter session and examination year.`,
    defaultFaqs: [
      {
        question: `How many subjects are listed in ${branch.name} ${semester.name}?`,
        answer:
          semSubjects.length > 0
            ? `There are currently ${semSubjects.length} active subjects in ${branch.name} ${semester.name}: ${subjectNamesText}.`
            : `Subjects added by administrators for ${branch.name} ${semester.name} appear automatically on this page.`,
      },
      {
        question: `Can I switch to another semester in ${branch.name}?`,
        answer: `Yes. Use the semester switcher links below the subject cards or return to the ${branch.name} branch page to open Semesters 1 through 6.`,
      },
    ],
    defaultImageAltText: `GTU ${branch.name} ${semester.name} subject question paper directory`,
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: Boolean(branch.isActive && semester.isActive),
    entityUpdatedAt: semester.updatedAt,
  };
}

export function buildSubjectSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'code' | 'slug' | 'isActive'>,
  semester: Pick<Semester, 'id' | 'semesterNumber' | 'name' | 'isActive'>,
  subject: Pick<Subject, 'id' | 'name' | 'code' | 'slug' | 'description' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string,
  context?: { papers?: Paper[] }
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}`;
  const shortBranch = branch.name.replace(/^Diploma\s+/i, '');
  const subjPapers = (context?.papers || []).filter((p) => p.subjectId === subject.id);
  const sessionsText = summarizeSessions(subjPapers);

  const countClause =
    subjPapers.length > 0
      ? `There are currently ${subjPapers.length} uploaded PDF paper${subjPapers.length === 1 ? '' : 's'} (${sessionsText}) available for instant viewing and download.`
      : `New Summer and Winter PDF question papers for ${subject.name} (${subject.code}) appear here immediately once published.`;

  return {
    seoId: getSeoDocId('subject', subject.id),
    pageType: 'subject',
    pageReferenceId: subject.id,
    pageName: `${subject.name} (${subject.code})`,
    pagePath,
    defaultTitle: `GTU Diploma Sem ${semester.semesterNumber} ${shortBranch} ${subject.name} (${subject.code}) Previous Year Question Papers`,
    defaultDescription:
      subject.description?.trim() ||
      `Download GTU ${subject.name} (${subject.code}) Summer and Winter previous year question papers PDF for ${branch.name} Semester ${semester.semesterNumber}.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: `GTU diploma sem ${semester.semesterNumber} ${shortBranch} ${subject.name} previous year question papers`,
    defaultSecondaryKeywords: `gtu diploma previous year question papers, ${subject.code} question paper pdf, ${subject.name.toLowerCase()} gtu summer winter paper`,
    defaultH1Heading: `${subject.name} (${subject.code}) — GTU Question Papers`,
    defaultH2Headings: [
      `GTU Summer & Winter Question Papers for ${subject.name} (${subject.code})`,
      `How to Prepare ${subject.name} Using Past GTU Papers`,
    ],
    defaultH3Headings: [
      'Comparing Summer and Winter Exam Sessions',
      `Common Subject Code ${subject.code} Links`,
    ],
    defaultMainIntro:
      subject.description?.trim() ||
      `Download verified GTU ${subject.name} (Subject Code: ${subject.code}) previous year Summer and Winter question paper PDFs for ${branch.name} ${semester.name || `Semester ${semester.semesterNumber}`}.`,
    defaultDetailedContent: `${subject.name} (${subject.code}) is part of the ${branch.name} Semester ${semester.semesterNumber} curriculum. ${countClause}\n\nWorking through multiple Summer and Winter sessions for ${subject.code} lets you observe how questions are structured across theory explanations, short definitions, diagrams, and problem-solving sections. Use the session tabs and year filter above to narrow down specific papers or click any paper title to open its dedicated detail page.`,
    defaultFaqs: [
      {
        question: `What is the GTU subject code for ${subject.name} in ${branch.name}?`,
        answer: `On this subject archive, ${subject.name} is cataloged under GTU Subject Code ${subject.code} in Semester ${semester.semesterNumber}.`,
      },
      {
        question: `Which exam sessions are included for ${subject.name} (${subject.code})?`,
        answer:
          subjPapers.length > 0
            ? `Available sessions for ${subject.name} (${subject.code}) currently include: ${sessionsText}.`
            : `Both GTU Summer and Winter examination question papers are supported and displayed cleanly by session on this page.`,
      },
    ],
    defaultImageAltText: `GTU ${subject.name} ${subject.code} Semester ${semester.semesterNumber} question papers PDF`,
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: Boolean(branch.isActive && semester.isActive && subject.isActive),
    entityUpdatedAt: subject.updatedAt,
  };
}

export function buildPaperSeoDefaults(
  branch: Pick<Branch, 'id' | 'name' | 'code' | 'slug' | 'isActive'>,
  semester: Pick<Semester, 'id' | 'semesterNumber' | 'name' | 'isActive'>,
  subject: Pick<Subject, 'id' | 'name' | 'code' | 'slug' | 'isActive'>,
  paper: Pick<Paper, 'id' | 'title' | 'examSession' | 'examYear' | 'slug' | 'isActive' | 'updatedAt'>,
  siteUrl?: string,
  fallbackOrigin?: string
): SeoPageDescriptor {
  const pagePath = `/${branch.slug}/semester-${semester.semesterNumber}/${subject.slug}/${paper.slug}`;
  const shortBranch = branch.name.replace(/^Diploma\s+/i, '');
  return {
    seoId: getSeoDocId('paper', paper.id),
    pageType: 'paper',
    pageReferenceId: paper.id,
    pageName: `${subject.name} — ${paper.examSession} ${paper.examYear}`,
    pagePath,
    defaultTitle: `GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} Question Paper PDF | DiplomaToppers`,
    defaultDescription: `Download the GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} question paper PDF for ${branch.name} Semester ${semester.semesterNumber}.`,
    defaultCanonical: buildCanonicalUrl(pagePath, siteUrl, fallbackOrigin),
    defaultFocusKeyword: `GTU ${subject.name} ${paper.examSession} ${paper.examYear} question paper PDF`,
    defaultSecondaryKeywords: `gtu diploma previous year question papers, ${subject.code} ${paper.examSession.toLowerCase()} ${paper.examYear}, ${shortBranch.toLowerCase()} sem ${semester.semesterNumber} paper`,
    defaultH1Heading: `${subject.name} (${subject.code}) — GTU ${paper.examSession} ${paper.examYear} Question Paper`,
    defaultH2Headings: [
      `Paper Overview: ${subject.name} ${paper.examSession} ${paper.examYear}`,
      `Practice Strategy for ${subject.code} Question Papers`,
    ],
    defaultH3Headings: [
      'Online PDF Viewer & Direct Download',
      `Explore Other Years of ${subject.name}`,
    ],
    defaultMainIntro: `View online or download the GTU ${subject.name} (${subject.code}) ${paper.examSession} ${paper.examYear} Diploma Engineering question paper PDF for ${branch.name} Semester ${semester.semesterNumber}.`,
    defaultDetailedContent: `This dedicated question paper page hosts the GTU ${paper.examSession} ${paper.examYear} examination PDF for ${subject.name} (Subject Code: ${subject.code}) under ${branch.name}, Semester ${semester.semesterNumber}.\n\nFor best exam readiness, open the PDF in a clean full-screen tab using View PDF or download a local copy for offline practice. After completing the ${paper.examSession} ${paper.examYear} paper under timed conditions, compare question trends with earlier Winter and Summer papers linked below.`,
    defaultFaqs: [
      {
        question: `How do I download the GTU ${subject.name} ${paper.examSession} ${paper.examYear} paper as a PDF?`,
        answer: `Click the Download PDF button on this page to save ${subject.code} ${paper.examSession} ${paper.examYear} directly, or use View PDF to read it inside your browser.`,
      },
      {
        question: `Where can I find more years for ${subject.name} (${subject.code})?`,
        answer: `Scroll to the Related Question Papers section below or visit the main ${subject.name} subject page to browse all uploaded Summer and Winter sessions.`,
      },
    ],
    defaultImageAltText: `GTU ${subject.name} ${subject.code} ${paper.examSession} ${paper.examYear} question paper PDF`,
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasInternalLinks: true,
    isPublished: Boolean(branch.isActive && semester.isActive && subject.isActive && paper.isActive),
    entityUpdatedAt: paper.updatedAt,
  };
}

export function collectCatalogPageDescriptors(params: {
  branches: Branch[];
  semesters: Semester[];
  subjects: Subject[];
  papers: Paper[];
  blogs?: BlogPost[];
  siteUrl?: string;
  fallbackOrigin?: string;
  siteDescription?: string;
}): SeoPageDescriptor[] {
  const {
    branches,
    semesters,
    subjects,
    papers,
    blogs = [],
    siteUrl,
    fallbackOrigin,
    siteDescription,
  } = params;
  const descriptors: SeoPageDescriptor[] = [];

  descriptors.push(
    buildHomeSeoDefaults(siteUrl, fallbackOrigin, siteDescription, {
      branchCount: branches.length,
      subjectCount: subjects.length,
      paperCount: papers.length,
      branchNames: branches.map((b) => b.name.replace(/^Diploma\s+/i, '')),
    })
  );

  descriptors.push(buildBlogIndexSeoDefaults(siteUrl, fallbackOrigin, blogs.filter((b) => b.isActive).length));

  for (const seed of STATIC_PUBLIC_PAGES) {
    descriptors.push(buildStaticSeoDefaults(seed, siteUrl, fallbackOrigin));
  }

  const branchById = new Map(branches.map((b) => [b.id, b]));
  const semById = new Map(semesters.map((s) => [s.id, s]));
  const subjById = new Map(subjects.map((s) => [s.id, s]));

  for (const b of branches) {
    descriptors.push(
      buildBranchSeoDefaults(b, siteUrl, fallbackOrigin, { semesters, subjects, papers })
    );
  }

  for (const sem of semesters) {
    const b = branchById.get(sem.branchId);
    if (!b) continue;
    descriptors.push(
      buildSemesterSeoDefaults(b, sem, siteUrl, fallbackOrigin, { subjects, papers })
    );
  }

  for (const subj of subjects) {
    const b = branchById.get(subj.branchId);
    const sem = semById.get(subj.semesterId);
    if (!b || !sem) continue;
    descriptors.push(
      buildSubjectSeoDefaults(b, sem, subj, siteUrl, fallbackOrigin, { papers })
    );
  }

  for (const pap of papers) {
    const subj = subjById.get(pap.subjectId);
    const b = branchById.get(pap.branchId);
    const sem = semById.get(pap.semesterId);
    if (!subj || !b || !sem) continue;
    descriptors.push(buildPaperSeoDefaults(b, sem, subj, pap, siteUrl, fallbackOrigin));
  }

  for (const post of blogs) {
    descriptors.push(buildBlogPostSeoDefaults(post, siteUrl, fallbackOrigin));
  }

  return descriptors;
}

export function mergeDescriptorWithSeo(
  descriptor: SeoPageDescriptor,
  stored?: Partial<SeoMetadata>
): SeoMetadata {
  const s = stored || {};
  const faqs =
    Array.isArray(s.faqs) && s.faqs.length > 0
      ? s.faqs.filter((f) => f && (f.question || f.answer))
      : descriptor.defaultFaqs;
  const h2Headings =
    Array.isArray(s.h2Headings) && s.h2Headings.length > 0
      ? s.h2Headings.filter(Boolean)
      : descriptor.defaultH2Headings;
  const h3Headings =
    Array.isArray(s.h3Headings) && s.h3Headings.length > 0
      ? s.h3Headings.filter(Boolean)
      : descriptor.defaultH3Headings;

  return {
    id: descriptor.seoId,
    pageType: descriptor.pageType,
    pageReferenceId: descriptor.pageReferenceId,
    pageName: descriptor.pageName,
    pagePath: descriptor.pagePath,
    focusKeyword: s.focusKeyword?.trim() || descriptor.defaultFocusKeyword,
    secondaryKeywords: s.secondaryKeywords?.trim() || descriptor.defaultSecondaryKeywords,
    seoTitle: s.seoTitle?.trim() || descriptor.defaultTitle,
    metaDescription: s.metaDescription?.trim() || descriptor.defaultDescription,
    h1Heading: s.h1Heading?.trim() || descriptor.defaultH1Heading,
    h2Headings,
    h3Headings,
    mainIntro: s.mainIntro?.trim() || descriptor.defaultMainIntro,
    detailedContent: s.detailedContent?.trim() || descriptor.defaultDetailedContent,
    faqs,
    imageAltText: s.imageAltText?.trim() || descriptor.defaultImageAltText,
    canonicalUrl: s.canonicalUrl?.trim() || descriptor.defaultCanonical,
    ogTitle: s.ogTitle?.trim() || s.seoTitle?.trim() || descriptor.defaultTitle,
    ogDescription:
      s.ogDescription?.trim() || s.metaDescription?.trim() || descriptor.defaultDescription,
    ogImageUrl: s.ogImageUrl?.trim() || '',
    robotsIndex: typeof s.robotsIndex === 'boolean' ? s.robotsIndex : descriptor.isPublished,
    robotsFollow: typeof s.robotsFollow === 'boolean' ? s.robotsFollow : descriptor.isPublished,
    isCustomized: Boolean(s.isCustomized),
    updatedAt: s.updatedAt || descriptor.entityUpdatedAt,
  };
}
