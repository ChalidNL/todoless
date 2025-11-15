import { db } from '../db/dexieClient';
import type { Todo, Label } from '../db/schema';

type TodoInput = {
  title: string;
  labels?: string[];
};

export async function bulkImportTodos(todosWithLabels: TodoInput[], userId: string) {
  return db.transaction('rw', db.todos, db.labels, async () => {
    // 1. Collect unique labels and add them
    const labelNames = [...new Set(todosWithLabels.flatMap(todo => todo.labels || []))];
    const existingLabels = await db.labels.where('name').anyOf(labelNames).and(l => l.userId === userId).toArray();
    const newLabels = labelNames.filter(name => !existingLabels.some(l => l.name === name)).map(name => ({ name, userId }));
    if (newLabels.length) await db.labels.bulkAdd(newLabels);

    // 2. Get label IDs
    const allLabels = await db.labels.where('userId').equals(userId).toArray();
    const getLabelIds = (names: string[]) => names.map(name => allLabels.find(l => l.name === name)?.id).filter((id): id is string => Boolean(id));

    // 3. Check for duplicates and add todos
    const existingTodos = await db.todos.where('userId').equals(userId).toArray();
    let added = 0, duplicates = 0, errors = [];
    for (const todo of todosWithLabels) {
      const isDuplicate = existingTodos.some(e => e.title === todo.title);
      if (isDuplicate) {
        duplicates++;
        continue;
      }
      try {
        await db.todos.add({
          id: crypto.randomUUID(),
          title: todo.title,
          completed: false,
          labelIds: getLabelIds(todo.labels || []),
          createdAt: new Date().toISOString(),
        } as Todo);
        added++;
      } catch (error) {
        errors.push({ todo, error });
      }
    }
    return { added, duplicates, errors };
  });
}
