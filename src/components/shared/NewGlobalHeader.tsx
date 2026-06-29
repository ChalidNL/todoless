import React, { useState } from 'react';
import { Plus, Filter, X, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { AppLogo } from './AppLogo';

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
      className="app-fab flex h-[var(--app-touch-target)] w-[var(--app-touch-target)] flex-shrink-0 items-center justify-center rounded-[16px]"
      title={t('common.addTooltip')}
      aria-label={t('common.addTooltip')}
    >
      <Plus className="h-5 w-5" strokeWidth={2.6} />
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
      setInputText('');
      if (onSearch) onSearch('');
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
      showCompleted: false,
      chipFilters: activeChipFilters.map(f => ({ type: f.type, id: f.id, label: f.label, color: f.color })),
    });
    setShowFilterDropdown(false);
    showCompletionMessage(t('filters.saved'));
  };

  return (
    <div className="app-shell-bg sticky top-0 z-40 safe-top">
      <div className="mx-auto max-w-2xl px-[var(--app-space-screen-x)] pb-3 pt-3">
        <div className="mb-5 flex min-h-[34px] items-center justify-center">
          <AppLogo size="lg" />
        </div>

        <div className="app-search-card flex items-center gap-3 bg-transparent p-0 shadow-none">
          {showFilters && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`app-icon-button relative h-[var(--app-touch-target)] w-[var(--app-touch-target)] flex-shrink-0 bg-[var(--app-surface-glass)] shadow-[var(--app-shadow-card)] backdrop-blur-md hover:bg-[var(--app-surface)] ${activeChipFilters.length > 0 ? 'text-[var(--app-primary)]' : ''}`}
                title={t('common.filtersTooltip')}
                aria-label={t('common.filtersTooltip')}
              >
                <Filter className="h-4 w-4" />
                {activeChipFilters.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-primary)] text-[10px] font-bold text-white">
                    {activeChipFilters.length}
                  </span>
                )}
              </button>

              {showFilterDropdown && (
                <div className="app-surface absolute left-0 top-full z-50 mt-2 max-h-80 w-64 overflow-y-auto">
                  <div className="border-b border-[var(--app-border-subtle)] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--app-text-muted)]">{t('filters.title')}</span>
                      <button type="button" onClick={() => setShowFilterDropdown(false)} className="rounded p-0.5 hover:bg-[var(--app-surface-2)]" aria-label={t('common.close')}>
                        <X className="h-3.5 w-3.5 text-[var(--app-text-soft)]" />
                      </button>
                    </div>
                  </div>

                  {activeChipFilters.length > 0 && (
                    <div className="border-b border-[var(--app-border-subtle)] p-2">
                      <div className="flex flex-wrap gap-1">
                        {activeChipFilters.map(f => (
                          <span
                            key={`${f.type}-${f.id}`}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: f.color ? `${f.color}20` : 'var(--app-surface-2)', color: f.color || 'var(--app-text-muted)' }}
                          >
                            {f.label || f.id}
                            <button type="button" onClick={() => toggleChipFilter(f.type, f.id)} className="hover:opacity-70" aria-label={t('common.remove')}>
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={saveCurrentFilter} className="flex flex-1 items-center justify-center gap-1 rounded py-1 text-[10px] font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]">
                          <Save className="h-3 w-3" /> {t('common.save')}
                        </button>
                        <button type="button" onClick={clearChipFilters} className="flex-1 rounded py-1 text-[10px] font-medium text-[var(--app-primary)] hover:bg-[var(--app-surface-2)]">
                          {t('common.clearAllTooltip')}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-1">
                    {typeFilters.length === 0 ? (
                      <p className="p-3 text-center text-xs text-[var(--app-text-soft)]">
                        {t('filters.noSavedFiltersHint')}
                      </p>
                    ) : (
                      typeFilters.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => applySavedFilter(f.id)}
                          className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-[var(--app-surface-2)]"
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="ml-2 shrink-0 text-[10px] text-[var(--app-text-soft)]">
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
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="app-input min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-pill)] bg-[var(--app-surface-glass)] px-4 py-2.5 text-sm shadow-[var(--app-shadow-card)] backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
              />
            </div>
          )}

          {showInputActions && onSubmitInput && (
            <button
              type="button"
              onClick={submitInput}
              className="app-icon-button h-[var(--app-touch-target)] w-[var(--app-touch-target)] flex-shrink-0 bg-[var(--app-surface-glass)] text-[var(--app-primary)] shadow-[var(--app-shadow-card)] hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
              title={submitAriaLabel}
              aria-label={submitAriaLabel}
            >
              <Save className="h-4 w-4" />
            </button>
          )}

          {showInputActions && onCancelInput && (
            <button
              type="button"
              onClick={onCancelInput}
              className="app-icon-button h-[var(--app-touch-target)] w-[var(--app-touch-target)] flex-shrink-0 bg-[var(--app-surface-glass)] shadow-[var(--app-shadow-card)] hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
              title={cancelAriaLabel}
              aria-label={cancelAriaLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {showAdd && <AddButton onClick={handleAdd} />}
        </div>
      </div>
    </div>
  );
};

export const NewGlobalHeader = AppHeader;
