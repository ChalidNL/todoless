// Mapping van emoji naar icon component en kleur
export const EMOJI_TO_ICON_MAP: Record<string, { icon: string; color: string; type: string } | undefined> = {
  '⭐': { icon: 'StarIcon', color: '#FFC107', type: 'colorful' },
  '✅': { icon: 'CheckIcon', color: '#4CAF50', type: 'colorful' },
  '❌': { icon: 'CloseIcon', color: '#FF6B6B', type: 'colorful' },
  '🗑️': { icon: 'TrashIcon', color: '#757575', type: 'colorful' },
  '🔍': { icon: 'SearchIcon', color: '#000000', type: 'monochrome' },
  '📋': { icon: 'ClipboardIcon', color: '#2196F3', type: 'colorful' },
  // Voeg hier meer emoji mappings toe
};
