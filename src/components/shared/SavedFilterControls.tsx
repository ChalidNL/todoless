import { ChevronRight, Save, Trash2 } from 'lucide-react';
import { t } from '../../i18n/translations';
import type { Filter } from '../../types';

interface SavedFilterControlsProps {
  filters: Filter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filter: Filter) => void;
  onDelete: (filter: Filter) => void;
  onSave: () => void;
}

export function SavedFilterControls({
  filters,
  open,
  onOpenChange,
  onApply,
  onDelete,
  onSave,
}: SavedFilterControlsProps) {
  return (
    <div className="relative flex flex-shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="app-chip inline-flex min-h-[var(--app-touch-target)] items-center gap-1.5 bg-white px-3 text-xs font-black text-[var(--app-text-muted)] shadow-sm"
        aria-label={t('filters.savedFilters')}
        aria-expanded={open}
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        {t('filters.savedFilters')}
      </button>
      <button
        type="button"
        onClick={onSave}
        className="grid min-h-[var(--app-touch-target)] min-w-[var(--app-touch-target)] place-items-center rounded-full bg-white text-[var(--app-primary)] shadow-sm"
        aria-label={`${t('common.save')} ${t('common.filter').toLowerCase()}`}
      >
        <Save className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-56 overflow-hidden rounded-[var(--app-radius-card)] border border-[var(--app-border-subtle)] bg-white p-1.5 shadow-[var(--app-shadow-card)]">
          {filters.length === 0 ? (
            <p className="px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
              {t('settings.noSavedFilters')}
            </p>
          ) : (
            filters.map((filter) => (
              <div key={filter.id} className="flex min-h-11 items-center gap-1 rounded-[var(--app-radius-md)] px-1 hover:bg-[var(--app-surface-2)]">
                <button
                  type="button"
                  onClick={() => onApply(filter)}
                  className="min-h-11 min-w-0 flex-1 truncate px-2 text-left text-sm font-bold text-[var(--app-text)]"
                >
                  {filter.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(filter)}
                  className="grid h-11 w-11 place-items-center rounded-full text-rose-600"
                  aria-label={`${t('common.delete')} ${filter.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
