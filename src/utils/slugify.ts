export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sanitizeId(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function buildPaperDownloadFilename(
  subjectCode: string,
  subjectName: string,
  examSession: string,
  examYear: number
): string {
  const cleanCode = subjectCode.trim().replace(/[^a-zA-Z0-9-]/g, '') || slugify(subjectName).toUpperCase();
  const cleanSession = examSession.trim().replace(/[^a-zA-Z]/g, '');
  return `GTU-${cleanCode}-${cleanSession}-${examYear}.pdf`;
}
