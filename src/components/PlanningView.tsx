import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { TopBar } from './shared/TopBar';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { LabelBadge } from './shared/LabelBadge';
import {
  Bell,
  BellOff,
  Flag,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Repeat,
  Lock,
  Unlock,
  User,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Reminder } from '../types';
import { getUpcomingReminders, getRemindersInRange } from '../utils/reminderUtils';

type FilterType = 'all' | 'upcoming' | 'flagged' | 'dismissed';
type SortType = 'date' | 'priority' | 'name';

export const PlanningView = () => {
  const {
    reminders,
    tasks,
    labels,
    users,
    addReminder,
    updateReminder,
    dismissReminder,
    deleteReminder,
    refreshReminders,
  } = useApp();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('upcoming');
  const [sort, setSort] = useState<SortType>('date');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['today', 'tomorrow', 'week']));

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [newRecurring, setNewRecurring] = useState<'week' | 'month' | 'year' | ''>('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const [newFlagged, setNewFlagged] = useState(false);
  const [newPrivate, setNewPrivate] = useState(false);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const filteredReminders = useMemo(() => {
    let result = [...reminders];

    switch (filter) {
      case 'upcoming':
        result = getUpcomingReminders(reminders, 7);
        break;
      case 'flagged':
        result = reminders.filter((r) => r.flagged && !r.dismissed);
        break;
      case 'dismissed':
        result = reminders.filter((r) => r.dismissed);
        break;
    }

    switch (sort) {
      case 'priority':
        result.sort((a, b) => {
          if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
          return a.dueDate - b.dueDate;
        });
        break;
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        result.sort((a, b) => a.dueDate - b.dueDate);
    }

    return result;
  }, [reminders, filter, sort]);

  const groupedReminders = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
    const monthEnd = now + 30 * 24 * 60 * 60 * 1000;

    const groups: Record<string, Reminder[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      week: [],
      month: [],
      later: [],
      dismissed: [],
    };

    filteredReminders.forEach((r) => {
      if (r.dismissed) {
        groups.dismissed.push(r);
      } else if (r.dueDate < todayStart) {
        groups.overdue.push(r);
      } else if (r.dueDate < tomorrowStart) {
        groups.today.push(r);
      } else if (r.dueDate < todayStart + 2 * 24 * 60 * 60 * 1000) {
        groups.tomorrow.push(r);
      } else if (r.dueDate < weekEnd) {
        groups.week.push(r);
      } else if (r.dueDate < monthEnd) {
        groups.month.push(r);
      } else {
        groups.later.push(r);
      }
    });

    return groups;
  }, [filteredReminders]);

  const handleCreateReminder = () => {
    if (!newTitle || !newDueDate) return;

    const date = new Date(newDueDate);
    if (newDueTime) {
      const [h, m] = newDueTime.split(':');
      date.setHours(parseInt(h), parseInt(m));
    }

    addReminder({
      title: newTitle,
      dueDate: date.getTime(),
      recurring: newRecurring || undefined,
      assignee: newAssignee || undefined,
      labels: newLabels,
      flagged: newFlagged,
      isPrivate: newPrivate,
      source: 'manual',
    });

    setNewTitle('');
    setNewDueDate('');
    setNewDueTime('');
    setNewRecurring('');
    setNewAssignee('');
    setNewLabels([]);
    setNewFlagged(false);
    setNewPrivate(false);
    setShowCreateModal(false);
  };

  const toggleLabel = (labelId: string) => {
    setNewLabels((prev) =>
      prev.includes(labelId) ? prev.filter((l) => l !== labelId) : [...prev, labelId],
    );
  };

  const formatReminderDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow =
      d.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

    if (isToday) return `Today at ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    if (isTomorrow) return `Tomorrow at ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) +
      ` ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const groupLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    overdue: { label: 'Overdue', icon: <Bell className="w-4 h-4 text-red-500" />, color: 'border-red-300 bg-red-50' },
    today: { label: 'Today', icon: <Bell className="w-4 h-4 text-amber-500" />, color: 'border-amber-300 bg-amber-50' },
    tomorrow: { label: 'Tomorrow', icon: <CalendarIcon className="w-4 h-4 text-blue-500" />, color: 'border-blue-300 bg-blue-50' },
    week: { label: 'This Week', icon: <CalendarIcon className="w-4 h-4 text-indigo-500" />, color: 'border-indigo-300 bg-indigo-50' },
    month: { label: 'This Month', icon: <CalendarIcon className="w-4 h-4 text-purple-500" />, color: 'border-purple-300 bg-purple-50' },
    later: { label: 'Later', icon: <CalendarIcon className="w-4 h-4 text-neutral-400" />, color: 'border-neutral-200 bg-neutral-50' },
    dismissed: { label: 'Dismissed', icon: <BellOff className="w-4 h-4 text-neutral-400" />, color: 'border-neutral-200 bg-neutral-50' },
  };

  const renderReminderCard = (reminder: Reminder) => {
    const label = labels.find((l) => l.id === reminder.labels[0]);
    const assignee = users.find((u) => u.id === reminder.assignee);
    const sourceTask = tasks.find((t) => t.id === reminder.linkedTo);

    return (
      <div
        key={reminder.id}
        className={`flex items-start gap-3 p-3 rounded-lg border ${
          reminder.dismissed ? 'opacity-60 bg-neutral-50' : 'bg-white hover:bg-neutral-50'
        } ${reminder.flagged ? 'border-l-4 border-l-amber-400' : 'border-neutral-200'}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {reminder.flagged && <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            {reminder.isPrivate && <Lock className="w-3 h-3 text-neutral-400 shrink-0" />}
            <span className={`text-sm font-medium truncate ${reminder.dismissed ? 'line-through text-neutral-400' : ''}`}>
              {reminder.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-500">
            <span>{formatReminderDate(reminder.dueDate)}</span>
            {reminder.recurring && (
              <span className="flex items-center gap-0.5">
                <Repeat className="w-3 h-3" /> {reminder.recurring}
              </span>
            )}
            {assignee && (
              <span className="flex items-center gap-0.5">
                <User className="w-3 h-3" /> {assignee.name}
              </span>
            )}
            {sourceTask && (
              <span className="text-neutral-400">from: {sourceTask.title}</span>
            )}
          </div>

          {reminder.labels.length > 0 && (
            <div className="flex gap-1 mt-1">
              {reminder.labels.map((lid) => {
                const l = labels.find((lb) => lb.id === lid);
                return l ? <LabelBadge key={lid} label={l} /> : null;
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!reminder.dismissed ? (
            <>
              <button
                onClick={() => dismissReminder(reminder.id)}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
                title="Dismiss"
              >
                <BellOff className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  updateReminder(reminder.id, { flagged: !reminder.flagged });
                }}
                className={`p-1.5 rounded hover:bg-neutral-100 ${reminder.flagged ? 'text-amber-500' : 'text-neutral-400'}`}
                title="Toggle flag"
              >
                <Flag className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  updateReminder(reminder.id, { isPrivate: !reminder.isPrivate });
                }}
                className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400"
                title="Toggle private"
              >
                {reminder.isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            </>
          ) : null}
          <button
            onClick={() => deleteReminder(reminder.id)}
            className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderGroup = (key: string, items: Reminder[]) => {
    if (items.length === 0) return null;
    const groupInfo = groupLabels[key];
    const isExpanded = expandedGroups.has(key);

    return (
      <div key={key} className="mb-4">
        <button
          onClick={() => toggleGroup(key)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border ${groupInfo.color} mb-2`}
        >
          <div className="flex items-center gap-2">
            {groupInfo.icon}
            <span className="text-sm font-semibold">{groupInfo.label}</span>
            <span className="text-xs text-neutral-500">({items.length})</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {isExpanded && (
          <div className="space-y-2 ml-2">
            {items.map(renderReminderCard)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <TopBar />

      <NewGlobalHeader
        onSearch={() => {}}
        onAdd={() => setShowCreateModal(true)}
        searchPlaceholder="Search reminders..."
        type="reminder"
      />

      {/* Filter & Sort bar */}
      <div className="bg-white border-b border-neutral-200 sticky top-[105px] z-20">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['upcoming', 'all', 'flagged', 'dismissed'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-sm capitalize transition-colors ${
                  filter === f
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="text-sm border border-neutral-200 rounded px-2 py-1.5 bg-white"
          >
            <option value="date">Sort by date</option>
            <option value="priority">Sort by priority</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
      </div>

      {/* Reminder groups */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {Object.entries(groupedReminders).map(([key, items]) => renderGroup(key, items))}

        {filteredReminders.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p className="text-lg font-medium">No reminders</p>
            <p className="text-sm mt-1">Create a reminder or tasks with due dates will auto-generate one</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Reminder</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-neutral-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What to remember..."
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Recurring</label>
                <select
                  value={newRecurring}
                  onChange={(e) => setNewRecurring(e.target.value as typeof newRecurring)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                >
                  <option value="">None</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </div>

              {users.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Assignee</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {labels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Labels</label>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => toggleLabel(l.id)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          newLabels.includes(l.id)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newFlagged}
                    onChange={(e) => setNewFlagged(e.target.checked)}
                    className="rounded border-neutral-300 text-amber-500 focus:ring-amber-500"
                  />
                  <Flag className="w-4 h-4 text-amber-500" />
                  Flagged
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newPrivate}
                    onChange={(e) => setNewPrivate(e.target.checked)}
                    className="rounded border-neutral-300 focus:ring-blue-500"
                  />
                  <Lock className="w-4 h-4" />
                  Private
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReminder}
                  disabled={!newTitle || !newDueDate}
                  className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
