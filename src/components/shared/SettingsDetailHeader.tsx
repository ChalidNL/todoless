import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { t } from '../../i18n/translations';
import { AppHeader } from './NewGlobalHeader';

interface SettingsDetailHeaderProps {
  mode: 'list' | 'detail';
  // Detail mode
  title?: string;
  subtitle?: string;
  themeColor?: string; // e.g. '#6366f1' for profile, '#06b6d4' for family
  avatarInitials?: string;
  onBack?: () => void;
  // List mode (pass-through to AppHeader)
  screen?: 'leden' | 'labels' | 'shop' | 'instellingen';
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onAdd?: () => void;
  count?: number;
  showFilters?: boolean;
  // Common
  className?: string;
}

/**
 * Generate a three-stop gradient string from a single theme color.
 * Blends toward lighter/analogous shades for a smooth hero background.
 */
function gradientFromColor(color: string): string {
  // Parse the hex color to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create two lighter variants by shifting toward white
  const midR = Math.min(255, r + Math.round((255 - r) * 0.3));
  const midG = Math.min(255, g + Math.round((255 - g) * 0.3));
  const midB = Math.min(255, b + Math.round((255 - b) * 0.3));

  const lightR = Math.min(255, r + Math.round((255 - r) * 0.55));
  const lightG = Math.min(255, g + Math.round((255 - g) * 0.55));
  const lightB = Math.min(255, b + Math.round((255 - b) * 0.55));

  return `linear-gradient(135deg, ${color} 0%, rgb(${midR},${midG},${midB}) 50%, rgb(${lightR},${lightG},${lightB}) 100%)`;
}

/**
 * Derive a shadow color from the theme color using the same RGB values
 * but with a fixed 28% opacity.
 */
function shadowFromColor(color: string): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `0 16px 40px rgba(${r},${g},${b},0.28)`;
}

export function SettingsDetailHeader({
  mode,
  title,
  subtitle,
  themeColor = '#6366f1',
  avatarInitials,
  onBack,
  screen,
  searchPlaceholder,
  onSearch,
  onAdd,
  count,
  showFilters,
  className = '',
}: SettingsDetailHeaderProps) {
  if (mode === 'list') {
    return (
      <AppHeader
        screen={screen}
        searchPlaceholder={searchPlaceholder}
        showFilters={showFilters ?? false}
        showSearch={true}
        showAdd={true}
        onSearch={onSearch}
        onAddEmpty={onAdd}
        count={count}
      />
    );
  }

  // Detail mode — gradient hero section
  const gradient = gradientFromColor(themeColor);
  const shadow = shadowFromColor(themeColor);

  return (
    <section
      className={`relative overflow-hidden px-6 pb-7 pt-5 text-white ${className}`}
      style={{
        background: gradient,
        boxShadow: shadow,
      }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-4 inline-flex min-h-9 items-center gap-1 rounded-full bg-white/12 px-3 text-sm font-semibold text-white active:scale-[0.97]"
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
          {t('common.back')}
        </button>
      )}

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        {avatarInitials && (
          <span className="relative grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full border-[3px] border-white/60 bg-white/25 text-[28px] font-black text-white shadow-lg">
            {avatarInitials}
          </span>
        )}

        {title && (
          <div>
            <h1 className="text-xl font-black tracking-[-0.01em]">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm font-semibold text-white/80">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default SettingsDetailHeader;
