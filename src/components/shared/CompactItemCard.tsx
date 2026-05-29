import React, { useState } from 'react';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, Trash2, Menu, X, RotateCcw, Plus, Minus, ToggleLeft } from 'lucide-react';
import { t } from '../../i18n/translations';
import { AttributeChip } from './AttributeChip';
import { LabelBadge } from './LabelBadge';

interface CompactItemCardProps {
  item: Item;
}

export const CompactItemCard = ({ item }: CompactItemCardProps) => {
  const { updateItem, deleteItem, shops, createShop, toggleChipFilter, isChipFilterActive, convertItemToTask } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    const newQuantity = Math.max(1, (item.quantity || 1) - 1);
    updateItem(item.id, { quantity: newQuantity });
  };

  const handleSelectShop = (shopId: string) => {
    updateItem(item.id, { shopId });
    setShowShopSelector(false);
  };

  const filteredShops = shops.filter(s => 
    s.name.toLowerCase().includes(shopSearchQuery.toLowerCase())
  );

  const handleCreateShop = () => {
    if (shopSearchQuery.trim() && !shops.find(s => s.name.toLowerCase() === shopSearchQuery.toLowerCase())) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      createShop({
        name: shopSearchQuery.trim(),
        color: randomColor
      });
      setShopSearchQuery('');
    }
  };

  const currentShop = item.shopId ? shops.find(s => s.id === item.shopId) : null;

  return (
    <div className="rounded-lg p-2.5 hover:border-neutral-300 transition-all bg-white border-2 border-neutral-200">
      <div className="flex items-center gap-2">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.completed}
          onChange={handleToggle}
          className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer flex-shrink-0 accent-blue-600"
        />
        
        {/* Item content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm flex-1 ${item.completed ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
              {item.title}
            </h3>
            {!item.completed && (
              <div className="flex items-center gap-1 bg-neutral-100 rounded px-2 py-0.5">
                <button onClick={decreaseQuantity} className="hover:bg-neutral-200 rounded p-0.5" aria-label={t('items.decreaseQuantity')}>
                  <Minus className="w-3 h-3 text-neutral-600" />
                </button>
                <span className="text-xs font-medium text-neutral-700 min-w-[20px] text-center">{item.quantity || 1}</span>
                <button onClick={increaseQuantity} className="hover:bg-neutral-200 rounded p-0.5" aria-label={t('items.increaseQuantity')}>
                  <Plus className="w-3 h-3 text-neutral-600" />
                </button>
              </div>
            )}
          </div>

          {/* Shop chip only */}
          {currentShop && !item.completed && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <AttributeChip
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
                label={currentShop.name}
                color={currentShop.color}
                onClick={() => toggleChipFilter('shop', currentShop.id, currentShop.name, currentShop.color)}
                active={isChipFilterActive('shop', currentShop.id)}
              />
            </div>
          )}

          {/* Expanded menu: shop selector + delete */}
          {showMenu && (
            <div className="mt-2 pt-2 border-t border-neutral-100 space-y-2">
              {/* Shop selector */}
              <div>
                <div className="text-xs text-neutral-600 mb-1">{t('items.shopSelectorLabel')}</div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={shopSearchQuery}
                    onChange={(e) => setShopSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateShop(); }}
                    placeholder={t('items.searchOrCreateShopPlaceholder')}
                    className="flex-1 px-2 py-1 text-xs border border-neutral-200 rounded"
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                  {filteredShops.map((shop) => (
                    <button key={shop.id} onClick={() => handleSelectShop(shop.id)}
                      className={item.shopId === shop.id ? 'ring-2 ring-neutral-900 rounded-full' : ''}>
                      <LabelBadge label={shop} />
                    </button>
                  ))}
                </div>
                {shopSearchQuery && filteredShops.length === 0 && (
                  <button onClick={handleCreateShop}
                    className="w-full mt-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                    {t('items.createShopButton')} "{shopSearchQuery}"
                  </button>
                )}
              </div>

              {/* Convert to task */}
              <button
                onClick={() => convertItemToTask(item.id)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded w-full"
              >
                <ToggleLeft className="w-3.5 h-3.5" />
                {t('items.convertToTaskTooltip')}
              </button>

              {/* Delete button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded w-full"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
        >
          {showMenu ? <X className="w-5 h-5 text-neutral-600" /> : <Menu className="w-5 h-5 text-neutral-400" />}
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl p-5 mx-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-neutral-900 mb-4">{t('items.confirmDelete')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded">
                {t('common.no')}
              </button>
              <button onClick={() => { deleteItem(item.id); setShowDeleteConfirm(false); }} className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
