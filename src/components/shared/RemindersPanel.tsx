import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, X, Clock, Repeat, Trash2 } from 'lucide-react';

export const RemindersPanel = () => {
  const { reminders, dismissReminder, deleteReminder } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  // Only show active (non-dismissed, non-fired) reminders
  const activeReminders = reminders.filter(r => !r.dismissed && !r.fired);

  if (activeReminders.length === 0 && !isOpen) {
    return null;
  }

  const formatTimeUntil = (dueDate: number) => {
    const now = Date.now();
    const diff = dueDate - now;
    const absDiff = Math.abs(diff);
    const minutes = Math.floor(absDiff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diff < 0) {
      if (days > 0) return `${days}d overdue`;
      if (hours > 0) return `${hours}h overdue`;
      return `${minutes}m overdue`;
    }
    if (days > 0) return `in ${days}d`;
    if (hours > 0) return `in ${hours}h`;
    return `in ${minutes}m`;
  };

  const getRepeatLabel = (interval?: string) => {
    if (!interval) return '';
    const labels: Record<string, string> = {
      hour: 'Every hour',
      day: 'Daily',
      week: 'Weekly',
      month: 'Monthly',
      year: 'Yearly',
    };
    return labels[interval] || '';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Bell icon button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Reminders"
      >
        <Bell className="w-5 h-5" />
        {activeReminders.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {activeReminders.length}
          </span>
        )}
      </button>

      {/* Reminders list */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 w-80 bg-white rounded-lg shadow-xl border border-neutral-200 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Reminders</h3>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-neutral-100 rounded">
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
          {activeReminders.length === 0 ? (
            <p className="p-4 text-sm text-neutral-400 text-center">No active reminders</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {activeReminders.map((reminder) => (
                <div key={reminder.id} className="p-3 hover:bg-neutral-50">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reminder.title}</p>
                      {reminder.description && (
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">{reminder.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1 text-xs text-neutral-400">
                          <Clock className="w-3 h-3" />
                          {formatTimeUntil(reminder.dueDate)}
                        </span>
                        {reminder.recurring && (
                          <span className="flex items-center gap-1 text-xs text-blue-500">
                            <Repeat className="w-3 h-3" />
                            {getRepeatLabel(reminder.recurring)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => dismissReminder(reminder.id)}
                        className="p-1 hover:bg-neutral-200 rounded"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3 text-neutral-400" />
                      </button>
                      <button
                        onClick={() => deleteReminder(reminder.id)}
                        className="p-1 hover:bg-red-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
