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
