import React, { useState } from 'react';
import { Plus, Filter, X, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { AppMark } from './AppLogo';

interface AppHeaderProps {
  onSearch?: (query: string) => void;
  onAdd?: (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number; sprintId?: string; shopId?: string }) => void;
  onAddEmpty?: (value?: string) => void;
  onInputValueChange?: (value: string) => void;
  onSubmitInput?: (value: string) => void;
  onCancelInput?: () => void;
  inputValue?: string;
  submitAriaLabel?: string;
  cancelAriaLabel?: string;
  showInputActions?: boolean;
  onFilter?: (filters: any) => void;
  searchPlaceholder?: string;
  type?: 'task' | 'item' | 'note' | 'calendar';
  showFilters?: boolean;
  showSearch?: boolean;
  showAdd?: boolean;
}

export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 bg-white text-black rounded-md hover:bg-neutral-200 flex-shrink-0"
      title={t('common.addTooltip')}
      aria-label={t('common.addTooltip')}
    >
      <Plus className="w-4 h-4" />
    </button>
  );
}

export const AppHeader = ({
  onSearch,
  onAdd,
  onAddEmpty,
  onInputValueChange,
  onSubmitInput,
  onCancelInput,
  inputValue,
  submitAriaLabel = t('common.save'),
  cancelAriaLabel = t('common.cancel'),
  showInputActions = true,
  onFilter,
  searchPlaceholder = t('common.searchDot'),
  type = 'task',
  showFilters = true,
  showSearch = true,
  showAdd = true
}: AppHeaderProps) => {
  const [internalInputValue, setInternalInputValue] = useState('');
  const inputText = inputValue ?? internalInputValue;
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const { filters, toggleChipFilter, clearChipFilters, activeChipFilters = [], addFilter, showCompletionMessage } = useApp();

  const typeFilters = filters.filter(f => f.type === type);

  const setInputText = (value: string) => {
    if (onInputValueChange) onInputValueChange(value);
    else setInternalInputValue(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    if (onSearch) onSearch(value);
  };

  const submitInput = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    if (onSubmitInput) {
      onSubmitInput(trimmed);
      return;
    }
    if (onAdd) {
      onAdd(trimmed);
      setInputText('');
      if (onSearch) onSearch('');
    }
  };

  const handleAdd = () => {
    const trimmed = inputText.trim();
    if (trimmed && (onAdd || onSubmitInput)) {
      submitInput();
      return;
    }
    if (onAddEmpty) {
      onAddEmpty(trimmed || undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    handleAdd();
  };

  const applySavedFilter = (filterId: string) => {
    const filter = filters.find(f => f.id === filterId);
    if (!filter) return;
    clearChipFilters();
    if (filter.chipFilters) {
      filter.chipFilters.forEach((cf: any) => {
        toggleChipFilter(cf.type, cf.id, cf.label, cf.color);
      });
    }
    setShowFilterDropdown(false);
    showCompletionMessage(t('filters.applied'));
  };

  const saveCurrentFilter = () => {
    if (activeChipFilters.length === 0) {
      showCompletionMessage(t('filters.noActiveFilters'));
      return;
    }
    const name = `Filter ${typeFilters.length + 1}`;
    addFilter({
      name,
      type: type === 'item' ? 'item' : 'task',
      labelIds: [],
      chipFilters: activeChipFilters.map(f => ({ type: f.type, id: f.id, label: f.label, color: f.color })),
    });
    setShowFilterDropdown(false);
    showCompletionMessage(t('filters.saved'));
  };

  return (
    <>
      <div className="bg-black border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-center gap-2 text-white w-full">
            <AppMark className="w-8 h-8 text-white" />
            <span className="text-xl font-semibold tracking-tight">todoless</span>
          </div>

          <div className="flex items-center gap-2">
            {showFilters && (
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`p-2 rounded-md flex-shrink-0 text-white hover:bg-neutral-800 ${
                    activeChipFilters.length > 0 ? 'bg-neutral-800 ring-1 ring-neutral-600' : ''
                  }`}
                  title={t('common.filtersTooltip')}
                >
                  <Filter className="w-4 h-4" />
                  {activeChipFilters.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeChipFilters.length}
                    </span>
                  )}
                </button>

                {showFilterDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2 border-b border-neutral-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-600">{t('filters.title')}</span>
                        <button onClick={() => setShowFilterDropdown(false)} className="p-0.5 hover:bg-neutral-100 rounded">
                          <X className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                      </div>
                    </div>

                    {activeChipFilters.length > 0 && (
                      <div className="p-2 border-b border-neutral-100">
                        <div className="flex flex-wrap gap-1">
                          {activeChipFilters.map(f => (
                            <span key={`${f.type}-${f.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: f.color ? `${f.color}20` : '#f3f4f6', color: f.color || '#6b7280' }}
                            >
                              {f.label || f.id}
                              <button onClick={() => toggleChipFilter(f.type, f.id)} className="hover:opacity-70">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={saveCurrentFilter} className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-100 py-1 rounded">
                            <Save className="w-3 h-3" /> {t('common.save')}
                          </button>
                          <button onClick={clearChipFilters} className="flex-1 text-[10px] font-medium text-red-500 hover:bg-red-50 py-1 rounded">
                            {t('common.clearAllTooltip')}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-1">
                      {typeFilters.length === 0 ? (
                        <p className="text-xs text-neutral-400 p-3 text-center">
                          {t('filters.noSavedFiltersHint')}
                        </p>
                      ) : (
                        typeFilters.map(f => (
                          <button key={f.id} onClick={() => applySavedFilter(f.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 rounded flex items-center justify-between"
                          >
                            <span className="truncate">{f.name}</span>
                            <span className="text-[10px] text-neutral-400 ml-2 shrink-0">
                              {f.chipFilters?.length || 0}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {showSearch && (
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full px-3 py-2 bg-neutral-900 text-white border border-neutral-700 rounded-md focus:outline-none focus:border-neutral-500 text-sm"
                />
              </div>
            )}

            {showInputActions && onSubmitInput && (
              <button
                type="button"
                onClick={submitInput}
                className="p-2 rounded-md flex-shrink-0 bg-white text-black hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/60"
                title={submitAriaLabel}
                aria-label={submitAriaLabel}
              >
                <Save className="w-4 h-4" />
              </button>
            )}

            {showInputActions && onCancelInput && (
              <button
                type="button"
                onClick={onCancelInput}
                className="p-2 rounded-md flex-shrink-0 text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-white/50"
                title={cancelAriaLabel}
                aria-label={cancelAriaLabel}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {showAdd && <AddButton onClick={handleAdd} />}
          </div>
        </div>
      </div>
    </>
  );
};

export const NewGlobalHeader = AppHeader;
