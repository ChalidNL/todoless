import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarView } from '../components/calendar/CalendarView';
import { t } from '../i18n/translations';
import type { Task } from '../types';

const useAppMock = vi.fn();
const addTask = vi.fn();
const updateTask = vi.fn();
const deleteTask = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

const baseAppValue = {
  tasks: [] as Task[],
  addTask,
  updateTask,
  deleteTask,
  users: [],
  labels: [],
  shops: [],
  filters: [],
  addLabel: vi.fn(),
  swapEntity: vi.fn(),
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  isChipFilterActive: vi.fn().mockReturnValue(false),
  activeChipFilters: [],
  refreshEntries: vi.fn(),
  showCompletionMessage: vi.fn(),
  moveTaskToStatus: vi.fn(),
};

const startOfToday = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// All three dated tasks land on today (midnight) so they appear in the
// schedule-view agenda regardless of the time the suite runs.
const calendarTasks = (): Task[] => [
  calTask({ id: 'focus-a', title: 'Focus Alpha', status: 'todo', priority: 'high', focus: true, createdAt: 1 }),
  calTask({ id: 'plain-b', title: 'Plain Beta', status: 'todo', focus: false, createdAt: 2 }),
  calTask({ id: 'blocked-c', title: 'Blocked Gamma', status: 'todo', blocked: true, createdAt: 3 }),
];

const renderSchedule = () => {
  render(<CalendarView />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'schedule' } });
  return screen.getByTestId('calendar-agenda-list');
};

describe('CalendarView chip filters + hidden date/repeat dropdown sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppMock.mockReturnValue(baseAppValue);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  it('filters schedule items down to the focus set when the status=focus chip is active', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      activeChipFilters: [{ type: 'status', id: 'focus', label: 'Focus', color: '#f97316' }],
      tasks: calendarTasks(),
    });

    const agenda = renderSchedule();

    expect(within(agenda).getByText('Focus Alpha')).toBeInTheDocument();
    expect(within(agenda).queryByText('Plain Beta')).not.toBeInTheDocument();
    expect(within(agenda).queryByText('Blocked Gamma')).not.toBeInTheDocument();
  });

  it('applies the focus chip filter BEFORE the search query (filter ∩ search)', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      activeChipFilters: [{ type: 'status', id: 'focus', label: 'Focus', color: '#f97316' }],
      tasks: calendarTasks(),
    });

    const agenda = renderSchedule();
    const search = screen.getByPlaceholderText(t('calendar.searchPlaceholder'));

    // 'Alpha' keeps the focus task; 'Plain Beta' was already removed by the
    // chip (a search-first implementation would still match it).
    fireEvent.change(search, { target: { value: 'Alpha' } });
    expect(within(agenda).getByText('Focus Alpha')).toBeInTheDocument();
    expect(within(agenda).queryByText('Plain Beta')).not.toBeInTheDocument();

    // 'Beta' cannot resurrect the chip-filtered task: the agenda is empty.
    fireEvent.change(search, { target: { value: 'Beta' } });
    const emptyAgenda = screen.getByTestId('calendar-agenda-list');
    expect(within(emptyAgenda).getByText(t('calendar.noEvents'))).toBeInTheDocument();
    expect(within(emptyAgenda).queryByText('Plain Beta')).not.toBeInTheDocument();
  });

  it('filters schedule items down to the blocked set when the status=blocked chip is active', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      activeChipFilters: [{ type: 'status', id: 'blocked', label: 'Blocked', color: '#e11d48' }],
      tasks: calendarTasks(),
    });

    const agenda = renderSchedule();

    expect(within(agenda).getByText('Blocked Gamma')).toBeInTheDocument();
    expect(within(agenda).queryByText('Focus Alpha')).not.toBeInTheDocument();
    expect(within(agenda).queryByText('Plain Beta')).not.toBeInTheDocument();
  });

  it('omits the Due date and Repeat sections from the calendar header filter dropdown', () => {
    render(<CalendarView />);

    fireEvent.click(screen.getByRole('button', { name: t('common.filtersTooltip') }));

    expect(screen.queryByText(t('filters.dueDate'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('repeat.repeat'))).not.toBeInTheDocument();
    // Status sections still apply to the calendar model.
    expect(screen.getByText(t('dashboard.todoSprint'))).toBeInTheDocument();
  });
});

function calTask(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Task',
    status: 'todo',
    blocked: false,
    labels: [],
    flag: false,
    focus: false,
    createdAt: 1,
    dueDate: startOfToday(),
    showInCalendar: true,
    ...overrides,
  };
}