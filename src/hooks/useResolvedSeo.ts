import { useMemo } from 'react';
import { useCatalog } from '../contexts/CatalogContext';
import {
  mergeDescriptorWithSeo,
  normalizePagePath,
  type SeoPageDescriptor,
} from '../services/seoDefaults';
import type { SeoMetadata } from '../types/academic';

export function useResolvedSeo(descriptor: SeoPageDescriptor): SeoMetadata {
  const { seoMetadata } = useCatalog();

  return useMemo(() => {
    const targetPath = normalizePagePath(descriptor.pagePath);
    const stored =
      seoMetadata.find((item) => item.id === descriptor.seoId) ||
      seoMetadata.find((item) => normalizePagePath(item.pagePath) === targetPath);
    return mergeDescriptorWithSeo(descriptor, stored);
  }, [descriptor, seoMetadata]);
}
