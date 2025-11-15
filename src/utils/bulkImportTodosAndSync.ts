import { db } from '../db/dexieClient';
import type { Todo } from '../db/schema';

type TodoInput = {
  title: string;
  labels?: string[];
};

export async function bulkImportTodosAndSync(
  todosWithLabels: TodoInput[],
  userId: string,
  setSyncing: (syncing: boolean) => void
) {
  setSyncing(true);
  await db.transaction('rw', db.todos, db.labels, async () => {
    // Unieke labels toevoegen
    const labelNames = [...new Set(todosWithLabels.flatMap(todo => todo.labels || []))];
    const existingLabels = await db.labels.where('name').anyOf(labelNames).and(l => l.userId === userId).toArray();
    const newLabels = labelNames.filter(name => !existingLabels.some(l => l.name === name)).map(name => ({ name, userId }));
    if (newLabels.length) await db.labels.bulkAdd(newLabels);

    // Label-IDs ophalen
    const allLabels = await db.labels.where('userId').equals(userId).toArray();
    const getLabelIds = (names: string[]) => names.map(name => allLabels.find(l => l.name === name)?.id).filter((id): id is string => Boolean(id));

    // Duplicaat-check en todos toevoegen
    const existingTodos = await db.todos.where('userId').equals(userId).toArray();
    for (const todo of todosWithLabels) {
      const isDuplicate = existingTodos.some(e => e.title === todo.title);
      if (isDuplicate) continue;
      await db.todos.add({
        id: crypto.randomUUID(),
        title: todo.title,
        completed: false,
        labelIds: getLabelIds(todo.labels || []),
        createdAt: new Date().toISOString(),
      } as Todo);
    }
  });
  // Note: Dexie Cloud sync not implemented yet
  // if (db.cloud && db.cloud.sync) await db.cloud.sync();
  setSyncing(false);
}
