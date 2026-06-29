import { Lock, Users, Home, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { AppHeader } from './shared/NewGlobalHeader';
import { sortLabelsByVisibility } from '../lib/label-utils';
import { EmptyState } from './shared/EmptyState';

const VISIBILITY_ICON = {
  private: Lock,
  shared: Users,
  family: Home,
};

export function LabelsView() {
  const { labels, addLabel } = useApp();
  const sortedLabels = sortLabelsByVisibility(labels);

  const handleCreateLabel = () => {
    const name = window.prompt(t('settings.labelNamePlaceholder'), '');
    const trimmed = name?.trim();
    if (!trimmed) return;
    addLabel({ name: trimmed, color: '#eab308', visibility: 'family', isPrivate: false, sharedWith: [] });
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <AppHeader
        screen="labels"
        searchPlaceholder="Zoek labels..."
        showSearch={false}
        showFilters={false}
        onAddEmpty={handleCreateLabel}
        count={labels.length}
      />
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-4">
        {sortedLabels.length === 0 ? (
          <EmptyState
            title={t('settings.noLabels')}
            description={t('settings.noLabelsHint')}
            icon={<Tag className="h-7 w-7" />}
          />
        ) : (
          sortedLabels.map((label) => {
            const visibility = label.visibility || (label.isPrivate ? 'private' : 'family');
            const Icon = VISIBILITY_ICON[visibility] || Home;
            return (
              <article key={label.id} className="app-card app-animate-in p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-3xl text-white shadow-lg ring-4 ring-white" style={{ backgroundColor: label.color }}>
                    <Tag className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-extrabold text-[var(--app-text)]">{label.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="app-chip inline-flex min-h-7 items-center px-2.5 text-[11px] font-black" style={{ backgroundColor: `${label.color}18`, color: label.color }}>
                        {label.color}
                      </span>
                      <span className="app-chip inline-flex min-h-7 items-center gap-1 bg-violet-50 px-2.5 text-[11px] font-black capitalize text-violet-700">
                        <Icon className="h-3 w-3" />
                        {visibility}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
