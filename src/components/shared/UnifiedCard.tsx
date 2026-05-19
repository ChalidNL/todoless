import React, { useState } from 'react';
import { Task, Item, userDisplayName } from '../../types';
import { useApp } from '../../context/AppContext';
import { Check, Menu, X, Trash2, Tag, User, CalendarDays, Flag, ShoppingCart } from 'lucide-react';
import { LabelBadge } from './LabelBadge';
import { AttributeChip } from './AttributeChip';
import { entityColor, entityBg } from '../../lib/entity-colors';

interface UnifiedCardProps {
  entity: Task | Item;
  type: 'task' | 'item';
}

type UnifiedEditor = 'labels' | 'assignee' | 'schedule' | 'shop' | null;

export const UnifiedCard = ({ entity, type }: UnifiedCardProps) => {
  const { updateTask, updateItem, deleteTask, deleteItem, labels, users, shops, addLabel, addShop, isChipFilterActive } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<UnifiedEditor>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [shopInput, setShopInput] = useState('');

  const isTask = type === 'task';
  const task = isTask ? (entity as Task) : null;
  const item = !isTask ? (entity as Item) : null;

  const isDone = isTask ? task!.status === 'done' : item!.completed;
  const isTaskFlagged = isTask && task!.flag && !isDone;
  const isOverdue = !!entity.dueDate && entity.dueDate < Date.now() && !isDone;
  const quantity = item?.quantity ?? 1;
  const currentShop = item?.shopId ? shops.find(s => s.id === item.shopId) : null;
  const assignedUser = entity.assignedTo ? users.find(u => u.id === entity.assignedTo) : null;
  const dateStr = entity.dueDate ? new Date(entity.dueDate).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }) : null;

  const handleToggle = () => {
    if (isTask) {
      updateTask(entity.id, task!.status === 'done' ? { status: 'todo', completedAt: undefined } : { status: 'done', completedAt: Date.now() });
    } else {
      updateItem(entity.id, { completed: !item!.completed });
    }
  };

  const handleDelete = () => {
    if (isTask) deleteTask(entity.id);
    else deleteItem(entity.id);
  };

  const setValue = (val: Record<string, unknown>) => {
    if (isTask) updateTask(entity.id, val);
    else updateItem(entity.id, val);
  };

  const handleToggleFlag = () => {
    if (isTask) updateTask(entity.id, { flag: !task!.flag, blocked: !task!.flag });
  };

  const setQuantity = (next: number) => {
    if (item) updateItem(item.id, { quantity: Math.max(0, next) });
  };

  const isShopFiltered = (id?: string) => id ? isChipFilterActive('shop', id) : false;

  const hasLabels = entity.labels.length > 0;
  const hasAssignee = !!entity.assignedTo;
  const hasShop = !!currentShop;

  const visibleShops = shops.filter((shop) => shop.name.toLowerCase().includes(shopInput.toLowerCase()));

  return (
    <div className={`rounded-lg border transition-colors ${""}
      isDone ? 'border-neutral-200 opacity-75' : 'border-neutral-200 hover:border-neutral-300'
    } ${""}
      isTaskFlagged ? '!bg-red-50' : isOverdue ? '!bg-orange-50' : 'bg-white'
    }`}>
      <div className="p-2.5">
        {/* Line 1: checkbox + title + badge(s) + hamburger */}
        <div className="flex items-center gap-2">
          {/* Checkbox (button) */}
          <button
            onClick={handleToggle}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isDone
                ? 'bg-neutral-900 border-neutral-900 text-white'
                : 'border-neutral-300 hover:border-neutral-500'
            }`}
            aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
          >
            {isDone && <Check className="w-3 h-3" />}
          </button>

          {/* Title */}
          {showMenu ? (
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                const trimmed = titleDraft.trim();
                if (trimmed && trimmed !== entity.title) {
                  setValue({ title: trimmed });
                } else if (!trimmed) {
                  setTitleDraft(entity.title);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  setTitleDraft(entity.title);
                }
              }}
              autoFocus
              className={`text-sm font-medium flex-1 min-w-0 px-1.5 py-0.5 border border-neutral-300 rounded bg-white ${
                isDone ? 'line-through text-neutral-400' : 'text-neutral-900'
              }`}
              aria-label="Edit title"
            />
          ) : (
          <span className={`text-sm font-medium flex-1 truncate ${
            isDone ? 'line-through text-neutral-400' : 'text-neutral-900'
          }`}>
            {entity.title}
          </span>
          )}

          {/* Flag badge (tasks) */}
          {isTask && task!.flag && (
            <Flag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          )}

          {/* Due date badge */}
          {dateStr && !isDone && (
            <span className="text-[11px] text-neutral-500 border border-neutral-200 rounded px-1.5 py-0.5 flex-shrink-0">
              {dateStr}
            </span>
          )}

          {/* Quantity [+][-] controls (items) — replaces static badge */}
          {!isTask && !isDone && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setQuantity(quantity - 1)}
                className="w-6 h-6 text-xs border border-neutral-200 rounded hover:bg-neutral-50 text-neutral-700"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="text-xs font-medium text-neutral-600 border border-neutral-200 rounded px-2 py-0.5 min-w-[28px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-6 h-6 text-xs border border-neutral-200 rounded hover:bg-neutral-50 text-neutral-700"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => {
              setShowMenu(!showMenu);
              setActiveEditor(!showMenu ? activeEditor : null);
              if (!showMenu) setTitleDraft(entity.title);
            }}
            className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
            aria-label="Open attributes"
          >
            {showMenu ? <X className="w-4 h-4 text-neutral-600" /> : <Menu className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>

        {/* Chip row — labels + assignee + shop */}
        {(hasLabels || assignedUser || hasShop) && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-7">
            {entity.labels.map(labelId => {
              const label = labels.find(l => l.id === labelId);
              return label ? <LabelBadge key={label.id} label={label} size="sm" /> : null;
            })}
            {assignedUser && (
              <span className="chip" style={{ backgroundColor: entityBg(assignedUser.id), color: entityColor(assignedUser.id) }}>
                <User className="w-3 h-3" strokeWidth={2} />
                {assignedUser.firstName || ''}
              </span>
            )}
            {currentShop && (
              <AttributeChip
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
                label={currentShop.name}
                color="#10b981"
                active={isShopFiltered(currentShop.id)}
                onClick={showMenu ? () => setValue({ shopId: null }) : () => setActiveEditor('shop')}
              />
            )}
          </div>
        )}

        {/* Line 2: attributes behind hamburger */}
        {showMenu && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            {/* Attribute buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                className={`p-1.5 rounded transition-colors ${activeEditor === 'labels' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="#label"
                aria-label="Edit labels"
              >
                <Tag className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setActiveEditor(activeEditor === 'assignee' ? null : 'assignee')}
                className={`p-1.5 rounded transition-colors ${activeEditor === 'assignee' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="@assignee"
                aria-label="Edit assignee"
              >
                <User className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setActiveEditor(activeEditor === 'schedule' ? null : 'schedule')}
                className={`p-1.5 rounded transition-colors ${activeEditor === 'schedule' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="//schedule"
                aria-label="Edit schedule"
              >
                <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
              </button>
              {isTask && (
                <button
                  onClick={handleToggleFlag}
                  className={`p-1.5 rounded transition-colors ${task!.flag ? 'bg-red-200 text-red-700' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="flag"
                  aria-label="Toggle flag"
                >
                  <Flag className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {!isTask && (
                <button
                  onClick={() => {
                    const next = activeEditor === 'shop' ? null : 'shop';
                    setActiveEditor(next);
                    if (next) setShopInput('');
                  }}
                  className={`p-1.5 rounded transition-colors ${hasShop || activeEditor === 'shop' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="$shop"
                  aria-label="Edit shop"
                >
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={handleDelete}
                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                title="delete"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Label editor */}
            {activeEditor === 'labels' && (
              <div className="mt-2 p-2 bg-neutral-50 rounded space-y-1.5">
                <input
                  type="text"
                  onChange={(e) => {
                    const name = e.target.value.trim();
                    if (!name) return;
                    const existing = labels.find(l => l.name.toLowerCase() === name.toLowerCase());
                    if (existing) {
                      if (!entity.labels.includes(existing.id)) {
                        setValue({ labels: [...entity.labels, existing.id] });
                      }
                    } else {
                      addLabel({ name, color: '#3b82f6' });
                    }
                    e.target.value = '';
                  }}
                  placeholder="Type label + Enter..."
                  className="w-full text-sm px-2 py-1.5 border border-neutral-200 rounded"
                  aria-label="Label input"
                />
                <div className="flex flex-wrap gap-1">
                  {labels.map(label => (
                    <button
                      key={label.id}
                      onClick={() => {
                        const has = entity.labels.includes(label.id);
                        setValue({ labels: has ? entity.labels.filter(id => id !== label.id) : [...entity.labels, label.id] });
                      }}
                      className={entity.labels.includes(label.id) ? 'ring-2 ring-neutral-900 rounded' : ''}
                    >
                      <LabelBadge label={label} size="sm" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule editor */}
            {activeEditor === 'schedule' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={entity.dueDate ? new Date(entity.dueDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => setValue({ dueDate: e.target.value ? new Date(e.target.value).getTime() : null })}
                  className="text-sm px-2 py-1.5 border border-neutral-200 rounded flex-1"
                  aria-label="Due date"
                />
                <input
                  type="time"
                  value={entity.dueDate ? new Date(entity.dueDate).toTimeString().slice(0, 5) : ''}
                  onChange={(e) => {
                    const dateVal = entity.dueDate ? new Date(entity.dueDate).toISOString().slice(0, 10) : '';
                    if (!dateVal) return;
                    setValue({ dueDate: new Date(`${dateVal}T${e.target.value || '00:00'}:00`).getTime() });
                  }}
                  className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                  aria-label="Due time"
                />
              </div>
            )}

            {/* Assignee editor */}
            {activeEditor === 'assignee' && (
              <div className="mt-2 relative">
                <input
                  type="text"
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    const match = users.find(u => userDisplayName(u).toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
                    if (match && e.target.value.length > 0) {
                      setValue({ assignedTo: match.id });
                      setActiveEditor(null);
                    }
                    if (!e.target.value) {
                      setValue({ assignedTo: null });
                    }
                  }}
                  placeholder="Search team..."
                  className="w-full text-sm px-2 py-1.5 border border-neutral-200 rounded"
                  aria-label="Search assignee"
                />
              </div>
            )}

            {/* Shop editor (items only) — text-input-first like GroceryCard */}
            {activeEditor === 'shop' && !isTask && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = shopInput.trim();
                        if (!name) return;
                        const existing = shops.find((s) => s.name.toLowerCase() === name.toLowerCase());
                        if (existing) {
                          setValue({ shopId: existing.id });
                        } else {
                          addShop({ name, color: '#10b981' });
                        }
                        setShopInput('');
                      }
                    }}
                    placeholder="Type shop + Enter..."
                    className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                    aria-label="Shop input"
                  />
                  {hasShop && (
                    <button
                      onClick={() => setValue({ shopId: null })}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                      aria-label="Clear shop"
                      title="Clear shop"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {visibleShops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => setValue({ shopId: item!.shopId === shop.id ? null : shop.id })}
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border ${
                          item!.shopId === shop.id ? 'ring-2 ring-neutral-900' : 'hover:border-neutral-400'
                        }`}
                        style={{
                          backgroundColor: item!.shopId === shop.id ? `${shop.color || '#10b981'}20` : undefined,
                          color: item!.shopId === shop.id ? shop.color || '#10b981' : undefined,
                          borderColor: item!.shopId === shop.id ? `${shop.color || '#10b981'}40` : '#e5e7eb',
                        }}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {shop.name}
                      </span>
                    </button>
                  ))}
                  {visibleShops.length === 0 && (
                    <p className="text-xs text-neutral-400 italic">No shops found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
