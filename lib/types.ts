import type { ProgressTask } from './progress';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  target_date: string | null;
  created_at: string;
};

export type Task = ProgressTask & {
  description: string | null;
  parent_task_id: string | null;
  assigned_to: string | null;
};

export type Milestone = {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
};

export type NewTask = { title: string; priority: Task['priority']; due: string; milestone: string };
