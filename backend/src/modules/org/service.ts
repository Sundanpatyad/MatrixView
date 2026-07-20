import { Types } from 'mongoose';
import { AuthError } from '../auth/errors.js';
import { User } from '../auth/models/User.js';
import { hashPassword } from '../../utils/password.js';
import { Project } from '../workspace/models/Project.js';
import { newId } from '../workspace/upload.js';

type Actor = {
  sub: string;
  orgId: string;
  email: string;
  role: string;
};

function requireOrgAdmin(actor: Actor) {
  if (actor.role !== 'Admin') {
    throw new AuthError('Admin access required', 403, 'FORBIDDEN');
  }
}

async function projectsForEmail(orgId: string, email: string) {
  const projects = await Project.find({
    orgId,
    'members.email': email.toLowerCase(),
  })
    .select('_id name key')
    .lean();
  return projects.map((p) => ({
    id: String(p._id),
    name: p.name,
    key: p.key,
  }));
}

export async function listOrgUsers(actor: Actor) {
  requireOrgAdmin(actor);
  const users = await User.find({ orgId: actor.orgId })
    .select('_id name email role status createdAt avatarUrl')
    .sort({ createdAt: -1 })
    .lean();

  const result = await Promise.all(
    users.map(async (u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      avatarUrl: u.avatarUrl ?? null,
      createdAt:
        u.createdAt instanceof Date
          ? u.createdAt.toISOString()
          : String(u.createdAt ?? ''),
      projects: await projectsForEmail(actor.orgId, u.email),
    })),
  );

  return { users: result };
}

async function addUserToProject(
  orgId: string,
  projectId: string,
  user: { _id: Types.ObjectId; name: string; email: string },
  projectRole: 'admin' | 'member',
) {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new AuthError('Project not found', 404, 'NOT_FOUND');
  }
  const project = await Project.findOne({ _id: projectId, orgId });
  if (!project) throw new AuthError('Project not found', 404, 'NOT_FOUND');

  const email = user.email.toLowerCase();
  if (project.members.some((m) => m.email === email)) {
    return project; // already on project
  }

  project.members.push({
    id: newId('mem'),
    userId: user._id,
    name: user.name,
    email,
    role: projectRole,
    addedAt: new Date(),
  });
  await project.save();
  return project;
}

export async function createOrgUser(
  actor: Actor,
  input: {
    name: string;
    email: string;
    password: string;
    role?: 'Admin' | 'Manager' | 'Member';
    projectIds?: string[];
    projectRole?: 'admin' | 'member';
  },
) {
  requireOrgAdmin(actor);

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email) throw new AuthError('Name and email required', 400);
  if (input.password.length < 8) {
    throw new AuthError('Password must be at least 8 characters', 400);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AuthError('A user with that email already exists', 409, 'EMAIL_TAKEN');
  }

  const user = await User.create({
    orgId: actor.orgId,
    email,
    name,
    passwordHash: await hashPassword(input.password),
    role: input.role ?? 'Member',
    status: 'active',
  });

  const projectRole = input.projectRole ?? 'member';
  const projectIds = input.projectIds ?? [];
  for (const projectId of projectIds) {
    await addUserToProject(actor.orgId, projectId, user, projectRole);
  }

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      projects: await projectsForEmail(actor.orgId, user.email),
    },
  };
}

export async function assignUserProjects(
  actor: Actor,
  userId: string,
  input: { projectIds: string[]; projectRole?: 'admin' | 'member' },
) {
  requireOrgAdmin(actor);
  if (!Types.ObjectId.isValid(userId)) {
    throw new AuthError('User not found', 404, 'NOT_FOUND');
  }

  const user = await User.findOne({ _id: userId, orgId: actor.orgId });
  if (!user) throw new AuthError('User not found', 404, 'NOT_FOUND');

  const projectRole = input.projectRole ?? 'member';
  for (const projectId of input.projectIds) {
    await addUserToProject(actor.orgId, projectId, user, projectRole);
  }

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      projects: await projectsForEmail(actor.orgId, user.email),
    },
  };
}
