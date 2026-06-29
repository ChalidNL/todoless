import { ShoppingCart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { AppHeader } from './shared/NewGlobalHeader';
import { EmptyState } from './shared/EmptyState';

export function ShopsView() {
  const { shops, addShop } = useApp();

  const handleCreateShop = () => {
    const name = window.prompt(t('settings.shopNamePlaceholder'), '');
    const trimmed = name?.trim();
    if (!trimmed) return;
    addShop({ name: trimmed, color: '#ec4899' });
  };

  return (
    <div className="app-shell-bg min-h-full pb-24">
      <AppHeader
        screen="shop"
        searchPlaceholder="Zoek winkels..."
        showSearch={false}
        showFilters={false}
        onAddEmpty={handleCreateShop}
        count={shops.length}
      />
      <div className="mx-auto max-w-lg space-y-3 px-4 pt-4">
        {shops.length === 0 ? (
          <EmptyState title="Nog geen winkels" description="Maak een winkel aan via de + knop" icon={<ShoppingCart className="h-7 w-7" />} />
        ) : (
          shops.map((shop) => (
            <article key={shop.id} className="app-card app-animate-in p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-3xl text-white shadow-lg ring-4 ring-white" style={{ backgroundColor: shop.color }}>
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-extrabold text-[var(--app-text)]">{shop.name}</h2>
                  <span className="mt-2 inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-black" style={{ backgroundColor: `${shop.color}18`, color: shop.color }}>
                    {shop.color}
                  </span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
