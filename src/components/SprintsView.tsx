import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../i18n/translations';
import { BurndownChart } from './BurndownChart';
import {
  Plus,
  Trash2,
  ChevronRight,
  Play,
  CheckCircle2,
  Calendar,
  Target,
  TrendingUp,
  Clock,
  Zap,
} from 'lucide-react';
import type { Sprint, SprintStatus, Task } from '../types';

export function SprintsView() {
  const { sprints, tasks, addSprint, updateSprint, deleteSprint, startSprint, completeSprint, appSettings } = useApp();
  const { language } = useLanguage();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState(appSettings.sprintDuration || '2weeks');
  const [newGoal, setNewGoal] = useState('');

  const sprintTasks = useMemo(() => {
    const map = new Map<string, Task[]>();
    sprints.forEach((s) => {
      const sprintTasks = tasks.filter((task) => task.sprintId === s.id);
      map.set(s.id, sprintTasks);
    });
    return map;
  }, [sprints, tasks]);

  const getSprintProgress = (sprint: Sprint): { done: number; total: number; percent: number } => {
    const sts = sprintTasks.get(sprint.id) || [];
    const done = sts.filter((t) => t.status === 'done').length;
    const total = sts.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, percent };
  };

  const statusLabels: Record<SprintStatus, string> = {
    planned: 'Gepland',
    active: 'Actief',
    completed: 'Voltooid',
  };

  const statusColors: Record<SprintStatus, string> = {
    planned: 'bg-neutral-100 text-neutral-600',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  const durationLabels: Record<string, string> = {
    '1week': '1 week',
    '2weeks': '2 weken',
    '3weeks': '3 weken',
    '1month': '1 maand',
  };

  const getDurationDays = (duration: string): number => {
    if (duration === '1week') return 7;
    if (duration === '3weeks') return 21;
    if (duration === '1month') return 30;
    return 14;
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const now = new Date();
    const durationDays = getDurationDays(newDuration);

    // Start from today (or next configured start day)
    const startDay = appSettings.sprintStartDay ?? 1;
    const currentDay = now.getDay();
    let daysUntilStart = startDay - currentDay;
    if (daysUntilStart < 0) daysUntilStart += 7;
    if (daysUntilStart === 0) daysUntilStart = 0; // Start today if it's the start day

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + daysUntilStart);
    startDate.setHours(0, 0, 0, 0);

    // Auto-increment sprint number
    const sprintNum = sprints.length + 1;

    addSprint({
      name: newName.trim() || `Sprint ${sprintNum}`,
      startDate: startDate.getTime(),
      endDate: startDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
      duration: newDuration as any,
      weekNumber: Math.ceil((startDate.getDate()) / 7),
      year: startDate.getFullYear(),
      status: 'planned',
      goal: newGoal ? parseInt(newGoal, 10) : undefined,
    });

    setNewName('');
    setNewDuration(appSettings.sprintDuration || '2weeks');
    setNewGoal('');
    setShowCreateForm(false);
  };

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  // Detail view
  if (selectedSprint) {
    const sts = sprintTasks.get(selectedSprint.id) || [];
    const progress = getSprintProgress(selectedSprint);
    const backlogTasks = sts.filter((t) => t.status === 'backlog');
    const todoTasks = sts.filter((t) => t.status === 'todo');
    const doneTasks = sts.filter((t) => t.status === 'done');

    const startDateStr = new Date(selectedSprint.startDate).toLocaleDateString(
      language === 'nl' ? 'nl-NL' : 'en-US',
      { day: 'numeric', month: 'short' },
    );
    const endDateStr = new Date(selectedSprint.endDate).toLocaleDateString(
      language === 'nl' ? 'nl-NL' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );

    const daysLeft = Math.max(0, Math.ceil((selectedSprint.endDate - Date.now()) / (1000 * 60 * 60 * 24)));
    const isExpired = selectedSprint.status === 'active' && daysLeft === 0;

    return (
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <button
          onClick={() => setSelectedSprintId(null)}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-700 mb-4"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Terug naar overzicht
        </button>

        {/* Sprint Header */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedSprint.status === 'active' ? 'bg-green-100' :
                selectedSprint.status === 'completed' ? 'bg-blue-100' : 'bg-neutral-100'
              }`}>
                {selectedSprint.status === 'active' ? <Zap className="w-5 h-5 text-green-600" /> :
                 selectedSprint.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-blue-600" /> :
                 <Clock className="w-5 h-5 text-neutral-500" />}
              </div>
              <div>
                <h1 className="text-xl font-semibold">{selectedSprint.name}</h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {startDateStr} - {endDateStr}
                </p>
              </div>
            </div>
            <button
              onClick={() => deleteSprint(selectedSprint.id)}
              className="p-2 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50"
              title="Verwijderen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex gap-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[selectedSprint.status]}`}>
              {statusLabels[selectedSprint.status]}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
              {durationLabels[selectedSprint.duration]}
            </span>
            {selectedSprint.goal && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Target className="w-3 h-3" /> Doel: {selectedSprint.goal} taken
              </span>
            )}
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-neutral-600">Voortgang</span>
              <span className="font-medium">{progress.percent}%</span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${progress.percent}%`,
                  backgroundColor: selectedSprint.status === 'completed' ? '#3b82f6' : '#22c55e',
                }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {progress.done} / {progress.total} taken voltooid
              {selectedSprint.goal && progress.done >= selectedSprint.goal && (
                <span className="text-green-600 font-medium ml-2">Doel behaald!</span>
              )}
            </p>
          </div>

          {/* Days remaining */}
          {selectedSprint.status === 'active' && (
            <div className="flex items-center gap-2 text-sm text-neutral-600 mb-4">
              <TrendingUp className="w-4 h-4" />
              <span>{daysLeft} {daysLeft === 1 ? 'dag' : 'dagen'} resterend{isExpired ? ' (verlopen)' : ''}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {selectedSprint.status === 'planned' && (
              <button
                onClick={() => startSprint(selectedSprint.id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                <Play className="w-4 h-4" /> Start sprint
              </button>
            )}
            {selectedSprint.status === 'active' && (
              <button
                onClick={() => completeSprint(selectedSprint.id)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <CheckCircle2 className="w-4 h-4" /> Voltooi sprint
              </button>
            )}
            {selectedSprint.status === 'planned' && (
              <button
                onClick={() => {
                  updateSprint(selectedSprint.id, { name: `Sprint ${sprints.indexOf(selectedSprint) + 1}` });
                }}
                className="px-4 py-2 border border-neutral-200 rounded-lg text-sm hover:bg-neutral-50"
              >
                Hernoemen
              </button>
            )}
          </div>
        </div>

        {/* Task columns */}
        {/* Burndown chart */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 mb-6">
          <BurndownChart sprint={selectedSprint} tasks={sts} />
        </div>

        <div className="space-y-6">
          {/* Backlog */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Backlog ({backlogTasks.length})
            </h2>
            {backlogTasks.length === 0 ? (
              <p className="text-sm text-neutral-400 py-2">Geen taken in backlog</p>
            ) : (
              <div className="space-y-2">
                {backlogTasks.map((task) => (
                  <SprintTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>

          {/* To Do */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" /> Te doen ({todoTasks.length})
            </h2>
            {todoTasks.length === 0 ? (
              <p className="text-sm text-neutral-400 py-2">Geen taken om te doen</p>
            ) : (
              <div className="space-y-2">
                {todoTasks.map((task) => (
                  <SprintTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>

          {/* Done */}
          {doneTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Voltooid ({doneTasks.length})
              </h2>
              <div className="space-y-2">
                {doneTasks.map((task) => (
                  <SprintTaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {sts.length === 0 && (
            <div className="text-center py-8 text-neutral-400">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Geen taken in deze sprint</p>
              <p className="text-xs mt-1">Voeg taken toe via de takenlijst</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Sprints</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white rounded-lg text-sm hover:bg-neutral-800"
        >
          <Plus className="w-4 h-4" /> Nieuwe sprint
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 mb-6">
          <h2 className="font-medium mb-3">Nieuwe sprint aanmaken</h2>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sprint naam (optioneel)"
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="mb-2">
            <label className="text-xs text-neutral-500 mb-1 block">Duur</label>
            <select
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
              <option value="1week">1 week</option>
              <option value="2weeks">2 weken</option>
              <option value="3weeks">3 weken</option>
              <option value="1month">1 maand</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="text-xs text-neutral-500 mb-1 block">Doel (aantal taken, optioneel)</label>
            <input
              type="number"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="bijv. 10"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              min="0"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() && sprints.length === 0}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aanmaken
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewName('');
                setNewGoal('');
              }}
              className="px-4 py-2 border border-neutral-200 rounded-lg text-sm hover:bg-neutral-50"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Active sprint banner */}
      {sprints.find((s) => s.status === 'active') && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Actieve sprint</span>
          </div>
          {(() => {
            const active = sprints.find((s) => s.status === 'active')!;
            const progress = getSprintProgress(active);
            return (
              <button
                onClick={() => setSelectedSprintId(active.id)}
                className="w-full text-left"
              >
                <p className="text-green-700 font-medium">{active.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 bg-green-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-green-600 transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-green-600">{progress.percent}%</span>
                </div>
              </button>
            );
          })()}
        </div>
      )}

      {/* Sprint list */}
      {sprints.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Calendar className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Geen sprints</p>
          <p className="text-sm mt-1">Maak je eerste sprint aan om te beginnen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const progress = getSprintProgress(sprint);
            return (
              <button
                key={sprint.id}
                onClick={() => setSelectedSprintId(sprint.id)}
                className="w-full bg-white rounded-xl shadow-sm border border-neutral-200 p-4 text-left hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    sprint.status === 'active' ? 'bg-green-100' :
                    sprint.status === 'completed' ? 'bg-blue-100' : 'bg-neutral-100'
                  }`}>
                    {sprint.status === 'active' ? <Zap className="w-5 h-5 text-green-600" /> :
                     sprint.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-blue-600" /> :
                     <Clock className="w-5 h-5 text-neutral-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{sprint.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[sprint.status]}`}>
                        {statusLabels[sprint.status]}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 truncate mt-0.5">
                      {new Date(sprint.startDate).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })} - {new Date(sprint.endDate).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 bg-neutral-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${progress.percent}%`,
                            backgroundColor: sprint.status === 'completed' ? '#3b82f6' : '#22c55e',
                          }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500 shrink-0">{progress.percent}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                      <span>{progress.total} taken</span>
                      {sprint.goal && (
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" /> Doel: {sprint.goal}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-300 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Simple task card for sprint detail view
function SprintTaskCard({ task }: { task: Task }) {
  const { updateTask } = useApp();

  const statusIcon = task.status === 'done'
    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
    : <div className="w-5 h-5 rounded-full border-2 border-neutral-300 shrink-0" />;

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-3 flex items-center gap-3">
      <button
        onClick={() => {
          const newStatus = task.status === 'done' ? 'todo' : 'done';
          updateTask(task.id, { status: newStatus });
        }}
      >
        {statusIcon}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === 'done' ? 'line-through text-neutral-400' : ''}`}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className="text-xs text-neutral-400 mt-0.5">
            {new Date(task.dueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${
          task.status === 'done'
            ? 'bg-green-100 text-green-700'
            : task.status === 'todo'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-neutral-100 text-neutral-600'
        }`}
      >
        {task.status === 'done' ? 'Voltooid' : task.status === 'todo' ? 'Te doen' : 'Backlog'}
      </span>
    </div>
  );
}
