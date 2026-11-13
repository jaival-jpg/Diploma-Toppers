# DiplomaToppers — GTU Diploma Question Paper Repository

DiplomaToppers is a full-stack educational web application built for Gujarat Technological University (GTU) Diploma Engineering students to browse, search, view, and download previous year Summer and Winter examination question papers organized by branch, semester, and subject.

## Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, React Router, Lucide React
- **Backend Server**: Express (Node.js + TypeScript) with server-injected SEO metadata, `/sitemap.xml`, `/robots.txt`, secure PDF/banner upload & streaming
- **Database**: Firebase Firestore (with schema-validated `firestore.rules`)
- **Admin Authentication**: Server-verified password login (`POST /api/admin/login`) issuing HMAC-SHA256 session tokens & HTTP-only cookies
- **Live GTU Syllabus & Exam Search Grounding**: `@google/genai` (`gemini-4-hydrogen` with `googleSearch` tool)

## Environment Variables
Copy `.env.example` to `.env` or configure these variables in your hosting environment:
- `GEMINI_API_KEY`: Server-side Gemini API key for GTU Search Grounding
- `ADMIN_PASSWORD`: Optional override for the Admin Dashboard password
- `ADMIN_SESSION_SECRET`: Optional HMAC signing secret for admin session cookies/tokens
- `APP_URL` / `NEXT_PUBLIC_SITE_URL`: Canonical production domain (used for `sitemap.xml`, `robots.txt`, and `<link rel="canonical">`)
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`: Optional Google Search Console verification meta tag token

## Local Development & Production
```bash
npm install
npm run dev      # Starts Express + Vite on port 3000
npm run build    # Builds production frontend bundle in dist/
npm start        # Starts production server on port 3000
```

## Security & Admin Setup
- Firestore security rules are defined in `firestore.rules` and verified against `@firebase/eslint-plugin-security-rules`.
- Public visitors can read active branches, semesters, subjects, papers, and active advertisements.
- Administrators log in at `/admin/login` (linked subtly via `"ad"` in the footer) using the administrator password to access `/admin/dashboard`.
- Administrators can manage branches, semesters, subjects, question paper PDFs, advertisements (Google AdSense or custom banners), and site SEO settings.
