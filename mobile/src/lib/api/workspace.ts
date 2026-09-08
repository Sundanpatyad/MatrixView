import { appendUploadFile } from '../pickers';
import { apiFetch } from './client';
import type {
  BoardTask,
  PickedFile,
  Project,
  ProjectPhase,
  ProjectRole,
  ProjectSprint,
  ProjectTeam,
  TaskPriority,
  TaskType,
  TimelineItem,
} from './types';

export interface WorkspaceSnapshot {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
}

async function appendFiles(form: FormData, files: PickedFile[]) {
  for (const file of files) {
    await appendUploadFile(form, 'files', file);
  }
}

export function fetchWorkspace() {
  return apiFetch<WorkspaceSnapshot>('/api/workspace', { auth: true });
}

export function listProjectsRequest() {
  return apiFetch<{ projects: Project[] }>('/api/projects', { auth: true });
}

export function createProjectRequest(input: { name: string; key: string; description?: string }) {
  return apiFetch<{ project: Project }>('/api/projects', { method: 'POST', body: input, auth: true });
}

export function deleteProjectRequest(projectId: string) {
  return apiFetch<{ ok: true; projectId: string }>(`/api/projects/${projectId}`, { method: 'DELETE', auth: true });
}

export async function uploadProjectAvatarRequest(projectId: string, file: PickedFile) {
  const form = new FormData();
  await appendUploadFile(form, 'avatar', file);
  return apiFetch<{ project: Project }>(`/api/projects/${projectId}/avatar`, {
    method: 'POST',
    body: form,
    auth: true,
    timeoutMs: 120000,
  });
}

export function removeProjectAvatarRequest(projectId: string) {
  return apiFetch<{ project: Project }>(`/api/projects/${projectId}/avatar`, { method: 'DELETE', auth: true });
}

export function addMemberRequest(projectId: string, input: { name?: string; email: string; role?: ProjectRole }) {
  return apiFetch<{
    project: Project;
    result: 'added' | 'invited';
    emailSent: boolean;
    inviteLink: string | null;
  }>(`/api/projects/${projectId}/members`, { method: 'POST', body: input, auth: true });
}

export function updateMemberRoleRequest(projectId: string, memberId: string, role: ProjectRole) {
  return apiFetch<{ project: Project }>(`/api/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    body: { role },
    auth: true,
  });
}

export function removeMemberRequest(projectId: string, memberId: string) {
  return apiFetch<{ project: Project; tasks?: BoardTask[]; timeline?: TimelineItem[] }>(
    `/api/projects/${projectId}/members/${memberId}`,
    { method: 'DELETE', auth: true },
  );
}

export function addColumnRequest(projectId: string, label: string, sprintId?: string) {
  return apiFetch<{ project: Project; sprint?: ProjectSprint }>(`/api/projects/${projectId}/columns`, {
    method: 'POST',
    body: { label, sprintId },
    auth: true,
  });
}

export function renameColumnRequest(projectId: string, columnId: string, label: string, sprintId?: string) {
  return apiFetch<{ project: Project; sprint?: ProjectSprint }>(
    `/api/projects/${projectId}/columns/${columnId}`,
    {
      method: 'PATCH',
      body: { label, sprintId },
      auth: true,
    },
  );
}

export function reorderColumnsRequest(projectId: string, columnIds: string[], sprintId?: string) {
  return apiFetch<{ project: Project; sprint?: ProjectSprint }>(`/api/projects/${projectId}/columns`, {
    method: 'PUT',
    body: { columnIds, sprintId },
    auth: true,
  });
}

export function removeColumnRequest(projectId: string, columnId: string, moveTo?: string, sprintId?: string) {
  const params = new URLSearchParams();
  if (moveTo) params.set('moveTo', moveTo);
  if (sprintId) params.set('sprintId', sprintId);
  const query = params.toString() ? `?${params}` : '';
  return apiFetch<{ project: Project; tasks: BoardTask[]; sprint?: ProjectSprint }>(
    `/api/projects/${projectId}/columns/${columnId}${query}`,
    { method: 'DELETE', auth: true },
  );
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  estimateHours?: number;
  assigneeName?: string;
  assigneeId?: string;
  dueDate?: string;
  teamId?: string | null;
  sprintId?: string | null;
}

export function createTaskRequest(projectId: string, input: CreateTaskInput) {
  return apiFetch<{ task: BoardTask }>(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  status?: string;
  loggedHours?: number;
  reporterName?: string;
  labels?: string[];
  startDate?: string;
  endDate?: string;
};

export function updateTaskRequest(taskId: string, input: UpdateTaskInput) {
  return apiFetch<{ task: BoardTask }>(`/api/tasks/${taskId}`, { method: 'PATCH', body: input, auth: true });
}

export function deleteTaskRequest(taskId: string) {
  return apiFetch<{ ok: true; taskId: string; projectId: string }>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function listProjectTasksRequest(projectId: string, teamId?: string) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  return apiFetch<{ tasks: BoardTask[] }>(`/api/projects/${projectId}/tasks${query}`, { auth: true });
}

export async function addCommentRequest(taskId: string, body: string, files: PickedFile[] = []) {
  const form = new FormData();
  form.append('body', body);
  await appendFiles(form, files);
  return apiFetch<{ task: BoardTask }>(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: form,
    auth: true,
    timeoutMs: 120000,
  });
}

export async function addTaskAttachmentsRequest(taskId: string, files: PickedFile[]) {
  const form = new FormData();
  await appendFiles(form, files);
  return apiFetch<{ task: BoardTask }>(`/api/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: form,
    auth: true,
    timeoutMs: 120000,
  });
}

