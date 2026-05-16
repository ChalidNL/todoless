import React, { useState } from 'react';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { LabelBadge } from '../shared/LabelBadge';
import {
  Check,
  Plus,
  Minus,
  Menu,
  X,
  Trash2,
  ShoppingCart,
  User,
} from 'lucide-react';

interface GroceryCardProps {
  item: Item;
}

/**
 * Grocery card: todo-style with checkbox, title, quantity +/-,
 * and inline shop badge + assignee badges.
 */
export const GroceryCard = ({ item }: GroceryCardProps) => {
  const { updateItem, deleteItem, shops, users } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);

  const quantity = item.quantity ?? 0;
  const currentShop = item.shopId ? shops.find((s) => s.id === item.shopId) : null;
  const currentAssignee = item.assignedTo ? users.find((u) => u.id === item.assignedTo) : null;

  const handleToggle = () => {
    updateItem(item.id, { completed: !item.completed });
  };

  const increaseQuantity = () => {
    updateItem(item.id, { quantity: quantity + 1 });
  };

  const decreaseQuantity = () => {
    updateItem(item.id, { quantity: Math.max(0, quantity - 1) });
  };

  const handleSelectShop = (shopId: string) => {
    updateItem(item.id, { shopId: item.shopId === shopId ? undefined : shopId });
    setShowShopSelector(false);
  };

  return (
    <div
      className={`rounded-lg border-2 transition-all bg-white ${
        item.completed
          ? 'border-neutral-200 opacity-75'
          : 'border-neutral-200 hover:border-neutral-300'
      }`}
    >
      <div className="p-3">
        {/* Top row: checkbox + title + quantity + menu */}
        <div className="flex items-center gap-2">
          {/* Checkbox */}
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

          {/* Title */}
          <span
            className={`text-sm font-medium flex-1 truncate ${
              item.completed ? 'line-through text-neutral-400' : 'text-neutral-900'
            }`}
          >
            {item.title}
          </span>

          {/* Quantity controls */}
          {!item.completed && (
            <div className="flex items-center gap-1 bg-neutral-100 rounded-md px-2 py-1">
              <button
                onClick={decreaseQuantity}
                className="hover:bg-neutral-200 rounded p-0.5"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5 text-neutral-600" />
              </button>
              <span className="text-xs font-semibold text-neutral-700 min-w-[24px] text-center">
                {quantity}
              </span>
              <button
                onClick={increaseQuantity}
                className="hover:bg-neutral-200 rounded p-0.5"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5 text-neutral-600" />
              </button>
            </div>
          )}

          {/* Quantity text when completed */}
          {item.completed && quantity > 0 && (
            <span className="text-xs text-neutral-400 font-medium">x{quantity}</span>
          )}

          {/* Menu button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
          >
            {showMenu ? (
              <X className="w-4 h-4 text-neutral-600" />
            ) : (
              <Menu className="w-4 h-4 text-neutral-400" />
            )}
          </button>
        </div>

        {/* Badges row: shop + assignee */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {currentShop && (
            <LabelBadge label={currentShop} size="sm" />
          )}
          {currentAssignee && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">
              <User className="w-3 h-3" />
              {currentAssignee.name}
            </span>
          )}
          {item.labels && item.labels.length > 0 && (
            <span className="text-[10px] text-neutral-400">
              {item.labels.length} label{item.labels.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Expanded menu: shop selector + delete */}
        {showMenu && (
          <div className="mt-2 pt-2 border-t border-neutral-100 space-y-2">
            {/* Shop selector */}
            <div>
              <div className="flex items-center gap-1 flex-wrap">
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    onClick={() => handleSelectShop(shop.id)}
                    className={item.shopId === shop.id ? 'ring-2 ring-neutral-900 rounded' : ''}
                  >
                    <LabelBadge label={shop} size="sm" />
                  </button>
                ))}
              </div>
              {shops.length === 0 && (
                <p className="text-xs text-neutral-400 italic">No shops — add in Settings</p>
              )}
            </div>

            {/* Delete */}
            <button
              onClick={() => {
                deleteItem(item.id);
                setShowMenu(false);
              }}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
