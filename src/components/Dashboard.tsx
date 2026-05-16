import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, CheckCircle, ShoppingCart, AlertTriangle, Users, TrendingDown, Calendar, Target } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

/**
 * Generate burndown chart data for a sprint.
 * Returns array of daily data points with actual remaining, ideal remaining,
 * and cumulative completed counts.
 */
export interface BurndownPoint {
  date: string;
  dateLabel: string;
  remaining: number;
  ideal: number;
  completed: number;
}

export interface SprintStats {
  totalTasks: number;
  completedTasks: number;
  completionPct: number;
  daysRemaining: number;
  totalDays: number;
  velocity: number; // tasks/day
  isSprintActive: boolean;
  isSprintOver: boolean;
}

export function generateBurndownData(
  sprintTasks: Array<{ completedAt?: number }>,
  sprintStart: number,
  sprintEnd: number,
  now: number,
): BurndownPoint[] {
  const total = sprintTasks.length;
  if (total === 0) return [];

  // Pre-compute completion counts per day (O(n) instead of O(n*m))
  const completionsByDay = new Map<number, number>();
  sprintTasks.forEach(t => {
    if (t.completedAt) {
      const dayStart = Math.floor(t.completedAt / 86400000) * 86400000;
      completionsByDay.set(dayStart, (completionsByDay.get(dayStart) || 0) + 1);
    }
  });

  const points: BurndownPoint[] = [];
  const end = Math.min(sprintEnd, now);
  let cumulativeDone = 0;

  for (let d = sprintStart; d <= end; d += 86400000) {
    const dayStart = Math.floor(d / 86400000) * 86400000;
    cumulativeDone += completionsByDay.get(dayStart) || 0;
    const remaining = total - cumulativeDone;

    // Ideal: linear burn from total at start to 0 at end
    const progress = (d - sprintStart) / (sprintEnd - sprintStart);
    const ideal = Math.max(0, total - Math.round(total * progress));

    points.push({
      date: new Date(d).toISOString().split('T')[0],
      dateLabel: new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      remaining,
      ideal,
      completed: cumulativeDone,
    });
  }

  return points;
}

export function computeSprintStats(
  tasks: Array<{ sprintId?: string; status: string; completedAt?: number; archived?: boolean }>,
  sprintId: string,
  sprintStart: number,
  sprintEnd: number,
  now: number,
): SprintStats {
  const sprintTasks = tasks.filter(t => t.sprintId === sprintId && !t.archived);
  const total = sprintTasks.length;
  const completed = sprintTasks.filter(t => t.status === 'done').length;
  const totalDays = Math.ceil((sprintEnd - sprintStart) / 86400000);
  const daysElapsed = Math.max(0, Math.ceil((Math.min(now, sprintEnd) - sprintStart) / 86400000));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const velocity = daysElapsed > 0 ? completed / daysElapsed : 0;

  return {
    totalTasks: total,
    completedTasks: completed,
    completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    daysRemaining,
    totalDays,
    velocity: Math.round(velocity * 10) / 10,
    isSprintActive: now >= sprintStart && now < sprintEnd,
    isSprintOver: now >= sprintEnd,
  };
}

export const Dashboard = () => {
  const { tasks, items, users, sprints, currentSprint } = useApp();

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const openTasks = tasks.filter(t => t.status !== 'done' && !t.archived).length;
  const openItems = items.filter(i => !i.completed).length;
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'done').length;
  const completedThisWeek = tasks.filter(t => t.completedAt && t.completedAt > weekAgo).length;

  // Completions per user this week
  const completionsPerUser = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.completedAt && t.completedAt > weekAgo && t.assignedTo) {
        map[t.assignedTo] = (map[t.assignedTo] || 0) + 1;
      }
    });
    return users.map(u => ({
      name: u.name || u.email,
      completed: map[u.id] || 0,
    }));
  }, [tasks, users]);

  // Sprint burndown with ideal line
  const burndownData = useMemo(() => {
    if (!currentSprint) return [];
    const sprintTasks = tasks.filter(t => t.sprintId === currentSprint.id);
    return generateBurndownData(sprintTasks, currentSprint.startDate, currentSprint.endDate, now);
  }, [tasks, currentSprint, now]);

  // Sprint progress stats
  const sprintStats = useMemo((): SprintStats | null => {
    if (!currentSprint) return null;
    return computeSprintStats(
      tasks,
      currentSprint.id,
      currentSprint.startDate,
      currentSprint.endDate,
      now,
    );
  }, [tasks, currentSprint, now]);

  // Upcoming due dates
  const upcoming = tasks
    .filter(t => t.dueDate && t.dueDate > now && t.status !== 'done')
    .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0))
    .slice(0, 5);

  return (
    <div className="max-w-lg mx-auto pb-24 px-4">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6" />
          Dashboard
        </h1>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Open Tasks', value: openTasks, icon: <CheckCircle className="w-5 h-5 text-blue-500" /> },
          { label: 'Grocery Items', value: openItems, icon: <ShoppingCart className="w-5 h-5 text-green-500" /> },
          { label: 'Overdue', value: overdue, icon: <AlertTriangle className="w-5 h-5 text-red-500" /> },
          { label: 'Done This Week', value: completedThisWeek, icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xs text-neutral-500">{stat.label}</span></div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Sprint Burndown */}
      {currentSprint && burndownData.length > 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-blue-500" />
              Sprint Burndown
            </h2>
            <span className="text-xs text-neutral-400">
              {currentSprint.name}
            </span>
          </div>

          {/* Sprint stats bar */}
          {sprintStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm">
              <div className="flex items-center gap-2 bg-neutral-50 rounded px-3 py-2">
                <Target className="w-4 h-4 text-blue-500" />
                <div>
                  <span className="text-xs text-neutral-400 block">Progress</span>
                  <span className="font-semibold">{sprintStats.completionPct}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 rounded px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <div>
                  <span className="text-xs text-neutral-400 block">Completed</span>
                  <span className="font-semibold">{sprintStats.completedTasks}/{sprintStats.totalTasks}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 rounded px-3 py-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                <div>
                  <span className="text-xs text-neutral-400 block">Days Left</span>
                  <span className="font-semibold">{sprintStats.daysRemaining}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-neutral-50 rounded px-3 py-2">
                <TrendingDown className="w-4 h-4 text-purple-500" />
                <div>
                  <span className="text-xs text-neutral-400 block">Velocity</span>
                  <span className="font-semibold">{sprintStats.velocity} tasks/day</span>
                </div>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={burndownData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 'dataMax']} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const label = name === 'remaining' ? 'Remaining' : name === 'ideal' ? 'Ideal' : 'Completed';
                  return [value, label];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name="Ideal"
              />
              <Line
                type="monotone"
                dataKey="remaining"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* No sprint message */}
      {currentSprint && burndownData.length === 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
          <div className="flex items-center gap-2 text-neutral-400">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">No tasks assigned to current sprint yet</span>
          </div>
        </div>
      )}

      {/* Completions per user */}
      {completionsPerUser.length > 0 && (
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Tasks Completed This Week
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={completionsPerUser}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Upcoming Due Dates */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
        <h2 className="font-semibold mb-3">Upcoming Due Dates</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">No upcoming deadlines</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(t => (
              <div key={t.id} className="flex justify-between items-center text-sm">
                <span>{t.title}</span>
                <span className="text-neutral-500">{new Date(t.dueDate!).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
