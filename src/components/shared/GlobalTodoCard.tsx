/**
 * GlobalTodoCard — shared card component for all todoless entity types.
 *
 * Phase 1 (Tasks): re-exports CompactTaskCard as the canonical card for Tasks.
 * Phase 2 (Groceries+): UnifiedCard replaces GroceryCard/CompactItemCard.
 *
 * Import from here instead of CompactTaskCard so consumers get the
 * stable API surface regardless of underlying implementation.
 */
export { UnifiedCard as GlobalTodoCard } from './UnifiedCard';
