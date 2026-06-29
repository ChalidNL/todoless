import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UnifiedCard } from '../shared/UnifiedCard';
import { NewGlobalHeader } from '../shared/NewGlobalHeader';
import { ChevronDown, ChevronUp, RotateCcw, ShoppingCart, X as XIcon, Save, ChevronRight, Target } from 'lucide-react';
import { t } from '../../i18n/translations';
import { groupGroceriesByCategory, partitionFocusedGroceries, sortGroceriesAlpha, type GrocerySortMode } from '../../lib/grocery-view-utils';
import { EmptyState } from '../shared/EmptyState';
import { SectionHeader } from '../shared/SectionHeader';

function StoreFilterChips({ shops, activeIds, onToggle, onAll }: { shops: Array<{ id: string; name: string; color?: string }>; activeIds: string[]; onToggle: (shop: { id: string; name: string; color?: string }) => void; onAll: () => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" aria-label="Store filters">
      <button
        type="button"
        onClick={onAll}
        className={`app-chip inline-flex min-h-[var(--app-touch-target)] flex-shrink-0 items-center gap-2 px-3 text-xs font-black shadow-sm ${activeIds.length === 0 ? 'text-white' : 'bg-white text-[var(--app-text-muted)]'}`}
        style={activeIds.length === 0 ? { backgroundColor: '#ec4899' } : undefined}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        Alle
      </button>
      {shops.map((shop) => {
        const active = activeIds.includes(shop.id);
        const color = shop.color || 'var(--app-primary)';
        return (
          <button
            key={shop.id}
            type="button"
            onClick={() => onToggle(shop)}
            className={`app-chip inline-flex min-h-[var(--app-touch-target)] flex-shrink-0 items-center gap-2 px-3 text-xs font-black shadow-sm ${active ? 'text-white' : 'bg-white text-[var(--app-text-muted)]'}`}
            style={active ? { backgroundColor: color } : { color }}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {shop.name}
          </button>
        );
      })}
    </div>
  );
}

export const GroceriesView = () => {
  const { items, shops = [], addItem, uncheckAllDoneItems, showCompletionMessage, activeChipFilters, toggleChipFilter, clearChipFilters, filters, addFilter, deleteFilter } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBought, setShowBought] = useState(false);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [sortMode, setSortMode] = useState<GrocerySortMode>('alpha');

  const itemFilters = useMemo(() => filters.filter(f => f.type === 'item'), [filters]);

  const applySavedFilter = (f: typeof filters[0]) => {
    clearChipFilters();
    if (f.chipFilters) {
      for (const cf of f.chipFilters) {
        toggleChipFilter(cf.type, cf.id, cf.label, cf.color);
      }
    }
    setShowSavedFilters(false);
    showCompletionMessage(`Filter: ${f.name}`);
  };

  const filteredItems = useMemo(() => {
    let result = items;

    // Chip filters (shop only)
    for (const f of activeChipFilters) {
      if (f.type === 'shop') {
        result = result.filter((item) => item.shopId === f.id);
      }
    }

    // Search
    if (searchQuery) {
      result = result.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [items, activeChipFilters, searchQuery]);

  const activeItems = useMemo(() => filteredItems.filter((item) => !item.completed), [filteredItems]);

  const { focused: focusedActiveItems, regular: regularActiveItems } = useMemo(
    () => partitionFocusedGroceries(activeItems),
    [activeItems]
  );

  const sortedActiveItems = useMemo(() => sortGroceriesAlpha(activeItems), [activeItems]);

  const groupedActive = useMemo(() => groupGroceriesByCategory(regularActiveItems), [regularActiveItems]);

  const sortedBoughtItems = useMemo(() => sortGroceriesAlpha(filteredItems.filter((item) => item.completed)), [filteredItems]);

  const handleAddItem = (value: string, metadata?: { shopId?: string }) => {
    addItem({
      title: value,
      completed: false,
      quantity: 1,
      labels: [],
      shopId: metadata?.shopId,
    });
  };

  const handleRestockCompletedItems = () => {
    if (!window.confirm(t('items.confirmRestock'))) return;
    uncheckAllDoneItems();
    showCompletionMessage(t('items.restocked'));
  };

  const hasAnyFilter = activeChipFilters.length > 0;
  const activeShopFilterIds = activeChipFilters.filter((f) => f.type === 'shop').map((f) => f.id);
  const clearShopFilters = () => activeShopFilterIds.forEach((id) => toggleChipFilter('shop', id));

  return (
    <>
      <div className="sticky top-0 z-40">
        <NewGlobalHeader
          screen="shop"
          onSearch={setSearchQuery}
          onAdd={handleAddItem}
          searchPlaceholder={t('items.searchPlaceholder')}
          type="item"
          count={sortedActiveItems.length}
          sortValue={sortMode}
          onSortChange={(value) => setSortMode(value as GrocerySortMode)}
          sortOptions={[
            { value: 'alpha', label: t('items.sortAlpha') },
            { value: 'category', label: t('items.sortCategory') },
          ]}
        />
      </div>
      {/* Active items */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {shops.length > 0 && (
          <StoreFilterChips
            shops={shops}
            activeIds={activeShopFilterIds}
            onToggle={(shop) => toggleChipFilter('shop', shop.id, shop.name, shop.color)}
            onAll={clearShopFilters}
          />
        )}
        {sortedActiveItems.length === 0 ? (
          <EmptyState title={t('groceries.empty') || 'No items yet'} icon={<ShoppingCart className="h-7 w-7" />} />
        ) : (
          <div className="space-y-4">
            {focusedActiveItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-orange-600 mb-2 px-1 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-500" />
                  {t('tasks.focus')} ({focusedActiveItems.length})
                </h3>
                <div className="space-y-[10px]">
                  {focusedActiveItems.map((item) => (
                    <UnifiedCard key={item.id} entity={item} type="item" />
                  ))}
                </div>
              </div>
            )}

            {sortMode === 'alpha' ? (
              <div className="space-y-[10px]">
                {regularActiveItems.map((item) => (
                  <UnifiedCard key={item.id} entity={item} type="item" />
                ))}
              </div>
            ) : (
              groupedActive.map(([category, catItems]) => (
                <div key={category}>
                  <SectionHeader title={category} count={catItems.length} />
                  <div className="space-y-[10px]">
                    {catItems.map((item) => (
                      <UnifiedCard key={item.id} entity={item} type="item" />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* In stock items (collapsed by default) */}
        {sortedBoughtItems.length > 0 && (
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowBought(!showBought)}
                className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                {showBought ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {t('common.completed')} ({sortedBoughtItems.length})
              </button>
              {sortedBoughtItems.length > 0 && (
                <button
                  onClick={handleRestockCompletedItems}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                  title={t('common.restock')}
                >
                  <RotateCcw className="w-3 h-3" />
                  {t('common.restock')}
                </button>
              )}
            </div>

            {showBought && (
              <div className="mt-3 space-y-[10px]">
                {sortedBoughtItems.map((item) => (
                  <UnifiedCard key={item.id} entity={item} type="item" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
