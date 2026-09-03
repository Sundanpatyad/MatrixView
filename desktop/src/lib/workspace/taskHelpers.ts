import type { BoardTask, Project, ProjectMember } from './types';

export type WorkUser = { email: string; name: string };

export function memberForUser(
  project: Project | undefined,
  user: WorkUser | null | undefined,
): ProjectMember | null {
  if (!project || !user) return null;
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim().toLowerCase();
  return (
    project.members.find((m) => m.email.toLowerCase() === email) ??
    project.members.find((m) => m.name.trim().toLowerCase() === name) ??
    null
  );
}

export function isUnassigned(task: BoardTask): boolean {
  const id = (task.assigneeId ?? '').trim();
  const name = (task.assigneeName ?? '').trim().toLowerCase();
  return !id || !name || name === 'unassigned';
}

export function isTaskAssignedTo(
  task: BoardTask,
  member: { id: string; name: string } | null | undefined,
): boolean {
  if (!member) return false;
  const name = member.name.trim().toLowerCase();
  return (
    (Boolean(member.id) && task.assigneeId === member.id) ||
    task.assigneeName.trim().toLowerCase() === name
  );
}

export function isTaskAssignedToUser(
  task: BoardTask,
  user: WorkUser | null | undefined,
  project?: Project,
): boolean {
  if (!user) return false;
  const member = memberForUser(project, user);
  if (member && isTaskAssignedTo(task, member)) return true;
  return task.assigneeName.trim().toLowerCase() === user.name.trim().toLowerCase();
}

export function dueKey(raw: string): string {
  if (!raw?.trim()) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return localYmd(d);
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function isOverdue(task: BoardTask): boolean {
  if (task.status === 'done') return false;
  const key = dueKey(task.dueDate);
  if (!key) return false;
  return key < localYmd(new Date());
}

export function isDueSoon(task: BoardTask, days = 7): boolean {
  if (task.status === 'done' || isOverdue(task)) return false;
  const key = dueKey(task.dueDate);
  if (!key) return false;
  const end = new Date();
  end.setDate(end.getDate() + days);
  return key <= localYmd(end);
}

const PRIORITY_RANK: Record<string, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

export function compareMyWork(a: BoardTask, b: BoardTask): number {
  const aOver = isOverdue(a) ? 0 : 1;
  const bOver = isOverdue(b) ? 0 : 1;
  if (aOver !== bOver) return aOver - bOver;
  const aDue = dueKey(a.dueDate) || '9999-12-31';
  const bDue = dueKey(b.dueDate) || '9999-12-31';
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  const pa = PRIORITY_RANK[a.priority] ?? 2;
  const pb = PRIORITY_RANK[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  return a.title.localeCompare(b.title);
}

export function formatDueLabel(raw: string): string {
  const key = dueKey(raw);
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function isTaskOpen(task: BoardTask, project?: Project): boolean {
  const doneId =
    project?.columns.find((c) => c.id === 'done')?.id ??
    project?.columns[project.columns.length - 1]?.id ??
    'done';
  return task.status !== doneId && task.status !== 'done';
}