export function removeTaskAttachmentRequest(taskId: string, attachmentId: string) {
  return apiFetch<{ task: BoardTask }>(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function createTeamRequest(projectId: string, input: { name: string; memberIds?: string[] }) {
  return apiFetch<{ team: ProjectTeam }>(`/api/projects/${projectId}/teams`, {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export function listProjectTeamsRequest(projectId: string) {
  return apiFetch<{ teams: ProjectTeam[] }>(`/api/projects/${projectId}/teams`, { auth: true });
}

export function updateTeamRequest(teamId: string, input: { name?: string; memberIds?: string[] }) {
  return apiFetch<{ team: ProjectTeam }>(`/api/teams/${teamId}`, { method: 'PATCH', body: input, auth: true });
}

export function addTeamMembersRequest(teamId: string, memberIds: string[]) {
  return apiFetch<{ team: ProjectTeam }>(`/api/teams/${teamId}/members`, {
    method: 'POST',
    body: { memberIds },
    auth: true,
  });
}

export function removeTeamMemberRequest(teamId: string, memberId: string) {
  return apiFetch<{ team: ProjectTeam }>(`/api/teams/${teamId}/members/${memberId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function deleteTeamRequest(teamId: string) {
  return apiFetch<{ ok: true; teamId: string }>(`/api/teams/${teamId}`, { method: 'DELETE', auth: true });
}

export async function createTimelineRequest(
  input: {
    projectId: string;
    title: string;
    description?: string;
    type?: TaskType;
    priority?: TaskPriority;
    dueDate?: string;
    teamId?: string;
  },
  files: PickedFile[] = [],
) {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  await appendFiles(form, files);
  return apiFetch<{ item: TimelineItem }>('/api/timeline', {
    method: 'POST',
    body: form,
    auth: true,
    timeoutMs: 120000,
  });
}

export function assignTimelineRequest(itemId: string, assignee: { id: string; name: string }) {
  return apiFetch<{ timelineItem: TimelineItem; task: BoardTask }>(`/api/timeline/${itemId}/assign`, {
    method: 'POST',
    body: assignee,
    auth: true,
  });
}

export function deleteTimelineRequest(itemId: string) {
  return apiFetch<{ ok: true }>(`/api/timeline/${itemId}`, { method: 'DELETE', auth: true });
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

export function listInvitesRequest() {
  return apiFetch<{ invites: PendingInvite[] }>('/api/invites', { auth: true });
}

export function acceptInviteRequest(inviteId: string) {
  return apiFetch<{ project: Project; inviteId: string }>(`/api/invites/${inviteId}/accept`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

export function declineInviteRequest(inviteId: string) {
  return apiFetch<{ ok: true; inviteId: string }>(`/api/invites/${inviteId}/decline`, {
    method: 'POST',
    body: {},
    auth: true,
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
) {
  return apiFetch<PlanPayload>(`/api/projects/${projectId}/phases`, {
    method: 'POST',
    body: { phases },
    auth: true,
  });
}

export function startPhaseRequest(projectId: string, phaseId: string) {
  return apiFetch<PlanPayload>(`/api/projects/${projectId}/phases/${phaseId}/start`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

export function completePhaseRequest(projectId: string, phaseId: string) {
  return apiFetch<PlanPayload>(`/api/projects/${projectId}/phases/${phaseId}/complete`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

export function createSprintRequest(
  projectId: string,
  input: { name: string; phaseId?: string | null; startDate: string; endDate: string },
) {
  return apiFetch<PlanPayload & { sprint: ProjectSprint }>(`/api/projects/${projectId}/sprints`, {
    method: 'POST',
    body: input,
    auth: true,
  });
}

export function startSprintRequest(projectId: string, sprintId: string) {
  return apiFetch<PlanPayload>(`/api/projects/${projectId}/sprints/${sprintId}/start`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

export function extendSprintRequest(projectId: string, sprintId: string, endDate: string) {
  return apiFetch<PlanPayload>(`/api/projects/${projectId}/sprints/${sprintId}/extend`, {
    method: 'POST',
    body: { endDate },
    auth: true,
  });
}

export function completeSprintRequest(projectId: string, sprintId: string) {
  return apiFetch<PlanPayload>(`/api/projects/${projectId}/sprints/${sprintId}/complete`, {
    method: 'POST',
    body: {},
    auth: true,
  });
}

