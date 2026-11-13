import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const navigate = useNavigate();

  const parentItem = [...items]
    .slice(0, -1)
    .reverse()
    .find((item) => Boolean(item.to));

  const handleBack = () => {
    if (parentItem?.to) {
      navigate(parentItem.to);
      return;
    }
    navigate(-1);
  };

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={handleBack}
        aria-label={parentItem ? `Back to ${parentItem.label}` : 'Go back'}
        title={parentItem ? `Back to ${parentItem.label}` : 'Back'}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[#202124] shadow-xs transition-colors hover:bg-slate-200 hover:text-[#1769D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1769D2] dark:border-slate-300 dark:bg-slate-100 dark:text-[#202124] dark:hover:bg-white"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
    </div>
  );
}
