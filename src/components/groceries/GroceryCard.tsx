import React, { useState } from 'react';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { LabelBadge } from '../shared/LabelBadge';
import { Check, Menu, X, Trash2, ShoppingCart, Hash } from 'lucide-react';

interface GroceryCardProps {
  item: Item;
}

type GroceryEditor = 'shop' | 'quantity' | null;

export const GroceryCard = ({ item }: GroceryCardProps) => {
  const { updateItem, deleteItem, shops } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<GroceryEditor>(null);

  const quantity = item.quantity ?? 0;
  const currentShop = item.shopId ? shops.find((s) => s.id === item.shopId) : null;

  const handleToggle = () => {
    updateItem(item.id, { completed: !item.completed });
  };

  const setQuantity = (next: number) => {
    updateItem(item.id, { quantity: Math.max(0, next) });
  };

  return (
    <div
      className={`rounded-lg border bg-white transition-colors ${
        item.completed ? 'border-neutral-200 opacity-75' : 'border-neutral-200 hover:border-neutral-300'
      }`}
    >
      <div className="p-2.5">
        {/* Layer 1: checkbox + description + hamburger */}
        <div className="flex items-start gap-2">
          <button
            onClick={handleToggle}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 self-start transition-colors ${
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

          <button
            onClick={() => {
              const next = !showMenu;
              setShowMenu(next);
              setActiveEditor(next ? activeEditor : null);
            }}
            className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0 self-start"
            aria-label="Open item menu"
          >
            {showMenu ? <X className="w-4 h-4 text-neutral-600" /> : <Menu className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>

        {/* Layer 2: grocery-only attributes */}
        {showMenu && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveEditor(activeEditor === 'shop' ? null : 'shop')}
                className={`p-1.5 rounded transition-colors ${activeEditor === 'shop' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="$shop"
                aria-label="Edit shop"
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveEditor(activeEditor === 'quantity' ? null : 'quantity')}
                className={`p-1.5 rounded transition-colors ${activeEditor === 'quantity' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title="*quantity"
                aria-label="Edit quantity"
              >
                <Hash className="w-4 h-4" />
              </button>
              <div className="ml-auto">
                <button
                  onClick={() => {
                    deleteItem(item.id);
                    setShowMenu(false);
                    setActiveEditor(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {/* Layer 3: selected attribute editor */}
            {activeEditor === 'shop' && (
              <div className="mt-2 flex flex-wrap gap-1">
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    onClick={() => updateItem(item.id, { shopId: item.shopId === shop.id ? undefined : shop.id })}
                    className={item.shopId === shop.id ? 'ring-2 ring-neutral-900 rounded' : ''}
                  >
                    <LabelBadge label={shop} size="sm" />
                  </button>
                ))}
                {shops.length === 0 && (
                  <p className="text-xs text-neutral-400 italic">No shops — add in Settings</p>
                )}
                {currentShop && (
                  <span className="text-[11px] text-neutral-500 w-full mt-1">Selected: {currentShop.name}</span>
                )}
              </div>
            )}

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
  );
};
