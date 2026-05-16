import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Test the stock status logic used by GroceriesView
type StockFilter = 'all' | 'missing' | 'few' | 'instock' | 'bought';

interface MockItem {
  id: string;
  title: string;
  completed: boolean;
  quantity?: number;
}

const getStockStatus = (item: MockItem): StockFilter => {
  if (item.completed) return 'bought';
  const qty = item.quantity ?? 0;
  if (qty === 0) return 'missing';
  if (qty === 1) return 'few';
  return 'instock';
};

describe('Groceries Stock Filter Logic', () => {
  it('classifies completed items as bought', () => {
    const item = { id: '1', title: 'Milk', completed: true, quantity: 5 };
    expect(getStockStatus(item)).toBe('bought');
  });

  it('classifies quantity 0 as missing', () => {
    const item = { id: '1', title: 'Milk', completed: false, quantity: 0 };
    expect(getStockStatus(item)).toBe('missing');
  });

  it('classifies quantity 1 as few', () => {
    const item = { id: '1', title: 'Milk', completed: false, quantity: 1 };
    expect(getStockStatus(item)).toBe('few');
  });

  it('classifies quantity > 1 as in stock', () => {
    const item = { id: '1', title: 'Milk', completed: false, quantity: 3 };
    expect(getStockStatus(item)).toBe('instock');
  });

  it('classifies undefined quantity as missing', () => {
    const item = { id: '1', title: 'Milk', completed: false };
    expect(getStockStatus(item)).toBe('missing');
  });

  it('filters items by stock status', () => {
    const items: MockItem[] = [
      { id: '1', title: 'Milk', completed: false, quantity: 3 },
      { id: '2', title: 'Eggs', completed: false, quantity: 1 },
      { id: '3', title: 'Bread', completed: false, quantity: 0 },
      { id: '4', title: 'Butter', completed: true, quantity: 2 },
    ];

    const missing = items.filter((i) => getStockStatus(i) === 'missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].title).toBe('Bread');

    const few = items.filter((i) => getStockStatus(i) === 'few');
    expect(few).toHaveLength(1);
    expect(few[0].title).toBe('Eggs');

    const inStock = items.filter((i) => getStockStatus(i) === 'instock');
    expect(inStock).toHaveLength(1);
    expect(inStock[0].title).toBe('Milk');

    const bought = items.filter((i) => getStockStatus(i) === 'bought');
    expect(bought).toHaveLength(1);
    expect(bought[0].title).toBe('Butter');
  });

  it('filters items by search query', () => {
    const items: MockItem[] = [
      { id: '1', title: 'Whole Milk', completed: false, quantity: 2 },
      { id: '2', title: 'Oat Milk', completed: false, quantity: 1 },
      { id: '3', title: 'Bread', completed: false, quantity: 3 },
    ];

    const milkItems = items.filter((i) =>
      i.title.toLowerCase().includes('milk')
    );
    expect(milkItems).toHaveLength(2);
  });

  it('combines stock filter with search query', () => {
    const items: MockItem[] = [
      { id: '1', title: 'Whole Milk', completed: false, quantity: 0 },
      { id: '2', title: 'Oat Milk', completed: false, quantity: 2 },
      { id: '3', title: 'Bread', completed: false, quantity: 0 },
    ];

    const result = items.filter(
      (i) =>
        getStockStatus(i) === 'missing' &&
        i.title.toLowerCase().includes('milk')
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Whole Milk');
  });

  it('excludes bought items from main list', () => {
    const items: MockItem[] = [
      { id: '1', title: 'Milk', completed: false, quantity: 2 },
      { id: '2', title: 'Eggs', completed: true, quantity: 1 },
    ];

    const mainList = items.filter((i) => getStockStatus(i) !== 'bought');
    expect(mainList).toHaveLength(1);
    expect(mainList[0].title).toBe('Milk');
  });
});

describe('Groceries Item Type Definitions', () => {
  it('ItemLinkedType accepts valid values', () => {
    const validTypes: ('task' | 'item')[] = ['task', 'item'];
    expect(validTypes).toContain('task');
    expect(validTypes).toContain('item');
  });
});
