import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { UnifiedCard } from '../shared/UnifiedCard';
import { NewGlobalHeader } from '../shared/NewGlobalHeader';
import { TopBar } from '../shared/TopBar';
import { ChevronDown, ChevronUp, RotateCcw, ShoppingCart, X as XIcon, Save, ChevronRight } from 'lucide-react';

export const GroceriesView = () => {
  const { items, addItem, uncheckAllDoneItems, showCompletionMessage, activeChipFilters, toggleChipFilter, clearChipFilters, filters, addFilter, deleteFilter } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBought, setShowBought] = useState(false);
  const [showSavedFilters, setShowSavedFilters] = useState(false);

  const itemFilters = useMemo(() => filters.filter(f => f.type === 'item' || f.type === 'both'), [filters]);

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

  const handleAddItem = (value: string, metadata?: { shopId?: string }) => {
    addItem({
      title: value,
      completed: false,
      quantity: 1,
      labels: [],
      shopId: metadata?.shopId,
    });
  };

  const hasAnyFilter = activeChipFilters.length > 0;

  return (
    <>
      <div className="sticky top-0 z-40">
        <NewGlobalHeader
          onSearch={setSearchQuery}
          onAdd={handleAddItem}
          searchPlaceholder="Search groceries..."
          type="item"
        />
      </div>
              {/* Filter bar */}
        {hasAnyFilter && (
        <div className="bg-white border-b border-neutral-200 shadow-sm">
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
            <div className="relative">
              <button
                onClick={() => setShowSavedFilters(!showSavedFilters)}
                className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
                title="Saved filters"
                aria-label="Saved filters"
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
                        onClick={() => { deleteFilter(f.id); showCompletionMessage('Filter deleted'); }}
                        className="text-neutral-400 hover:text-red-500 ml-2 flex-shrink-0"
                        title="Delete filter"
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
                  const name = window.prompt('Filter name:', '');
                  if (!name || !name.trim()) return;
                  const typeRaw = window.prompt('Type: task, item, or both', 'item');
                  const ftype = (typeRaw || 'item').trim().toLowerCase();
                  const validType = ftype === 'task' || ftype === 'item' ? ftype : 'both';
                  addFilter({
                    name: name.trim(),
                    labelIds: [],
                    chipFilters: activeChipFilters.length > 0 ? activeChipFilters.map(c => ({...c})) : undefined,
                    showCompleted: true,
                    type: validType,
                  });
                  showCompletionMessage('Filter saved');
                } catch(e) {
                  showCompletionMessage('Failed to save filter');
                }
              }}
              className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
              title="Save current filter"
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
    </>
  );
};
