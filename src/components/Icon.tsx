import React from 'react';
import { EMOJI_TO_ICON_MAP } from '../constants/emojiToIcon';
import StarIcon from './icons/StarIcon.svg?react';
import CheckIcon from './icons/CheckIcon.svg?react';
import CloseIcon from './icons/CloseIcon.svg?react';
import TrashIcon from './icons/TrashIcon.svg?react';
import SearchIcon from './icons/SearchIcon.svg?react';
import ClipboardIcon from './icons/ClipboardIcon.svg?react';

const ICONS: Record<string, React.FC<{ color?: string; className?: string }>> = {
  StarIcon,
  CheckIcon,
  CloseIcon,
  TrashIcon,
  SearchIcon,
  ClipboardIcon,
};

export interface IconProps {
  emoji: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ emoji, className, style }) => {
  const mapping = EMOJI_TO_ICON_MAP[emoji];
  if (!mapping) return <span>{emoji}</span>;
  const IconComponent = ICONS[mapping.icon];
  if (!IconComponent) return <span>{emoji}</span>;
  return (
    <span className={`icon-container ${className || ''}`} style={style}>
      <IconComponent color={mapping.color} />
    </span>
  );
};

export default Icon;
