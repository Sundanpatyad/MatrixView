import { apiFetch } from './client';
import type { OrgUser, ProjectRole } from './types';

export function listOrgUsers() {
  return apiFetch<{ users: OrgUser[] }>('/api/org/users', { auth: true });
}

export function createOrgUser(input: {
  name: string;
  email: string;
  password: string;
  role?: 'Admin' | 'Manager' | 'Member';
  projectIds?: string[];
  projectRole?: ProjectRole;
}) {
  return apiFetch<{ user: OrgUser }>('/api/org/users', { method: 'POST', body: input, auth: true });
}

export function assignUserProjects(userId: string, projectIds: string[], projectRole: ProjectRole = 'member') {
  return apiFetch<{ user: OrgUser }>(`/api/org/users/${userId}/projects`, {
    method: 'POST',
    body: { projectIds, projectRole },
    auth: true,
  });
}
