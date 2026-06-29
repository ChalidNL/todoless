import { Pencil, Store, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { AppHeader } from './shared/NewGlobalHeader';
import { EmptyState } from './shared/EmptyState';
import type { Shop } from '../types';

const COLOR_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#ef4444', '#14b8a6', '#f43f5e', '#a855f7'];

export function ShopsView() {
  const { shops, addShop, updateShop } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState('#ec4899');

  const closeModal = () => { setShowModal(false); setEditing(null); setDraftName(''); };
  const openCreate = () => { setEditing(null); setDraftName(''); setDraftColor('#ec4899'); setShowModal(true); };
  const openEditStore = (shop: Shop) => { setEditing(shop); setDraftName(shop.name); setDraftColor(shop.color || '#ec4899'); setShowModal(true); };
  const saveShop = () => {
    const name = draftName.trim();
    if (!name) return;
    if (editing) updateShop(editing.id, { name, color: draftColor });
    else addShop({ name, color: draftColor });
    closeModal();
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <AppHeader screen="shop" searchPlaceholder="Zoek winkels..." showSearch={false} showFilters={false} onAddEmpty={openCreate} count={shops.length} sortValue="alpha" onSortChange={() => {}} sortOptions={[{ value: 'alpha', label: 'A-Z' }]} />
      <div className="mx-auto max-w-lg space-y-2 px-4 pt-4">
        {shops.length === 0 ? (
          <EmptyState title="Nog geen winkels" description="Maak een winkel aan via de + knop" icon={<Store className="h-7 w-7" />} />
        ) : shops.map((shop) => (
          <article key={shop.id} className="app-card app-animate-in flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[var(--app-radius-md)]" style={{ background: `${shop.color || '#ec4899'}15`, color: shop.color || '#ec4899' }}><Store className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--app-text)]">{shop.name}</span>
            <button type="button" onClick={() => openEditStore(shop)} className="grid h-[34px] w-[34px] place-items-center rounded-[var(--app-radius-md)] border border-[var(--app-border-subtle)] bg-[var(--app-bg)] text-[var(--app-text-muted)]" aria-label={`Edit ${shop.name}`}><Pencil className="h-[15px] w-[15px]" /></button>
          </article>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-black text-[var(--app-text)]">{editing ? t('settings.editShopTitle') : t('settings.addShopTitle')}</h2><button type="button" onClick={closeModal} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--app-bg)]"><X className="h-4 w-4" /></button></div>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder={t('settings.shopNamePlaceholder')} className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-input)] border border-[var(--app-border-subtle)] px-3 text-sm font-semibold outline-none" autoFocus />
            <div className="flex flex-wrap gap-2.5 py-4">{COLOR_PALETTE.map((color) => <button key={color} type="button" onClick={() => setDraftColor(color)} className="h-9 w-9 rounded-full" style={{ background: color, border: draftColor === color ? '3px solid #1a1a2e' : '3px solid transparent', boxShadow: draftColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none' }} aria-label={color} />)}</div>
            <button type="button" onClick={saveShop} className="min-h-[var(--app-touch-target)] w-full rounded-[var(--app-radius-xl)] bg-[var(--app-primary-grad)] text-sm font-black text-white shadow-[var(--app-shadow-fab)]">{t('common.save')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
