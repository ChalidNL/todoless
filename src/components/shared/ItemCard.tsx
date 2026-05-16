import React, { useState } from 'react';
import { Item, Note } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  ShoppingCart, Trash2, Menu, X, RotateCcw, Plus, Minus,
  Lock, Unlock, Eye, Link, Tag,
} from 'lucide-react';
import { LabelBadge } from './LabelBadge';

export interface ItemCardProps {
  item: Item;
  compact?: boolean;
}

/**
 * ItemCard — item display type: label + shop + quantity + linked + private.
 * Shows item title with completion checkbox, followed by attribute badges
 * for shop, quantity, labels, linked notes, and privacy status.
 */
export const ItemCard = ({ item, compact = false }: ItemCardProps) => {
  const { updateItem, deleteItem, convertItemToTask, shops, labels, notes } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [shopQuery, setShopQuery] = useState('');

  const currentShop = shops.find(s => s.id === item.shopId);
  const itemLabels = labels.filter(l => (item.labels || []).includes(l.id));
  const linkedNotes = notes.filter(n => n.linkedType === 'item' && n.linkedTo === item.id);

  const handleToggle = () => {
    updateItem(item.id, { completed: !item.completed });
  };

  const handleRestock = () => {
    updateItem(item.id, { completed: false });
  };

  const increaseQuantity = () => {
    updateItem(item.id, { quantity: (item.quantity || 1) + 1 });
  };

  const decreaseQuantity = () => {
    const newQty = Math.max(1, (item.quantity || 1) - 1);
    updateItem(item.id, { quantity: newQty });
  };

  const closePickers = () => {
    setShowShopPicker(false);
  };

  const filteredShops = shops.filter(s =>
    s.name.toLowerCase().includes(shopQuery.toLowerCase())
  );

  const cardClass = compact
    ? 'rounded-lg p-2 hover:border-neutral-300 transition-all bg-white border border-neutral-200'
    : 'rounded-lg p-3 hover:border-neutral-300 transition-all bg-white border-2 border-neutral-200';

  return (
    <div
      className={`${cardClass} ${item.completed ? 'opacity-60' : ''}`}
      data-testid={`item-card-${item.id}`}
    >
      {/* Row 1: Checkbox + Title + Quantity */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={item.completed}
          onChange={handleToggle}
          className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer flex-shrink-0 accent-blue-600"
          aria-label={`Mark "${item.title}" as ${item.completed ? 'incomplete' : 'complete'}`}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p
            className={`text-sm leading-snug ${item.completed
              ? 'line-through text-neutral-400'
              : 'text-neutral-900'
              }`}
          >
            {item.title || <span className="italic text-neutral-400">Untitled item</span>}
          </p>

          {/* Attributes row */}
          {!compact && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {/* Shop badge */}
              {currentShop && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-700" title={`Shop: ${currentShop.name}`}>
                  <ShoppingCart className="w-3 h-3" />
                  {currentShop.name}
                </span>
              )}

              {/* Quantity */}
              {item.quantity && item.quantity > 1 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-medium" title="Quantity">
                  <Plus className="w-3 h-3" />
                  x{item.quantity}
                </span>
              )}

              {/* Labels */}
              {itemLabels.map(label => (
                <LabelBadge key={label.id} label={label} size="sm" />
              ))}

              {/* Linked notes indicator */}
              {linkedNotes.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700" title={`${linkedNotes.length} linked note(s)`}>
                  <Link className="w-3 h-3" />
                  {linkedNotes.length}
                </span>
              )}

              {/* Private */}
              {item.isPrivate && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700" title="Private — only visible to you">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quantity controls (always visible for non-completed items) */}
        {!item.completed && (
          <div className="flex items-center gap-1 bg-neutral-100 rounded px-1.5 py-0.5 flex-shrink-0">
            <button
              onClick={decreaseQuantity}
              className="hover:bg-neutral-200 rounded p-0.5"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3 text-neutral-600" />
            </button>
            <span className="text-xs font-medium text-neutral-700 min-w-[20px] text-center">
              {item.quantity || 1}
            </span>
            <button
              onClick={increaseQuantity}
              className="hover:bg-neutral-200 rounded p-0.5"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3 text-neutral-600" />
            </button>
          </div>
        )}

        {/* Menu button */}
        <button
          onClick={() => {
            setShowMenu(!showMenu);
            if (showMenu) closePickers();
          }}
          className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0 mt-0.5"
          aria-label="Item options"
        >
          {showMenu
            ? <X className="w-4 h-4 text-neutral-600" />
            : <Menu className="w-4 h-4 text-neutral-400" />
          }
        </button>
      </div>

      {/* Expanded menu */}
      {showMenu && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          {/* Icon toolbar */}
          <div className="flex items-center gap-1 mb-2">
            <ToolbarButton
              active={showShopPicker}
              onClick={() => { closePickers(); setShowShopPicker(!showShopPicker); }}
              icon={<ShoppingCart className="w-4 h-4" />}
              title="Shop"
              hasValue={!!item.shopId}
            />
            <ToolbarButton
              active={false}
              onClick={() => convertItemToTask(item.id)}
              icon={<Eye className="w-4 h-4" />}
              title="Convert to task"
            />
            {item.completed && (
              <ToolbarButton
                active={false}
                onClick={handleRestock}
                icon={<RotateCcw className="w-4 h-4" />}
                title="Restock"
              />
            )}

            <div className="flex-1" />

            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 hover:bg-neutral-100 rounded"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {/* Shop picker */}
          {showShopPicker && (
            <PickerSection title="Shop">
              <input
                type="text"
                value={shopQuery}
                onChange={e => setShopQuery(e.target.value)}
                placeholder="Search or create shop..."
                className="w-full px-2 py-1 text-xs border rounded mb-2"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && shopQuery.trim()) {
                    const { createShop } = useApp();
                    // Inline shop creation handled by context
                    setShopQuery('');
                  }
                }}
              />
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {filteredShops.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      updateItem(item.id, { shopId: item.shopId === s.id ? undefined : s.id });
                      setShowShopPicker(false);
                    }}
                    className={item.shopId === s.id ? 'ring-2 ring-neutral-900 rounded' : ''}
                  >
                    <LabelBadge label={s} size="sm" />
                  </button>
                ))}
              </div>
            </PickerSection>
          )}

          {/* Delete confirmation */}
          {showActions && (
            <PickerSection title="Delete item">
              <button
                onClick={() => { deleteItem(item.id); setShowActions(false); }}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Confirm delete
              </button>
            </PickerSection>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────────────────── */

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hasValue?: boolean;
}

const ToolbarButton = ({ active, onClick, icon, title, hasValue }: ToolbarButtonProps) => {
  const iconElement = React.isValidElement(icon) ? icon : null;
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-black text-white' : 'hover:bg-neutral-100'}`}
      title={title}
    >
      {iconElement
        ? React.cloneElement(iconElement, {
            className: `w-4 h-4 ${active ? 'text-white' : hasValue ? 'text-blue-500' : 'text-neutral-400'}`,
          })
        : icon}
    </button>
  );
};

interface PickerSectionProps {
  title: string;
  children: React.ReactNode;
}

const PickerSection = ({ title, children }: PickerSectionProps) => (
  <div className="mt-2 pt-2 border-t border-neutral-100">
    <div className="text-xs text-neutral-600 mb-2 font-medium">{title}</div>
    {children}
  </div>
);
