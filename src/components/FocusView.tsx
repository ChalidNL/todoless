import type React from 'react';
import { AlertTriangle, Clock, Play, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t, formatDate } from '../i18n/translations';
import { PageHeader } from './shared/PageHeader';
import { TaskCard } from './shared/TaskCard';
import { EmptyState } from './shared/EmptyState';
import { Button } from './ui/Button';

export function FocusView() {
  const { tasks, showCompletionMessage } = useApp();
  const active = tasks.filter((task) => task.status !== 'done');
  const focusTasks = active.filter((task) => task.focus || task.priority === 'high' || task.blocked);
  const overdue = focusTasks.filter((task) => task.dueDate && task.dueDate < Date.now()).length;

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <PageHeader title={t('tasks.focus')} subtitle={`${focusTasks.length} focus`} />
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        <FocusCard
          total={focusTasks.length}
          due={focusTasks.filter((task) => task.dueDate).length}
          blocked={overdue}
          onStart={() => showCompletionMessage(t('tasks.focus'))}
        />

        {focusTasks.length === 0 ? (
          <EmptyState title="Geen focus-taken" icon={<Target className="h-7 w-7" />} />
        ) : (
          <div className="space-y-2">
            {focusTasks.map((task) => (
              <div key={task.id}>
                {task.dueDate && <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">{formatDate(task.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                <TaskCard task={task} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FocusCard({ total, due, blocked, onStart }: { total: number; due: number; blocked: number; onStart: () => void }) {
  return (
    <section className="app-rainbow-animated relative isolate overflow-hidden rounded-[32px] bg-[var(--app-rainbow-grad)] p-5 text-white shadow-[var(--app-glow-focus)]">
      <div className="absolute inset-0 bg-black/5" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
            <Target className="h-6 w-6" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-white/75">Focus</p>
          <h2 className="mt-1 text-[34px] font-black leading-none tracking-[-0.06em]">{total}</h2>
          <p className="mt-2 max-w-[220px] text-sm font-semibold text-white/85">Ademruimte voor de belangrijkste taken van vandaag.</p>
        </div>
        <div className="min-w-[128px]">
          <Button label="Focus starten" icon={Play} onClick={onStart} fullWidth={false} className="bg-white text-[var(--app-primary)] shadow-[0_0_36px_rgba(255,255,255,.7)]" />
        </div>
      </div>
      <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
        <FocusStat icon={<Target className="h-4 w-4" />} label={t('tasks.focus')} value={total} />
        <FocusStat icon={<Clock className="h-4 w-4" />} label={t('common.dueSoon')} value={due} />
        <FocusStat icon={<AlertTriangle className="h-4 w-4" />} label={t('dashboard.blocked')} value={blocked} />
      </div>
    </section>
  );
}

function FocusStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[20px] bg-white/16 p-3 ring-1 ring-white/20 backdrop-blur-sm">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/20">{icon}</div>
      <div className="text-2xl font-black leading-none">{value}</div>
      <div className="mt-1 truncate text-[11px] font-bold text-white/80">{label}</div>
    </div>
  );
}
