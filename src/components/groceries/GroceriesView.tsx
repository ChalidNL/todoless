import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UnifiedCard } from '../shared/UnifiedCard';
import { NewGlobalHeader } from '../shared/NewGlobalHeader';
import { SharedSelect } from '../shared/SharedSelect';
import { ChevronDown, ChevronUp, RotateCcw, ShoppingCart, X as XIcon, Save, ChevronRight, Target } from 'lucide-react';
import { t } from '../../i18n/translations';
import { groupGroceriesByCategory, partitionFocusedGroceries, sortGroceriesAlpha, type GrocerySortMode } from '../../lib/grocery-view-utils';

export const GroceriesView = () => {
  const { items, addItem, uncheckAllDoneItems, showCompletionMessage, activeChipFilters, toggleChipFilter, clearChipFilters, filters, addFilter, deleteFilter } = useApp();
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

  return (
    <>
      <div className="sticky top-0 z-40">
        <NewGlobalHeader
          onSearch={setSearchQuery}
          onAdd={handleAddItem}
          searchPlaceholder={t('items.searchPlaceholder')}
          type="item"
        />
      </div>
              {/* Filter bar */}
        {hasAnyFilter && (
        <div className="bg-white border-b border-neutral-200 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600">
              {sortedActiveItems.length > 0
                ? `${t('items.title')} (${sortedActiveItems.length + sortedBoughtItems.length})`
                : t('inbox.noResults')}
            </span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {activeChipFilters.map((f) => (
                <span
                  key={`${f.type}-${f.id}`}
                  className="inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border select-none"
                  style={{
                    backgroundColor: f.color ? `${f.color}20` : undefined,
                    color: f.color ? f.color : undefined,
                    borderColor: f.color ? `${f.color}40` : '#e5e7eb',
                  }}
                >
                  {f.label || f.id}
                  <button onClick={() => toggleChipFilter(f.type, f.id)} className="ml-0.5 hover:opacity-70">
                    <XIcon className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={clearChipFilters}
              className="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded"
              title={t('common.clearAllTooltip')}
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSavedFilters(!showSavedFilters)}
                className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
                title={t('common.filters')}
                aria-label={t('common.filters')}
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showSavedFilters ? 'rotate-90' : ''}`} />
              </button>
              {showSavedFilters && itemFilters.length > 0 && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                  {itemFilters.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-neutral-50">
                      <button
                        onClick={() => applySavedFilter(f)}
                        className="text-xs text-neutral-700 text-left flex-1 truncate"
                      >
                        {f.name}
                      </button>
                      <button
                        onClick={() => { deleteFilter(f.id); showCompletionMessage(t('filters.deleted')); }}
                        className="text-neutral-400 hover:text-red-500 ml-2 flex-shrink-0"
                        title={t('common.delete')}
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                try {
                  const name = window.prompt(t('settings.filterName'), '');
                  if (!name || !name.trim()) return;
                  const typeRaw = window.prompt(t('filters.itemOrShopPrompt'), 'item');
                  const ftype = (typeRaw || 'item').trim().toLowerCase();
                  const validType = ftype === 'task' ? 'task' : 'item';
                  addFilter({
                    name: name.trim(),
                    labelIds: [],
                    chipFilters: activeChipFilters.length > 0 ? activeChipFilters.map(c => ({...c})) : undefined,
                    showCompleted: true,
                    type: validType,
                  });
                  showCompletionMessage(t('filters.saved'));
                } catch(e) {
                  showCompletionMessage(t('filters.saveFailed'));
                }
              }}
              className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
              title={t('common.save')}
              aria-label={t('common.save')}
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Active items */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm text-neutral-600">
            {t('items.title')} ({sortedActiveItems.length})
          </h2>
          <SharedSelect<GrocerySortMode>
            value={sortMode}
            onChange={setSortMode}
            ariaLabel={t('items.sortLabel')}
            options={[
              { value: 'alpha', label: t('items.sortAlpha') },
              { value: 'category', label: t('items.sortCategory') },
            ]}
          />
        </div>
        {sortedActiveItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">{t('groceries.empty') || 'No items yet'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {focusedActiveItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-orange-600 mb-2 px-1 flex items-center gap-2">
                  <Target className="w-4 h-4 text-orange-500" />
                  {t('tasks.focus')} ({focusedActiveItems.length})
                </h3>
                <div className="space-y-2">
                  {focusedActiveItems.map((item) => (
                    <UnifiedCard key={item.id} entity={item} type="item" />
                  ))}
                </div>
              </div>
            )}

            {sortMode === 'alpha' ? (
              <div className="space-y-2">
                {regularActiveItems.map((item) => (
                  <UnifiedCard key={item.id} entity={item} type="item" />
                ))}
              </div>
            ) : (
              groupedActive.map(([category, catItems]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 px-1">
                    {category} ({catItems.length})
                  </h3>
                  <div className="space-y-2">
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
              <div className="mt-3 space-y-2">
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
