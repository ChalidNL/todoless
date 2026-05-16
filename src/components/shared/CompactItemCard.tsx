import React, { useState } from 'react';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, Trash2, Menu, X, RotateCcw, Plus, Minus, ToggleLeft, Lock, Unlock, User } from 'lucide-react';
import { LabelBadge } from './LabelBadge';

interface CompactItemCardProps {
  item: Item;
}

export const CompactItemCard = ({ item }: CompactItemCardProps) => {
  const { updateItem, deleteItem, convertItemToTask, shops, createShop, users } = useApp();
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
    u.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
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
                >
                  <Minus className="w-3 h-3 text-neutral-600" />
                </button>
                <span className="text-xs font-medium text-neutral-700 min-w-[20px] text-center">
                  {item.quantity || 1}
                </span>
                <button
                  onClick={increaseQuantity}
                  className="hover:bg-neutral-200 rounded p-0.5"
                >
                  <Plus className="w-3 h-3 text-neutral-600" />
                </button>
              </div>
            )}
          </div>

          {/* Owner & Assignee badges */}
          {(item.createdBy || item.assignedTo) && (
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {item.createdBy && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-500">
                  <div className="w-3.5 h-3.5 rounded-full bg-neutral-300 flex items-center justify-center text-[8px] text-white font-medium">
                    {(users.find(u => u.id === item.createdBy)?.name || '?').charAt(0)}
                  </div>
                  {users.find(u => u.id === item.createdBy)?.name || 'Unknown'}
                </span>
              )}
              {item.assignedTo && item.assignedTo !== item.createdBy && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">
                  <User className="w-3 h-3" />
                  {users.find(u => u.id === item.assignedTo)?.name || 'Unknown'}
                </span>
              )}
              {item.isPrivate && (
                <Lock className="w-3 h-3 text-purple-400" />
              )}
            </div>
          )}

          {/* Shop badge if selected */}
          {currentShop && (
            <div className="mb-2">
              <LabelBadge label={currentShop} size="sm" />
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
                title="Select Shop"
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
                title="Assignee"
              >
                <User className={`w-4 h-4 ${showAssigneeSelector ? 'text-white' : item.assignedTo ? 'text-blue-500' : 'text-neutral-400'}`} />
              </button>

              {/* Convert to Task */}
              <button
                onClick={() => convertItemToTask(item.id)}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100"
                title="Convert to Task"
              >
                <ToggleLeft className="w-4 h-4 text-neutral-400" />
              </button>

              {/* Lock/Unlock - Privacy */}
              <button
                onClick={() => updateItem(item.id, { isPrivate: !item.isPrivate })}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100"
                title={item.isPrivate ? 'Private (only you)' : 'Shared with family'}
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
                  title="Restock (add back to shopping list)"
                >
                  <RotateCcw className="w-4 h-4 text-green-500" />
                </button>
              )}
              
              <div className="flex-1" />
              
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          )}

          {/* Shop selector with search/create */}
          {showShopSelector && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="text-xs text-neutral-600 mb-2">Shop</div>
              <input
                type="text"
                value={shopSearchQuery}
                onChange={(e) => setShopSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateShop();
                  }
                }}
                placeholder="Search or create shop..."
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
                  Create "{shopSearchQuery}"
                </button>
              )}
            </div>
          )}

          {/* Assignee selector with search */}
          {showAssigneeSelector && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="text-xs text-neutral-600 mb-2">Assign to</div>
              <input
                type="text"
                value={assigneeSearchQuery}
                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                placeholder="Search users..."
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

          {/* Delete confirmation */}
          {showActions && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <button
                onClick={() => {
                  deleteItem(item.id);
                  setShowActions(false);
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Confirm delete
              </button>
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