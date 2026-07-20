/** Column id — defaults use fixed keys; custom columns use generated ids */
export type TaskStatus = string;
export type TaskType = 'task' | 'bug' | 'story' | 'time';
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export type BoardColumn = {
  id: string;
  label: string;
  accent: string;
  /** Legacy flag — columns are deletable unless it would leave the board empty */
  locked?: boolean;
};

export type TaskAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** Server path (e.g. /uploads/…) or legacy data URL */
  url?: string;
  /** @deprecated prefer url — kept for local preview fallback */
  dataUrl?: string;
  createdAt: string;
  uploadedBy: string;
};

export function attachmentHref(att: TaskAttachment): string | undefined {
  return att.url || att.dataUrl;
}

export type TaskComment = {
  id: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  attachments: TaskAttachment[];
};

export type ProjectRole = 'admin' | 'member';

export type ProjectMember = {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
  status?: 'active' | 'pending';
  userId?: string | null;
  avatarUrl?: string | null;
  addedAt: string;
};

export type Project = {
  id: string;
  name: string;
  key: string;
  description: string;
  avatarUrl?: string | null;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string | null;
  columns: BoardColumn[];
  members: ProjectMember[];
};

/** Sub-group inside a project — tasks can be scoped to a team when teams exist. */
export type ProjectTeam = {
  id: string;
  projectId: string;
  name: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
};

/** Admin backlog — create now, assign to a teammate later */
export type TimelineItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  attachments: TaskAttachment[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  /** Set when admin assigns → board task is created */
  assigneeId: string | null;
  assigneeName: string | null;
  taskId: string | null;
  assignedAt: string | null;
};

export type BoardTask = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  estimateHours: number;
  loggedHours: number;
  remainingHours: number;
  createdBy: string;
  createdByName: string;
  assigneeId: string;
  assigneeName: string;
  reporterName: string;
  labels: string[];
  startDate: string;
  endDate: string;
  dueDate: string;
  /** null = project-global (default when project has no teams) */
  teamId: string | null;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
};

export const COLUMN_ACCENTS = [
  'bg-ink-500',
  'bg-[#f0b232]',
  'bg-[#00a8fc]',
  'bg-[#23a559]',
  'bg-[#5865f2]',
  'bg-[#eb459e]',
  'bg-[#57f287]',
  'bg-[#ed4245]',
  'bg-brand-500',
  'bg-[#fee75c]',
] as const;

export const DEFAULT_BOARD_COLUMNS: BoardColumn[] = [
  { id: 'todo', label: 'To Do', accent: 'bg-ink-500', locked: true },
  { id: 'in_progress', label: 'In Progress', accent: 'bg-[#f0b232]', locked: true },
  { id: 'review', label: 'In Review', accent: 'bg-[#00a8fc]', locked: true },
  { id: 'done', label: 'Done', accent: 'bg-[#23a559]', locked: true },
];

export const BOARD_COLUMNS = DEFAULT_BOARD_COLUMNS;

export const TASK_TYPES: { id: TaskType; label: string; color: string }[] = [
  { id: 'task', label: 'Task', color: 'bg-[#00a8fc]' },
  { id: 'bug', label: 'Bug', color: 'bg-[#ed4245]' },
  { id: 'story', label: 'Story', color: 'bg-[#23a559]' },
  { id: 'time', label: 'Time', color: 'bg-[#f0b232]' },
];

export const TASK_PRIORITIES: TaskPriority[] = [
  'lowest',
  'low',
  'medium',
  'high',
  'highest',
];

export function ensureProjectColumns(project: Project): Project {
  const withCols = project.columns?.length
    ? project
    : { ...project, columns: [...DEFAULT_BOARD_COLUMNS] };
  return {
    ...withCols,
    members: withCols.members ?? [],
  };
}

/** Backfill fields for tasks saved before Jira-style details existed */
export function ensureTaskFields(task: BoardTask): BoardTask {
  return {
    ...task,
    remainingHours: task.remainingHours ?? Math.max((task.estimateHours ?? 0) - (task.loggedHours ?? 0), 0),
    reporterName: task.reporterName || task.createdByName || 'Unknown',
    labels: task.labels ?? [],
    startDate: task.startDate ?? '',
    endDate: task.endDate ?? '',
    dueDate: task.dueDate ?? '',
    teamId: task.teamId ?? null,
    attachments: task.attachments ?? [],
    comments: (task.comments ?? []).map((c) => ({
      ...c,
      attachments: c.attachments ?? [],
    })),
    priority: (task.priority as TaskPriority) || 'medium',
  };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
