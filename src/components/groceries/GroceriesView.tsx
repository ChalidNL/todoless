import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UnifiedCard } from '../shared/UnifiedCard';
import { NewGlobalHeader } from '../shared/NewGlobalHeader';
import { TopBar } from '../shared/TopBar';
import { ChevronDown, ChevronUp, RotateCcw, ShoppingCart, X as XIcon, Save } from 'lucide-react';

export const GroceriesView = () => {
  const { items, addItem, uncheckAllDoneItems, showCompletionMessage, activeChipFilters, toggleChipFilter, clearChipFilters } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBought, setShowBought] = useState(false);

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

  const sortedActiveItems = useMemo(() => {
    return [...filteredItems.filter((item) => !item.completed)].sort((a, b) =>
      a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    );
  }, [filteredItems]);

  const sortedBoughtItems = useMemo(() => {
    return [...filteredItems.filter((item) => item.completed)].sort((a, b) =>
      a.title.toLowerCase().localeCompare(b.title.toLowerCase())
    );
  }, [filteredItems]);

  const handleAddItem = (value: string) => {
    addItem({
      title: value,
      completed: false,
      quantity: 1,
      labels: [],
    });
  };

  const hasAnyFilter = activeChipFilters.length > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0">
        <NewGlobalHeader
          onSearch={setSearchQuery}
          onAdd={handleAddItem}
          searchPlaceholder="Search groceries..."
          type="item"
        />
      </div>
      <div className="flex-1 overflow-y-auto bg-neutral-50">
        {/* Filter bar */}
        {hasAnyFilter && (
        <div className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600">
              {sortedActiveItems.length > 0
                ? `Groceries (${sortedActiveItems.length + sortedBoughtItems.length})`
                : 'No results'}
            </span>
            <div className="flex gap-1 flex-1 flex-wrap">
              {activeChipFilters.map((f) => (
                <span
                  key={`${f.type}-${f.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
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
              title="Clear all filters"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => showCompletionMessage('Filter saved (not yet implemented)')}
              className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
              title="Save filter"
              aria-label="Save filter"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Active items */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-neutral-600 flex items-center gap-1.5">
            Groceries ({sortedActiveItems.length})
          </h2>
        </div>
        {sortedActiveItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">No grocery items</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedActiveItems.map((item) => (
              <UnifiedCard key={item.id} entity={item} type="item" />
            ))}
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
                In stock ({sortedBoughtItems.length})
              </button>
              {sortedBoughtItems.length > 0 && (
                <button
                  onClick={() => {
                    uncheckAllDoneItems();
                    showCompletionMessage('All groceries reset to in stock');
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                  title="Uncheck all"
                >
                  <RotateCcw className="w-3 h-3" />
                  Uncheck All
                </button>
              )}
            </div>

            {showBought && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedBoughtItems.map((item) => (
                  <UnifiedCard key={item.id} entity={item} type="item" />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
};
