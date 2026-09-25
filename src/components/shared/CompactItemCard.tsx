import React, { useState } from 'react';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, Trash2, Menu, X, ToggleLeft, Plus, Minus } from 'lucide-react';
import { t } from '../../i18n/translations';
import { AttributeChip } from './AttributeChip';
import { LabelBadge } from './LabelBadge';

interface CompactItemCardProps {
  item: Item;
}

export const CompactItemCard = ({ item }: CompactItemCardProps) => {
  const { updateItem, deleteItem, convertItemToTask, shops, createShop, toggleChipFilter, isChipFilterActive } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');

  const handleToggle = () => {
    updateItem(item.id, { completed: !item.completed });
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

  const closeAllPanels = () => {
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
    <div className={`rounded-lg p-2.5 hover:border-neutral-300 transition-all bg-white border-2 border-neutral-200 ${
      isExpanded ? 'shadow-lg' : ''
    }`}>
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
          {/* Title and Quantity */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`text-sm flex-1 ${item.completed ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
              {item.title}
            </h3>
            {!item.completed && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); decreaseQuantity(); }}
                  style={{
                    width: '30px', height: '30px', borderRadius: '10px',
                    background: '#f8f7ff', border: '1px solid rgba(99,102,241,0.10)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '17px', fontWeight: 600, color: '#64748b',
                    cursor: 'pointer',
                  }}
                  aria-label={t('items.decreaseQuantity')}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span style={{
                  fontSize: '15px', fontWeight: 700, minWidth: '22px', textAlign: 'center',
                  color: '#1a1a2e',
                }}>
                  {item.quantity || 1}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); increaseQuantity(); }}
                  style={{
                    width: '30px', height: '30px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #22c55e, #06b6d4)',
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
                    cursor: 'pointer',
                  }}
                  aria-label={t('items.increaseQuantity')}
                >
                  <Plus className="w-3.5 h-3.5" color="white" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>

          {/* Chips row — shop only */}
          {!item.completed && currentShop && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <AttributeChip
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
                label={currentShop.name}
                color={currentShop.color}
                onClick={() => toggleChipFilter('shop', currentShop.id, currentShop.name, currentShop.color)}
                active={isChipFilterActive('shop', currentShop.id)}
              />
            </div>
          )}

          {/* Icon toolbar - only visible when menu is open */}
          {showMenu && (
            <div className="flex items-center gap-1 pt-2 border-t border-neutral-100">
              <button 
                onClick={() => {
                  closeAllPanels();
                  setShowShopSelector(!showShopSelector);
                }}
                className={`p-1.5 rounded transition-colors ${showShopSelector ? 'bg-blue-100' : 'hover:bg-neutral-100'}`}
                title={t('items.selectShopTooltip')}
              >
                <ShoppingCart className={`w-4 h-4 ${currentShop ? 'text-blue-500' : 'text-neutral-400'}`} />
              </button>

              <button
                onClick={() => convertItemToTask(item.id)}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100"
                title={t('items.convertToTaskTooltip')}
              >
                <ToggleLeft className="w-4 h-4 text-neutral-400" />
              </button>
              
              <div className="flex-1" />
              
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
                title={t('common.delete')}
              >
                <Trash2 className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          )}

          {/* Shop selector with search/create */}
          {showShopSelector && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="text-xs text-neutral-600 mb-2">{t('items.shopSelectorLabel')}</div>
              <input
                type="text"
                value={shopSearchQuery}
                onChange={(e) => setShopSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateShop();
                  }
                }}
                placeholder={t('items.searchOrCreateShopPlaceholder')}
                className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded mb-2"
                autoFocus
              />
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {filteredShops.map((shop) => (
                  <button
                    key={shop.id}
                    onClick={() => handleSelectShop(shop.id)}
                    className={`${item.shopId === shop.id ? 'ring-2 ring-neutral-900' : ''}`}
                  >
                    <LabelBadge label={shop} />
                  </button>
                ))}
              </div>
              {shopSearchQuery && filteredShops.length === 0 && (
                <button
                  onClick={handleCreateShop}
                  className="w-full mt-2 px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {t('items.createShopButton')} &quot;{shopSearchQuery}&quot;
                </button>
              )}
            </div>
          )}

          {/* Delete confirmation popup */}
          {showActions && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowActions(false)}>
              <div className="bg-white rounded-lg shadow-xl p-5 mx-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
                <p className="text-sm font-medium text-neutral-900 mb-4">{t('items.confirmDelete')}</p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowActions(false)}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
                  >
                    {t('common.no')}
                  </button>
                  <button
                    onClick={() => {
                      deleteItem(item.id);
                      setShowActions(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hamburger Menu Button - Right aligned */}
        <button
          onClick={() => {
            setShowMenu(!showMenu);
            setIsExpanded(!isExpanded);
          }}
          className="p-1.5 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
        >
          {showMenu ? (
            <X className="w-5 h-5 text-neutral-600" />
          ) : (
            <Menu className="w-5 h-5 text-neutral-400" />
          )}
        </button>
      </div>
    </div>
  );
};
