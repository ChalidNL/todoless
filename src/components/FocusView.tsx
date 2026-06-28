import type React from 'react';
import { Target, Clock, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t, formatDate } from '../i18n/translations';
import { PageHeader } from './shared/PageHeader';
import { CompactTaskCard } from './shared/CompactTaskCard';

export function FocusView() {
  const { tasks } = useApp();
  const active = tasks.filter((task) => task.status !== 'done');
  const focusTasks = active.filter((task) => task.focus || task.priority === 'high' || task.blocked);
  const overdue = focusTasks.filter((task) => task.dueDate && task.dueDate < Date.now()).length;

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <PageHeader title={t('tasks.focus')} subtitle={`${focusTasks.length} focus`} />
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <FocusStat icon={<Target className="h-4 w-4" />} label={t('tasks.focus')} value={focusTasks.length} tone="violet" />
          <FocusStat icon={<Clock className="h-4 w-4" />} label={t('common.dueSoon')} value={focusTasks.filter((task) => task.dueDate).length} tone="blue" />
          <FocusStat icon={<AlertTriangle className="h-4 w-4" />} label={t('dashboard.blocked')} value={overdue} tone="rose" />
        </div>

        {focusTasks.length === 0 ? (
          <div className="app-surface py-14 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-violet-300" />
            <p className="text-sm font-semibold text-[var(--app-text-muted)]">Geen focus-taken</p>
          </div>
        ) : (
          <div className="space-y-2">
            {focusTasks.map((task) => (
              <div key={task.id}>
                {task.dueDate && <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">{formatDate(task.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                <CompactTaskCard task={task} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FocusStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'violet' | 'blue' | 'rose' }) {
  const toneClass = tone === 'violet' ? 'from-violet-500 to-indigo-500' : tone === 'blue' ? 'from-sky-500 to-blue-600' : 'from-rose-500 to-pink-600';
  return (
    <div className={`rounded-[22px] bg-gradient-to-br ${toneClass} p-3 text-white shadow-[0_14px_34px_rgba(88,69,255,.16)]`}>
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/20">{icon}</div>
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="mt-1 truncate text-[11px] font-bold text-white/80">{label}</div>
    </div>
  );
}
