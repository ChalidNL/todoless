import { Item } from '../types';
import { categorizeItem } from './grocery-categories';

export type GrocerySortMode = 'alpha' | 'category';

function compareGroceriesAlpha(left: Pick<Item, 'title'>, right: Pick<Item, 'title'>): number {
  return left.title.toLocaleLowerCase().localeCompare(right.title.toLocaleLowerCase(), 'nl');
}

export function sortGroceriesAlpha(items: Item[]): Item[] {
  return [...items].sort(compareGroceriesAlpha);
}

export function stripCategoryEmoji(category: string): string {
  return category.replace(/^[^\w\s]+\s*/, '');
}

export function groupGroceriesByCategory(items: Item[]): Array<[string, Item[]]> {
  const groups: Record<string, Item[]> = {};

  for (const item of sortGroceriesAlpha(items)) {
    const category = categorizeItem(item.title);
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  }

  return Object.entries(groups).sort(([left], [right]) =>
    stripCategoryEmoji(left).localeCompare(stripCategoryEmoji(right), 'nl')
  );
}

export function partitionFocusedGroceries(items: Item[]): { focused: Item[]; regular: Item[] } {
  const focused: Item[] = [];
  const regular: Item[] = [];

  for (const item of items) {
    if (item.focus) focused.push(item);
    else regular.push(item);
  }

  return {
    focused: sortGroceriesAlpha(focused),
    regular: sortGroceriesAlpha(regular),
  };
}
