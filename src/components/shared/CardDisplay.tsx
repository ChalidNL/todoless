import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { TaskCard } from './TaskCard';
import { ItemCard } from './ItemCard';
import { ChevronDown, ChevronUp, CheckCircle, ShoppingCart, RotateCcw } from 'lucide-react';

export interface CardDisplayProps {
  /** Type of cards to display */
  type: 'task' | 'item';
  /** Whether to show completed/checked-out items in a collapsible section */
  showCompleted?: boolean;
  /** Maximum number of items to show in the active section before truncating */
  maxActive?: number;
  /** Compact mode — less padding, smaller elements */
  compact?: boolean;
  /** Optional filter function applied before grouping */
  filterFn?: (item: any) => boolean;
  /** Custom empty state message */
  emptyMessage?: string;
}

/**
 * CardDisplay — container component that displays task or item cards grouped by status.
 * 
 * Shows active (incomplete) cards first, then a collapsible "Checked Out" section
 * for completed cards. Displays count badges for each section.
 * 
 * Usage:
 * <CardDisplay type="task" showCompleted={true} />
 * <CardDisplay type="item" compact={true} />
 */
export const CardDisplay = ({
  type,
  showCompleted = true,
  maxActive,
  compact = false,
  filterFn,
  emptyMessage,
}: CardDisplayProps) => {
  const {
    tasks, items,
    uncheckAllDoneTasks, uncheckAllDoneItems,
    showCompletionMessage,
  } = useApp();

  const [showCheckedOut, setShowCheckedOut] = useState(false);

  // Filter and group data based on type
  const { activeList, checkedOutList, totalCount } = useMemo(() => {
    if (type === 'task') {
      let filtered: Task[] = tasks;
      if (filterFn) {
        filtered = tasks.filter(filterFn) as Task[];
      }
      const active = filtered.filter(t => t.status !== 'done');
      const checkedOut = filtered.filter(t => t.status === 'done');
      return { activeList: active, checkedOutList: checkedOut, totalCount: filtered.length };
    } else {
      let filtered: Item[] = items;
      if (filterFn) {
        filtered = items.filter(filterFn) as Item[];
      }
      const active = filtered.filter(i => !i.completed);
      const checkedOut = filtered.filter(i => i.completed);
      return { activeList: active, checkedOutList: checkedOut, totalCount: filtered.length };
    }
  }, [type, tasks, items, filterFn]);

  const displayActive = maxActive ? activeList.slice(0, maxActive) : activeList;
  const hasMore = maxActive ? activeList.length > maxActive : false;

  const emptyMsg = emptyMessage || (type === 'task' ? 'No tasks found' : 'No items found');

  const handleCheckInAll = () => {
    if (type === 'task') {
      uncheckAllDoneTasks();
    } else {
      uncheckAllDoneItems();
    }
    showCompletionMessage('All checked back in');
  };

  if (totalCount === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-400 text-sm">{emptyMsg}</p>
      </div>
    );
  }

  return (
    <div data-testid={`card-display-${type}`}>
      {/* Active cards section */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
            {type === 'task'
              ? <CheckCircle className="w-4 h-4 text-blue-500" />
              : <ShoppingCart className="w-4 h-4 text-green-500" />
            }
            Active ({activeList.length})
          </h2>
          {hasMore && (
            <span className="text-xs text-neutral-400">
              Showing {maxActive} of {activeList.length}
            </span>
          )}
        </div>

        {activeList.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-400 text-sm">{emptyMsg}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayActive.map((item) => (
              type === 'task'
                ? <TaskCard key={item.id} task={item} compact={compact} />
                : <ItemCard key={item.id} item={item} compact={compact} />
            ))}
          </div>
        )}
      </div>

      {/* Checked Out section (collapsible) */}
      {showCompleted && checkedOutList.length > 0 && (
        <div className="border-t border-neutral-200 pt-4 mt-4">
          <div className="flex items-center justify-between w-full px-1 mb-2">
            <button
              onClick={() => setShowCheckedOut(!showCheckedOut)}
              className="flex items-center gap-2"
            >
              <h2 className="text-sm font-semibold text-neutral-700">
                Checked Out ({checkedOutList.length})
              </h2>
              {showCheckedOut
                ? <ChevronUp className="w-4 h-4 text-neutral-500" />
                : <ChevronDown className="w-4 h-4 text-neutral-500" />
              }
            </button>

            <button
              onClick={handleCheckInAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
              title="Check in all"
            >
              <RotateCcw className="w-3 h-3" />
              Check In All
            </button>
          </div>

          {showCheckedOut && (
            <div className="space-y-2">
              {checkedOutList.map((item) => (
                type === 'task'
                  ? <TaskCard key={item.id} task={item} compact={compact} showCheckbox={false} />
                  : <ItemCard key={item.id} item={item} compact={compact} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * CardCount — simple badge showing the count of a card type.
 * Useful for dashboard stats or tab headers.
 */
export const CardCount = ({ type, count }: { type: 'task' | 'item'; count: number }) => {
  const icon = type === 'task'
    ? <CheckCircle className="w-4 h-4 text-blue-500" />
    : <ShoppingCart className="w-4 h-4 text-green-500" />;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-neutral-200 text-sm">
      {icon}
      <span className="font-semibold">{count}</span>
      <span className="text-neutral-500">{type === 'task' ? 'tasks' : 'items'}</span>
    </span>
  );
};
