import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CompactWeekViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  monthNames: string[];
}

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_HEIGHT = 28; // px per hour — was 48

export const CompactWeekView: React.FC<CompactWeekViewProps> = ({
  currentDate,
  onDateChange,
  monthNames,
}) => {
  const { tasks, calendarEvents } = useApp();

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const now = new Date();
  const isCurrentWeek =
    now >= weekDays[0] && now <= weekDays[6];

  const shortDays = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  // Collect items per day
  const dayItems = useMemo(() => {
    return weekDays.map((day) => {
      const dayStart = new Date(day).setHours(0, 0, 0, 0);
      const dayEnd = new Date(day).setHours(23, 59, 59, 999);

      const allDayItems: Array<{ id: string; title: string; kind: string; color: string }> = [];
      const timedItems: Array<{
        id: string;
        title: string;
        kind: string;
        startMin: number;
        endMin: number;
        color: string;
      }> = [];

      // Calendar events
      for (const ev of calendarEvents) {
        if (ev.startTime >= dayStart && ev.startTime <= dayEnd) {
          const color = ev.allDay ? 'bg-emerald-200 text-emerald-800' : 'bg-indigo-200 text-indigo-800';
          if (ev.allDay) {
            allDayItems.push({ id: ev.id, title: ev.title, kind: 'event', color });
          } else {
            const sMin = new Date(ev.startTime).getHours() * 60 + new Date(ev.startTime).getMinutes();
            const eMin = new Date(ev.endTime).getHours() * 60 + new Date(ev.endTime).getMinutes();
            timedItems.push({ id: ev.id, title: ev.title, kind: 'event', startMin: sMin, endMin: eMin, color });
          }
        }
      }

      // Tasks with dueDate
      for (const t of tasks) {
        if (!t.dueDate) continue;
        if (t.dueDate < dayStart || t.dueDate > dayEnd) continue;
        const h = new Date(t.dueDate).getHours();
        const m = new Date(t.dueDate).getMinutes();
        const isAllDay = h === 0 && m === 0;
        let color = 'bg-blue-200 text-blue-800';
        if (t.status === 'done') color = 'bg-neutral-100 text-neutral-400 line-through';
        else if (t.priority === 'urgent') color = 'bg-red-200 text-red-800';
        else if (t.priority === 'low') color = 'bg-neutral-100 text-neutral-600';

        if (isAllDay) {
          allDayItems.push({ id: t.id!, title: t.title, kind: 'task', color });
        } else {
          const sMin = h * 60 + m;
          timedItems.push({ id: t.id!, title: t.title, kind: 'task', startMin: sMin, endMin: sMin + 30, color });
        }
      }

      return { allDayItems, timedItems };
    });
  }, [weekDays, tasks, calendarEvents]);

  const maxAllDay = Math.max(...dayItems.map((d) => d.allDayItems.length), 0);
  const allDayRowHeight = maxAllDay > 0 ? Math.min(maxAllDay, 2) * 18 + 4 : 0;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const totalHours = HOUR_END - HOUR_START + 1;
  const gridHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto select-none">
      {/* Nav header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white shrink-0">
        <button
          onClick={() => {
            const d = new Date(currentDate);
            d.setDate(d.getDate() - 7);
            onDateChange(d);
          }}
          className="p-1 hover:bg-neutral-100 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium">
          {(() => {
            const s = weekDays[0];
            const e = weekDays[6];
            const sm = monthNames[s.getMonth()].slice(0, 3);
            const em = monthNames[e.getMonth()].slice(0, 3);
            if (sm === em) return `${sm} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
            return `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${s.getFullYear()}`;
          })()}
        </span>
        <button
          onClick={() => {
            const d = new Date(currentDate);
            d.setDate(d.getDate() + 7);
            onDateChange(d);
          }}
          className="p-1 hover:bg-neutral-100 rounded"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day header row */}
      <div className="flex bg-white border-b shrink-0">
        <div className="w-10 shrink-0" />
        {weekDays.map((day, idx) => {
          const isToday = now.toDateString() === day.toDateString();
          return (
            <div
              key={idx}
              className={`flex-1 text-center py-1 border-l border-neutral-100 ${isToday ? 'bg-blue-50/40' : ''}`}
            >
              <div className={`text-[9px] uppercase ${isToday ? 'text-blue-600 font-bold' : 'text-neutral-400'}`}>
                {shortDays[day.getDay()]}
              </div>
              <div className={`text-sm leading-tight ${isToday ? 'text-blue-600 font-bold' : 'text-neutral-800'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row (compact) */}
      {maxAllDay > 0 && (
        <div className="flex bg-white border-b shrink-0" style={{ height: `${allDayRowHeight}px` }}>
          <div className="w-10 shrink-0 text-[8px] text-neutral-300 flex items-center justify-center">AD</div>
          {dayItems.map((col, idx) => (
            <div key={idx} className="flex-1 border-l border-neutral-100 p-px overflow-hidden flex flex-col gap-px">
              {col.allDayItems.slice(0, 2).map((ev) => (
                <div
                  key={ev.id}
                  className={`text-[9px] px-1 rounded truncate leading-tight ${ev.color}`}
                  title={ev.title}
                >
                  {ev.title}
                </div>
              ))}
              {col.allDayItems.length > 2 && (
                <div className="text-[8px] text-neutral-400 px-1">+{col.allDayItems.length - 2}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto bg-white relative" style={{ minHeight: `${gridHeight}px` }}>
        {/* Current time line */}
        {isCurrentWeek && nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60 + 60 && (
          <div
            className="absolute left-10 right-0 z-10 pointer-events-none"
            style={{ top: `${((nowMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT + allDayRowHeight}px` }}
          >
            <div className="flex items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 -ml-0.5" />
              <div className="flex-1 h-px bg-red-400" />
            </div>
          </div>
        )}

        {Array.from({ length: totalHours }, (_, i) => HOUR_START + i).map((hour) => {
          const topPx = (hour - HOUR_START) * HOUR_HEIGHT + allDayRowHeight;
          return (
            <div key={hour} className="flex relative" style={{ height: `${HOUR_HEIGHT}px` }}>
              {/* Time label */}
              <div
                className="w-10 shrink-0 text-[9px] text-neutral-300 text-right pr-1"
                style={{ marginTop: '-5px' }}
              >
                {String(hour).padStart(2, '0')}
              </div>

              {/* 7 day columns */}
              <div className="flex-1 flex">
                {weekDays.map((day, idx) => {
                  const isToday = now.toDateString() === day.toDateString();
                  const items = dayItems[idx].timedItems.filter(
                    (e) => e.startMin >= hour * 60 && e.startMin < (hour + 1) * 60
                  );

                  return (
                    <div
                      key={idx}
                      className={`flex-1 border-l border-neutral-100 relative ${isToday ? 'bg-blue-50/20' : ''}`}
                    >
                      {/* Half-hour faint line */}
                      <div className="absolute inset-x-0 top-1/2 border-t border-neutral-50" />

                      {items.map((ev) => {
                        const topOff = ((ev.startMin - hour * 60) / 60) * HOUR_HEIGHT;
                        const dur = Math.max(ev.endMin - ev.startMin, 15);
                        const hPx = Math.max((dur / 60) * HOUR_HEIGHT, 14);
                        return (
                          <div
                            key={ev.id}
                            className={`absolute inset-x-px text-[8px] px-0.5 rounded leading-tight truncate ${ev.color}`}
                            style={{ top: `${topOff}px`, height: `${hPx}px` }}
                            title={`${ev.title} (${Math.floor(ev.startMin / 60)}:${String(ev.startMin % 60).padStart(2, '0')})`}
                          >
                            {hPx > 16 ? ev.title : ''}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
