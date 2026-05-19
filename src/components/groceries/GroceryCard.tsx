import React, { useState } from 'react';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { AttributeChip } from '../shared/AttributeChip';
import { Check, Menu, X, Trash2, ShoppingCart, Hash, User, CalendarDays } from 'lucide-react';

interface GroceryCardProps {
  item: Item;
}

type GroceryEditor = 'shop' | 'quantity' | 'assignee' | 'schedule' | null;

const DeleteConfirm = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
    <div className="bg-white rounded-lg shadow-xl p-5 mx-4 max-w-xs w-full">
      <p className="text-sm font-medium text-neutral-900 mb-4">Weet je het zeker?</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
        >
          Nee
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          Ja, verwijderen
        </button>
      </div>
    </div>
  </div>
);

export const GroceryCard = ({ item }: GroceryCardProps) => {
  const { updateItem, deleteItem, shops, users, isChipFilterActive } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<GroceryEditor>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const quantity = item.quantity ?? 1;
  const currentShop = item.shopId ? shops.find((s) => s.id === item.shopId) : null;
  const assignedUser = item.assignedTo ? users.find((u) => u.id === item.assignedTo) : null;
  const dateStr = item.dueDate
    ? new Date(item.dueDate).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' })
    : null;

  const handleToggle = () => {
    updateItem(item.id, { completed: !item.completed });
  };

  const setQuantity = (next: number) => {
    updateItem(item.id, { quantity: Math.max(0, next) });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteItem(item.id);
    setShowMenu(false);
    setActiveEditor(null);
  };

  const hasShop = !!item.shopId;
  const hasAssignee = !!item.assignedTo;
  const hasSchedule = !!item.dueDate;
  const dateValue = item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '';
  const timeValue = item.dueDate ? new Date(item.dueDate).toTimeString().slice(0, 5) : '';
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  const isShopFiltered = (id?: string) => id ? isChipFilterActive('shop', id) : false;
  const isAssigneeFiltered = (id?: string) => id ? isChipFilterActive('assignee', id) : false;
  const isDateFiltered = (ds: string) => isChipFilterActive('date', ds);

  return (
    <>
      <div
        className={`rounded-lg border transition-colors ${
          item.completed ? 'border-neutral-200 opacity-75' : 'border-neutral-200 hover:border-neutral-300'
        } bg-white`}
      >
        <div className="p-2.5">
          {/* Layer 1: checkbox + description + hamburger */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                item.completed
                  ? 'bg-neutral-900 border-neutral-900 text-white'
                  : 'border-neutral-300 hover:border-neutral-500'
              }`}
              aria-label={item.completed ? 'Mark as not bought' : 'Mark as bought'}
            >
              {item.completed && <Check className="w-3 h-3" />}
            </button>

            <span
              className={`text-sm font-medium flex-1 truncate ${
                item.completed ? 'line-through text-neutral-400' : 'text-neutral-900'
              }`}
            >
              {item.title}
            </span>

            <span className="text-xs font-medium text-neutral-600 border border-neutral-200 rounded px-2 py-0.5">
              {quantity}
            </span>

            <button
              onClick={() => {
                const next = !showMenu;
                setShowMenu(next);
                setActiveEditor(next ? activeEditor : null);
              }}
              className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
              aria-label="Open item attributes"
            >
              {showMenu ? <X className="w-4 h-4 text-neutral-600" /> : <Menu className="w-4 h-4 text-neutral-400" />}
            </button>
          </div>

          {/* Line 2: chips — assignee, shop, date */}
          {(assignedUser || currentShop || dateStr) && !item.completed && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-0.5">
              {assignedUser && (
                <AttributeChip
                  icon={<User className="w-3.5 h-3.5" />}
                  label={assignedUser.name}
                  color="#10b981"
                  active={isAssigneeFiltered(assignedUser.id)}
                  onClick={showMenu ? () => updateItem(item.id, { assignedTo: null }) : () => setActiveEditor('assignee')}
                />
              )}
              {currentShop && (
                <AttributeChip
                  icon={<ShoppingCart className="w-3.5 h-3.5" />}
                  label={currentShop.name}
                  color="#10b981"
                  active={isShopFiltered(currentShop.id)}
                  onClick={showMenu ? () => updateItem(item.id, { shopId: null }) : () => setActiveEditor('shop')}
                />
              )}
              {dateStr && (
                <AttributeChip
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                  label={dateStr}
                  color="#ea580c"
                  active={isDateFiltered(dateStr)}
                  onClick={showMenu ? () => updateItem(item.id, { dueDate: null }) : () => setActiveEditor('schedule')}
                />
              )}
            </div>
          )}

          {/* Layer 3: attributes behind hamburger */}
          {showMenu && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = activeEditor === 'assignee' ? null : 'assignee';
                    setActiveEditor(next);
                    if (next) setAssigneeSearch('');
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    hasAssignee || activeEditor === 'assignee'
                      ? 'bg-green-100 text-green-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="@assignee"
                  aria-label="Edit assignee"
                >
                  <User className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'schedule' ? null : 'schedule')}
                  className={`p-1.5 rounded transition-colors ${
                    hasSchedule || activeEditor === 'schedule'
                      ? 'bg-orange-100 text-orange-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="//schedule"
                  aria-label="Edit schedule"
                >
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'shop' ? null : 'shop')}
                  className={`p-1.5 rounded transition-colors ${
                    hasShop || activeEditor === 'shop'
                      ? 'bg-green-100 text-green-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="$shop"
                  aria-label="Edit shop"
                >
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'quantity' ? null : 'quantity')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'quantity' ? 'bg-neutral-100 text-neutral-700 ring-1 ring-neutral-300' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="*quantity"
                  aria-label="Edit quantity"
                >
                  <Hash className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded transition-colors text-red-600 hover:bg-red-50"
                  title="delete"
                  aria-label="Delete item"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Assignee editor */}
              {activeEditor === 'assignee' && (
                <div className="mt-2 relative">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredUsers.length === 1) {
                          updateItem(item.id, { assignedTo: filteredUsers[0].id });
                          setActiveEditor(null);
                        }
                        if (e.key === 'Escape') setActiveEditor(null);
                      }}
                      placeholder="Search team..."
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Search assignee"
                    />
                    {hasAssignee && (
                      <button
                        onClick={() => {
                          updateItem(item.id, { assignedTo: null });
                          setAssigneeSearch('');
                          setActiveEditor(null);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                        aria-label="Clear assignee"
                        title="Remove assignee"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {filteredUsers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            updateItem(item.id, { assignedTo: item.assignedTo === u.id ? null : u.id });
                            setActiveEditor(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 flex items-center gap-2 ${
                            item.assignedTo === u.id ? 'bg-neutral-50 font-medium' : ''
                          }`}
                        >
                          <span>{u.name}</span>
                          {u.role && <span className="text-xs text-neutral-400 ml-auto">{u.role}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Schedule editor */}
              {activeEditor === 'schedule' && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateValue}
                      onChange={(e) => {
                        if (!e.target.value) {
                          updateItem(item.id, { dueDate: null });
                          return;
                        }
                        const t = timeValue || '00:00';
                        updateItem(item.id, { dueDate: new Date(`${e.target.value}T${t}:00`).getTime() });
                      }}
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Due date"
                    />
                    <input
                      type="time"
                      value={timeValue}
                      onChange={(e) => {
                        if (!dateValue) return;
                        updateItem(item.id, { dueDate: new Date(`${dateValue}T${e.target.value || '00:00'}:00`).getTime() });
                      }}
                      className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Due time"
                    />
                  </div>
                </div>
              )}

              {/* Shop editor */}
              {activeEditor === 'shop' && (
                <div className="mt-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {shops.map((shop) => (
                      <button
                        key={shop.id}
                        onClick={() => updateItem(item.id, { shopId: item.shopId === shop.id ? null : shop.id })}
                      >
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border ${
                            item.shopId === shop.id ? 'ring-2 ring-neutral-900' : 'hover:border-neutral-400'
                          }`}
                          style={{
                            backgroundColor: item.shopId === shop.id ? `${shop.color || '#10b981'}20` : undefined,
                            color: item.shopId === shop.id ? shop.color || '#10b981' : undefined,
                            borderColor: item.shopId === shop.id ? `${shop.color || '#10b981'}40` : '#e5e7eb',
                          }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          {shop.name}
                        </span>
                      </button>
                    ))}
                    {shops.length === 0 && (
                      <p className="text-xs text-neutral-400 italic">No shops — add in Settings</p>
                    )}
                  </div>
                  {hasShop && currentShop && (
                    <button
                      onClick={() => updateItem(item.id, { shopId: null })}
                      className="mt-2 text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1"
                      aria-label="Clear shop"
                    >
                      <X className="w-3 h-3" /> Clear shop
                    </button>
                  )}
                </div>
              )}

              {/* Quantity editor */}
              {activeEditor === 'quantity' && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(quantity - 1)}
                    className="px-2 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="min-w-[24px] text-center text-sm font-semibold text-neutral-700">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-2 py-1 text-xs border border-neutral-200 rounded hover:bg-neutral-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
};
