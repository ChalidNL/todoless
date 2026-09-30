import React, { useState } from 'react';
import { Plus, SlidersHorizontal, X, Save, Search, Inbox, CheckSquare, CalendarDays, ShoppingCart, Users, Tag, Target, Settings, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t, formatDate } from '../../i18n/translations';
import { AppLogo } from './AppLogo';
import { getCompactUserName } from '../../lib/member-role-utils';
import { entityColor } from '../../lib/entity-colors';

interface AppHeaderProps {
  type?: string;
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
  showFilters?: boolean;
  showSearch?: boolean;
  showAdd?: boolean;
  count?: number | string;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: Array<{ value: string; label: string }>;
  sortAriaLabel?: string;
  /**
   * Hide the date-preset and repeat chip sections inside the filter dropdown.
   * Used by screens whose items are not keyed by a single due-date/repeat
   * field (calendar), so the dropdown only offers sections that actually
   * match the model — no separate calendar filter implementation.
   */
  hideDateRepeatSections?: boolean;
}

const SCREEN_THEMES = {
  inbox: { color: '#3b82f6', bg: '#eff6ff', badgeKey: 'nav.inbox', Icon: Inbox },
  taken: { color: '#22c55e', bg: '#f0fdf4', badgeKey: 'nav.tasks', Icon: CheckSquare },
  agenda: { color: '#f97316', bg: '#fff7ed', badgeKey: 'nav.calendar', Icon: CalendarDays },
  shop: { color: '#ec4899', bg: '#fdf2f8', badgeKey: 'nav.groceries', Icon: ShoppingCart },
  leden: { color: '#06b6d4', bg: '#ecfeff', badgeKey: 'members.title', Icon: Users },
  labels: { color: '#eab308', bg: '#fefce8', badgeKey: 'settings.labels', Icon: Tag },
  focus: { color: '#8b5cf6', bg: '#f5f3ff', badgeKey: 'tasks.focus', Icon: Target },
  instellingen: { color: '#6366f1', bg: '#eef2ff', badgeKey: 'settings.title', Icon: Settings },
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
  showFilters = true,
  showSearch = true,
  showAdd = true,
  count,
  sortValue,
  onSortChange,
  sortOptions = [],
  sortAriaLabel = t('common.sort'),
  hideDateRepeatSections = false,
}: AppHeaderProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [internalInputValue, setInternalInputValue] = useState('');
  const inputText = inputValue ?? internalInputValue;
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const { toggleChipFilter, clearChipFilters, activeChipFilters = [], labels = [], users = [], tasks = [], reminders = [], appSettings = {}, showCompletionMessage } = useApp();
  const theme = SCREEN_THEMES[screen];
  const BadgeIcon = theme.Icon;
  const currentUser = users.find((user: any) => user.id === (appSettings as any).currentUserId) || users[0];
  const displayName = currentUser ? `${currentUser.displayName || currentUser.name || [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.email || ''}` : '';
  const initials = currentUser
    ? `${currentUser.firstName?.[0] || ''}${currentUser.lastName?.[0] || ''}`.toUpperCase() || displayName.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT'
    : 'CT';
  const now = Date.now();
  const reminderWindowMs = ((appSettings as any).reminderMinutes ?? 15) * 60 * 1000;
  const dueSoonCount = (appSettings as any).taskReminders === false ? 0 : tasks.filter((task: any) => {
    if (task.status === 'done' || !task.dueDate) return false;
    return task.dueDate >= now && task.dueDate <= now + reminderWindowMs;
  }).length;
  const firedReminderCount = reminders.filter((reminder: any) => reminder.fired && !reminder.dismissed).length;
  const notificationCount = dueSoonCount + firedReminderCount;
  const isSortable = !!onSortChange && sortOptions.length > 0;

  // Only render the action row (search card) when at least one action is
  // actually enabled — otherwise screens like Settings render a full-height,
  // empty grey card that pushes the badge row down (GH header-height bug).
  const hasActionRow = showFilters || showSearch || showAdd || (showInputActions && (!!onSubmitInput || !!onCancelInput));

  // Date presets reuse the exact 'date' chip format TasksView filters on:
  // formatDate(dueDate, { month: 'short', day: 'numeric' }) === chip id.
  const datePresetChips = Array.from({ length: 7 }, (_, i) => {
    const ts = now + i * 86_400_000;
    return {
      id: formatDate(ts, { month: 'short', day: 'numeric' }),
      label: formatDate(ts, { weekday: 'short', day: 'numeric' }),
    };
  });

  const renderFilterChip = (type: string, id: string, label: string, color?: string) => {
    const active = activeChipFilters.some((f: any) => f.type === type && f.id === id);
    return (
      <button
        key={`${type}-${id}`}
        type="button"
        onClick={() => toggleChipFilter(type, id, label, color)}
        className={`inline-flex min-h-8 flex-shrink-0 items-center rounded-full border px-2.5 text-xs font-bold shadow-sm transition-all ${
          active ? 'text-white' : 'border-[var(--app-border-subtle)] bg-white text-[var(--app-text-muted)]'
        }`}
        style={active ? { backgroundColor: color || 'var(--app-accent)' } : undefined}
      >
        {label}
      </button>
    );
  };

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
      return;
    }
    showCompletionMessage(t('calendar.titleRequired'));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
  };

  const handleHeaderNavigate = (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="sticky top-0 z-40 safe-top" style={{ background: theme.bg, borderBottom: `1px solid ${theme.color}18` }}>
      <div className="mx-auto max-w-2xl px-[var(--app-space-screen-x)] pb-3 pt-3">
        <div className="mb-3 flex min-h-[44px] items-center justify-between px-0">
          <a
            href="/settings/profile"
            onClick={handleHeaderNavigate('/settings/profile')}
            className="grid h-11 w-11 flex-shrink-0 place-items-center overflow-hidden rounded-full border-[2.5px] border-white/20 bg-[#1a1a2e] text-[13px] font-bold tracking-[-0.02em] text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] active:scale-[0.97]"
            aria-label={t('settings.yourProfile')}
          >
            <span>{initials}</span>
          </a>
          <AppLogo size="lg" />
          <a
            href="/settings/notifications"
            onClick={handleHeaderNavigate('/settings/notifications')}
            className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white/60 text-[var(--app-text-muted)] active:scale-[0.97]"
            aria-label={t('settings.notifications')}
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={1.8} />
            {notificationCount > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-black text-white">{notificationCount > 9 ? '9+' : notificationCount}</span>}
          </a>
        </div>

        {/* Title band (badge row) — always directly under the logo row so the
            page title sits at the same vertical position on every screen,
            whether or not an action row is rendered below it. A uniform
            min-height keeps the title baseline identical with/without the
            sort select (no per-screen offsets). */}
        <div className="mt-3 flex min-h-[var(--app-touch-target)] items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <BadgeIcon className="h-[18px] w-[18px]" style={{ color: theme.color }} strokeWidth={2.2} />
            <span className="text-sm font-semibold tracking-[0.06em]" style={{ color: theme.color }}>{t(theme.badgeKey).toUpperCase()}</span>
            {count !== undefined && (
              <span className="rounded-[var(--app-radius-pill)] px-2 py-0.5 text-sm font-black" style={{ color: theme.color, background: `${theme.color}15` }}>{count}</span>
            )}
          </div>
          {isSortable && (
            <select
              value={sortValue}
              onChange={(event) => onSortChange?.(event.target.value)}
              className="min-h-11 rounded-[var(--app-radius-pill)] px-3.5 text-sm font-semibold outline-none"
              style={{ border: `1px solid ${theme.color}25`, background: `${theme.color}08`, color: theme.color, minWidth: '4.5rem' }}
              aria-label={sortAriaLabel}
              data-component="shared-select"
            >
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </div>

        {hasActionRow && (
        <div className="app-search-card mt-3 flex items-center gap-2 border-0 bg-transparent p-0 shadow-none">
          {showFilters && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="app-icon-button relative h-11 w-11 flex-shrink-0 border backdrop-blur-md hover:bg-[var(--app-surface)]"
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
                <div className="app-surface absolute left-0 top-full z-50 mt-2 max-h-80 w-64 overflow-y-auto backdrop-blur-xl bg-white/90 border border-white/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <div className="border-b border-[var(--app-border-subtle)] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--app-text-muted)]">{t('filters.title')}</span>
                      <button type="button" onClick={() => setShowFilterDropdown(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--app-surface-2)]" aria-label={t('common.close')}>
                        <X className="h-4 w-4 text-[var(--app-text-soft)]" />
                      </button>
                    </div>
                  </div>

                  <div className="p-1">
                    {/* Predefined status filters — only for task screens (not shop/labels) */}
                    {screen !== 'shop' && screen !== 'labels' && (
                    <>
                    <div className="flex flex-wrap gap-1 p-1.5">
                      {[
                        { id: 'todo', label: t('dashboard.todoSprint'), color: '#16a34a' },
                        { id: 'focus', label: t('tasks.focus'), color: '#f97316' },
                        { id: 'blocked', label: t('dashboard.blocked'), color: '#e11d48' },
                        { id: 'done', label: t('dashboard.doneSprint'), color: '#7c3aed' },
                      ].map((pf) => {
                        const active = activeChipFilters.some((f: any) => f.type === 'status' && f.id === pf.id);
                        return (
                          <button
                            key={pf.id}
                            type="button"
                            onClick={() => toggleChipFilter('status', pf.id, pf.label, pf.color)}
                            className={`inline-flex min-h-8 flex-shrink-0 items-center rounded-full border px-2.5 text-xs font-bold shadow-sm transition-all ${
                              active ? 'text-white' : 'border-[var(--app-border-subtle)] bg-white text-[var(--app-text-muted)]'
                            }`}
                            style={active ? { backgroundColor: pf.color } : undefined}
                          >
                            {pf.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Label filters (TasksView chip type: 'label') */}
                    {labels.length > 0 && (
                      <div className="border-t border-[var(--app-border-subtle)] p-1.5">
                        <div className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-soft)]">{t('tasks.labels')}</div>
                        <div className="flex flex-wrap gap-1">
                          {labels.map((label: any) => renderFilterChip('label', label.id, label.name, label.color))}
                        </div>
                      </div>
                    )}

                    {/* Assignee filters (TasksView chip type: 'assignee') */}
                    {users.length > 0 && (
                      <div className="border-t border-[var(--app-border-subtle)] p-1.5">
                        <div className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-soft)]">{t('tasks.assignee')}</div>
                        <div className="flex flex-wrap gap-1">
                          {users.map((user: any) => (
                            <div key={user?.id || 'user-empty'} className="contents">
                              {user?.id ? renderFilterChip('assignee', user.id, getCompactUserName(user), entityColor(user.id)) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Date-preset + repeat filters — hidden on screens where
                        items are not keyed by a single due-date/repeat field
                        (calendar): the presets would not match the model. */}
                    {!hideDateRepeatSections && (
                    <>
                    {/* Date-preset filters (TasksView chip type: 'date') */}
                    <div className="border-t border-[var(--app-border-subtle)] p-1.5">
                      <div className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-soft)]">{t('filters.dueDate')}</div>
                      <div className="flex flex-wrap gap-1">
                        {datePresetChips.map((preset) => renderFilterChip('date', preset.id, preset.label))}
                      </div>
                    </div>

                    {/* Repeat filters (TasksView chip type: 'repeat') */}
                    <div className="border-t border-[var(--app-border-subtle)] p-1.5">
                      <div className="px-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-soft)]">{t('repeat.repeat')}</div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: 'day', label: t('repeat.shortDay') },
                          { id: 'week', label: t('repeat.shortWeek') },
                          { id: 'month', label: t('repeat.shortMonth') },
                          { id: 'year', label: t('repeat.shortYear') },
                        ].map((rp) => renderFilterChip('repeat', rp.id, rp.label))}
                      </div>
                    </div>
                    </>
                    )}
                    </>
                    )}
                  </div>
                  <div className="flex gap-2 border-t border-[var(--app-border-subtle)] p-2">
                    <button type="button" onClick={clearChipFilters} className="min-h-9 flex-1 rounded-full border border-[var(--app-border-subtle)] text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]">
                      {t('common.clearAllTooltip')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showSearch && (
            <div className="flex min-h-12 flex-1 items-center gap-3 rounded-[var(--app-radius-pill)] bg-white/95 px-4 shadow-sm backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <Search className="h-[17px] w-[17px] flex-shrink-0" style={{ color: theme.color }} strokeWidth={2.2} />
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="min-h-11 min-w-0 flex-1 bg-transparent p-0 text-[16px] font-medium text-[var(--app-text)] placeholder:text-[var(--app-text-soft)] focus:outline-none"
              />
            </div>
          )}

          {showInputActions && onSubmitInput && (
            <button
              type="button"
              onClick={submitInput}
              className="app-icon-button h-11 w-11 flex-shrink-0 bg-white/85 shadow-none hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
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
              className="app-icon-button h-11 w-11 flex-shrink-0 bg-white/85 shadow-none hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)]/20"
              title={cancelAriaLabel}
              aria-label={cancelAriaLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {showAdd && <AddButton onClick={handleAdd} color={theme.color} />}
        </div>
        )}

        {/* Active filter chips — compact removable chips under the action row, above content */}
        {activeChipFilters.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1" data-testid="active-filter-chips">
            {activeChipFilters.map((filter) => {
              const chipColor = filter.color || theme.color;
              return (
                <span
                  key={`${filter.type}-${filter.id}`}
                  className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: chipColor }}
                >
                  <span className="truncate">{filter.label || filter.id}</span>
                  <button
                    type="button"
                    onClick={() => toggleChipFilter(filter.type, filter.id)}
                    className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full transition-colors hover:bg-white/25 active:scale-95"
                    aria-label={t('common.remove')}
                    title={t('common.remove')}
                  >
                    <X className="h-3 w-3" strokeWidth={3} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
