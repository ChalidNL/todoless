import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Sprint, Task } from '../types';

interface BurndownData {
  day: string;
  ideal: number;
  actual: number;
}

interface BurndownChartProps {
  sprint: Sprint;
  tasks: Task[];
}

export function BurndownChart({ sprint, tasks }: BurndownChartProps) {
  const data = useMemo(() => {
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalTasks = tasks.length;

    if (totalDays <= 0 || totalTasks === 0) return [];

    const sprintTaskIds = new Set(tasks.map((t) => t.id));

    // Generate daily data points
    const points: BurndownData[] = [];
    const now = new Date();

    for (let day = 0; day <= totalDays; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);

      // Ideal burndown: linear from totalTasks to 0
      const ideal = Math.max(0, Math.round(totalTasks - (totalTasks * day) / totalDays));

      // Actual: count tasks completed by this day
      const completedByDay = tasks.filter((t) => {
        if (t.status !== 'done' || !t.completedAt) return false;
        return new Date(t.completedAt) <= date;
      }).length;
      const actual = totalTasks - completedByDay;

      const isFuture = date > now;
      const isToday = date.toDateString() === now.toDateString();

      points.push({
        day: date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        ideal: isFuture ? NaN : ideal,
        actual: isFuture ? NaN : actual,
      });
    }

    return points;
  }, [sprint, tasks]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <p className="text-sm">Nog geen data voor burndown chart</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-neutral-700 mb-3">Burndown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#737373' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#737373' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [value, name === 'ideal' ? 'Ideaal' : 'Werkelijk']}
          />
          <Line
            type="linear"
            dataKey="ideal"
            stroke="#94a3b8"
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
            name="ideal"
          />
          <Line
            type="linear"
            dataKey="actual"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 3, fill: '#22c55e' }}
            activeDot={{ r: 5 }}
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Generate burndown data for a sprint (for export/testing)
export function generateBurndownData(sprint: Sprint, tasks: Task[]): BurndownData[] {
  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalTasks = tasks.length;

  if (totalDays <= 0) return [];

  const points: BurndownData[] = [];
  const now = new Date();

  for (let day = 0; day <= totalDays; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);

    const ideal = Math.max(0, Math.round(totalTasks - (totalTasks * day) / totalDays));
    const completedByDay = tasks.filter((t) => {
      if (t.status !== 'done' || !t.completedAt) return false;
      return new Date(t.completedAt) <= date;
    }).length;
    const actual = totalTasks - completedByDay;

    const isFuture = date > now;

    points.push({
      day: date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      ideal: isFuture ? NaN : ideal,
      actual: isFuture ? NaN : actual,
    });
  }

  return points;
}
