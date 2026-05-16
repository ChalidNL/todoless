import React from 'react';
import { AppLogo } from './AppLogo';

export const TopBar = () => {
  return (
    <div className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40 safe-top">
      <div className="max-w-lg mx-auto px-4 py-2.5">
        <div className="flex justify-center">
          <AppLogo size="sm" showText={true} variant="light" />
        </div>
      </div>
    </div>
  );
};