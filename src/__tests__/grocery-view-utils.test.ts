import { beforeEach, describe, expect, it } from 'vitest';
import { groupGroceriesByCategory, partitionFocusedGroceries, sortGroceriesAlpha, stripCategoryEmoji } from '../lib/grocery-view-utils';
import { categorizeItem } from '../lib/grocery-categories';
import { setActiveLanguage } from '../i18n/translations';
import type { Item } from '../types';

const item = (overrides: Partial<Item>): Item => ({
  id: overrides.id || 'item',
  title: overrides.title || 'Item',
  completed: overrides.completed ?? false,
  labels: overrides.labels || [],
  createdAt: overrides.createdAt || 1,
  quantity: overrides.quantity,
  shopId: overrides.shopId,
  priority: overrides.priority,
  assignedTo: overrides.assignedTo,
  dueDate: overrides.dueDate,
  linkedTaskIds: overrides.linkedTaskIds,
  linkedNoteIds: overrides.linkedNoteIds,
  createdBy: overrides.createdBy,
  isPrivate: overrides.isPrivate,
  category: overrides.category,
  location: overrides.location,
  focus: overrides.focus,
});

describe('grocery view utils', () => {
  beforeEach(() => {
    setActiveLanguage('en');
  });

  it('sorts groceries alphabetically by title', () => {
    const sorted = sortGroceriesAlpha([
      item({ id: 'b', title: 'Banaan' }),
      item({ id: 'a', title: 'Appel' }),
      item({ id: 'c', title: 'courgette' }),
    ]);

    expect(sorted.map((entry) => entry.title)).toEqual(['Appel', 'Banaan', 'courgette']);
  });

  it('groups groceries by category and sorts category headers alphabetically without emoji noise', () => {
    const grouped = groupGroceriesByCategory([
      item({ id: '1', title: 'yoghurt' }),
      item({ id: '2', title: 'brood' }),
      item({ id: '3', title: 'appel' }),
    ]);

    expect(grouped.map(([category]) => stripCategoryEmoji(category))).toEqual([
      'Bread & Pastry',
      'Dairy, Butter & Eggs',
      'Potatoes, Vegetables & Fruit',
    ]);
  });

  it('keeps produce and juices in separate localized supermarket categories', () => {
    expect(stripCategoryEmoji(categorizeItem('groenten'))).toBe('Potatoes, Vegetables & Fruit');
    expect(stripCategoryEmoji(categorizeItem('bananen'))).toBe('Potatoes, Vegetables & Fruit');
    expect(stripCategoryEmoji(categorizeItem('appelsap'))).toBe('Soft Drinks & Juices');
    expect(stripCategoryEmoji(categorizeItem('sinaasappelsap'))).toBe('Soft Drinks & Juices');

    setActiveLanguage('nl');
    expect(stripCategoryEmoji(categorizeItem('groenten'))).toBe('Aardappelen, Groente & Fruit');
    expect(stripCategoryEmoji(categorizeItem('appelsap'))).toBe('Frisdrank & Sappen');
  });

  it('partitions focused groceries into a dedicated top section', () => {
    const { focused, regular } = partitionFocusedGroceries([
      item({ id: '2', title: 'Melk' }),
      item({ id: '1', title: 'Appels' , focus: true}),
      item({ id: '3', title: 'Bananen', focus: true }),
    ]);

    expect(focused.map((entry) => entry.title)).toEqual(['Appels', 'Bananen']);
    expect(regular.map((entry) => entry.title)).toEqual(['Melk']);
  });
});
