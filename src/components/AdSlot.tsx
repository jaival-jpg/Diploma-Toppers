import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useCatalog } from '../contexts/CatalogContext';
import type { AdPlacement, Advertisement } from '../types/academic';

function isWithinSchedule(ad: Advertisement): boolean {
  const now = Date.now();
  if (ad.startDate) {
    const start = new Date(ad.startDate).getTime();
    if (!Number.isNaN(start) && now < start) return false;
  }
  if (ad.endDate) {
    const end = new Date(ad.endDate).getTime();
    if (!Number.isNaN(end) && now > end + 86400000) return false;
  }
  return true;
}

function normalizeAdCode(rawCode: string): string {
  const trimmed = rawCode.trim();
  if (!trimmed) return '';
  if (/^(https?:)?\/\/\S+$/i.test(trimmed) && !trimmed.includes('<')) {
    return `<script type="text/javascript" src="${trimmed}"></script>`;
  }
  return trimmed;
}

function parseBannerDimensions(bannerSize?: string): { width: number; height: number } {
  const match = (bannerSize || '').match(/^(\d+)x(\d+)$/);
  if (match) {
    return { width: Number(match[1]), height: Number(match[2]) };
  }
  return { width: 300, height: 250 };
}

function matchesPlacement(adPlacement: AdPlacement, target: AdPlacement): boolean {
  if (adPlacement === target) return true;
  if (target === 'home_above_branches' && adPlacement === 'home_top') return true;
  if (target === 'branch_above_semesters' && adPlacement === 'branch') return true;
  if (target === 'semester_above_subjects' && adPlacement === 'semester') return true;
  if (target === 'subject_above_papers' && adPlacement === 'subject') return true;
  if (target === 'paper_above_details' && adPlacement === 'paper') return true;
  return false;
}

function AdsterraBannerEmbed({ ad }: { ad: Advertisement }) {
  const code = normalizeAdCode(ad.adCode || '');
  if (!code) return null;

  const { width, height } = parseBannerDimensions(ad.bannerSize);
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center;width:100%;height:100%;}</style></head><body>${code}</body></html>`;

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-1.5 text-[11px] font-medium text-[#666666] dark:text-slate-400">
        Advertisement
      </div>
      <div className="flex w-full justify-center overflow-x-auto">
        <iframe
          title={`Advertisement: ${ad.title}`}
          srcDoc={srcDoc}
          width={width}
          height={height}
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          className="shrink-0 border-0 overflow-hidden rounded-lg bg-transparent"
        />
      </div>
    </div>
  );
}

function AdsterraNativeEmbed({ ad }: { ad: Advertisement }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const code = normalizeAdCode(ad.adCode || '');

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !code) return;
    el.innerHTML = '';

    const temp = document.createElement('div');
    temp.innerHTML = code;

    const scripts: HTMLScriptElement[] = [];
    const nodes = Array.from(temp.childNodes);

    for (const node of nodes) {
      if (node.nodeName.toLowerCase() === 'script') {
        const orig = node as HTMLScriptElement;
        const script = document.createElement('script');
        for (const attr of Array.from(orig.attributes)) {
          script.setAttribute(attr.name, attr.value);
        }
        if (orig.textContent) {
          script.textContent = orig.textContent;
        }
        scripts.push(script);
      } else {
        el.appendChild(node.cloneNode(true));
      }
    }

    for (const script of scripts) {
      el.appendChild(script);
    }

    return () => {
      el.innerHTML = '';
    };
  }, [code]);

  if (!code) return null;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-1.5 text-center text-[11px] font-medium text-[#666666] dark:text-slate-400">
        Sponsored
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

function SmartlinkOrCustomBanner({ ad }: { ad: Advertisement }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!ad.imageStoragePath && !ad.destinationUrl) {
    return null;
  }

  const inner = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {ad.imageStoragePath && !imgFailed ? (
        <img
          src={ad.imageStoragePath}
          alt={ad.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-24 w-full object-cover sm:h-28 md:h-32"
        />
      ) : (
        <div className="flex min-h-[76px] items-center justify-between gap-4 bg-gradient-to-r from-[#1769D2] to-[#0D47A1] px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-blue-100">Sponsored</div>
            <div className="truncate text-base font-bold text-white">{ad.title}</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-white/25">
            <span>Open</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </div>
  );

  if (ad.destinationUrl) {
    return (
      <a
        href={ad.destinationUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1769D2]"
      >
        {inner}
      </a>
    );
  }

  return inner;
}

function injectScriptNodes(adId: string, rawCode: string, targetAttr = 'data-dt-ad-id') {
  const code = normalizeAdCode(rawCode);
  if (!code) return;

  const temp = document.createElement('div');
  temp.innerHTML = code;

  const scriptElements = Array.from(temp.querySelectorAll('script'));
  if (scriptElements.length === 0) return;

  for (const orig of scriptElements) {
    const script = document.createElement('script');
    for (const attr of Array.from(orig.attributes)) {
      script.setAttribute(attr.name, attr.value);
    }
    if (orig.textContent) {
      script.textContent = orig.textContent;
    }
    script.setAttribute(targetAttr, adId);
    document.body.appendChild(script);
  }
}

export function GlobalAdScripts() {
  const { ads } = useCatalog();
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');

  const globalScriptAds = useMemo(() => {
    if (isAdminRoute) return [];
    return ads
      .filter(
        (ad) =>
          ad.isActive &&
          (ad.adType === 'popunder' || ad.adType === 'social_bar') &&
          isWithinSchedule(ad) &&
          Boolean(ad.adCode?.trim())
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [ads, isAdminRoute]);

  const signature = globalScriptAds.map((a) => `${a.id}:${a.adCode || ''}`).join('|');

  useEffect(() => {
    document.querySelectorAll('script[data-dt-global-ad-id]').forEach((node) => node.remove());

    if (isAdminRoute || globalScriptAds.length === 0) {
      return;
    }

    for (const ad of globalScriptAds) {
      injectScriptNodes(ad.id, ad.adCode || '', 'data-dt-global-ad-id');
    }

    return () => {
      document.querySelectorAll('script[data-dt-global-ad-id]').forEach((node) => node.remove());
    };
  }, [isAdminRoute, signature]);

  return null;
}

export function AdSlot({
  placement,
  overrideAds,
  compact = false,
}: {
  placement: AdPlacement;
  overrideAds?: Advertisement[];
  compact?: boolean;
}) {
  const { ads } = useCatalog();

  const pool = overrideAds ?? ads;
  const matching = pool
    .filter(
      (ad) =>
        ad.isActive &&
        matchesPlacement(ad.placement, placement) &&
        ad.adType !== 'popunder' &&
        ad.adType !== 'social_bar' &&
        isWithinSchedule(ad)
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (matching.length === 0) {
    return null;
  }

  return (
    <div className={compact ? 'space-y-3' : 'mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 space-y-3'}>
      {matching.map((ad) => {
        if (ad.adType === 'banner') {
          return <AdsterraBannerEmbed key={ad.id} ad={ad} />;
        }
        if (ad.adType === 'native_banner') {
          return <AdsterraNativeEmbed key={ad.id} ad={ad} />;
        }
        return <SmartlinkOrCustomBanner key={ad.id} ad={ad} />;
      })}
    </div>
  );
}
