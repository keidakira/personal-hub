export type ProgressTask = {
  id: string;
  project_id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_at: string | null;
  created_at: string;
  milestone_id: string | null;
};

export function taskProgress(tasks: readonly ProgressTask[]) {
  const completed = tasks.filter(task => task.status === 'done').length;
  return { total: tasks.length, completed, percent: tasks.length ? Math.round(completed / tasks.length * 100) : 0 };
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dueState(task: Pick<ProgressTask, 'due_at'>, now: Date): 'overdue' | 'today' | 'upcoming' | 'undated' {
  if (!task.due_at) return 'undated';
  const date = new Date(task.due_at);
  if (!Number.isFinite(date.getTime())) return 'undated';
  const diff = dayStart(date) - dayStart(now);
  return diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'upcoming';
}

/** Deadlines first, then work already started and priority. Never suggest blocked work. */
export function suggestedTasks<T extends ProgressTask>(tasks: readonly T[], now: Date): T[] {
  const urgency = { overdue: 0, today: 1, undated: 2, upcoming: 2 };
  const priority = { high: 0, medium: 1, low: 2 };
  return tasks.filter(task => task.status !== 'done' && task.status !== 'blocked').sort((a, b) => {
    const rank = urgency[dueState(a, now)] - urgency[dueState(b, now)];
    if (rank) return rank;
    const started = Number(b.status === 'in_progress') - Number(a.status === 'in_progress');
    if (started) return started;
    const importance = priority[a.priority] - priority[b.priority];
    if (importance) return importance;
    const date = (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity);
    return (Number.isNaN(date) ? 0 : date) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
}
