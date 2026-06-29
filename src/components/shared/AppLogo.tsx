import React from 'react';

const APP_ICON_SRC = '/icons/logo-rainbow.png';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'light' | 'dark';
}

interface AppMarkProps {
  className?: string;
}

export const AppMark = ({ className = '' }: AppMarkProps) => (
  <img
    src={APP_ICON_SRC}
    alt=""
    aria-hidden="true"
    className={`inline-block object-contain ${className}`}
    draggable={false}
  />
);

export const AppLogo = ({ size = 'md', showText = true, variant = 'dark' }: AppLogoProps) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const colorClass = variant === 'light' ? 'text-white' : 'text-neutral-900';

  return (
    <div className="flex items-center gap-2">
      <AppMark className={`${sizes[size]} shrink-0`} />
      {showText && (
        <span className={`font-semibold ${colorClass} ${textSizes[size]}`}>
          todoless
        </span>
      )}
    </div>
  );
};
