import type { Label, LabelVisibility } from '../types';

const VISIBILITY_ORDER: Record<LabelVisibility, number> = {
  family: 0,
  shared: 1,
  private: 2,
};

export function labelVisibilityRank(visibility?: LabelVisibility): number {
  return VISIBILITY_ORDER[visibility || 'family'] ?? VISIBILITY_ORDER.family;
}

export function sortLabelsByVisibility<T extends Pick<Label, 'name' | 'visibility'>>(labels: T[]): T[] {
  return [...labels].sort((a, b) => {
    const byVisibility = labelVisibilityRank(a.visibility) - labelVisibilityRank(b.visibility);
    if (byVisibility !== 0) return byVisibility;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
