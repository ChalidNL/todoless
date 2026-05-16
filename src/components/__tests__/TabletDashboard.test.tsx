import { describe, it, expect, vi } from 'vitest';

// --- QuickStats logic tests ---
describe('TabletDashboard QuickStats', () => {
  it('counts open tasks correctly', () => {
    const tasks = [
      { id: '1', status: 'todo', archived: false },
      { id: '2', status: 'done', archived: false },
      { id: '3', status: 'todo', archived: true },
      { id: '4', status: 'backlog', archived: false },
    ];
    const openTasks = tasks.filter(t => t.status !== 'done' && !t.archived).length;
    expect(openTasks).toBe(2);
  });

  it('counts open grocery items correctly', () => {
    const items = [
      { id: '1', title: 'Milk', completed: false },
      { id: '2', title: 'Bread', completed: true },
      { id: '3', title: 'Eggs', completed: false },
    ];
    const openItems = items.filter(i => !i.completed).length;
    expect(openItems).toBe(2);
  });

  it('identifies overdue tasks', () => {
    const now = Date.now();
    const tasks = [
      { id: '1', status: 'todo', dueDate: now - 86400000 },
      { id: '2', status: 'done', dueDate: now - 86400000 },
      { id: '3', status: 'todo', dueDate: now + 86400000 },
      { id: '4', status: 'todo' },
    ];
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'done').length;
    expect(overdue).toBe(1);
  });

  it('counts tasks completed this week', () => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const tasks = [
      { id: '1', completedAt: now - 2 * 86400000 },
      { id: '2', completedAt: weekAgo - 1 },
      { id: '3' },
    ];
    const doneThisWeek = tasks.filter(t => t.completedAt && t.completedAt > weekAgo).length;
    expect(doneThisWeek).toBe(1);
  });
});

// --- Panel filtering logic tests ---
describe('TabletDashboard Panel Filtering', () => {
  it('filters tasks by search query', () => {
    const tasks = [
      { id: '1', title: 'Buy groceries' },
      { id: '2', title: 'Walk the dog' },
      { id: '3', title: 'Grocery shopping list' },
    ];
    const q = 'grocer';
    const filtered = tasks.filter(t => t.title.toLowerCase().includes(q));
    expect(filtered).toHaveLength(2);
    expect(filtered.map(t => t.id)).toEqual(['1', '3']);
  });

  it('filters items by search query', () => {
    const items = [
      { id: '1', title: 'Milk' },
      { id: '2', title: 'Bread' },
      { id: '3', title: 'Butter' },
    ];
    const q = 'b';
    const filtered = items.filter(i => i.title.toLowerCase().includes(q));
    expect(filtered).toHaveLength(2);
  });

  it('filters notes by search in title and content', () => {
    const notes = [
      { id: '1', title: 'Meeting notes', content: 'Discuss project timeline' },
      { id: '2', title: 'Recipe', content: 'Use milk and flour' },
      { id: '3', title: 'Todo', content: 'Prepare meeting agenda' },
    ];
    const q = 'meeting';
    const filtered = notes.filter(n =>
      (n.title || '').toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
    expect(filtered).toHaveLength(2);
  });

  it('sorts upcoming events by start time', () => {
    const now = Date.now();
    const events = [
      { id: '1', title: 'Later', startTime: now + 3 * 86400000 },
      { id: '2', title: 'Tomorrow', startTime: now + 86400000 },
      { id: '3', title: 'Today', startTime: now + 3600000 },
    ];
    const upcoming = events
      .filter(e => e.startTime >= now)
      .sort((a, b) => a.startTime - b.startTime);
    expect(upcoming.map(e => e.title)).toEqual(['Today', 'Tomorrow', 'Later']);
  });

  it('separates today events from future events', () => {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const tomorrowMs = todayMs + 86400000;

    const events = [
      { id: '1', title: 'Morning standup', startTime: todayMs + 9 * 3600000 },
      { id: '2', title: 'Dinner', startTime: todayMs + 18 * 3600000 },
      { id: '3', title: 'Tomorrow meeting', startTime: tomorrowMs + 10 * 3600000 },
    ];
    const todayEvents = events.filter(e => e.startTime < tomorrowMs);
    const futureEvents = events.filter(e => e.startTime >= tomorrowMs);
    expect(todayEvents).toHaveLength(2);
    expect(futureEvents).toHaveLength(1);
  });
});

// --- Column width calculation ---
describe('TabletDashboard Column Width', () => {
  const getColumnWidth = (count: number): string => {
    if (count === 1) return 'w-full';
    if (count === 2) return 'w-1/2';
    if (count === 3) return 'w-1/3';
    return 'w-1/4';
  };

  it('returns full width for single panel', () => {
    expect(getColumnWidth(1)).toBe('w-full');
  });

  it('returns half width for two panels', () => {
    expect(getColumnWidth(2)).toBe('w-1/2');
  });

  it('returns third width for three panels', () => {
    expect(getColumnWidth(3)).toBe('w-1/3');
  });

  it('returns quarter width for four panels', () => {
    expect(getColumnWidth(4)).toBe('w-1/4');
  });
});

// --- Panel toggle logic ---
describe('TabletDashboard Panel Toggle', () => {
  const togglePanel = (current: string[], key: string): string[] => {
    return current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
  };

  it('adds panel when not active', () => {
    const result = togglePanel(['tasks', 'items'], 'notes');
    expect(result).toEqual(['tasks', 'items', 'notes']);
  });

  it('removes panel when already active', () => {
    const result = togglePanel(['tasks', 'items', 'notes'], 'items');
    expect(result).toEqual(['tasks', 'notes']);
  });

  it('handles empty panel list', () => {
    const result = togglePanel([], 'tasks');
    expect(result).toEqual(['tasks']);
  });

  it('supports all four panel types', () => {
    let panels: string[] = [];
    panels = togglePanel(panels, 'tasks');
    panels = togglePanel(panels, 'items');
    panels = togglePanel(panels, 'notes');
    panels = togglePanel(panels, 'calendar');
    expect(panels).toEqual(['tasks', 'items', 'notes', 'calendar']);
  });
});
