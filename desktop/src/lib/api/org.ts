import { apiFetch } from './client';

export type OrgUserProject = {
  id: string;
  name: string;
  key: string;
};

export type OrgUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  createdAt?: string;
  projects: OrgUserProject[];
};

export function listOrgUsers(): Promise<{ users: OrgUser[] }> {
  return apiFetch('/api/org/users', { auth: true });
}

export function createOrgUser(input: {
  name: string;
  email: string;
  password: string;
  role?: 'Admin' | 'Manager' | 'Member';
  projectIds?: string[];
  projectRole?: 'admin' | 'member';
}): Promise<{ user: OrgUser }> {
  return apiFetch('/api/org/users', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function assignUserProjects(
  userId: string,
  input: { projectIds: string[]; projectRole?: 'admin' | 'member' },
): Promise<{ user: OrgUser }> {
  return apiFetch(`/api/org/users/${userId}/projects`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}
