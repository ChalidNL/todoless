import React from 'react';
import { CheckSquare } from 'lucide-react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'light' | 'dark';
}

interface AppMarkProps {
  className?: string;
}

export const AppMark = ({ className = '' }: AppMarkProps) => (
  <CheckSquare className={className} strokeWidth={2.5} aria-hidden="true" />
);

export const AppLogo = ({ size = 'md', showText = true, variant = 'dark' }: AppLogoProps) => {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const colorClass = variant === 'light' ? 'text-white' : 'text-neutral-900';

  return (
    <div className="flex items-center gap-2">
      <AppMark className={`${sizes[size]} ${colorClass} shrink-0`} />
      {showText && (
        <span className={`font-semibold ${colorClass} ${textSizes[size]}`}>
          todoless
        </span>
      )}
    </div>
  );
};