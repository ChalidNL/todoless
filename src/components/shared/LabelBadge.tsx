import React from 'react';
import { Home, Lock, Users } from 'lucide-react';
import { t } from '../../i18n/translations';
import type { LabelVisibility } from '../../types';

type BadgeLabel = {
  name: string;
  color: string;
  visibility?: LabelVisibility;
};

interface LabelBadgeProps {
  label: BadgeLabel;
  onRemove?: (e?: React.MouseEvent) => void;
  size?: 'sm' | 'md';
}

const VisibilityIcon = ({ visibility }: { visibility: LabelVisibility }) => {
  const cls = 'w-3 h-3 opacity-80';
  if (visibility === 'private') return <Lock className={cls} aria-label={t('labels.visibilityPrivate')} />;
  if (visibility === 'shared') return <Users className={cls} aria-label={t('labels.visibilityShared')} />;
  return <Home className={cls} aria-label={t('labels.visibilityFamily')} />;
};

export const LabelBadge = ({ label, onRemove, size = 'md' }: LabelBadgeProps) => {
  return (
    <span
      className={`chip inline-flex items-center gap-1 ${
        size === 'sm' ? '' : 'px-2'
      }`}
      style={{
        backgroundColor: `${label.color}15`,
        color: label.color,
      }}
      title={`${label.name} · ${label.visibility || 'family'}`}
    >
      <VisibilityIcon visibility={label.visibility || 'family'} />
      {label.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
};
