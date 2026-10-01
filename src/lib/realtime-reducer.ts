/**
 * #77: apply a PocketBase realtime event to a local list instead of refetching
 * everything. PocketBase only delivers events for records the subscriber may
 * read (collection list/view rules), so an event is trusted for visibility;
 * `visible` lets the caller additionally drop records it never shows.
 *
 * Events for records that stop being readable (e.g. another member makes a
 * task private) are not delivered at all — the periodic/focus resync in
 * AppContext covers that case.
 */
export type RealtimeAction = 'create' | 'update' | 'delete';

export function applyRealtimeEvent<T extends { id: string }>(
  list: T[],
  action: RealtimeAction | string,
  record: T,
  visible = true,
): T[] {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (action === 'delete' || !visible) {
    return index === -1 ? list : list.filter((entry) => entry.id !== record.id);
  }
  if (index === -1) return [record, ...list];
  const next = list.slice();
  next[index] = record;
  return next;
}

/** Own records are always shown; other members' private records never are. */
export function isVisibleToMe(record: { createdBy?: string; isPrivate?: boolean }, myId: string | undefined): boolean {
  return (!!myId && record.createdBy === myId) || !record.isPrivate;
}
