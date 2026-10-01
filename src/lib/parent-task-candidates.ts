import type { Task } from '../types';

const isSubtask = (task: Task) => task.linkedType === 'task' && !!task.linkedTo;

// Is `candidate` a (transitive) child of `task`? Guards data that already
// contains a chain; walks at most `tasks.length` steps so a cycle cannot hang.
function descendsFrom(candidate: Task, task: Task, byId: Map<string, Task>): boolean {
  let cursor: Task | undefined = candidate;
  for (let hops = 0; cursor && isSubtask(cursor) && hops <= byId.size; hops++) {
    if (cursor.linkedTo === task.id) return true;
    cursor = byId.get(cursor.linkedTo as string);
  }
  return false;
}

// Which tasks may `task` be filed under? The lists treat any task with
// linkedType 'task' + linkedTo as a subtask and hide it, and the parent card
// renders exactly one level. So a parent must be a top-level task, not done,
// not the task itself and not one of its own subtasks - otherwise the task
// disappears from every list (A -> B -> A hides both; A under a subtask of C
// is never rendered anywhere).
export function isEligibleParent(candidate: Task, task: Task, tasks: Task[]): boolean {
  if (candidate.id === task.id || candidate.status === 'done') return false;
  if (isSubtask(candidate)) return false;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return !descendsFrom(candidate, task, byId);
}

export function parentTaskCandidates(tasks: Task[], task: Task, query: string, limit = 6): Task[] {
  const needle = query.trim().toLowerCase();
  return tasks
    .filter((candidate) => isEligibleParent(candidate, task, tasks))
    .filter((candidate) => !needle || candidate.title.toLowerCase().includes(needle))
    .slice(0, limit);
}
