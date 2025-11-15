import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieClient';

export function useTodoCounts(userId: string) {
  const todoCount = useLiveQuery(() => db.todos.where('userId').equals(userId).count(), [userId], 0);
  const labelCount = useLiveQuery(() => db.labels.where('userId').equals(userId).count(), [userId], 0);
  return { todoCount, labelCount };
}
