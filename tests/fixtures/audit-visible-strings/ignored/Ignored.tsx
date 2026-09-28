export const Ignored = ({ name }: { name: string }) => (
  <div>
    {/* i18n-ignore: brand word, stays literal by convention */}
    <p>TodoLess</p>
    <span>{t('dashboard.blocked')}</span>
    {/* i18n-ignore: technical landmark label */}
    <nav aria-label="Primary">
      <button aria-label={t('common.edit')}>✕</button>
    </nav>
    {/* i18n-ignore: brand alt text */}
    <img src="/logo.svg" alt="TodoLess" />
  </div>
);