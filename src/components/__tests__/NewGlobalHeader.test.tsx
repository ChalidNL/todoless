import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewGlobalHeader } from '../shared/NewGlobalHeader';

// Mock the AppContext
const mockUseApp = vi.fn();
vi.mock('../../context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

const defaultMockContext = {
  users: [],
  labels: [],
  filters: [],
  items: [],
  shops: [],
  appSettings: {},
};

describe('NewGlobalHeader', () => {
  beforeEach(() => {
    mockUseApp.mockReturnValue(defaultMockContext);
    vi.clearAllMocks();
  });

  describe('Search functionality', () => {
    it('renders search input by default', () => {
      render(<NewGlobalHeader />);
      const searchInput = screen.getByPlaceholderText('Search...');
      expect(searchInput).toBeInTheDocument();
    });

    it('calls onSearch when input changes', () => {
      const onSearch = vi.fn();
      render(<NewGlobalHeader onSearch={onSearch} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      
      fireEvent.change(searchInput, { target: { value: 'test query' } });
      
      expect(onSearch).toHaveBeenCalledWith('test query');
    });

    it('uses custom placeholder when provided', () => {
      render(<NewGlobalHeader searchPlaceholder="Search tasks..." />);
      const searchInput = screen.getByPlaceholderText('Search tasks...');
      expect(searchInput).toBeInTheDocument();
    });

    it('hides search when showSearch is false', () => {
      render(<NewGlobalHeader showSearch={false} />);
      const searchInput = screen.queryByPlaceholderText('Search...');
      expect(searchInput).not.toBeInTheDocument();
    });
  });

  describe('Add button functionality', () => {
    it('renders add button by default', () => {
      render(<NewGlobalHeader />);
      const buttons = screen.getAllByRole('button');
      // Add button is the second button (after filter button)
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('calls onAdd with input value when add button is clicked', () => {
      const onAdd = vi.fn();
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1]; // Second button is add
      
      fireEvent.change(searchInput, { target: { value: 'New task' } });
      fireEvent.click(addButton);
      
      expect(onAdd).toHaveBeenCalledWith('New task', {});
    });

    it('calls onAdd when Enter key is pressed', () => {
      const onAdd = vi.fn();
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      
      fireEvent.change(searchInput, { target: { value: 'New task' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      
      expect(onAdd).toHaveBeenCalledWith('New task', {});
    });

    it('does not call onAdd when input is empty', () => {
      const onAdd = vi.fn();
      render(<NewGlobalHeader onAdd={onAdd} />);
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.click(addButton);
      
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('clears input after adding', () => {
      const onAdd = vi.fn();
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'New task' } });
      fireEvent.click(addButton);
      
      expect(searchInput).toHaveValue('');
    });

    it('hides add button when showAdd is false', () => {
      render(<NewGlobalHeader showAdd={false} />);
      const buttons = screen.getAllByRole('button');
      // Should only have filter button, no add button
      expect(buttons.length).toBe(1);
    });

    it('clears search after adding when onSearch is provided', () => {
      const onSearch = vi.fn();
      const onAdd = vi.fn();
      render(<NewGlobalHeader onSearch={onSearch} onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'New task' } });
      fireEvent.click(addButton);
      
      expect(onSearch).toHaveBeenLastCalledWith('');
    });
  });

  describe('Filter functionality', () => {
    it('renders filter button by default', () => {
      render(<NewGlobalHeader />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2); // filter + add
    });

    it('shows filter panel when filter button is clicked', () => {
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        labels: [{ id: 'label1', name: 'urgent', color: '#ff0000' }],
      });
      render(<NewGlobalHeader />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0]; // First button is filter
      
      fireEvent.click(filterButton);
      
      // Filter panel should appear
      expect(screen.getByText('Labels')).toBeInTheDocument();
    });

    it('hides filter panel when filter button is clicked again', () => {
      render(<NewGlobalHeader />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      
      fireEvent.click(filterButton); // Open
      fireEvent.click(filterButton); // Close
      
      expect(screen.queryByText('Labels')).not.toBeInTheDocument();
    });

    it('hides filters when showFilters is false', () => {
      render(<NewGlobalHeader showFilters={false} />);
      const buttons = screen.getAllByRole('button');
      // Should only have add button, no filter button
      expect(buttons.length).toBe(1);
    });

    it('calls onFilter with active filters when filters change', () => {
      const onFilter = vi.fn();
      render(<NewGlobalHeader onFilter={onFilter} type="task" />);
      
      // Open filter panel
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      // onFilter should be called on mount with default filters
      expect(onFilter).toHaveBeenCalled();
    });

    it('does not show Private quick filter button in filter panel', () => {
      render(<NewGlobalHeader onFilter={vi.fn()} type="task" />);

      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);

      expect(screen.queryByRole('button', { name: /^private$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument();
    });
  });

  describe('Type-specific functionality', () => {
    it('shows task-specific filters when type is task', () => {
      render(<NewGlobalHeader type="task" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    it('shows item-specific filters when type is item', () => {
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        items: [{ id: 'item1', name: 'Milk', category: 'Dairy', location: 'Fridge', completed: false, createdAt: Date.now() }],
      });
      render(<NewGlobalHeader type="item" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      expect(screen.getByText('Location')).toBeInTheDocument();
    });

    it('shows calendar-specific filters when type is calendar', () => {
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        users: [{ id: 'user1', name: 'John', email: 'john@example.com' }],
      });
      render(<NewGlobalHeader type="calendar" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      expect(screen.getByText('Assigned')).toBeInTheDocument();
      expect(screen.getByText('Recurring')).toBeInTheDocument();
    });
  });

  describe('Metadata parsing', () => {
    it('parses @me assignee when appSettings.currentUserId is set', () => {
      const onAdd = vi.fn();
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        appSettings: { currentUserId: 'user123' },
      });
      
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'Task @me' } });
      fireEvent.click(addButton);
      
      expect(onAdd).toHaveBeenCalledWith('Task', { assignee: 'user123' });
    });

    it('parses @user assignee when user exists', () => {
      const onAdd = vi.fn();
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        users: [{ id: 'user456', name: 'John', email: 'john@example.com' }],
      });
      
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'Task @John' } });
      fireEvent.click(addButton);
      
      expect(onAdd).toHaveBeenCalledWith('Task', { assignee: 'user456' });
    });

    it('parses #label when label exists', () => {
      const onAdd = vi.fn();
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        labels: [{ id: 'label1', name: 'urgent', color: '#ff0000' }],
      });
      
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'Task #urgent' } });
      fireEvent.click(addButton);
      
      expect(onAdd).toHaveBeenCalledWith('Task', { labels: ['label1'] });
    });

    it('parses //date for due date', () => {
      const onAdd = vi.fn();
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'Task //2025-12-31' } });
      fireEvent.click(addButton);
      
      const expectedDate = new Date('2025-12-31').getTime();
      expect(onAdd).toHaveBeenCalledWith('Task', { dueDate: expectedDate });
    });

    it('parses multiple metadata tokens together', () => {
      const onAdd = vi.fn();
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        appSettings: { currentUserId: 'user123' },
        labels: [{ id: 'label1', name: 'urgent', color: '#ff0000' }],
      });
      
      render(<NewGlobalHeader onAdd={onAdd} />);
      const searchInput = screen.getByPlaceholderText('Search...');
      const buttons = screen.getAllByRole('button');
      const addButton = buttons[1];
      
      fireEvent.change(searchInput, { target: { value: 'Buy groceries @me #urgent //2025-12-31' } });
      fireEvent.click(addButton);
      
      const expectedDate = new Date('2025-12-31').getTime();
      expect(onAdd).toHaveBeenCalledWith('Buy groceries', { 
        assignee: 'user123', 
        labels: ['label1'], 
        dueDate: expectedDate 
      });
    });
  });

  describe('Filter panel interactions', () => {
    it('toggles label filters in filter panel', () => {
      const onFilter = vi.fn();
      mockUseApp.mockReturnValue({
        ...defaultMockContext,
        labels: [
          { id: 'label1', name: 'urgent', color: '#ff0000' },
          { id: 'label2', name: 'bug', color: '#00ff00' },
        ],
      });
      
      render(<NewGlobalHeader onFilter={onFilter} type="task" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      // Click on first label
      const labelButtons = screen.getAllByText('urgent');
      fireEvent.click(labelButtons[0]);
      
      expect(onFilter).toHaveBeenCalled();
    });

    it('toggles status filters for tasks', () => {
      const onFilter = vi.fn();
      render(<NewGlobalHeader onFilter={onFilter} type="task" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      const statusButton = screen.getByText('todo');
      fireEvent.click(statusButton);
      
      expect(onFilter).toHaveBeenCalled();
    });

    it('toggles priority filters for tasks', () => {
      const onFilter = vi.fn();
      render(<NewGlobalHeader onFilter={onFilter} type="task" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      const priorityButton = screen.getByText('urgent');
      fireEvent.click(priorityButton);
      
      expect(onFilter).toHaveBeenCalled();
    });

    it('clears all filters when Clear All button is clicked', () => {
      const onFilter = vi.fn();
      render(<NewGlobalHeader onFilter={onFilter} type="task" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      // Set some filters
      const statusButton = screen.getByText('todo');
      fireEvent.click(statusButton);
      
      // Clear all
      const clearButton = screen.getByText('Clear All');
      fireEvent.click(clearButton);
      
      expect(onFilter).toHaveBeenCalled();
    });

    it('toggles completed filter', () => {
      const onFilter = vi.fn();
      render(<NewGlobalHeader onFilter={onFilter} type="task" />);
      const buttons = screen.getAllByRole('button');
      const filterButton = buttons[0];
      fireEvent.click(filterButton);
      
      const completedButton = screen.getByText('Completed');
      fireEvent.click(completedButton);
      
      expect(onFilter).toHaveBeenCalled();
    });
  });
});
