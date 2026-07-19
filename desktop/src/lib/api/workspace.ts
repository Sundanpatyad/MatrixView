import { apiFetch } from './client';
import type {
  BoardColumn,
  BoardTask,
  Project,
  ProjectRole,
  TaskPriority,
  TaskType,
  TimelineItem,
} from '@/lib/workspace/types';

export type WorkspacePayload = {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
};

export function fetchWorkspace(): Promise<WorkspacePayload> {
  return apiFetch<WorkspacePayload>('/api/workspace', { auth: true });
}

export function createProjectRequest(input: {
  name: string;
  key: string;
  description: string;
}): Promise<{ project: Project }> {
  return apiFetch('/api/projects', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export type InviteMemberResult = {
  project: Project;
  result: 'added' | 'invited';
  emailSent: boolean;
  inviteLink: string | null;
};

export function addMemberRequest(
  projectId: string,
  input: { name?: string; email: string; role: ProjectRole },
): Promise<InviteMemberResult> {
  return apiFetch(`/api/projects/${projectId}/members`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function updateMemberRoleRequest(
  projectId: string,
  memberId: string,
  role: ProjectRole,
): Promise<{ project: Project }> {
  return apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ role }),
  });
}

export function removeMemberRequest(
  projectId: string,
  memberId: string,
): Promise<{ project: Project }> {
  return apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function addColumnRequest(
  projectId: string,
  label: string,
): Promise<{ project: Project; column: BoardColumn }> {
  return apiFetch(`/api/projects/${projectId}/columns`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ label }),
  });
}

export function renameColumnRequest(
  projectId: string,
  columnId: string,
  label: string,
): Promise<{ project: Project }> {
  return apiFetch(`/api/projects/${projectId}/columns/${columnId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ label }),
  });
}

export function removeColumnRequest(
  projectId: string,
  columnId: string,
  moveToStatus?: string,
): Promise<{ project: Project; tasks: BoardTask[] }> {
  const q = moveToStatus ? `?moveTo=${encodeURIComponent(moveToStatus)}` : '';
  return apiFetch(`/api/projects/${projectId}/columns/${columnId}${q}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function reorderColumnsRequest(
  projectId: string,
  columnIds: string[],
): Promise<{ project: Project }> {
  return apiFetch(`/api/projects/${projectId}/columns`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ columnIds }),
  });
}

export function createTaskRequest(
  projectId: string,
  input: {
    title: string;
    description: string;
    type: TaskType;
    priority: TaskPriority;
    estimateHours: number;
    assigneeName: string;
    assigneeId?: string;
    dueDate: string;
  },
): Promise<{ task: BoardTask }> {
  return apiFetch(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function updateTaskRequest(
  taskId: string,
  patch: Partial<BoardTask>,
): Promise<{ task: BoardTask }> {
  const {
    title,
    description,
    type,
    priority,
    status,
    estimateHours,
    loggedHours,
    assigneeId,
    assigneeName,
    reporterName,
    labels,
    startDate,
    endDate,
    dueDate,
  } = patch;
  return apiFetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({
      title,
      description,
      type,
      priority,
      status,
      estimateHours,
      loggedHours,
      assigneeId,
      assigneeName,
      reporterName,
      labels,
      startDate,
      endDate,
      dueDate,
    }),
  });
}

export function addCommentRequest(
  taskId: string,
  body: string,
  files: File[] = [],
): Promise<{ task: BoardTask }> {
  const form = new FormData();
  form.append('body', body);
  for (const file of files) form.append('files', file);
  return apiFetch(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    auth: true,
    body: form,
  });
}

export function addTaskAttachmentsRequest(
  taskId: string,
  files: File[],
): Promise<{ task: BoardTask }> {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  return apiFetch(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    auth: true,
    body: form,
  });
}

export function removeTaskAttachmentRequest(
  taskId: string,
  attachmentId: string,
): Promise<{ task: BoardTask }> {
  return apiFetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function createTimelineRequest(
  input: {
    projectId: string;
    title: string;
    description: string;
    type: TaskType;
    priority: TaskPriority;
    dueDate: string;
  },
  files: File[] = [],
): Promise<{ item: TimelineItem }> {
  const form = new FormData();
  form.append('projectId', input.projectId);
  form.append('title', input.title);
  form.append('description', input.description);
  form.append('type', input.type);
  form.append('priority', input.priority);
  form.append('dueDate', input.dueDate);
  for (const file of files) form.append('files', file);
  return apiFetch('/api/timeline', {
    method: 'POST',
    auth: true,
    body: form,
  });
}

export function updateTimelineRequest(
  itemId: string,
  input: {
    title: string;
    description: string;
    type: TaskType;
    priority: TaskPriority;
    dueDate: string;
    removeAttachmentIds?: string[];
    assigneeId?: string;
    assigneeName?: string;
  },
  files: File[] = [],
): Promise<{ item: TimelineItem; task: BoardTask | null }> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('description', input.description);
  form.append('type', input.type);
  form.append('priority', input.priority);
  form.append('dueDate', input.dueDate);
  if (input.assigneeId !== undefined) form.append('assigneeId', input.assigneeId);
  if (input.assigneeName !== undefined) form.append('assigneeName', input.assigneeName);
  if (input.removeAttachmentIds?.length) {
    form.append('removeAttachmentIds', JSON.stringify(input.removeAttachmentIds));
  }
  for (const file of files) form.append('files', file);
  return apiFetch(`/api/timeline/${itemId}`, {
    method: 'PATCH',
    auth: true,
    body: form,
  });
}

export function assignTimelineRequest(
  itemId: string,
  assignee: { id: string; name: string },
): Promise<{ timelineItem: TimelineItem; task: BoardTask }> {
  return apiFetch(`/api/timeline/${itemId}/assign`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(assignee),
  });
}

export function deleteTimelineRequest(itemId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/timeline/${itemId}`, {
    method: 'DELETE',
    auth: true,
  });
}
