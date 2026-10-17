'use client';

import { ArrowRight, CalendarDays, Check, CheckCircle2, Circle, Flag, Plus, Sun, Trash2 } from 'lucide-react';
import { dueState, suggestedTasks, taskProgress } from '@/lib/progress';
import type { Milestone, Project, Task } from '@/lib/types';

export const prettyDate = (value: string | null) => value
  ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : 'No deadline';

export function ProgressBar({ completed, total, label }: { completed: number; total: number; label: string }) {
  const percent = total ? Math.round(completed / total * 100) : 0;
  return <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${completed} of ${total} tasks completed`}><div style={{ width: percent + '%' }}/></div>;
}

function TaskDate({ task, now }: { task: Task; now: Date }) {
  const state = task.status === 'done' ? 'undated' : dueState(task, now);
  return <span className={`date-label due-${state}`}>{state === 'overdue' ? 'Overdue · ' : ''}{state === 'today' ? 'Due today' : prettyDate(task.due_at)}</span>;
}

export function TodaySection({ projects, tasks, now, busy, onComplete, onProject }: {
  projects: Project[]; tasks: Task[]; now: Date; busy: boolean;
  onComplete: (task: Task) => void; onProject: (project: Project) => void;
}) {
  const activeIds = new Set(projects.filter(project => project.status === 'active').map(project => project.id));
  const activeTasks = tasks.filter(task => activeIds.has(task.project_id));
  const focus = suggestedTasks(activeTasks, now).slice(0, 3);
  const overdue = activeTasks.filter(task => task.status !== 'done' && dueState(task, now) === 'overdue').length;
  const blocked = activeTasks.filter(task => task.status === 'blocked').length;
  return <section className="today-section" aria-labelledby="today-title">
    <div className="today-heading"><div className="today-heading-main"><span className="today-symbol"><Sun size={19}/></span><div><h2 id="today-title">Today</h2><p>A little focus goes a long way.</p></div></div><span className="today-caption">{overdue ? `${overdue} overdue` : 'One step at a time'}</span></div>
    {focus.length ? <><div className="today-tasks">{focus.map((task, index) => {
      const project = projects.find(project => project.id === task.project_id)!;
      return <div className={`focus-task${index === 0 ? ' first-step' : ''}`} key={task.id}>
        <button className="task-checkbox" aria-label={`Complete ${task.title}`} disabled={busy} onClick={() => onComplete(task)}><Circle size={20}/></button>
        <div className="focus-body">{index === 0 && <span className="first-step-label"><Flag size={10}/> Your first step</span>}<strong>{task.title}</strong><button className="task-project-link" onClick={() => onProject(project)}>{project.name}<ArrowRight size={11}/></button></div>
        <TaskDate task={task} now={now}/>
      </div>;
    })}</div><div className="today-foot"><span>{focus.length} suggested {focus.length === 1 ? 'task' : 'tasks'} · chosen by deadline and priority</span>{blocked > 0 && <span>{blocked} blocked</span>}</div></> : <div className="today-empty"><CheckCircle2 size={24}/><div><strong>{blocked ? 'A little help is needed' : 'A little breathing room'}</strong><p>{blocked ? `${blocked} ${blocked === 1 ? 'task is' : 'tasks are'} blocked. Open a project to review what’s needed.` : 'No tasks to focus on. Add a small next step when you’re ready.'}</p></div></div>}
  </section>;
}

export function ProjectCard({ project, tasks, index, now, onOpen }: { project: Project; tasks: Task[]; index: number; now: Date; onOpen: () => void }) {
  const progress = taskProgress(tasks);
  const next = suggestedTasks(tasks, now)[0];
  const allDone = progress.total > 0 && progress.completed === progress.total;
  const monogram = project.name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'PH';
  return <button className={`project-card${allDone ? ' project-finished' : ''}`} onClick={onOpen}>
    <div className="project-top"><div className={'project-icon tone-' + index % 4}>{monogram}</div><span className={`project-status status-${project.status}`}>{project.status === 'active' ? 'In progress' : project.status}</span></div>
    <strong>{project.name}</strong><p>{project.description || 'A little space to make things happen.'}</p>
    <div className="progress-info"><span><b>{progress.completed}</b> of {progress.total} done</span><b>{progress.percent}%</b></div>
    <ProgressBar completed={progress.completed} total={progress.total} label={`${project.name} progress`}/>
    <div className="project-next"><span>{allDone ? <CheckCircle2 size={13}/> : <ArrowRight size={13}/>}</span><div><small>{allDone ? 'Nicely done' : 'Next step'}</small><span>{allDone ? 'Every little step, complete.' : project.status !== 'active' ? `Project ${project.status}` : next?.title || (tasks.some(task => task.status === 'blocked') ? 'Review blocked tasks' : 'Add your first task')}</span></div></div>
    <div className="project-meta"><span><CalendarDays size={13}/>{prettyDate(project.target_date)}</span><span>Open project <ArrowRight size={12}/></span></div>
  </button>;
}

export function MilestoneBoard({ milestones, tasks, selected, onSelect, onAdd }: {
  milestones: Milestone[]; tasks: Task[]; selected: string | null;
  onSelect: (id: string | null) => void; onAdd: () => void;
}) {
  const completed = milestones.filter(milestone => {
    const progress = taskProgress(tasks.filter(task => task.milestone_id === milestone.id));
    return progress.total > 0 && progress.total === progress.completed;
  }).length;
  return <section className="milestone-section" aria-labelledby="milestones-title">
    <div className="section-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h2 id="milestones-title">Milestones {milestones.length > 0 && <span className="heading-count">{completed}/{milestones.length}</span>}</h2></div><button className="text-btn" onClick={onAdd}><Plus size={15}/> Add milestone</button></div>
    {milestones.length ? <><div className="milestone-grid">{milestones.map((milestone, index) => {
      const progress = taskProgress(tasks.filter(task => task.milestone_id === milestone.id));
      const done = progress.total > 0 && progress.total === progress.completed;
      return <button key={milestone.id} className={`milestone-card${done ? ' milestone-done' : ''}${selected === milestone.id ? ' milestone-selected' : ''}`} aria-pressed={selected === milestone.id} onClick={() => onSelect(selected === milestone.id ? null : milestone.id)}>
        <div className="milestone-top"><span className="milestone-number">{done ? <Check size={14}/> : String(index + 1).padStart(2, '0')}</span><span>{done ? 'Complete' : progress.completed ? 'Underway' : 'Not started'}</span></div>
        <strong>{milestone.title}</strong><ProgressBar completed={progress.completed} total={progress.total} label={`${milestone.title} progress`}/><small>{progress.total ? `${progress.completed} of ${progress.total} tasks done` : 'Assign tasks to get started'}<ArrowRight size={12}/></small>
      </button>;
    })}</div><p className="section-note">Click a milestone to see its tasks. Progress follows the tasks you complete.</p></> : <div className="milestone-empty"><span className="milestone-empty-icon"><Flag size={20}/></span><div><strong>Give your plan a few stepping stones.</strong><p>Try “Research”, “Book”, and “Get ready”. Link tasks and watch each stage come together.</p></div><button className="ghost-btn" onClick={onAdd}><Plus size={14}/> Add your first</button></div>}
  </section>;
}

export function TaskList({ tasks, milestones, busy, now, onComplete, onDelete, onAssign }: {
  tasks: Task[]; milestones: Milestone[]; busy: boolean; now: Date;
  onComplete: (task: Task) => void; onDelete: (task: Task) => void; onAssign: (task: Task, milestoneId: string) => void;
}) {
  return <div className="task-list">{tasks.map(task => <div className={'task-row' + (task.status === 'done' ? ' done' : '')} key={task.id}>
    <button className="task-checkbox" aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`} disabled={busy} onClick={() => onComplete(task)}>{task.status === 'done' ? <CheckCircle2 size={20}/> : <Circle size={20}/>}</button>
    <div className="task-body"><strong>{task.title}</strong><small>{task.status.replace('_', ' ')} · <span className={'priority ' + task.priority}>{task.priority}</span></small></div>
    {milestones.length > 0 && <select className="task-milestone-select" value={task.milestone_id || ''} disabled={busy} aria-label={`Milestone for ${task.title}`} onChange={event => onAssign(task, event.target.value)}><option value="">No milestone</option>{milestones.map(milestone => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select>}
    <TaskDate task={task} now={now}/><button className="icon-btn task-trash" aria-label={`Delete ${task.title}`} disabled={busy} onClick={() => onDelete(task)}><Trash2 size={16}/></button>
  </div>)}</div>;
}
