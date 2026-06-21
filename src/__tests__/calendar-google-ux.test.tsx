import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarView } from '../components/calendar/CalendarView';
import { Settings } from '../components/Settings';
import type { Task } from '../types';

const useAppMock = vi.fn();
const addTask = vi.fn();
const updateAppSettings = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, signOut: vi.fn() }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    getFamilyById: vi.fn().mockResolvedValue({ name: 'Family' }),
    login: vi.fn(),
    getApiTokens: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../lib/pocketbase', () => ({
  pb: { authStore: { token: 'token' } },
}));

vi.mock('../lib/app-update', () => ({
  fetchLatestAppVersion: vi.fn().mockResolvedValue(null),
  forceRefreshApp: vi.fn(),
  getNormalizedAppVersion: vi.fn().mockReturnValue('dev'),
  shouldShowUpdateButton: vi.fn().mockReturnValue(false),
}));

const baseAppValue = {
  tasks: [],
  addTask,
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  users: [{ id: 'user-1', email: 'me@example.com', name: 'Me', role: 'owner' }],
  labels: [],
  shops: [],
  filters: [],
  appSettings: { currentUserId: 'user-1', sprintStartDay: 1 },
  updateAppSettings,
  updateUser: vi.fn().mockResolvedValue(true),
  deleteUser: vi.fn().mockResolvedValue(true),
  addLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  addShop: vi.fn(),
  updateShop: vi.fn(),
  deleteShop: vi.fn(),
  deleteFilter: vi.fn(),
  swapEntity: vi.fn(),
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  isChipFilterActive: vi.fn().mockReturnValue(false),
  activeChipFilters: [],
  activeLabelFilters: [],
  addFilter: vi.fn(),
  refreshEntries: vi.fn(),
  showCompletionMessage: vi.fn(),
  moveTaskToStatus: vi.fn(),
};

describe('Calendar Google-inspired UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppMock.mockReturnValue(baseAppValue);
    vi.stubGlobal('__APP_VERSION__', 'dev');
    vi.stubGlobal('__APP_COMMIT__', 'local');
    vi.stubGlobal('__APP_BUILD_ID__', 'test');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  it('creates from the header input on Enter once and clears the bar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 10, 7, 0, 0));
    render(<CalendarView />);

    const search = screen.getByPlaceholderText('Search calendar…');
    fireEvent.change(search, { target: { value: 'Enter saved task' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(addTask).toHaveBeenCalledTimes(1);
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Enter saved task', showInCalendar: true }));
    expect(search).toHaveValue('');
    vi.useRealTimers();
  });

  it('orders and names views like Google, including 3 days and Schedule', () => {
    render(<CalendarView />);
    const options = within(screen.getByRole('combobox', { name: 'Calendar view' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Schedule', 'Day', '3 days', 'Week', 'Work week', 'Month']);
  });

  it('renders overlapping timed tasks side-by-side across the full day column with duration height', () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const taskA = task({ id: 'a', title: 'A', dueDate: start.getTime(), startTime: start.getTime(), endTime: start.getTime() + 2 * 3600000 });
    const taskB = task({ id: 'b', title: 'B', dueDate: start.getTime() + 30 * 60000, startTime: start.getTime() + 30 * 60000, endTime: start.getTime() + 90 * 60000 });
    useAppMock.mockReturnValue({ ...baseAppValue, tasks: [taskA, taskB] });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });

    const first = screen.getByTestId('calendar-timed-task-a');
    const second = screen.getByTestId('calendar-timed-task-b');
    expect(first).toHaveStyle({ width: '50%' });
    expect(second).toHaveStyle({ width: '50%' });
    expect(first).toHaveStyle({ height: '112px' });
    expect(within(first).getByText(/09:00/)).toBeInTheDocument();
  });

  it('uses the selected first day of week for week and month ranges', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 17, 12)); // Wednesday
    useAppMock.mockReturnValue({ ...baseAppValue, appSettings: { currentUserId: 'user-1', sprintStartDay: 0 } });
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'week' } });
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('Jun 14');

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    const headers = screen.getAllByTestId('calendar-month-weekday').map((node) => node.textContent);
    expect(headers[0]).toMatch(/Sun/i);
    vi.useRealTimers();
  });

  it('persists first day of week from Settings', () => {
    render(<Settings />);
    const select = screen.getByRole('combobox', { name: 'First day of week' });
    fireEvent.change(select, { target: { value: '0' } });
    expect(updateAppSettings).toHaveBeenCalledWith({ sprintStartDay: 0 });
  });
});

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Task',
    status: 'todo',
    blocked: false,
    labels: [],
    flag: false,
    createdAt: Date.now(),
    showInCalendar: true,
    ...overrides,
  };
}
