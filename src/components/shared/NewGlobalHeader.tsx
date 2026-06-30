import React, { useState } from 'react';
import { Plus, SlidersHorizontal, X, Save, Search, Inbox, CheckSquare, CalendarDays, ShoppingCart, Users, Tag, Target, Settings, Bell, ChevronDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { AppLogo } from './AppLogo';

interface AppHeaderProps {
  screen?: 'inbox' | 'taken' | 'agenda' | 'shop' | 'leden' | 'labels' | 'focus' | 'instellingen';
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
  count?: number | string;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: Array<{ value: string; label: string }>;
  sortAriaLabel?: string;
}

const SCREEN_THEMES = {
  inbox: { color: '#3b82f6', bg: '#eff6ff', badgeLabel: 'INBOX', Icon: Inbox },
  taken: { color: '#22c55e', bg: '#f0fdf4', badgeLabel: 'TAKEN', Icon: CheckSquare },
  agenda: { color: '#f97316', bg: '#fff7ed', badgeLabel: 'AGENDA', Icon: CalendarDays },
  shop: { color: '#ec4899', bg: '#fdf2f8', badgeLabel: 'SHOP', Icon: ShoppingCart },
  leden: { color: '#06b6d4', bg: '#ecfeff', badgeLabel: 'FAMILIE', Icon: Users },
  labels: { color: '#eab308', bg: '#fefce8', badgeLabel: 'LABELS', Icon: Tag },
  focus: { color: '#8b5cf6', bg: '#f5f3ff', badgeLabel: 'FOCUS', Icon: Target },
  instellingen: { color: '#6366f1', bg: '#eef2ff', badgeLabel: 'INSTELLINGEN', Icon: Settings },
} as const;

export function AddButton({ onClick, color = 'var(--app-primary)' }: { onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-fab flex h-[var(--app-touch-target)] w-[var(--app-touch-target)] flex-shrink-0 items-center justify-center rounded-[16px]"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 12px ${color}40` }}
      title={t('common.addTooltip')}
      aria-label={t('common.addTooltip')}
    >
      <Plus className="h-5 w-5" strokeWidth={2.6} />
    </button>
  );
}

export const AppHeader = ({
  screen = 'inbox',
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
  showAdd = true,
  count,
  sortValue,
  onSortChange,
  sortOptions = [],
  sortAriaLabel = t('common.sort')
}: AppHeaderProps) => {
  const [internalInputValue, setInternalInputValue] = useState('');
  const inputText = inputValue ?? internalInputValue;
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const { filters, toggleChipFilter, clearChipFilters, activeChipFilters = [], users = [], appSettings = {} } = useApp();
  const theme = SCREEN_THEMES[screen];
  const BadgeIcon = theme.Icon;
  const currentUser = users.find((user: any) => user.id === (appSettings as any).currentUserId) || users[0];
  const displayName = currentUser ? `${currentUser.displayName || currentUser.name || [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.email || ''}` : '';
  const initials = currentUser
    ? `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase() || displayName.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT'
    : 'CT';
  const notificationCount = 0;
  const isSortable = !!onSortChange && sortOptions.length > 0;

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
  };

  const closeFilterSheet = () => setShowFilterDropdown(false);

  return (
    <div className="sticky top-0 z-40 safe-top" style={{ background: theme.bg, borderBottom: `1px solid ${theme.color}18` }}>
      <div className="mx-auto max-w-2xl px-[var(--app-space-screen-x)] pb-3 pt-3">
        <div className="mb-3 flex min-h-[36px] items-center justify-between px-0">
          <a
            href="/settings/profile"
            className="grid h-9 w-9 flex-shrink-0 place-items-center overflow-hidden rounded-full border-[2.5px] border-white/20 bg-[#1a1a2e] text-[13px] font-bold tracking-[-0.02em] text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] active:scale-[0.97]"
            aria-label={t('settings.yourProfile')}
          >
            <span>{initials}</span>
          </a>
          <AppLogo size="lg" />
          <a
            href="/settings/notifications"
            className="relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-white/60 text-[var(--app-text-muted)] active:scale-[0.97]"
            aria-label="Notificaties"
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
            {notificationCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-red-500" />}
          </a>
        </div>

        <div className="app-search-card flex items-center gap-2 bg-transparent p-0 shadow-none">
          {showFilters && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="app-icon-button relative h-10 w-10 flex-shrink-0 border backdrop-blur-md hover:bg-[var(--app-surface)]"
                style={{ background: activeChipFilters.length > 0 ? `${theme.color}18` : 'rgba(255,255,255,0.82)', borderColor: activeChipFilters.length > 0 ? `${theme.color}40` : 'var(--app-border-subtle)', color: activeChipFilters.length > 0 ? theme.color : 'var(--app-text-muted)' }}
                title={t('common.filtersTooltip')}
                aria-label={t('common.filtersTooltip')}
              >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
                {activeChipFilters.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: theme.color }} />
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
                  <div className="flex gap-2 border-t border-[var(--app-border-subtle)] p-2">
                    <button type="button" onClick={clearChipFilters} className="min-h-9 flex-1 rounded-full border border-[var(--app-border-subtle)] text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]">
                      {t('common.clearAllTooltip')}
                    </button>
                    <button type="button" onClick={closeFilterSheet} className="min-h-9 flex-1 rounded-full text-xs font-bold text-white" style={{ background: theme.color }}>
                      {t('common.confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showSearch && (
            <div className="flex min-h-12 flex-1 items-center gap-3 rounded-[var(--app-radius-pill)] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <Search className="h-[17px] w-[17px] flex-shrink-0" style={{ color: theme.color }} strokeWidth={2.2} />
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent p-0 text-[16px] font-medium text-[var(--app-text)] placeholder:text-[var(--app-text-soft)] focus:outline-none"
              />
            </div>
          )}

          {showInputActions && onSubmitInput && (
            <button
              type="button"
              onClick={submitInput}
              className="app-icon-button h-10 w-10 flex-shrink-0 bg-white/85 shadow-none hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
              style={{ color: theme.color }}
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
              className="app-icon-button h-10 w-10 flex-shrink-0 bg-white/85 shadow-none hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
              title={cancelAriaLabel}
              aria-label={cancelAriaLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {showAdd && <AddButton onClick={handleAdd} color={theme.color} />}
        </div>

        {/* Active filter chips now inline in screen-specific filter bars — removed from global header */}

        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <BadgeIcon className="h-[18px] w-[18px]" style={{ color: theme.color }} strokeWidth={2.2} />
            <span className="text-sm font-black tracking-[0.06em]" style={{ color: theme.color }}>{theme.badgeLabel}</span>
            {count !== undefined && (
              <span className="rounded-[var(--app-radius-pill)] px-2 py-0.5 text-sm font-black" style={{ color: theme.color, background: `${theme.color}15` }}>{count}</span>
            )}
          </div>
          {isSortable && (
            <select
              value={sortValue}
              onChange={(event) => onSortChange?.(event.target.value)}
              className="min-h-10 rounded-[var(--app-radius-pill)] px-3.5 text-sm font-semibold outline-none"
              style={{ border: `1px solid ${theme.color}25`, background: `${theme.color}08`, color: theme.color, minWidth: '4.5rem' }}
              aria-label={sortAriaLabel}
              data-component="shared-select"
            >
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </div>
      </div>
    </div>
  );
};

export const NewGlobalHeader = AppHeader;
