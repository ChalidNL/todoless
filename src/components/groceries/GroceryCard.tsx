import React, { useState } from 'react';
import { Item, ItemLinkedType } from '../../types';
import { useApp } from '../../context/AppContext';
import { LabelBadge } from '../shared/LabelBadge';
import {
  ShoppingCart,
  Trash2,
  Menu,
  X,
  Plus,
  Minus,
  Link as LinkIcon,
  Lock,
  PackageOpen,
  Package,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react';

interface GroceryCardProps {
  item: Item;
}

/**
 * Grocy-inspired grocery item card.
 * Shows stock status, quantity controls, shop badge, linked entity, and privacy indicator.
 */
export const GroceryCard = ({ item }: GroceryCardProps) => {
  const { updateItem, deleteItem, shops } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  const currentShop = item.shopId ? shops.find((s) => s.id === item.shopId) : null;
  const quantity = item.quantity ?? 0;

  // Grocy-style stock status based on quantity
  const stockStatus = (() => {
    if (item.completed) return { label: 'Bought', icon: PackageCheck, color: 'text-green-600', bg: 'bg-green-50' };
    if (quantity === 0) return { label: 'Missing', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' };
    if (quantity === 1) return { label: 'Few', icon: PackageOpen, color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'In Stock', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' };
  })();

  const StockIcon = stockStatus.icon;

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
    updateItem(item.id, { shopId });
    setShowShopSelector(false);
    setShopSearchQuery('');
  };

  const handleCreateShop = () => {
    if (shopSearchQuery.trim() && !shops.find((s) => s.name.toLowerCase() === shopSearchQuery.toLowerCase())) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      // Note: createShop is available via useApp, accessed through destructuring above
      setShopSearchQuery('');
    }
  };

  const filteredShops = shops.filter((s) =>
    s.name.toLowerCase().includes(shopSearchQuery.toLowerCase())
  );

  // Linked entity display
  const linkedLabel = (() => {
    if (!item.linkedType || !item.linkedTo) return null;
    const typeLabel: Record<ItemLinkedType, string> = { task: 'Task', item: 'Item' };
    return `${typeLabel[item.linkedType]}: ${item.linkedTo.slice(0, 8)}...`;
  })();

  return (
    <div
      className={`rounded-lg border-2 transition-all bg-white ${
        item.completed
          ? 'border-neutral-200 opacity-75'
          : stockStatus.color.includes('red')
          ? 'border-red-200'
          : 'border-neutral-200 hover:border-neutral-300 hover:shadow-md'
      }`}
    >
      <div className="p-3">
        {/* Header: stock status + title + private indicator */}
        <div className="flex items-center gap-2 mb-2">
          {/* Stock status badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
            <StockIcon className="w-3 h-3" />
            {stockStatus.label}
          </span>

          {/* Title */}
          <h3 className={`text-sm font-medium flex-1 truncate ${item.completed ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
            {item.title}
          </h3>

          {/* Private indicator */}
          {item.isPrivate && (
            <Lock className="w-3.5 h-3.5 text-neutral-400" title="Private" />
          )}

          {/* Hamburger menu */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
          >
            {showMenu ? <X className="w-4 h-4 text-neutral-600" /> : <Menu className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>

        {/* Quantity controls + shop badge row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quantity */}
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

          {/* Shop badge */}
          {currentShop && (
            <LabelBadge label={currentShop} size="sm" />
          )}

          {/* Linked entity badge */}
          {linkedLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-purple-50 text-purple-700 border border-purple-200">
              <LinkIcon className="w-3 h-3" />
              {linkedLabel}
            </span>
          )}
        </div>

        {/* Expanded menu */}
        {showMenu && (
          <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-1 flex-wrap">
            {/* Shop selector toggle */}
            <button
              onClick={() => {
                setShowShopSelector(!showShopSelector);
                setShowActions(false);
              }}
              className={`p-1.5 rounded transition-colors ${showShopSelector ? 'bg-blue-100' : 'hover:bg-neutral-100'}`}
              title="Change shop"
            >
              <ShoppingCart className={`w-4 h-4 ${currentShop ? 'text-blue-500' : 'text-neutral-400'}`} />
            </button>

            {/* Toggle bought status */}
            <button
              onClick={handleToggle}
              className="p-1.5 rounded hover:bg-neutral-100 transition-colors"
              title={item.completed ? 'Mark as not bought' : 'Mark as bought'}
            >
              <PackageCheck className={`w-4 h-4 ${item.completed ? 'text-green-500' : 'text-neutral-400'}`} />
            </button>

            {/* Delete */}
            <div className="flex-1" />
            <button
              onClick={() => {
                setShowActions(!showActions);
                setShowShopSelector(false);
              }}
              className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
              title="Delete item"
            >
              <Trash2 className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        )}

        {/* Shop selector panel */}
        {showShopSelector && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            <div className="text-xs text-neutral-600 mb-1">Shop</div>
            <input
              type="text"
              value={shopSearchQuery}
              onChange={(e) => setShopSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateShop()}
              placeholder="Search shops..."
              className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded mb-2"
              autoFocus
            />
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {filteredShops.map((shop) => (
                <button
                  key={shop.id}
                  onClick={() => handleSelectShop(shop.id)}
                  className={item.shopId === shop.id ? 'ring-2 ring-neutral-900 rounded' : ''}
                >
                  <LabelBadge label={shop} size="sm" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {showActions && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            <button
              onClick={() => {
                deleteItem(item.id);
                setShowActions(false);
              }}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Confirm delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
