export type ExamSession = 'Summer' | 'Winter';
export type AdType =
  | 'banner'
  | 'native_banner'
  | 'popunder'
  | 'social_bar'
  | 'smartlink'
  | 'custom';

export type BannerSize =
  | '468x60'
  | '300x250'
  | '160x300'
  | '160x600'
  | '320x50'
  | '728x90';

export type AdPlacement =
  | 'global'
  | 'home_above_branches'
  | 'home_below_branches'
  | 'branch_above_semesters'
  | 'branch_below_semesters'
  | 'semester_above_subjects'
  | 'semester_below_subjects'
  | 'subject_above_papers'
  | 'subject_below_papers'
  | 'paper_above_details'
  | 'paper_below_details'
  | 'home_top'
  | 'branch'
  | 'semester'
  | 'subject'
  | 'paper'
  | 'admin_dashboard';

export interface Branch {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Semester {
  id: string;
  branchId: string;
  semesterNumber: number;
  name: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  branchId: string;
  semesterId: string;
  name: string;
  code: string;
  slug: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Paper {
  id: string;
  subjectId: string;
  branchId: string;
  semesterId: string;
  title: string;
  examSession: ExamSession;
  examYear: number;
  pdfStoragePath: string;
  originalFilename: string;
  fileSize: number;
  slug: string;
  isActive: boolean;
  downloadCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string;
  coverImageUrl: string;
  coverImageAlt: string;
  relatedBranchId?: string;
  isActive: boolean;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Advertisement {
  id: string;
  title: string;
  adType: AdType;
  bannerSize?: BannerSize | '';
  adCode?: string;
  imageStoragePath?: string;
  destinationUrl?: string;
  placement: AdPlacement;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WebsiteSettingsMap {
  siteTitle?: string;
  siteDescription?: string;
  siteUrl?: string;
  googleVerification?: string;
  contactEmail?: string;
  aboutContent?: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GtuInsightsResponse {
  summary: string;
  sources: GroundingSource[];
}

export type SeoPageType =
  | 'home'
  | 'branch'
  | 'semester'
  | 'subject'
  | 'paper'
  | 'blog'
  | 'static';

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoMetadata {
  id: string;
  pageType: SeoPageType;
  pageReferenceId: string;
  pageName: string;
  pagePath: string;
  focusKeyword: string;
  secondaryKeywords: string;
  seoTitle: string;
  metaDescription: string;
  h1Heading: string;
  h2Headings: string[];
  h3Headings: string[];
  mainIntro: string;
  detailedContent: string;
  faqs: SeoFaqItem[];
  imageAltText: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  isCustomized: boolean;
  updatedAt?: string;
}

export type SeoCheckStatus = 'pass' | 'warning' | 'fail';

export interface SeoCheckItem {
  id: string;
  label: string;
  status: SeoCheckStatus;
  detail: string;
}

export interface SeoAnalyzerReport {
  passedCount: number;
  warningCount: number;
  failedCount: number;
  totalChecks: number;
  wordCount: number;
  keywordInTitle: boolean;
  keywordInDescription: boolean;
  keywordInH1: boolean;
  keywordInContent: boolean;
  checks: SeoCheckItem[];
}
