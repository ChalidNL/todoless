import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarEvent } from '../types';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { TopBar } from './shared/TopBar';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { CompactTaskCard } from './shared/CompactTaskCard';

type CalendarView = 'list' | 'day' | 'week' | 'month' | 'year';

export const Calendar = () => {
  const { tasks, addTask, calendarEvents } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [recurringType, setRecurringType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [searchQuery, setSearchQuery] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handlePreviousYear = () => {
    setCurrentDate(new Date(year - 1, 0, 1));
  };

  const handleNextYear = () => {
    setCurrentDate(new Date(year + 1, 0, 1));
  };

  const handleAddEvent = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    setNewEventTitle(value);
    setShowAddModal(true);
  };

  const handleCreateEvent = () => {
    if (!newEventTitle) return;

    let dueDate: number | undefined;
    if (newEventDate) {
      const date = new Date(newEventDate);
      if (newEventTime) {
        const [hours, minutes] = newEventTime.split(':');
        date.setHours(parseInt(hours), parseInt(minutes));
      }
      dueDate = date.getTime();
    }

    const newTask = {
      title: newEventTitle,
      dueDate,
      recurring: recurringType !== 'none' ? recurringType : undefined,
      isEvent: true,
    };

    addTask(newTask);
    setShowAddModal(false);
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventTime('');
    setRecurringType('none');
  };

  const getTasksForDay = (day: number) => {
    const dayDate = new Date(year, month, day);
    const dayStart = new Date(dayDate).setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate).setHours(23, 59, 59, 999);

    return tasks.filter(task => {
      if (!task.dueDate) return false;
      return task.dueDate >= dayStart && task.dueDate <= dayEnd;
    });
  };

  const getTodayTasks = () => {
    const today = new Date();
    const dayStart = new Date(today).setHours(0, 0, 0, 0);
    const dayEnd = new Date(today).setHours(23, 59, 59, 999);

    return tasks.filter(task => {
      if (!task.dueDate) return false;
      return task.dueDate >= dayStart && task.dueDate <= dayEnd;
    });
  };

  const getWeekDays = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    const dayStart = new Date(date).setHours(0, 0, 0, 0);
    const dayEnd = new Date(date).setHours(23, 59, 59, 999);

    return tasks.filter(task => {
      if (!task.dueDate) return false;
      return task.dueDate >= dayStart && task.dueDate <= dayEnd;
    });
  };

  const getAllTasks = () => {
    return tasks
      .filter(task => task.dueDate)
      .filter(task => task.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
  };

  const getTasksForYear = () => {
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();
    
    const monthsData = [];
    for (let m = 0; m < 12; m++) {
      const monthTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return taskDate.getFullYear() === year && taskDate.getMonth() === m;
      });
      monthsData.push({ month: m, tasks: monthTasks });
    }
    
    return monthsData;
  };

  const getEventsForDay = (day: number) => {
    const dayDate = new Date(year, month, day);
    const dayStart = new Date(dayDate).setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate).setHours(23, 59, 59, 999);

    const dayTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      return task.dueDate >= dayStart && task.dueDate <= dayEnd;
    });

    const dayCalEvents = (calendarEvents || []).filter(event => {
      return event.startTime <= dayEnd && event.endTime >= dayStart;
    });

    return [...dayTasks.map(t => ({ type: 'task' as const, data: t })),
            ...dayCalEvents.map(e => ({ type: 'event' as const, data: e }))];
  };

  const handleDayClick = (day: number) => {
    setCurrentDate(new Date(year, month, day));
    setView('day');
  };

  const renderCalendarDays = () => {
    const days = [];
    const maxEventsVisible = 3;

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-24 bg-neutral-50/50 border border-neutral-100" />
      );
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const events = getEventsForDay(day);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

      days.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={`h-24 border border-neutral-100 p-0.5 cursor-pointer hover:bg-neutral-50 transition-colors ${
            isToday ? 'bg-blue-50/30' : 'bg-white'
          }`}
        >
          <div className="flex items-center justify-between px-1">
            <span className={`text-xs leading-none ${
              isToday
                ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white font-semibold'
                : 'text-neutral-500'
            }`}>
              {day}
            </span>
          </div>
          <div className="mt-0.5 space-y-px">
            {events.slice(0, maxEventsVisible).map(item => {
              if (item.type === 'task') {
                const task = item.data;
                const hasTime = task.dueDate && new Date(task.dueDate).getHours() !== 0;
                const timeStr = hasTime
                  ? new Date(task.dueDate!).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div
                    key={task.id}
                    className={`text-[10px] leading-tight px-1 py-px rounded truncate ${
                      task.status === 'done'
                        ? 'bg-neutral-100 text-neutral-400 line-through'
                        : task.priority === 'urgent'
                        ? 'bg-red-100 text-red-700 font-medium'
                        : task.priority === 'low'
                        ? 'bg-neutral-50 text-neutral-500'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                    title={`${task.title}${timeStr ? ` ${timeStr}` : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {timeStr && <span className="opacity-70 mr-0.5">{timeStr}</span>}
                    {task.title}
                  </div>
                );
              } else {
                const event = item.data;
                const isAllDay = event.allDay;
                const timeStr = isAllDay
                  ? ''
                  : new Date(event.startTime).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={event.id}
                    className="text-[10px] leading-tight px-1 py-px rounded truncate bg-emerald-100 text-emerald-700"
                    title={`${event.title}${timeStr ? ` ${timeStr}` : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {timeStr && <span className="opacity-70 mr-0.5">{timeStr}</span>}
                    {event.title}
                  </div>
                );
              }
            })}
            {events.length > maxEventsVisible && (
              <div className="text-[10px] text-neutral-400 px-1 font-medium">
                +{events.length - maxEventsVisible} meer
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const renderListView = () => {
    const allTasks = getAllTasks();
    
    // Group tasks by date
    const groupedByDate: { [key: string]: typeof allTasks } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    allTasks.forEach(task => {
      if (!task.dueDate) return;
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);
      const dateKey = taskDate.toISOString().split('T')[0];
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(task);
    });

    // Sort dates
    const sortedDates = Object.keys(groupedByDate).sort();
    
    const formatDateHeader = (dateStr: string) => {
      const date = new Date(dateStr);
      const diffTime = date.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      let label = '';
      if (diffDays === 0) label = 'Today';
      else if (diffDays === 1) label = 'Tomorrow';
      else if (diffDays === -1) label = 'Yesterday';
      else if (diffDays > 1 && diffDays < 7) label = date.toLocaleDateString('nl-NL', { weekday: 'long' });
      else label = date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
      
      const dateNum = date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
      
      return { label, dateNum, isToday: diffDays === 0, isPast: diffDays < 0 };
    };

    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        {sortedDates.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No scheduled tasks found</p>
            <p className="text-sm mt-2">Add tasks with due dates to see them here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(dateStr => {
              const tasks = groupedByDate[dateStr];
              const { label, dateNum, isToday, isPast } = formatDateHeader(dateStr);
              
              return (
                <div key={dateStr} className={`rounded-lg overflow-hidden ${isToday ? 'ring-2 ring-blue-500' : ''}`}>
                  {/* Date Header */}
                  <div className={`sticky top-[170px] z-10 px-4 py-2 border-b backdrop-blur-sm ${
                    isToday 
                      ? 'bg-blue-500/90 border-blue-400 text-white' 
                      : isPast 
                        ? 'bg-neutral-100/90 border-neutral-200 text-neutral-500'
                        : 'bg-white/90 border-neutral-200 text-neutral-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{label}</span>
                        <span className="text-sm opacity-75">{dateNum}</span>
                      </div>
                      <div className="text-sm opacity-75">
                        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Tasks List */}
                  <div className="divide-y divide-neutral-100">
                    {tasks.map(task => (
                      <div 
                        key={task.id} 
                        className={`p-3 hover:bg-neutral-50 transition-colors ${
                          task.status === 'done' ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Time */}
                          <div className="w-16 text-sm text-neutral-500 pt-0.5 flex-shrink-0">
                            {task.dueDate ? formatTime(task.dueDate) : 'All day'}
                          </div>
                          
                          {/* Task Card */}
                          <div className="flex-1 min-w-0">
                            <CompactTaskCard task={task} showCheckbox={true} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const dayTasks = getTasksForDate(currentDate);
    const now = new Date();
    const isCurrentDay = now.toDateString() === currentDate.toDateString();

    // Unified events with positional data (matches week view density)
    const dayEvents = dayTasks.map(t => ({
      id: t.id,
      title: t.title,
      startMin: t.dueDate ? new Date(t.dueDate).getHours() * 60 + new Date(t.dueDate).getMinutes() : 0,
      endMin: t.dueDate ? new Date(t.dueDate).getHours() * 60 + new Date(t.dueDate).getMinutes() + 30 : 0,
      status: t.status,
      priority: t.priority,
      isAllDay: t.dueDate ? (new Date(t.dueDate).getHours() === 0 && new Date(t.dueDate).getMinutes() === 0) : false,
    }));

    const allDayEvents = dayEvents.filter(e => e.isAllDay);
    const timedEvents = dayEvents.filter(e => !e.isAllDay);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="flex flex-col h-[calc(100vh-200px)] max-w-2xl mx-auto">
        {/* Day header */}
        <div className="flex border-b border-neutral-200 bg-white sticky top-[105px] z-10">
          <div className="w-12 shrink-0" /> {/* time gutter */}
          <div className="flex-1 text-center py-2">
            <div className={`text-[10px] uppercase tracking-wide ${isCurrentDay ? 'text-blue-600' : 'text-neutral-500'}`}>
              {shortDays[currentDate.getDay()]}
            </div>
            <div className={`text-lg font-bold ${isCurrentDay ? 'text-blue-600' : 'text-neutral-900'}`}>
              {currentDate.getDate()}
            </div>
          </div>
        </div>

        {/* All-day row */}
        {allDayEvents.length > 0 && (
          <div className="flex bg-white border-b border-neutral-200" style={{ height: `${Math.max(allDayEvents.length, 1) * 22}px` }}>
            <div className="w-12 shrink-0 text-[10px] text-neutral-400 flex items-center justify-center">all-day</div>
            <div className="flex-1 p-0.5 overflow-hidden space-y-px">
              {allDayEvents.map(ev => (
                <div
                  key={ev.id}
                  className={`text-[11px] px-1.5 py-0.5 rounded truncate ${
                    ev.status === 'done'
                      ? 'bg-neutral-100 text-neutral-400 line-through'
                      : ev.priority === 'urgent'
                      ? 'bg-red-50 text-red-700'
                      : ev.priority === 'low'
                      ? 'bg-neutral-50 text-neutral-600'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                  title={ev.title}
                >
                  {ev.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto bg-white relative">
          {/* Current time line */}
          {isCurrentDay && (
            <div
              className="absolute left-12 right-0 z-10 pointer-events-none"
              style={{ top: `${(nowMinutes / 60 - HOUR_START) * HOUR_HEIGHT + (allDayEvents.length * 22)}px` }}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-[2px] bg-red-500" />
              </div>
            </div>
          )}

          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i).map(hour => {
            const topPx = (hour - HOUR_START) * HOUR_HEIGHT + (allDayEvents.length * 22);
            const hourEvents = timedEvents.filter(e => e.startMin >= hour * 60 && e.startMin < (hour + 1) * 60);

            return (
              <div key={hour} className="flex relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                <div className="w-12 shrink-0 text-[10px] text-neutral-400 text-right pr-2" style={{ marginTop: '-6px' }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div className="flex-1 border-l border-neutral-100 relative">
                  {/* Half-hour divider */}
                  <div className="absolute left-0 right-0 top-1/2 border-t border-neutral-50" />
                  {hourEvents.map(ev => {
                    const topOffset = ((ev.startMin - hour * 60) / 60) * HOUR_HEIGHT;
                    const durationMin = Math.max(ev.endMin - ev.startMin, 15);
                    const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 16);
                    const isDone = ev.status === 'done';
                    return (
                      <div
                        key={ev.id}
                        className={`absolute inset-x-0.5 text-[10px] px-1 rounded overflow-hidden truncate leading-tight ${
                          isDone
                            ? 'bg-neutral-100 text-neutral-400 line-through'
                            : ev.priority === 'urgent'
                            ? 'bg-red-50 text-red-700 border-l-2 border-red-400'
                            : ev.priority === 'low'
                            ? 'bg-neutral-50 text-neutral-600 border-l-2 border-neutral-300'
                            : 'bg-blue-50 text-blue-700 border-l-2 border-blue-400'
                        }`}
                        style={{ top: `${topOffset}px`, height: `${heightPx}px` }}
                        title={ev.title}
                      >
                        {ev.title}
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

  const goToToday = () => setCurrentDate(new Date());
  const goToPrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goToNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const HOUR_START = 6;
  const HOUR_END = 23;
  const HOUR_HEIGHT = 48; // px per hour

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const now = new Date();
    const isCurrentWeek = now >= weekDays[0] && now <= weekDays[6];

    // Combine calendar events + tasks with dueDate into a unified list per day
    const getDayEvents = (date: Date) => {
      const dayStart = new Date(date).setHours(0, 0, 0, 0);
      const dayEnd = new Date(date).setHours(23, 59, 59, 999);
      const dayStr = date.toISOString().split('T')[0];

      const timedEvents = calendarEvents.filter(ev => {
        if (ev.allDay) return false;
        return ev.startTime >= dayStart && ev.startTime <= dayEnd;
      });

      const allDayEvents = calendarEvents.filter(ev => {
        if (!ev.allDay) return false;
        return ev.startTime >= dayStart && ev.startTime <= dayEnd;
      });

      // Tasks with dueDate that fall on this day (treat as all-day if no time set)
      const timedTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const h = new Date(t.dueDate).getHours();
        const m = new Date(t.dueDate).getMinutes();
        return t.dueDate >= dayStart && t.dueDate <= dayEnd && (h !== 0 || m !== 0);
      });

      const allDayTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const h = new Date(t.dueDate).getHours();
        const m = new Date(t.dueDate).getMinutes();
        return t.dueDate >= dayStart && t.dueDate <= dayEnd && h === 0 && m === 0;
      });

      return { timedEvents, allDayEvents, timedTasks, allDayTasks };
    };

    const allDayColumns = weekDays.map(day => {
      const { allDayEvents, allDayTasks } = getDayEvents(day);
      return [...allDayEvents, ...allDayTasks];
    });
    const maxAllDay = Math.max(...allDayColumns.map(c => c.length), 0);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Short day name (Mon-Sun)
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="flex flex-col h-[calc(100vh-200px)] max-w-6xl mx-auto">
        {/* Week header */}
        <div className="flex border-b border-neutral-200 bg-white sticky top-[105px] z-10">
          <div className="w-14 shrink-0" /> {/* time gutter */}
          <div className="flex-1 grid grid-cols-7">
            {weekDays.map((day, idx) => {
              const isToday = now.toDateString() === day.toDateString();
              return (
                <div key={idx} className="text-center py-2 border-l border-neutral-100">
                  <div className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-neutral-500'}`}>
                    {shortDays[day.getDay()]}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-neutral-900'}`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All-day row */}
        {maxAllDay > 0 && (
          <div className="flex bg-white border-b border-neutral-200" style={{ height: `${maxAllDay * 24}px` }}>
            <div className="w-14 shrink-0 text-[10px] text-neutral-400 flex items-center justify-center">all-day</div>
            <div className="flex-1 grid grid-cols-7">
              {allDayColumns.map((col, idx) => (
                <div key={idx} className="border-l border-neutral-100 p-0.5 overflow-hidden">
                  {col.map(ev => {
                    const isTask = 'status' in ev;
                    return (
                      <div
                        key={ev.id}
                        className={`text-[11px] px-1.5 py-0.5 rounded truncate ${
                          isTask
                            ? (ev as any).status === 'done'
                              ? 'bg-neutral-100 text-neutral-400 line-through'
                              : 'bg-blue-50 text-blue-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto bg-white relative">
          {/* Current time line */}
          {isCurrentWeek && (
            <div
              className="absolute left-14 right-0 z-10 pointer-events-none"
              style={{ top: `${(nowMinutes / 60 - HOUR_START) * HOUR_HEIGHT + (maxAllDay * 24)}px` }}
            >
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-[2px] bg-red-500" />
              </div>
            </div>
          )}

          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i).map(hour => {
            const topPx = (hour - HOUR_START) * HOUR_HEIGHT + (maxAllDay * 24);
            return (
              <div key={hour} className="flex relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                <div className="w-14 shrink-0 text-[10px] text-neutral-400 text-right pr-2" style={{ marginTop: '-6px' }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
                <div className="flex-1 grid grid-cols-7 relative">
                  {weekDays.map((day, idx) => {
                    const isToday = now.toDateString() === day.toDateString();
                    const { timedEvents, timedTasks } = getDayEvents(day);
                    const allTimed = [
                      ...timedEvents.map(ev => ({
                        id: ev.id,
                        title: ev.title,
                        startMin: new Date(ev.startTime).getHours() * 60 + new Date(ev.startTime).getMinutes(),
                        endMin: new Date(ev.endTime).getHours() * 60 + new Date(ev.endTime).getMinutes(),
                        kind: 'event' as const,
                      })),
                      ...timedTasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        startMin: new Date(t.dueDate!).getHours() * 60 + new Date(t.dueDate!).getMinutes(),
                        endMin: new Date(t.dueDate!).getHours() * 60 + new Date(t.dueDate!).getMinutes() + 30,
                        kind: 'task' as const,
                        status: t.status,
                        priority: t.priority,
                      })),
                    ].filter(e => e.startMin >= hour * 60 && e.startMin < (hour + 1) * 60);

                    return (
                      <div key={idx} className={`border-l ${isToday ? 'bg-blue-50/30' : ''} border-neutral-100 relative`}>
                        {/* Half-hour divider */}
                        <div className="absolute left-0 right-0 top-1/2 border-t border-neutral-50" />
                        {allTimed.map(ev => {
                          const topOffset = ((ev.startMin - hour * 60) / 60) * HOUR_HEIGHT;
                          const durationMin = Math.max(ev.endMin - ev.startMin, 15);
                          const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 18);
                          const isDone = 'status' in ev && ev.status === 'done';
                          return (
                            <div
                              key={ev.id}
                              className={`absolute inset-x-0.5 text-[10px] px-1 rounded overflow-hidden truncate leading-tight ${
                                isDone
                                  ? 'bg-neutral-100 text-neutral-400 line-through'
                                  : ev.kind === 'event'
                                  ? 'bg-indigo-100 text-indigo-700 border-l-2 border-indigo-400'
                                  : (ev.priority === 'urgent')
                                  ? 'bg-red-50 text-red-700 border-l-2 border-red-400'
                                  : (ev.priority === 'low')
                                  ? 'bg-neutral-50 text-neutral-600 border-l-2 border-neutral-300'
                                  : 'bg-blue-50 text-blue-700 border-l-2 border-blue-400'
                              }`}
                              style={{ top: `${topOffset}px`, height: `${heightPx}px` }}
                              title={ev.title}
                            >
                              {heightPx > 24 ? ev.title : ev.title}
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

  const renderMonthView = () => {
    return (
      <div className="max-w-7xl mx-auto px-2 py-2">
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-neutral-50 border-b border-neutral-200">
            {daysOfWeek.map(day => (
              <div
                key={day}
                className="py-1.5 text-center text-[11px] font-semibold text-neutral-500 uppercase tracking-wide"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const shortDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
    const today = new Date();

    const getDayTaskCount = (m: number, d: number) => {
      const dayStart = new Date(year, m, d).setHours(0, 0, 0, 0);
      const dayEnd = new Date(year, m, d).setHours(23, 59, 59, 999);
      return tasks.filter(t => {
        if (!t.dueDate) return false;
        return t.dueDate >= dayStart && t.dueDate <= dayEnd;
      }).length;
    };

    const renderMiniMonth = (m: number) => {
      const firstDay = new Date(year, m, 1);
      // Monday-based: getDay() 0=Sun -> 6, 1=Mon -> 0
      let startDow = firstDay.getDay() - 1;
      if (startDow < 0) startDow = 6;
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      const cells: React.ReactNode[] = [];
      // leading empty cells
      for (let i = 0; i < startDow; i++) {
        cells.push(<div key={`e-${i}`} />);
      }
      // day cells
      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getFullYear() === year && today.getMonth() === m && today.getDate() === d;
        const count = getDayTaskCount(m, d);
        cells.push(
          <div
            key={d}
            className={`text-center leading-5 cursor-pointer rounded-sm hover:bg-blue-100 transition-colors ${
              isToday
                ? 'bg-blue-600 text-white font-bold hover:bg-blue-700'
                : count > 0
                  ? 'font-semibold text-neutral-800'
                  : 'text-neutral-500'
            }`}
            onClick={() => {
              setCurrentDate(new Date(year, m, d));
              setView('month');
            }}
          >
            <span className="inline-block w-5 h-5 leading-5 text-[11px]">
              {d}
              {count > 0 && !isToday && (
                <span className={`block mx-auto mt-[-2px] h-[3px] w-[3px] rounded-full ${
                  count >= 3 ? 'bg-red-400' : 'bg-blue-400'
                }`} />
              )}
            </span>
          </div>
        );
      }

      return (
        <div
          key={m}
          className="bg-white rounded-lg border border-neutral-200 p-2 hover:border-neutral-300 transition-colors"
        >
          <h3
            className="text-xs font-semibold mb-1 text-neutral-700 cursor-pointer hover:text-blue-600"
            onClick={() => {
              setCurrentDate(new Date(year, m, 1));
              setView('month');
            }}
          >
            {monthNames[m]}
          </h3>
          <div className="grid grid-cols-7 gap-0">
            {shortDays.map(sd => (
              <div key={sd} className="text-center text-[9px] text-neutral-400 leading-4">{sd}</div>
            ))}
            {cells}
          </div>
        </div>
      );
    };

    return (
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, m) => renderMiniMonth(m))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <TopBar />
      
      {/* Global Header */}
      <NewGlobalHeader 
        onSearch={setSearchQuery}
        onAdd={handleAddEvent}
        searchPlaceholder="Search events or add with @user #label //date..."
        type="task"
      />

      {/* Navigation & View Selector */}
      <div className="bg-white border-b border-neutral-200 sticky top-[105px] z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Week/Month Navigation - Centered */}
          <div className="flex items-center justify-center gap-2 mb-3">
            {view === 'week' ? (
              <>
                <button onClick={goToToday} className="px-3 py-1.5 text-sm border border-neutral-200 rounded hover:bg-neutral-50">
                  Today
                </button>
                <button onClick={goToPrevWeek} className="p-2 hover:bg-neutral-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-lg font-medium min-w-48 text-center">
                  {(() => {
                    const wd = getWeekDays();
                    const s = wd[0];
                    const e = wd[6];
                    const sMonth = monthNames[s.getMonth()].slice(0, 3);
                    const eMonth = monthNames[e.getMonth()].slice(0, 3);
                    if (sMonth === eMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
                    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${s.getFullYear()}`;
                  })()}
                </span>
                <button onClick={goToNextWeek} className="p-2 hover:bg-neutral-100 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            ) : view === 'year' ? (
              <>
                <button onClick={handlePreviousYear} className="p-2 hover:bg-neutral-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-lg font-medium min-w-48 text-center">
                  {year}
                </span>
                <button onClick={handleNextYear} className="p-2 hover:bg-neutral-100 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={handlePreviousMonth} className="p-2 hover:bg-neutral-100 rounded">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-lg font-medium min-w-48 text-center">
                  {monthNames[month]} {year}
                </span>
                <button onClick={handleNextMonth} className="p-2 hover:bg-neutral-100 rounded">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* View Selector */}
          <div className="flex gap-2 justify-center">
            {(['list', 'day', 'week', 'month', 'year'] as CalendarView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded text-sm capitalize transition-colors ${
                  view === v
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View Content */}
      {view === 'list' && renderListView()}
      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}
      {view === 'year' && renderYearView()}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add New Event</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Title</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Date</label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Time (optional)</label>
                <input
                  type="time"
                  value={newEventTime}
                  onChange={(e) => setNewEventTime(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Recurring</label>
                <select
                  value={recurringType}
                  onChange={(e) => setRecurringType(e.target.value as typeof recurringType)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded"
                >
                  Add Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};