import { Lock, Users, Home, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { PageHeader } from './shared/PageHeader';
import { sortLabelsByVisibility } from '../lib/label-utils';

const VISIBILITY_ICON = {
  private: Lock,
  shared: Users,
  family: Home,
};

export function LabelsView() {
  const { labels } = useApp();
  const sortedLabels = sortLabelsByVisibility(labels);

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <PageHeader title={t('settings.labels')} subtitle={`${labels.length} labels`} />
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-4">
        {sortedLabels.length === 0 ? (
          <div className="app-surface py-14 text-center">
            <Tag className="mx-auto mb-3 h-10 w-10 text-violet-300" />
            <p className="text-sm font-semibold text-[var(--app-text-muted)]">{t('settings.noLabels')}</p>
          </div>
        ) : (
          sortedLabels.map((label) => {
            const visibility = label.visibility || (label.isPrivate ? 'private' : 'family');
            const Icon = VISIBILITY_ICON[visibility] || Home;
            return (
              <article key={label.id} className="app-card p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-3xl text-white shadow-lg" style={{ backgroundColor: label.color }}>
                    <Tag className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-extrabold text-[var(--app-text)]">{label.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="app-chip px-2.5 text-[11px] font-bold" style={{ backgroundColor: `${label.color}18`, color: label.color }}>
                        {label.color}
                      </span>
                      <span className="app-chip bg-violet-50 px-2.5 text-[11px] font-bold capitalize text-violet-700">
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
