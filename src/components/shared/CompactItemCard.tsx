import React, { useState } from 'react';
import { Item, userDisplayName } from '../../types';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, Trash2, Menu, X, RotateCcw, Plus, Minus, ToggleLeft, Lock, Unlock, User, CalendarDays } from 'lucide-react';
import { t } from '../../i18n/translations';
import { AttributeChip } from './AttributeChip';
import { LabelBadge } from './LabelBadge';
import { entityColor } from '../../lib/entity-colors';

interface CompactItemCardProps {
  item: Item;
}

export const CompactItemCard = ({ item }: CompactItemCardProps) => {
  const { updateItem, deleteItem, convertItemToTask, shops, createShop, users, toggleChipFilter, isChipFilterActive } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [showAssigneeSelector, setShowAssigneeSelector] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');

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

  const closeAllPanels = () => {
    setShowShopSelector(false);
    setShowAssigneeSelector(false);
  };

  const filteredShops = shops.filter(s => 
    s.name.toLowerCase().includes(shopSearchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.name && userDisplayName(u).toLowerCase().includes(assigneeSearchQuery.toLowerCase())
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
              <div className="flex items-center gap-1 bg-neutral-100 rounded px-2 py-0.5">
                <button
                  onClick={decreaseQuantity}
                  className="hover:bg-neutral-200 rounded p-0.5"
                  aria-label={t('items.decreaseQuantity')}
                >
                  <Minus className="w-3 h-3 text-neutral-600" />
                </button>
                <span className="text-xs font-medium text-neutral-700 min-w-[20px] text-center">
                  {item.quantity || 1}
                </span>
                <button
                  onClick={increaseQuantity}
                  className="hover:bg-neutral-200 rounded p-0.5"
                  aria-label={t('items.increaseQuantity')}
                >
                  <Plus className="w-3 h-3 text-neutral-600" />
                </button>
              </div>
            )}
          </div>

          {/* Chips row — owner + assignee + shop + date */}
          {(item.createdBy || (item.assignedTo && item.assignedTo !== item.createdBy) || currentShop || item.dueDate) && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              {item.createdBy && (
                <AttributeChip icon={<User className="w-3.5 h-3.5" />} label={users.find(u => u.id === item.createdBy)?.firstName || t('common.unknown')} color={entityColor(item.createdBy)} />
              )}
              {item.assignedTo && item.assignedTo !== item.createdBy && (
                <AttributeChip icon={<User className="w-3.5 h-3.5" />} label={users.find(u => u.id === item.assignedTo)?.firstName || t('common.unknown')} color={entityColor(item.assignedTo)} onClick={() => toggleChipFilter('assignee', item.assignedTo!, users.find(u => u.id === item.assignedTo)?.firstName || '', entityColor(item.assignedTo!))} active={isChipFilterActive('assignee', item.assignedTo!)} />
              )}
              {currentShop && (
                <AttributeChip icon={<ShoppingCart className="w-3.5 h-3.5" />} label={currentShop.name} color={currentShop.color} onClick={() => toggleChipFilter('shop', currentShop.id, currentShop.name, currentShop.color)} active={isChipFilterActive('shop', currentShop.id)} />
              )}
              {item.dueDate && (
                <AttributeChip icon={<CalendarDays className="w-3.5 h-3.5" />} label={new Date(item.dueDate).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' })} color="#6b7280" onClick={() => { const ds = new Date(item.dueDate!).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }); toggleChipFilter('date', ds); }} active={isChipFilterActive('date', new Date(item.dueDate!).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' }))} />
              )}
              {item.isPrivate && (
                <Lock className="w-3 h-3 text-purple-400" />
              )}
            </div>
          )}

          {/* Icon toolbar - only visible when menu is open */}
          {showMenu && (
            <div className="flex items-center gap-1 pt-2 border-t border-neutral-100">
              {/* Shopping Cart - Shop selector */}
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

              {/* User - Assignee */}
              <button 
                onClick={() => {
                  closeAllPanels();
                  setShowAssigneeSelector(!showAssigneeSelector);
                }}
                className={`p-1.5 rounded transition-colors ${showAssigneeSelector ? 'bg-black' : 'hover:bg-neutral-100'}`}
                title={t('items.assigneeTooltip')}
              >
                <User className={`w-4 h-4 ${showAssigneeSelector ? 'text-white' : item.assignedTo ? 'text-blue-500' : 'text-neutral-400'}`} />
              </button>

              {/* Convert to Task */}
              <button
                onClick={() => convertItemToTask(item.id)}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100"
                title={t('items.convertToTaskTooltip')}
              >
                <ToggleLeft className="w-4 h-4 text-neutral-400" />
              </button>

              {/* Lock/Unlock - Privacy */}
              <button
                onClick={() => updateItem(item.id, { isPrivate: !item.isPrivate })}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100"
                title={item.isPrivate ? t('items.privateTooltip') : t('items.sharedTooltip')}
              >
                {item.isPrivate ? (
                  <Lock className="w-4 h-4 text-purple-500" />
                ) : (
                  <Unlock className="w-4 h-4 text-neutral-400" />
                )}
              </button>
              
              {/* Restock - Only show for completed items */}
              {item.completed && (
                <button
                  onClick={handleRestock}
                  className="p-1.5 rounded transition-colors hover:bg-neutral-100"
                  title={t('items.restockTooltip')}
                >
                  <RotateCcw className="w-4 h-4 text-green-500" />
                </button>
              )}
              
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

          {/* Assignee selector with search */}
          {showAssigneeSelector && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="text-xs text-neutral-600 mb-2">{t('items.assignToLabel')}</div>
              <input
                type="text"
                value={assigneeSearchQuery}
                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                placeholder={t('items.searchUsersPlaceholder')}
                className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded mb-2"
                autoFocus
              />
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      updateItem(item.id, { assignedTo: item.assignedTo === user.id ? undefined : user.id });
                      setAssigneeSearchQuery('');
                    }}
                    className={`w-full px-2 py-1.5 text-left text-xs rounded flex items-center gap-2 ${
                      item.assignedTo === user.id ? 'bg-blue-100' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-xs">
                      {user.name.charAt(0)}
                    </div>
                    {user.name}
                  </button>
                ))}
              </div>
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
