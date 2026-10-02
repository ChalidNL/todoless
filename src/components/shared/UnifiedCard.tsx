import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Item } from '../../types';
import { useApp } from '../../context/AppContext';
import { Check, ChevronDown, ChevronUp, Trash2, ShoppingCart, ArrowLeftRight, X, Target } from 'lucide-react';
import { t } from '../../i18n/translations';
import { AttributeChip } from './AttributeChip';

// Grocery item card. It used to render tasks too, but tasks have rendered
// through CompactTaskCard for a long time and that branch was unreachable
// (#255); `type` stays so the call sites read as before.
interface UnifiedCardProps {
  entity: Item;
  type: 'item';
}

type UnifiedEditor = 'shop' | null;

export const UnifiedCard = ({ entity: item }: UnifiedCardProps) => {
  const { updateItem, deleteItem, shops, addShop, toggleChipFilter, isChipFilterActive, swapEntity } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<UnifiedEditor>(null);
  const [shopInput, setShopInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit mode inactivity timeout (60s): one setTimeout, reset on interaction (GH#78)
  const inactivityTimerRef = useRef<number | null>(null);
  const showMenuRef = useRef(showMenu);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    showMenuRef.current = showMenu;
  }, [showMenu]);

  const scheduleInactivityClose = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      window.clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = window.setTimeout(() => {
      inactivityTimerRef.current = null;
      setShowMenu(false);
      setActiveEditor(null);
    }, 60_000);
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    scheduleInactivityClose();
    return () => {
      if (inactivityTimerRef.current !== null) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [showMenu, scheduleInactivityClose]);

  const trackInteraction = useCallback(() => {
    if (showMenuRef.current) {
      scheduleInactivityClose();
    }
  }, [scheduleInactivityClose]);

  const isDone = item.completed;
  const isOverdue = !!item.dueDate && item.dueDate < Date.now() && !isDone;
  const quantity = item.quantity ?? 1;
  const currentShop = item.shopId ? shops.find(s => s.id === item.shopId) : null;
  const isFocused = !!item.focus && !isDone;

  const handleToggle = () => {
    updateItem(item.id, { completed: !item.completed });
  };

  const handleDelete = () => {
    deleteItem(item.id);
  };

  const setValue = (val: Record<string, unknown>) => {
    updateItem(item.id, val);
  };

  const setQuantity = (next: number) => {
    updateItem(item.id, { quantity: Math.max(1, next) });
  };

  const isShopFiltered = (id?: string) => id ? isChipFilterActive('shop', id) : false;

  const hasShop = !!currentShop;

  const visibleShops = shops.filter((shop) => shop.name.toLowerCase().includes(shopInput.toLowerCase()));

  return (
    <div
      ref={cardRef}
      onClick={trackInteraction}
      className={`app-card ${showMenu ? 'app-card-expanded' : ''} rounded-lg border transition-colors ${
        isDone
          ? 'border-neutral-200 opacity-75'
          : isFocused
            ? 'border-orange-400 hover:border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]'
            : 'border-neutral-200 hover:border-neutral-300'
      } ${
        isOverdue || isFocused ? '!bg-orange-50' : 'bg-white'
      } ${showMenu ? 'ring-1 ring-neutral-300 !bg-neutral-50' : ''}`}>
      <div className="p-2.5">
        {/* Line 1: checkbox + title + quantity + expander */}
        <div className="flex items-center gap-2">
          {/* Checkbox (button) */}
          <button
            onClick={handleToggle}
            className={`app-checkbox flex items-center justify-center flex-shrink-0 transition-colors ${
              isDone ? 'app-checkbox-checked' : 'hover:border-[var(--app-primary)]'
            }`}
            aria-label={isDone ? t('common.markAsNotDone') : t('common.markAsDone')}
          >
            {isDone && <Check className="w-3 h-3" />}
          </button>

          {/* Title */}
          <span className={`text-sm font-medium flex-1 truncate ${
            isDone ? 'line-through text-neutral-400' : 'text-neutral-900'
          }`}>
            {item.title}
          </span>

          {/* Quantity [+][-] controls */}
          {!isDone && (
            <div className="flex min-h-[44px] flex-shrink-0 items-center gap-1 rounded-full bg-[var(--app-surface-2)] p-1 shadow-inner">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); setQuantity(quantity - 1); }}
                disabled={quantity <= 1}
                className={`grid h-9 min-h-9 w-9 place-items-center rounded-full bg-white text-base font-black text-[var(--app-primary)] shadow-sm active:scale-[0.97] ${quantity <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                aria-label={t('items.decreaseQuantity')}
              >
                −
              </button>
              <span className="grid min-h-9 min-w-9 place-items-center text-center text-sm font-extrabold text-[var(--app-text)]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); setQuantity(quantity + 1); }}
                className="grid h-9 min-h-9 w-9 place-items-center rounded-full bg-[var(--app-primary)] text-base font-black text-white shadow-sm active:scale-[0.97]"
                aria-label={t('items.increaseQuantity')}
              >
                +
              </button>
            </div>
          )}

          {/* Expander */}
          <button
            onClick={() => {
              setShowMenu(!showMenu);
              setActiveEditor(null);
            }}
            className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
            aria-label={showMenu ? t('common.closeEditor') : t('common.openEditor')}
          >
            {showMenu ? <ChevronUp className="w-4 h-4 text-neutral-600" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>

        {/* Chip row — shop (only when not done) */}
        {!isDone && currentShop && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-0.5">
            <AttributeChip
              icon={<ShoppingCart className="w-3.5 h-3.5" />}
              label={currentShop.name}
              color={currentShop.color}
              active={isShopFiltered(currentShop.id)}
              onClick={showMenu ? () => setValue({ shopId: null }) : () => toggleChipFilter('shop', currentShop.id, currentShop.name, currentShop.color)}
            />
          </div>
        )}

        {/* Line 2: attributes behind the expander */}
        {showMenu && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = activeEditor === 'shop' ? null : 'shop';
                  setActiveEditor(next);
                  if (next) setShopInput('');
                }}
                className={`p-1.5 rounded transition-colors ${hasShop || activeEditor === 'shop' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'hover:bg-neutral-100 text-neutral-500'}`}
                title={t('items.selectShopTooltip')}
                aria-label={t('items.selectShopTooltip')}
              >
                <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setValue({ focus: !item.focus })}
                className={`p-1.5 rounded transition-colors ${
                  isFocused ? 'bg-orange-100 text-orange-700' : 'hover:bg-neutral-100 text-neutral-500'
                }`}
                title={t('tasks.focus')}
                aria-label={t('tasks.focus')}
              >
                <Target className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <div className="flex-1" />
              <button
                onClick={() => swapEntity(item.id)}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100 text-neutral-400"
                title={t('common.swapType')}
                aria-label={t('common.swapType')}
              >
                <ArrowLeftRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                title={t('common.delete')}
                aria-label={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Shop editor — text-input-first like GroceryCard */}
            {activeEditor === 'shop' && (
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
                    placeholder={t('items.shopInputPlaceholder')}
                    className="min-w-0 flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                    aria-label={t('items.shopInputAria')}
                  />
                  {hasShop && (
                    <button
                      onClick={() => setValue({ shopId: null })}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                      aria-label={t('items.clearShop')}
                      title={t('common.clearAllTooltip')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {visibleShops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => setValue({ shopId: item.shopId === shop.id ? null : shop.id })}
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
                  {visibleShops.length === 0 && (
                    <p className="text-xs text-neutral-400 italic">{t('items.noShopsFound')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title={t('items.confirmDelete')}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};
