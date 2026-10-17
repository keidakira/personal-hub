import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../lib/progress.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { dueState, taskProgress, suggestedTasks } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = new Date(2026, 9, 17, 12);
const task = (id, overrides = {}) => ({ id, project_id: 'project', title: id, status: 'todo', priority: 'medium', due_at: null, milestone_id: null, created_at: '2026-10-01', ...overrides });

test('progress handles empty stages and mixed task states without counting blocked work as done', () => {
  assert.deepEqual(taskProgress([]), { total: 0, completed: 0, percent: 0 });
  assert.deepEqual(taskProgress([task('a', { status: 'done' }), task('b'), task('c', { status: 'blocked' })]), { total: 3, completed: 1, percent: 33 });
  assert.equal(taskProgress([task('a', { status: 'done' })]).percent, 100);
});
test('due dates use local calendar days, including end of today', () => {
  assert.equal(dueState(task('a', { due_at: new Date(2026, 9, 17, 23, 59).toISOString() }), now), 'today');
  assert.equal(dueState(task('a', { due_at: new Date(2026, 9, 16, 23, 59).toISOString() }), now), 'overdue');
  assert.equal(dueState(task('a', { due_at: new Date(2026, 9, 18).toISOString() }), now), 'upcoming');
  assert.equal(dueState(task('a', { due_at: 'invalid' }), now), 'undated');
});
test('today prioritizes overdue and today before started work and priority, without mutating input', () => {
  const tasks = [task('future', { priority: 'low', due_at: new Date(2026, 9, 21).toISOString() }), task('high', { priority: 'high' }), task('started', { status: 'in_progress' }), task('today', { due_at: now.toISOString() }), task('overdue', { due_at: new Date(2026, 9, 16).toISOString() }), task('done', { status: 'done' }), task('blocked', { status: 'blocked', priority: 'high' })];
  const original = tasks.map(t => t.id);
  assert.deepEqual(suggestedTasks(tasks, now).map(t => t.id), ['overdue', 'today', 'started', 'high', 'future']);
  assert.deepEqual(tasks.map(t => t.id), original);
});
test('same-day deadlines and undated tasks sort deterministically', () => {
  const tasks = [task('z'), task('b', { due_at: now.toISOString() }), task('a', { due_at: new Date(2026, 9, 17, 8).toISOString() }), task('c')];
  assert.deepEqual(suggestedTasks(tasks, now).map(t => t.id), ['a', 'b', 'c', 'z']);
});
test('milestone progress changes independently when a linked task is completed or reassigned', () => {
  const tasks = [task('a', { milestone_id: 'research', status: 'done' }), task('b', { milestone_id: 'research' }), task('c', { milestone_id: 'book' })];
  const stage = id => taskProgress(tasks.filter(t => t.milestone_id === id));
  assert.equal(stage('research').percent, 50);
  assert.equal(stage('book').percent, 0);
  tasks[1].status = 'done';
  assert.equal(stage('research').percent, 100);
  tasks[1].milestone_id = 'book';
  assert.equal(stage('book').percent, 50);
  assert.equal(taskProgress(tasks).completed, 2);
});
