import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { AlertCircle, X, Clock } from 'lucide-react';

export const DueDateNotifications = () => {
  const { tasks } = useApp();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get tasks that are due soon (within 24 hours) or overdue
  const urgentTasks = tasks.filter(task => {
    if (!task.dueDate || task.status === 'done' || dismissed.includes(task.id)) {
      return false;
    }

    const now = Date.now();
    const dueDate = task.dueDate;
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);

    // Show if overdue or due within 24 hours
    return hoursUntilDue <= 24;
  });

  const handleDismiss = (taskId: string) => {
    setDismissed(prev => [...prev, taskId]);
    // Store in localStorage to persist across sessions
    const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
    localStorage.setItem('dismissedNotifications', JSON.stringify([...dismissed, taskId]));
  };

  useEffect(() => {
    // Load dismissed notifications from localStorage
    const stored = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
    setDismissed(stored);
  }, []);

  if (urgentTasks.length === 0 || !isMobile) {
    return null;
  }

  const formatTimeUntilDue = (dueDate: number) => {
    const now = Date.now();
    const diff = dueDate - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours < 0) {
      return t('common.overdue');
    } else if (hours === 0) {
      return t('common.minutesLeft').replace('{n}', String(minutes));
    } else if (hours < 24) {
      return t('common.hoursLeft').replace('{n}', String(hours));
    }
    return t('common.dueSoon');
  };

  return (
    <div className="fixed top-[49px] left-0 right-0 z-50 md:hidden">
      <div className="bg-amber-500 text-white shadow-lg">
        <div className="max-w-lg mx-auto">
          {urgentTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-2 border-b border-amber-600 last:border-b-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title || t('tasks.untitledTask')}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{formatTimeUntilDue(task.dueDate!)}</span>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(task.id)}
                className="p-1 hover:bg-amber-600 rounded flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
