import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Inbox, CheckSquare, ShoppingCart, CalendarDays,
  ChevronRight, TrendingUp, Clock, AlertTriangle, Star, FolderKanban,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompactTaskCard } from './shared/CompactTaskCard';

/**
 * MobileHome — phone-optimized home screen.
 * Shows quick stats, today's tasks, upcoming due dates, and quick navigation cards.
 * Designed as the default view on small screens (< 768px).
 */
export const MobileHome = () => {
  const { tasks, items, currentSprint } = useApp();
  const navigate = useNavigate();
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const tomorrowMs = todayMs + 86400000;
  const weekEndMs = todayMs + 7 * 86400000;

  // Today's tasks (due today or in sprint + todo)
  const todayTasks = useMemo(() => {
    return tasks
      .filter(t =>
        t.status !== 'done' &&
        !t.archived &&
        (
          (t.dueDate && t.dueDate >= todayMs && t.dueDate < tomorrowMs) ||
          (currentSprint && t.sprintId === currentSprint.id)
        )
      )
      .sort((a, b) => {
        // Urgent first, then by due date
        const prio = { urgent: 0, normal: 1, low: 2 };
        const aP = prio[a.priority || 'normal'] ?? 1;
        const bP = prio[b.priority || 'normal'] ?? 1;
        if (aP !== bP) return aP - bP;
        return (a.dueDate || Infinity) - (b.dueDate || Infinity);
      });
  }, [tasks, currentSprint, todayMs, tomorrowMs]);

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'done' && !t.archived && t.dueDate && t.dueDate < todayMs)
      .slice(0, 3);
  }, [tasks, todayMs]);

  // Upcoming this week
  const upcomingThisWeek = useMemo(() => {
    return tasks
      .filter(t =>
        t.status !== 'done' &&
        !t.archived &&
        t.dueDate &&
        t.dueDate >= tomorrowMs &&
        t.dueDate < weekEndMs
      )
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
      .slice(0, 5);
  }, [tasks, tomorrowMs, weekEndMs]);

  // Quick stats
  const openTasks = tasks.filter(t => t.status !== 'done' && !t.archived).length;
  const openItems = items.filter(i => !i.completed).length;
  const overdueCount = overdueTasks.length;

  // Quick nav cards
  const quickNav = [
    { to: '/', label: 'Inbox', icon: <Inbox className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600' },
    { to: '/tasks', label: 'Tasks', icon: <CheckSquare className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600' },
    { to: '/items', label: 'Items', icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-green-50 text-green-600' },
    { to: '/calendar', label: 'Calendar', icon: <CalendarDays className="w-5 h-5" />, color: 'bg-purple-50 text-purple-600' },
    { to: '/projects', label: 'Projects', icon: <FolderKanban className="w-5 h-5" />, color: 'bg-amber-50 text-amber-600' },
  ];

  const isChild = (useApp as any)?.()?.user?.role === 'child';

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-neutral-900 safe-top">
        <div className="px-4 py-4 mobile-content">
          <h1 className="text-xl font-bold text-white">
            {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {openTasks} open taken · {openItems} items
          </p>
        </div>
      </div>

      <div className="mobile-content pt-4 space-y-5">
        {/* Quick Nav Grid */}
        <div className="grid grid-cols-5 gap-2">
          {quickNav.map(nav => (
            <button
              key={nav.to}
              onClick={() => navigate(nav.to)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-neutral-100 active:scale-95 transition-transform"
            >
              <div className={`p-2 rounded-lg ${nav.color}`}>{nav.icon}</div>
              <span className="text-[11px] text-neutral-600 font-medium">{nav.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-neutral-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] text-neutral-500">Open</span>
            </div>
            <p className="text-xl font-bold">{openTasks}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingCart className="w-4 h-4 text-green-500" />
              <span className="text-[11px] text-neutral-500">Items</span>
            </div>
            <p className="text-xl font-bold">{openItems}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-[11px] text-neutral-500">Te laat</span>
            </div>
            <p className="text-xl font-bold text-red-600">{overdueCount}</p>
          </div>
        </div>

        {/* Overdue Section */}
        {overdueTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Te laat ({overdueTasks.length})
              </h2>
              <button
                onClick={() => navigate('/tasks')}
                className="text-xs text-neutral-500 flex items-center gap-0.5"
              >
                Bekijk <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {overdueTasks.map(task => (
                <CompactTaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Today's Tasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-500" /> Vandaag ({todayTasks.length})
            </h2>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-neutral-500 flex items-center gap-0.5"
            >
              Bekijk <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {todayTasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-100 p-6 text-center">
              <p className="text-sm text-neutral-400">Geen taken voor vandaag</p>
              <button
                onClick={() => navigate('/')}
                className="mt-2 text-xs text-blue-600 font-medium"
              >
                + Taak toevoegen
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.slice(0, 5).map(task => (
                <CompactTaskCard key={task.id} task={task} />
              ))}
              {todayTasks.length > 5 && (
                <button
                  onClick={() => navigate('/tasks')}
                  className="w-full py-2 text-xs text-neutral-500 text-center"
                >
                  + {todayTasks.length - 5} meer taken
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming This Week */}
        {upcomingThisWeek.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-purple-500" /> Deze week
              </h2>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs text-neutral-500 flex items-center gap-0.5"
              >
                Kalender <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-neutral-100 divide-y divide-neutral-50">
              {upcomingThisWeek.map(task => (
                <button
                  key={task.id}
                  onClick={() => navigate('/tasks')}
                  className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-neutral-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {task.priority === 'urgent' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    <span className="text-sm truncate">{task.title}</span>
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0 ml-2">
                    {new Date(task.dueDate!).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rewards for child users */}
        {isChild && (
          <button
            onClick={() => navigate('/rewards')}
            className="w-full bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <Star className="w-6 h-6 text-amber-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-amber-800">Beloningen</p>
              <p className="text-xs text-amber-600">Bekijk je voortgang en beloningen</p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400 ml-auto" />
          </button>
        )}

        {/* Spacer for bottom nav */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default MobileHome;
