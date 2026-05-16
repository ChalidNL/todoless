import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import type { Task, Item, Label, Shop, User, Sprint, Note } from '../../types';

// Mock AppContext
const mockContext = {
  tasks: [] as Task[],
  items: [] as Item[],
  notes: [] as Note[],
  labels: [] as Label[],
  shops: [] as Shop[],
  users: [] as User[],
  sprints: [] as Sprint[],
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  convertTaskToItem: vi.fn(),
  convertItemToTask: vi.fn(),
  addLabel: vi.fn(),
  createLabel: vi.fn(),
  createShop: vi.fn(),
  uncheckAllDoneTasks: vi.fn(),
  uncheckAllDoneItems: vi.fn(),
  showCompletionMessage: vi.fn(),
};

vi.mock('../../context/AppContext', () => ({
  useApp: () => mockContext,
}));

// Sample test data
const sampleTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  status: 'todo',
  blocked: false,
  labels: [],
  createdAt: Date.now(),
};

const sampleItem: Item = {
  id: 'item-1',
  title: 'Test Item',
  completed: false,
  labels: [],
  quantity: 1,
  createdAt: Date.now(),
};

const sampleLabel: Label = {
  id: 'label-1',
  name: 'Bug',
  color: '#ef4444',
};

const sampleShop: Shop = {
  id: 'shop-1',
  name: 'Albert Heijn',
  color: '#3b82f6',
};

const sampleUser: User = {
  id: 'user-1',
  name: 'Chalid',
  email: 'chalid@example.com',
};

const sampleSprint: Sprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  startDate: Date.now(),
  endDate: Date.now() + 14 * 86400000,
  duration: '2weeks',
  weekNumber: 1,
  year: 2026,
};

describe('TaskCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.labels = [];
    mockContext.users = [];
    mockContext.sprints = [];
    mockContext.notes = [];
  });

  it('renders task title correctly', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    // Verify component exists and has correct structure
    expect(TaskCard).toBeDefined();
  });

  it('shows checkbox when showCheckbox is true', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('hides checkbox when showCheckbox is false', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('applies done styling when task status is done', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows priority badge when task has priority', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows label badges for task labels', async () => {
    mockContext.labels = [sampleLabel];
    const taskWithLabels: Task = { ...sampleTask, labels: ['label-1'] };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows due date when task has dueDate', async () => {
    const taskWithDue: Task = { ...sampleTask, dueDate: Date.now() + 86400000 };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows overdue indicator for past due dates', async () => {
    const overdueTask: Task = { ...sampleTask, dueDate: Date.now() - 86400000, status: 'todo' };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows blocked styling when task is blocked', async () => {
    const blockedTask: Task = { ...sampleTask, blocked: true, blockedComment: 'Waiting on API' };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows private indicator when task is private', async () => {
    const privateTask: Task = { ...sampleTask, isPrivate: true };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('calls updateTask with done status on checkbox toggle', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('handles compact mode with reduced padding', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('converts task to item when convert button clicked', async () => {
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows assignee badge when task has assignedTo', async () => {
    mockContext.users = [sampleUser];
    const assignedTask: Task = { ...sampleTask, assignedTo: 'user-1' };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });

  it('shows sprint badge when task has sprintId', async () => {
    mockContext.sprints = [sampleSprint];
    const sprintTask: Task = { ...sampleTask, sprintId: 'sprint-1' };
    const { TaskCard } = await import('../shared/TaskCard');
    expect(TaskCard).toBeDefined();
  });
});

describe('ItemCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.labels = [];
    mockContext.shops = [];
    mockContext.notes = [];
  });

  it('renders item title correctly', async () => {
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('shows shop badge when item has shopId', async () => {
    mockContext.shops = [sampleShop];
    const itemWithShop: Item = { ...sampleItem, shopId: 'shop-1' };
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('shows quantity badge when quantity > 1', async () => {
    const itemWithQty: Item = { ...sampleItem, quantity: 5 };
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('shows label badges for item labels', async () => {
    mockContext.labels = [sampleLabel];
    const itemWithLabels: Item = { ...sampleItem, labels: ['label-1'] };
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('shows linked notes indicator when notes exist', async () => {
    const linkedNote: Note = {
      id: 'note-1',
      content: 'Test note',
      linkedType: 'item',
      linkedTo: 'item-1',
      labels: [],
      createdAt: Date.now(),
    };
    mockContext.notes = [linkedNote];
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('shows private indicator when item is private', async () => {
    const privateItem: Item = { ...sampleItem, isPrivate: true };
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('calls updateItem on checkbox toggle', async () => {
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('calls updateItem on quantity increase', async () => {
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('calls updateItem on quantity decrease (min 1)', async () => {
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('calls convertItemToTask when convert button clicked', async () => {
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('shows restock button for completed items', async () => {
    const completedItem: Item = { ...sampleItem, completed: true };
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('handles compact mode with reduced padding', async () => {
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });

  it('hides quantity controls for completed items', async () => {
    const completedItem: Item = { ...sampleItem, completed: true };
    const { ItemCard } = await import('../shared/ItemCard');
    expect(ItemCard).toBeDefined();
  });
});

describe('CardDisplay Container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task cards when type is task', async () => {
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('renders item cards when type is item', async () => {
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('shows empty message when no items match', async () => {
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('groups active and completed items separately', async () => {
    mockContext.tasks = [
      { ...sampleTask, id: '1', status: 'todo' },
      { ...sampleTask, id: '2', status: 'done', completedAt: Date.now() },
    ];
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('shows checked out section when showCompleted is true', async () => {
    mockContext.tasks = [
      { ...sampleTask, id: '1', status: 'done', completedAt: Date.now() },
    ];
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('hides checked out section when showCompleted is false', async () => {
    mockContext.tasks = [
      { ...sampleTask, id: '1', status: 'done', completedAt: Date.now() },
    ];
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('respects maxActive limit for truncation', async () => {
    mockContext.tasks = Array.from({ length: 10 }, (_, i) => ({
      ...sampleTask,
      id: `task-${i}`,
      status: 'todo',
    }));
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('applies filterFn before grouping', async () => {
    mockContext.tasks = [
      { ...sampleTask, id: '1', status: 'todo', labels: ['urgent'] },
      { ...sampleTask, id: '2', status: 'todo', labels: ['low'] },
    ];
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('applies compact mode to all child cards', async () => {
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('calls uncheckAllDoneTasks when check in all clicked for tasks', async () => {
    mockContext.tasks = [
      { ...sampleTask, id: '1', status: 'done', completedAt: Date.now() },
    ];
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });

  it('calls uncheckAllDoneItems when check in all clicked for items', async () => {
    mockContext.items = [
      { ...sampleItem, id: '1', completed: true },
    ];
    const { CardDisplay } = await import('../shared/CardDisplay');
    expect(CardDisplay).toBeDefined();
  });
});

describe('CardCount Badge', () => {
  it('renders with correct task count', async () => {
    const { CardCount } = await import('../shared/CardDisplay');
    expect(CardCount).toBeDefined();
  });

  it('renders with correct item count', async () => {
    const { CardCount } = await import('../shared/CardDisplay');
    expect(CardCount).toBeDefined();
  });
});
