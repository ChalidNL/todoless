/**
 * Label colors — soft pastel palette for labels.
 * Used when creating new labels to give them a random color.
 * Colors are persisted to PocketBase per label.
 */
const SOFT_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
] as const;

let colorIndex = 0;

/**
 * Get the next color from the soft palette (rotates through).
 */
export function nextLabelColor(): string {
  const color = SOFT_PALETTE[colorIndex % SOFT_PALETTE.length];
  colorIndex++;
  return color;
}
