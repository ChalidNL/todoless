import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InboxBacklog } from '../components/InboxBacklog';
import { t } from '../i18n/translations';
import type { Task } from '../types';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

// The REAL AppHeader is used (sort select stays reachable via the shared
// header) and the REAL CompactTaskCard exposes data-testid="compact-task-card-<id>"
// on its root. No router wrapper: TaskCard has no Link (same as
// inbox-stat-cards.test.tsx).
const baseAppValue = {
  labels: [],
  users: [],
  reminders: [],
  appSettings: {},
  tasks: [] as Task[],
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
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

// Visible order = DOM order of the compact-task-card roots, mapped back to
// titles via the fixture table (immune to non-title chrome inside the card).
const orderedTitles = (container: HTMLElement, titlesById: Record<string, string>): string[] =>
  [...container.querySelectorAll('[data-testid^="compact-task-card-"]')].map((el) => {
    const id = (el.getAttribute('data-testid') ?? '').replace('compact-task-card-', '');
    return titlesById[id] ?? (el.textContent ?? '').trim();
  });

const pickSort = (value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: t('common.sort') }), { target: { value } });

const alphaFixture: Record<string, string> = {
  zebra: 'Zebra',
  apple: 'apple',
  mango: 'Mango',
};

describe('InboxBacklog sort modes (via the shared AppHeader sort select)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('sorts backlog tasks A->Z (case-insensitive) by default', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [
        task({ id: 'zebra', title: 'Zebra', createdAt: 3000 }),
        task({ id: 'apple', title: 'apple', createdAt: 1000 }),
        task({ id: 'mango', title: 'Mango', createdAt: 2000 }),
      ],
    });

    const { container } = render(<InboxBacklog />);

    expect(orderedTitles(container, alphaFixture)).toStrictEqual(['apple', 'Mango', 'Zebra']);
  });

  it('sorts Z->A when alphaDesc is selected', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [
        task({ id: 'zebra', title: 'Zebra', createdAt: 3000 }),
        task({ id: 'apple', title: 'apple', createdAt: 1000 }),
        task({ id: 'mango', title: 'Mango', createdAt: 2000 }),
      ],
    });

    const { container } = render(<InboxBacklog />);
    pickSort('alphaDesc');

    expect(orderedTitles(container, alphaFixture)).toStrictEqual(['Zebra', 'Mango', 'apple']);
  });

  it('sorts newest first by createdAt desc, oldest first by createdAt asc, when selected', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [
        task({ id: 'zebra', title: 'Zebra', createdAt: 3000 }),
        task({ id: 'apple', title: 'apple', createdAt: 1000 }),
        task({ id: 'mango', title: 'Mango', createdAt: 2000 }),
      ],
    });

    const { container } = render(<InboxBacklog />);

    pickSort('newest');
    expect(orderedTitles(container, alphaFixture)).toStrictEqual(['Zebra', 'Mango', 'apple']);

    pickSort('oldest');
    expect(orderedTitles(container, alphaFixture)).toStrictEqual(['apple', 'Mango', 'Zebra']);
  });

  it('reduces with a status chip filter first, then sorts the filtered set (filter ≠ sort)', () => {
    const titles: Record<string, string> = { ...alphaFixture, 'todo-a': 'Aardvark', 'todo-z': 'Zulu todo' };
    useAppMock.mockReturnValue({
      ...baseAppValue,
      activeChipFilters: [{ type: 'status', id: 'todo', label: t('dashboard.todoSprint'), color: '#16a34a' }],
      tasks: [
        task({ id: 'zebra', title: 'Zebra', createdAt: 3000 }),
        task({ id: 'apple', title: 'apple', createdAt: 1000 }),
        task({ id: 'mango', title: 'Mango', createdAt: 2000 }),
        task({ id: 'todo-a', title: 'Aardvark', status: 'todo', createdAt: 4000 }),
        task({ id: 'todo-z', title: 'Zulu todo', status: 'todo', createdAt: 5000 }),
      ],
    });

    const { container } = render(<InboxBacklog />);

    // Status chip reduces to the todo set; the default sort orders THAT set.
    expect(orderedTitles(container, titles)).toStrictEqual(['Aardvark', 'Zulu todo']);

    pickSort('alphaDesc');
    expect(orderedTitles(container, titles)).toStrictEqual(['Zulu todo', 'Aardvark']);
  });

  it('reduces with the search query first, then sorts the remaining set', () => {
    const titles: Record<string, string> = { ...alphaFixture, 'todo-a': 'Aardvark', 'todo-z': 'Zulu todo' };
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [
        task({ id: 'zebra', title: 'Zebra', createdAt: 3000 }),
        task({ id: 'apple', title: 'apple', createdAt: 1000 }),
        task({ id: 'mango', title: 'Mango', createdAt: 2000 }),
        task({ id: 'todo-a', title: 'Aardvark', createdAt: 4000 }),
        task({ id: 'todo-z', title: 'Zulu todo', createdAt: 5000 }),
      ],
    });

    const { container } = render(<InboxBacklog />);

    pickSort('alphaDesc');
    fireEvent.change(screen.getByPlaceholderText(t('inbox.searchPlaceholder')), { target: { value: 'Z' } });

    // Search first removes apple/Mango/Aardvark; only Zebra + Zulu todo
    // remain, and the alphaDesc sort orders THAT reduced set.
    expect(orderedTitles(container, titles)).toStrictEqual(['Zulu todo', 'Zebra']);
  });

  it('sorts by priority (high→medium→low, none last) then title when priority is selected', () => {
    const titles: Record<string, string> = { lowA: 'Alpha low', highZ: 'Zulu high' };
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [
        task({ id: 'lowA', title: 'Alpha low', priority: 'low', createdAt: 1000 }),
        task({ id: 'highZ', title: 'Zulu high', priority: 'high', createdAt: 2000 }),
        task({ id: 'mango', title: 'Mango', createdAt: 3000 }),
      ],
    });

    const { container } = render(<InboxBacklog />);
    pickSort('priority');

    // Priority groups first (high before low); tasks without a priority fall
    // to the end, and equal-priority/no-priority items keep title order.
    expect(orderedTitles(container, titles)).toStrictEqual(['Zulu high', 'Alpha low', 'Mango']);
  });
});

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Task',
    status: 'backlog',
    blocked: false,
    labels: [],
    flag: false,
    priority: undefined,
    createdAt: Date.now(),
    showInCalendar: false,
    ...overrides,
  };
}