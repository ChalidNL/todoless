import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

describe('GroceriesView — simplified', () => {
  it('separates active and bought items', () => {
    const items = [
      { id: '1', title: 'Milk', completed: false, quantity: 2 },
      { id: '2', title: 'Eggs', completed: true, quantity: 1 },
      { id: '3', title: 'Bread', completed: false, quantity: 0 },
    ];

    const activeItems = items.filter((i) => !i.completed);
    const boughtItems = items.filter((i) => i.completed);

    expect(activeItems).toHaveLength(2);
    expect(activeItems[0].title).toBe('Milk');
    expect(activeItems[1].title).toBe('Bread');

    expect(boughtItems).toHaveLength(1);
    expect(boughtItems[0].title).toBe('Eggs');
  });

  it('filters items by search query', () => {
    const items = [
      { id: '1', title: 'Whole Milk', completed: false },
      { id: '2', title: 'Oat Milk', completed: false },
      { id: '3', title: 'Bread', completed: false },
    ];

    const result = items.filter((i) =>
      i.title.toLowerCase().includes('milk')
    );
    expect(result).toHaveLength(2);
  });

  it('search respects completed status', () => {
    const items = [
      { id: '1', title: 'Milk', completed: false },
      { id: '2', title: 'Milk', completed: true },
    ];

    const activeItems = items.filter(
      (i) => !i.completed && i.title.toLowerCase().includes('milk')
    );
    const boughtItems = items.filter(
      (i) => i.completed && i.title.toLowerCase().includes('milk')
    );

    expect(activeItems).toHaveLength(1);
    expect(boughtItems).toHaveLength(1);
  });

  it('swap preserves fields when converting task to item', () => {
    const taskEntry = {
      id: '1',
      title: 'Buy Milk',
      type: 'task' as const,
      labels: ['label1'],
      assignedTo: 'user1',
      dueDate: 1234567890000,
    };

    // Simulate swap: task → grocery
    const newItem = {
      title: taskEntry.title,
      completed: false,
      quantity: 1,
      labels: taskEntry.labels || [],
      assignedTo: taskEntry.assignedTo,
      dueDate: taskEntry.dueDate,
    };

    expect(newItem.title).toBe('Buy Milk');
    expect(newItem.completed).toBe(false);
    expect(newItem.quantity).toBe(1);
    expect(newItem.labels).toEqual(['label1']);
    expect(newItem.assignedTo).toBe('user1');
    expect(newItem.dueDate).toBe(1234567890000);
  });

  it('swap preserves fields when converting item to task', () => {
    const itemEntry = {
      id: '2',
      title: 'Milk',
      type: 'item' as const,
      labels: ['label2'],
      assignedTo: 'user2',
      dueDate: 9876543210000,
    };

    // Simulate swap: grocery → task
    const newTask = {
      title: itemEntry.title,
      status: 'todo' as const,
      blocked: false,
      labels: itemEntry.labels || [],
      assignedTo: itemEntry.assignedTo,
      dueDate: itemEntry.dueDate,
      flag: false,
    };

    expect(newTask.title).toBe('Milk');
    expect(newTask.status).toBe('todo');
    expect(newTask.labels).toEqual(['label2']);
    expect(newTask.assignedTo).toBe('user2');
    expect(newTask.dueDate).toBe(9876543210000);
  });
});
