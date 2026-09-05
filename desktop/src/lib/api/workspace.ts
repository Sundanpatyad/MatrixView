import { apiFetch } from './client';
import type {
  BoardColumn,
  BoardTask,
  Project,
  ProjectPhase,
  ProjectRole,
  ProjectSprint,
  ProjectTeam,
  TaskPriority,
  TaskType,
  TimelineItem,
} from '@/lib/workspace/types';

export type WorkspacePayload = {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
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

export function uploadProjectAvatarRequest(
  projectId: string,
  file: File,
): Promise<{ project: Project }> {
  const body = new FormData();
  body.append('avatar', file);
  return apiFetch(`/api/projects/${projectId}/avatar`, {
    method: 'POST',
    auth: true,
    body,
  });
}

export function removeProjectAvatarRequest(
  projectId: string,
): Promise<{ project: Project }> {
  return apiFetch(`/api/projects/${projectId}/avatar`, {
    method: 'DELETE',
    auth: true,
  });
}

export function deleteProjectRequest(projectId: string): Promise<{ ok: boolean; projectId: string }> {
  return apiFetch(`/api/projects/${projectId}`, {
    method: 'DELETE',
    auth: true,
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
): Promise<{ project: Project; tasks: BoardTask[]; timeline: TimelineItem[] }> {
  return apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function addColumnRequest(
  projectId: string,
  label: string,
  sprintId?: string,
): Promise<{ project: Project; column: BoardColumn; sprint?: ProjectSprint }> {
  return apiFetch(`/api/projects/${projectId}/columns`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ label, sprintId }),
  });
}

export function renameColumnRequest(
  projectId: string,
  columnId: string,
  label: string,
  sprintId?: string,
): Promise<{ project: Project; sprint?: ProjectSprint }> {
  return apiFetch(`/api/projects/${projectId}/columns/${columnId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ label, sprintId }),
  });
}

export function removeColumnRequest(
  projectId: string,
  columnId: string,
  moveToStatus?: string,
  sprintId?: string,
): Promise<{ project: Project; tasks: BoardTask[]; sprint?: ProjectSprint }> {
  const params = new URLSearchParams();
  if (moveToStatus) params.set('moveTo', moveToStatus);
  if (sprintId) params.set('sprintId', sprintId);
  const q = params.toString() ? `?${params}` : '';
  return apiFetch(`/api/projects/${projectId}/columns/${columnId}${q}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function reorderColumnsRequest(
  projectId: string,
  columnIds: string[],
  sprintId?: string,
): Promise<{ project: Project; sprint?: ProjectSprint }> {
  return apiFetch(`/api/projects/${projectId}/columns`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify({ columnIds, sprintId }),
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
    teamId?: string | null;
    sprintId?: string | null;
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
    teamId,
    sprintId,
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
      teamId,
      sprintId,
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
    teamId?: string | null;
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
  if (input.teamId) form.append('teamId', input.teamId);
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
    teamId?: string | null;
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
  if (input.teamId !== undefined) {
    form.append('teamId', input.teamId ?? '');
  }
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

export function createTeamRequest(
  projectId: string,
  input: { name: string; memberIds?: string[] },
): Promise<{ team: ProjectTeam }> {
  return apiFetch(`/api/projects/${projectId}/teams`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function listProjectTeamsRequest(
  projectId: string,
): Promise<{ teams: ProjectTeam[] }> {
  return apiFetch(`/api/projects/${projectId}/teams`, { auth: true });
}

export function updateTeamRequest(
  teamId: string,
  input: { name?: string; memberIds?: string[] },
): Promise<{ team: ProjectTeam }> {
  return apiFetch(`/api/teams/${teamId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function addTeamMembersRequest(
  teamId: string,
  memberIds: string[],
): Promise<{ team: ProjectTeam }> {
  return apiFetch(`/api/teams/${teamId}/members`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ memberIds }),
  });
}

export function removeTeamMemberRequest(
  teamId: string,
  memberId: string,
): Promise<{ team: ProjectTeam }> {
  return apiFetch(`/api/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function deleteTeamRequest(teamId: string): Promise<{ ok: boolean; teamId: string }> {
  return apiFetch(`/api/teams/${teamId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function listProjectTasksRequest(
  projectId: string,
  opts?: { teamId?: string },
): Promise<{ tasks: BoardTask[] }> {
  const q = opts?.teamId ? `?teamId=${encodeURIComponent(opts.teamId)}` : '';
  return apiFetch(`/api/projects/${projectId}/tasks${q}`, { auth: true });
}

export function deleteTimelineRequest(itemId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/timeline/${itemId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export type PendingInvite = {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  role: 'admin' | 'member';
  inviterName: string;
  expiresAt: string;
};

export type InvitePreview = {
  id: string;
  email: string;
  name: string;
  role: string;
  projectName: string;
  orgName: string;
  inviterName: string;
  hasAccount: boolean;
  expiresAt: string;
};

export function fetchInvitePreview(token: string) {
  return apiFetch<{ invite: InvitePreview }>(`/api/auth/invites/${encodeURIComponent(token)}`);
}

export function listInvitesRequest() {
  return apiFetch<{ invites: PendingInvite[] }>('/api/invites', { auth: true });
}

export function acceptInviteRequest(inviteId: string) {
  return apiFetch<{ project: Project; inviteId: string }>(`/api/invites/${inviteId}/accept`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}

export function acceptInviteByTokenRequest(token: string) {
  return apiFetch<{ project: Project; inviteId: string }>('/api/invites/accept', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ token }),
  });
}

export function declineInviteRequest(inviteId: string) {
  return apiFetch<{ ok: true; inviteId: string }>(`/api/invites/${inviteId}/decline`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}

export type PlanPayload = {
  project: Project;
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
};

export function createPhasesRequest(
  projectId: string,
  phases: Array<{ name: string; startDate?: string; endDate?: string }>,
): Promise<PlanPayload> {
  return apiFetch(`/api/projects/${projectId}/phases`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ phases }),
  });
}

export function startPhaseRequest(projectId: string, phaseId: string): Promise<PlanPayload> {
  return apiFetch(`/api/projects/${projectId}/phases/${phaseId}/start`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}

export function completePhaseRequest(projectId: string, phaseId: string): Promise<PlanPayload> {
  return apiFetch(`/api/projects/${projectId}/phases/${phaseId}/complete`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}

export function createSprintRequest(
  projectId: string,
  input: { name: string; phaseId?: string | null; startDate: string; endDate: string },
): Promise<PlanPayload & { sprint: ProjectSprint }> {
  return apiFetch(`/api/projects/${projectId}/sprints`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function startSprintRequest(projectId: string, sprintId: string): Promise<PlanPayload> {
  return apiFetch(`/api/projects/${projectId}/sprints/${sprintId}/start`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}

export function extendSprintRequest(
  projectId: string,
  sprintId: string,
  endDate: string,
): Promise<PlanPayload> {
  return apiFetch(`/api/projects/${projectId}/sprints/${sprintId}/extend`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ endDate }),
  });
}

export function completeSprintRequest(projectId: string, sprintId: string): Promise<PlanPayload> {
  return apiFetch(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({}),
  });
}

