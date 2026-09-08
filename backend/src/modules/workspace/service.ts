import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { config } from '../../config.js';
import { AuthError } from '../auth/errors.js';
import { Organization } from '../auth/models/Organization.js';
import { User } from '../auth/models/User.js';
import { hashPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/tokens.js';
import { sendInviteEmail } from '../../utils/mail.js';
import { COLUMN_ACCENTS, DEFAULT_BOARD_COLUMNS } from './constants.js';
import { Project, type ProjectDoc } from './models/Project.js';
import { ProjectInvite } from './models/ProjectInvite.js';
import { Phase } from './models/Phase.js';
import { Sprint, type SprintDoc } from './models/Sprint.js';
import { Task, type TaskDoc } from './models/Task.js';
import { Team } from './models/Team.js';
import { TimelineItem } from './models/TimelineItem.js';
import {
  presentProject,
  presentTask,
  presentProjects,
  presentTasks,
  serializeTeam,
  serializeTimeline,
  serializePhase,
  serializeSprint,
} from './serialize.js';
import { broadcastProjectEvent } from './boardRealtime.js';
import { emitToUser, leaveProjectRoomForUser } from '../../gateway/io.js';
import {
  deleteStoredMedia,
  deleteStoredMediaMany,
  type StoredMediaRef,
} from '../../storage/media.js';
import { fileToAttachment, newId } from './upload.js';
import {
  boardTaskHref,
  createAndEmit,
  resolveMemberUserId,
} from '../notifications/service.js';

type Actor = {
  sub: string;
  orgId: string;
  email: string;
  role: string;
  name?: string;
};

async function actorName(actor: Actor): Promise<string> {
  if (actor.name) return actor.name;
  const user = await User.findById(actor.sub).lean();
  return user?.name ?? actor.email;
}

/** Load project if the actor is a member (works across personal workspaces). */
async function getAccessibleProject(projectId: string, actor: Actor): Promise<ProjectDoc> {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new AuthError('Project not found', 404, 'NOT_FOUND');
  }
  const project = await Project.findById(projectId);
  if (!project) throw new AuthError('Project not found', 404, 'NOT_FOUND');
  requireMembership(project, actor.email);
  return project;
}

function requireMembership(project: ProjectDoc, email: string) {
  const member = project.members.find((m) => m.email.toLowerCase() === email.toLowerCase());
  if (!member) throw new AuthError('Not a project member', 403, 'FORBIDDEN');
  if ((member as { status?: string }).status === 'pending') {
    throw new AuthError('Accept this project invite first', 403, 'INVITE_PENDING');
  }
  return member;
}

function requireAdmin(project: ProjectDoc, email: string) {
  const member = requireMembership(project, email);
  if (member.role !== 'admin') {
    throw new AuthError('Project admin access required', 403, 'FORBIDDEN');
  }
  return member;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function requireIsoDay(value: string, label: string) {
  const trimmed = value.trim();
  if (!ISO_DAY.test(trimmed)) {
    throw new AuthError(`${label} must be YYYY-MM-DD`, 400);
  }
  return trimmed;
}

function optionalIsoDay(value?: string | null) {
  if (!value) return '';
  return requireIsoDay(value, 'Date');
}

type BoardColumnLike = { id: string; label: string; accent: string; locked?: boolean };

function isDoneColumn(col: { id: string; label: string }) {
  return col.id === 'done' || col.label.trim().toLowerCase() === 'done';
}

function doneColumnIds(columns: BoardColumnLike[]) {
  const ids = columns.filter(isDoneColumn).map((c) => c.id);
  if (ids.length === 0 && columns.length > 0) ids.push(columns[columns.length - 1]!.id);
  return new Set(ids);
}

function firstColumnId(columns: BoardColumnLike[]) {
  return columns[0]?.id ?? 'todo';
}

function cloneColumns(columns: BoardColumnLike[]): BoardColumnLike[] {
  const source = columns.length ? columns : DEFAULT_BOARD_COLUMNS;
  return source.map((c) => ({
    id: c.id,
    label: c.label,
    accent: c.accent,
    locked: Boolean(c.locked),
  }));
}

async function loadPlan(projectId: Types.ObjectId | string) {
  const [phases, sprints] = await Promise.all([
    Phase.find({ projectId }).sort({ order: 1, createdAt: 1 }),
    Sprint.find({ projectId }).sort({ startDate: 1, createdAt: 1 }),
  ]);
  return {
    phases: phases.map(serializePhase),
    sprints: sprints.map(serializeSprint),
  };
}

async function broadcastPlan(project: ProjectDoc, actorId: string) {
  const plan = await loadPlan(project._id);
  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:updated', {
    project: presented,
    ...plan,
    actorId,
  });
  return { project: presented, ...plan };
}

async function getSprintInProject(project: ProjectDoc, sprintId: string) {
  if (!Types.ObjectId.isValid(sprintId)) {
    throw new AuthError('Sprint not found', 404, 'NOT_FOUND');
  }
  const sprint = await Sprint.findOne({ _id: sprintId, projectId: project._id });
  if (!sprint) throw new AuthError('Sprint not found', 404, 'NOT_FOUND');
  return sprint;
}

async function getPhaseInProject(project: ProjectDoc, phaseId: string) {
  if (!Types.ObjectId.isValid(phaseId)) {
    throw new AuthError('Phase not found', 404, 'NOT_FOUND');
  }
  const phase = await Phase.findOne({ _id: phaseId, projectId: project._id });
  if (!phase) throw new AuthError('Phase not found', 404, 'NOT_FOUND');
  return phase;
}

function remapStatusToBacklog(status: string, project: ProjectDoc, fromColumns: BoardColumnLike[]) {
  const backlog = (project.columns ?? []) as BoardColumnLike[];
  const backlogIds = new Set(backlog.map((c) => c.id));
  if (backlogIds.has(status)) return status;
  const fromDone = doneColumnIds(fromColumns);
  if (fromDone.has(status)) {
    return [...doneColumnIds(backlog)][0] ?? firstColumnId(backlog);
  }
  return firstColumnId(backlog);
}

async function completeSprintDoc(project: ProjectDoc, sprint: SprintDoc) {
  if (sprint.status === 'done') return [] as TaskDoc[];
  const fromColumns = (sprint.columns ?? []) as BoardColumnLike[];
  const doneIds = doneColumnIds(fromColumns);
  const tasks = await Task.find({ projectId: project._id, sprintId: sprint._id });
  const moved: TaskDoc[] = [];
  for (const task of tasks) {
    if (doneIds.has(task.status)) continue;
    task.sprintId = null;
    task.status = remapStatusToBacklog(task.status, project, fromColumns);
    await task.save();
    moved.push(task);
  }
  sprint.status = 'done';
  sprint.completedAt = new Date();
  await sprint.save();
  return moved;
}

/** Projects the user belongs to — pending invites are not visible here. */
export async function getWorkspace(actor: Actor) {
  const email = actor.email.toLowerCase();
  const candidates = await Project.find({
    'members.email': email,
  }).sort({ createdAt: -1 });

  const visible = candidates.filter((p) => {
    const member = p.members.find((m) => m.email.toLowerCase() === email);
    return member && (member as { status?: string }).status !== 'pending';
  });

  const visibleIds = visible.map((p) => p._id);
  const tasks =
    visibleIds.length === 0
      ? []
      : await Task.find({ projectId: { $in: visibleIds } }).sort({ createdAt: 1 });
  const timeline =
    visibleIds.length === 0
      ? []
      : await TimelineItem.find({ projectId: { $in: visibleIds } }).sort({
          createdAt: -1,
        });
  const teams =
    visibleIds.length === 0
      ? []
      : await Team.find({ projectId: { $in: visibleIds } }).sort({ name: 1 });
  const phases =
    visibleIds.length === 0
      ? []
      : await Phase.find({ projectId: { $in: visibleIds } }).sort({ order: 1, createdAt: 1 });
  const sprints =
    visibleIds.length === 0
      ? []
      : await Sprint.find({ projectId: { $in: visibleIds } }).sort({ startDate: 1, createdAt: 1 });

  return {
    projects: await presentProjects(visible),
    tasks: await presentTasks(tasks),
    timeline: timeline.map(serializeTimeline),
    teams: teams.map(serializeTeam),
    phases: phases.map(serializePhase),
    sprints: sprints.map(serializeSprint),
  };
}

export async function createProject(
  actor: Actor,
  input: { name: string; key: string; description?: string },
) {
  const name = input.name.trim();
  const key = (input.key.trim().toUpperCase().slice(0, 6) || 'PRJ');
  const existing = await Project.findOne({ orgId: actor.orgId, key });
  if (existing) throw new AuthError('Project key already exists', 409, 'KEY_TAKEN');

  const displayName = await actorName(actor);
  const project = await Project.create({
    orgId: actor.orgId,
    name,
    key,
    description: input.description?.trim() ?? '',
    createdBy: displayName,
    createdByUserId: actor.sub,
    columns: DEFAULT_BOARD_COLUMNS.map((c) => ({ ...c })),
    members: [
      {
        id: newId('mem'),
        userId: actor.sub,
        name: displayName,
        email: actor.email.toLowerCase(),
        role: 'admin',
        addedAt: new Date(),
      },
    ],
    taskSeq: 0,
  });

  return presentProject(project);
}

export async function updateProjectAvatar(
  actor: Actor,
  projectId: string,
  avatarUrl: string,
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const previousUrl = (project as { avatarUrl?: string | null }).avatarUrl ?? null;
  (project as { avatarUrl?: string | null }).avatarUrl = avatarUrl;
  await project.save();

  if (previousUrl && previousUrl !== avatarUrl) {
    await deleteStoredMedia(previousUrl);
  }

  return presentProject(project);
}

export async function removeProjectAvatar(actor: Actor, projectId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const previousUrl = (project as { avatarUrl?: string | null }).avatarUrl ?? null;
  if (!previousUrl) return presentProject(project);

  (project as { avatarUrl?: string | null }).avatarUrl = null;
  await project.save();
  await deleteStoredMedia(previousUrl);

  return presentProject(project);
}

/** Project admins (including creator) can permanently delete a project and its data. */
export async function deleteProject(actor: Actor, projectId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const pid = project._id;

  // Collect attachment URLs before wiping
  const tasks = await Task.find({ projectId: pid }).select('attachments comments').lean();
  const timeline = await TimelineItem.find({ projectId: pid }).select('attachments').lean();
  const mediaRefs: StoredMediaRef[] = [];
  const projectAvatarUrl = (project as { avatarUrl?: string | null }).avatarUrl;
  if (projectAvatarUrl) {
    mediaRefs.push({ url: projectAvatarUrl });
  }
  for (const t of tasks) {
    for (const a of t.attachments ?? []) {
      mediaRefs.push({
        url: a.url,
        provider: (a as { storageProvider?: string }).storageProvider,
        storageKey: (a as { storageKey?: string }).storageKey,
        mimeType: a.mimeType,
      });
    }
    for (const c of t.comments ?? []) {
      for (const a of c.attachments ?? []) {
        mediaRefs.push({
          url: a.url,
          provider: (a as { storageProvider?: string }).storageProvider,
          storageKey: (a as { storageKey?: string }).storageKey,
          mimeType: a.mimeType,
        });
      }
    }
  }
  for (const item of timeline) {
    for (const a of item.attachments ?? []) {
      mediaRefs.push({
        url: a.url,
        provider: (a as { storageProvider?: string }).storageProvider,
        storageKey: (a as { storageKey?: string }).storageKey,
        mimeType: a.mimeType,
      });
    }
  }

  await Task.deleteMany({ projectId: pid });
  await TimelineItem.deleteMany({ projectId: pid });
  await ProjectInvite.deleteMany({ projectId: pid });
  await Team.deleteMany({ projectId: pid });
  await Phase.deleteMany({ projectId: pid });
  await Sprint.deleteMany({ projectId: pid });
  await project.deleteOne();
  await deleteStoredMediaMany(mediaRefs);

  return { ok: true as const, projectId: String(pid) };
}

export async function addMember(
  actor: Actor,
  projectId: string,
  input: { name?: string; email: string; role: 'admin' | 'member' },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const email = input.email.trim().toLowerCase();
  if (!email) throw new AuthError('Email required', 400);
  if (email === actor.email.toLowerCase()) {
    throw new AuthError('You are already on this project', 409, 'MEMBER_EXISTS');
  }

  const existingOnProject = project.members.find((m) => m.email === email);
  if (existingOnProject && existingOnProject.status !== 'pending') {
    throw new AuthError('Member already on project', 409, 'MEMBER_EXISTS');
  }

  const pendingInvite = await ProjectInvite.findOne({
    projectId: project._id,
    email,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).lean();
  if (pendingInvite) {
    throw new AuthError(
      'This person already has a pending invite to this project. They must Accept it first.',
      409,
      'INVITE_PENDING',
    );
  }

  const existingUser = await User.findOne({ email });
  const displayName =
    existingUser?.name ??
    (input.name?.trim() || email.split('@')[0] || 'Invited user');

  if (existingOnProject) {
    existingOnProject.name = displayName;
    existingOnProject.role = input.role;
    existingOnProject.status = 'pending';
    existingOnProject.userId = existingUser?._id ?? null;
  } else {
    project.members.push({
      id: newId('mem'),
      userId: existingUser?._id ?? null,
      name: displayName,
      email,
      role: input.role,
      status: 'pending',
      addedAt: new Date(),
    } as (typeof project.members)[number]);
  }
  await project.save();

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await ProjectInvite.updateMany(
    { projectId: project._id, email, status: 'pending' },
    { $set: { status: 'revoked' } },
  );

  const invite = await ProjectInvite.create({
    orgId: project.orgId,
    projectId: project._id,
    email,
    name: displayName,
    role: input.role,
    tokenHash,
    invitedBy: oid(actor.sub),
    status: 'pending',
    expiresAt,
  });

  const inviteLink = `${config.appUrl}/invite?token=${encodeURIComponent(rawToken)}`;
  const inviter = await User.findById(actor.sub).lean();
  const inviterName = inviter?.name ?? actor.email;

  let emailSent = false;
  try {
    const mail = await sendInviteEmail({
      to: email,
      inviterName,
      projectName: project.name,
      orgName: project.name,
      inviteLink,
      hasAccount: Boolean(existingUser),
    });
    emailSent = mail.sent;
  } catch (err) {
    console.error('[mail] Failed to send invite email', err);
  }

  if (existingUser) {
    const name = await actorName(actor);
    void createAndEmit({
      orgId: String(existingUser.orgId),
      recipientId: String(existingUser._id),
      actorId: actor.sub,
      actorName: name,
      type: 'project.invited',
      title: 'Project invite',
      body: `${name} invited you to ${project.name}. Accept to join.`,
      href: '/notifications',
      projectId: String(project._id),
      meta: {
        inviteId: String(invite._id),
        projectId: String(project._id),
        projectName: project.name,
        projectKey: project.key,
        role: input.role,
        inviterName: name,
        expiresAt: invite.expiresAt.toISOString(),
      },
    }).catch((err) => console.error('[notifications] project.invited', err));

    const view = await presentPendingInvite(invite);
    if (view) {
      emitToUser(String(existingUser._id), 'invite:new', { invite: view });
    }
  }

  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:updated', {
    project: presented,
    actorId: actor.sub,
  });

  return {
    project: presented,
    result: 'invited' as const,
    emailSent,
    inviteLink,
  };
}

function oid(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AuthError('Invalid id', 400);
  return new Types.ObjectId(id);
}

export async function getInvitePreview(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const invite = await ProjectInvite.findOne({
    tokenHash,
    status: 'pending',
  });
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new AuthError('Invite is invalid or expired', 404, 'INVITE_INVALID');
  }
  const project = await Project.findById(invite.projectId).lean();
  const inviter = await User.findById(invite.invitedBy).lean();
  const existingUser = await User.findOne({ email: invite.email }).select('_id').lean();
  return {
    id: String(invite._id),
    email: invite.email,
    name: invite.name || '',
    role: invite.role as 'admin' | 'member',
    projectName: project?.name ?? 'Project',
    orgName: project?.name ?? 'DockX',
    inviterName: inviter?.name ?? 'A teammate',
    hasAccount: Boolean(existingUser),
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export type PendingInviteView = {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  role: 'admin' | 'member';
  inviterName: string;
  expiresAt: string;
};

async function presentPendingInvite(
  invite: { _id: unknown; projectId: unknown; role: string; invitedBy: unknown; expiresAt: Date },
): Promise<PendingInviteView | null> {
  const project = await Project.findById(invite.projectId).lean();
  if (!project) return null;
  const inviter = await User.findById(invite.invitedBy).lean();
  return {
    id: String(invite._id),
    projectId: String(invite.projectId),
    projectName: project.name,
    projectKey: project.key,
    role: invite.role as 'admin' | 'member',
    inviterName: inviter?.name ?? 'A teammate',
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export async function listMyInvites(actor: Actor): Promise<PendingInviteView[]> {
  const email = actor.email.toLowerCase();
  const invites = await ProjectInvite.find({
    email,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  const out: PendingInviteView[] = [];
  for (const invite of invites) {
    const view = await presentPendingInvite(invite);
    if (view) out.push(view);
  }
  return out;
}

async function activateInviteForUser(
  invite: InstanceType<typeof ProjectInvite>,
  user: { _id: Types.ObjectId; email: string; name: string },
) {
  const project = await Project.findById(invite.projectId);
  if (!project) throw new AuthError('Project not found', 404, 'NOT_FOUND');

  let member = project.members.find((m) => m.email === user.email.toLowerCase());
  if (!member) {
    member = {
      id: newId('mem'),
      userId: user._id,
      name: user.name,
      email: user.email.toLowerCase(),
      role: invite.role as 'admin' | 'member',
      status: 'active',
      addedAt: new Date(),
    } as (typeof project.members)[number];
    project.members.push(member);
  } else {
    member.userId = user._id;
    member.name = user.name;
    member.role = invite.role as 'admin' | 'member';
    member.status = 'active';
  }
  await project.save();

  invite.status = 'accepted';
  invite.acceptedAt = new Date();
  invite.acceptedUserId = user._id;
  await invite.save();

  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:updated', {
    project: presented,
    actorId: String(user._id),
  });
  return presented;
}

export async function acceptMyInvite(actor: Actor, inviteId: string) {
  if (!Types.ObjectId.isValid(inviteId)) {
    throw new AuthError('Invite not found', 404, 'NOT_FOUND');
  }
  const invite = await ProjectInvite.findById(inviteId);
  if (!invite || invite.status !== 'pending' || invite.expiresAt.getTime() < Date.now()) {
    throw new AuthError('Invite is invalid or expired', 404, 'INVITE_INVALID');
  }
  if (invite.email !== actor.email.toLowerCase()) {
    throw new AuthError('This invite is for a different email', 403, 'FORBIDDEN');
  }
  const project = await activateInviteForUser(invite, {
    _id: oid(actor.sub),
    email: actor.email,
    name: await actorName(actor),
  });
  emitToUser(actor.sub, 'invite:resolved', {
    inviteId: String(invite._id),
    status: 'accepted',
  });
  return { project, inviteId: String(invite._id) };
}

export async function acceptInviteByToken(actor: Actor, rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const invite = await ProjectInvite.findOne({ tokenHash, status: 'pending' });
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new AuthError('Invite is invalid or expired', 404, 'INVITE_INVALID');
  }
  if (invite.email !== actor.email.toLowerCase()) {
    throw new AuthError('Sign in with the invited email to accept', 403, 'FORBIDDEN');
  }
  const project = await activateInviteForUser(invite, {
    _id: oid(actor.sub),
    email: actor.email,
    name: await actorName(actor),
  });
  emitToUser(actor.sub, 'invite:resolved', {
    inviteId: String(invite._id),
    status: 'accepted',
  });
  return { project, inviteId: String(invite._id) };
}

export async function declineMyInvite(actor: Actor, inviteId: string) {
  if (!Types.ObjectId.isValid(inviteId)) {
    throw new AuthError('Invite not found', 404, 'NOT_FOUND');
  }
  const invite = await ProjectInvite.findById(inviteId);
  if (!invite || invite.status !== 'pending') {
    throw new AuthError('Invite not found', 404, 'NOT_FOUND');
  }
  if (invite.email !== actor.email.toLowerCase()) {
    throw new AuthError('This invite is for a different email', 403, 'FORBIDDEN');
  }

  invite.status = 'revoked';
  await invite.save();

  const project = await Project.findById(invite.projectId);
  if (project) {
    project.members = project.members.filter(
      (m) =>
        !(
          m.email === actor.email.toLowerCase() &&
          (m as { status?: string }).status === 'pending'
        ),
    ) as typeof project.members;
    await project.save();
    const presented = await presentProject(project);
    await broadcastProjectEvent(project, 'project:updated', {
      project: presented,
      actorId: actor.sub,
    });
  }

  emitToUser(actor.sub, 'invite:resolved', {
    inviteId: String(invite._id),
    status: 'declined',
  });
  return { ok: true as const, inviteId: String(invite._id) };
}

export async function acceptInviteAndCreateUser(input: {
  token: string;
  name: string;
  password: string;
}) {
  const tokenHash = hashToken(input.token);
  const invite = await ProjectInvite.findOne({
    tokenHash,
    status: 'pending',
  });
  if (!invite || invite.expiresAt.getTime() < Date.now()) {
    throw new AuthError('Invite is invalid or expired', 404, 'INVITE_INVALID');
  }

  const email = invite.email;
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AuthError(
      'An account with this email already exists. Sign in instead.',
      409,
      'EMAIL_TAKEN',
    );
  }

  // Invitee gets their own personal workspace; project membership is separate
  const displayName = input.name.trim() || invite.name || email.split('@')[0] || 'User';
  const orgName = `${displayName}'s Workspace`;
  let slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workspace';
  if (await Organization.findOne({ slug })) {
    slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
  }
  const org = await Organization.create({ name: orgName, slug });

  const user = await User.create({
    orgId: org._id,
    email,
    name: displayName,
    passwordHash: await hashPassword(input.password),
    role: 'Admin',
    status: 'active',
  });

  await activateInviteForUser(invite, user);

  return user;
}

export async function updateMemberRole(
  actor: Actor,
  projectId: string,
  memberId: string,
  role: 'admin' | 'member',
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const member = project.members.find((m) => m.id === memberId);
  if (!member) throw new AuthError('Member not found', 404, 'NOT_FOUND');

  if (member.role === 'admin' && role === 'member') {
    const admins = project.members.filter((m) => m.role === 'admin');
    if (admins.length <= 1) {
      throw new AuthError('Cannot demote the last admin', 400, 'LAST_ADMIN');
    }
  }

  member.role = role;
  await project.save();
  return presentProject(project);
}

export async function removeMember(actor: Actor, projectId: string, memberId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const member = project.members.find((m) => m.id === memberId);
  if (!member) throw new AuthError('Member not found', 404, 'NOT_FOUND');

  if (member.role === 'admin') {
    const admins = project.members.filter((m) => m.role === 'admin');
    if (admins.length <= 1) {
      throw new AuthError('Cannot remove the last admin', 400, 'LAST_ADMIN');
    }
  }

  const assigneeIds = [member.id];
  if (member.userId) assigneeIds.push(String(member.userId));

  let removedUserId = member.userId ? String(member.userId) : null;
  if (!removedUserId && member.email) {
    const account = await User.findOne({ email: member.email.toLowerCase() }).select('_id').lean();
    if (account) removedUserId = String(account._id);
  }
  const projectName = project.name;
  const removedProjectId = String(project._id);

  project.members = project.members.filter((m) => m.id !== memberId) as typeof project.members;
  await project.save();

  await Team.updateMany({ projectId: project._id }, { $pull: { memberIds: memberId } });

  await ProjectInvite.updateMany(
    { projectId: project._id, email: member.email, status: 'pending' },
    { $set: { status: 'revoked' } },
  );

  const assignedTasks = await Task.find({
    projectId: project._id,
    assigneeId: { $in: assigneeIds },
  });
  for (const task of assignedTasks) {
    task.assigneeId = '';
    task.assigneeName = 'Unassigned';
    await task.save();
  }

  const assignedTimeline = await TimelineItem.find({
    projectId: project._id,
    assigneeId: { $in: assigneeIds },
  });
  for (const item of assignedTimeline) {
    item.assigneeId = null;
    item.assigneeName = null;
    await item.save();
  }

  const presented = await presentProject(project);
  const presentedTasks = await presentTasks(assignedTasks);
  const presentedTimeline = assignedTimeline.map(serializeTimeline);

  if (removedUserId) {
    leaveProjectRoomForUser(removedUserId, removedProjectId);
    emitToUser(removedUserId, 'project:removed', {
      projectId: removedProjectId,
      projectName,
    });
  }

  for (const task of presentedTasks) {
    await broadcastProjectEvent(project, 'task:updated', {
      task,
      actorId: actor.sub,
      changed: ['assigneeId', 'assigneeName'],
    });
  }
  await broadcastProjectEvent(project, 'project:updated', {
    project: presented,
    actorId: actor.sub,
  });

  return { project: presented, tasks: presentedTasks, timeline: presentedTimeline };
}

export async function addColumn(actor: Actor, projectId: string, label: string, sprintId?: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  const trimmed = label.trim();
  if (!trimmed) throw new AuthError('Column label required', 400);

  if (sprintId) {
    const sprint = await getSprintInProject(project, sprintId);
    const column = {
      id: newId('col'),
      label: trimmed,
      accent: COLUMN_ACCENTS[sprint.columns.length % COLUMN_ACCENTS.length],
      locked: false,
    };
    sprint.columns.push(column);
    await sprint.save();
    const presented = await presentProject(project);
    await broadcastProjectEvent(project, 'project:columns', {
      project: presented,
      sprint: serializeSprint(sprint),
      actorId: actor.sub,
    });
    return { project: presented, sprint: serializeSprint(sprint), column };
  }

  const column = {
    id: newId('col'),
    label: trimmed,
    accent: COLUMN_ACCENTS[project.columns.length % COLUMN_ACCENTS.length],
    locked: false,
  };
  project.columns.push(column);
  await project.save();
  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:columns', {
    project: presented,
    actorId: actor.sub,
  });
  return { project: presented, column };
}

export async function renameColumn(
  actor: Actor,
  projectId: string,
  columnId: string,
  label: string,
  sprintId?: string,
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);
  const trimmed = label.trim();
  if (!trimmed) throw new AuthError('Column label required', 400);

  if (sprintId) {
    const sprint = await getSprintInProject(project, sprintId);
    const col = sprint.columns.find((c) => c.id === columnId);
    if (!col) throw new AuthError('Column not found', 404, 'NOT_FOUND');
    col.label = trimmed;
    await sprint.save();
    const presented = await presentProject(project);
    await broadcastProjectEvent(project, 'project:columns', {
      project: presented,
      sprint: serializeSprint(sprint),
      actorId: actor.sub,
    });
    return { project: presented, sprint: serializeSprint(sprint) };
  }

  const col = project.columns.find((c) => c.id === columnId);
  if (!col) throw new AuthError('Column not found', 404, 'NOT_FOUND');
  col.label = trimmed;
  await project.save();
  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:columns', {
    project: presented,
    actorId: actor.sub,
  });
  return { project: presented };
}

export async function removeColumn(
  actor: Actor,
  projectId: string,
  columnId: string,
  moveToStatus?: string,
  sprintId?: string,
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  if (sprintId) {
    const sprint = await getSprintInProject(project, sprintId);
    const col = sprint.columns.find((c) => c.id === columnId);
    if (!col) throw new AuthError('Column not found', 404, 'NOT_FOUND');
    if (sprint.columns.length <= 1) {
      throw new AuthError('Cannot remove the last column', 400);
    }
    const fallback =
      moveToStatus ||
      sprint.columns.find((c) => c.id !== columnId)?.id ||
      'todo';
    sprint.columns = sprint.columns.filter((c) => c.id !== columnId) as typeof sprint.columns;
    await sprint.save();
    await Task.updateMany(
      { projectId: project._id, sprintId: sprint._id, status: columnId },
      { $set: { status: fallback } },
    );
    const tasks = await Task.find({ projectId: project._id });
    const presentedProject = await presentProject(project);
    const presentedTasks = await presentTasks(tasks);
    await broadcastProjectEvent(project, 'project:columns', {
      project: presentedProject,
      sprint: serializeSprint(sprint),
      tasks: presentedTasks,
      actorId: actor.sub,
    });
    return {
      project: presentedProject,
      sprint: serializeSprint(sprint),
      tasks: presentedTasks,
    };
  }

  const col = project.columns.find((c) => c.id === columnId);
  if (!col) throw new AuthError('Column not found', 404, 'NOT_FOUND');
  if (project.columns.length <= 1) {
    throw new AuthError('Cannot remove the last column', 400);
  }

  const fallback =
    moveToStatus ||
    project.columns.find((c) => c.id !== columnId)?.id ||
    'todo';

  project.columns = project.columns.filter((c) => c.id !== columnId) as typeof project.columns;
  await project.save();

  await Task.updateMany(
    { projectId: project._id, sprintId: null, status: columnId },
    { $set: { status: fallback } },
  );

  const tasks = await Task.find({ projectId: project._id });
  const presentedProject = await presentProject(project);
  const presentedTasks = await presentTasks(tasks);
  await broadcastProjectEvent(project, 'project:columns', {
    project: presentedProject,
    tasks: presentedTasks,
    actorId: actor.sub,
  });
  return {
    project: presentedProject,
    tasks: presentedTasks,
  };
}

export async function reorderColumns(
  actor: Actor,
  projectId: string,
  columnIds: string[],
  sprintId?: string,
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  if (sprintId) {
    const sprint = await getSprintInProject(project, sprintId);
    const currentIds = sprint.columns.map((c) => c.id);
    if (
      columnIds.length !== currentIds.length ||
      new Set(columnIds).size !== columnIds.length ||
      !columnIds.every((id) => currentIds.includes(id))
    ) {
      throw new AuthError('Column order must include every column exactly once', 400);
    }
    const byId = new Map(sprint.columns.map((c) => [c.id, c]));
    sprint.columns = columnIds.map((id) => byId.get(id)!) as typeof sprint.columns;
    await sprint.save();
    const presented = await presentProject(project);
    await broadcastProjectEvent(project, 'project:columns', {
      project: presented,
      sprint: serializeSprint(sprint),
      actorId: actor.sub,
    });
    return { project: presented, sprint: serializeSprint(sprint) };
  }

  const currentIds = project.columns.map((c) => c.id);
  if (
    columnIds.length !== currentIds.length ||
    new Set(columnIds).size !== columnIds.length ||
    !columnIds.every((id) => currentIds.includes(id))
  ) {
    throw new AuthError('Column order must include every column exactly once', 400);
  }

  const byId = new Map(project.columns.map((c) => [c.id, c]));
  project.columns = columnIds.map((id) => byId.get(id)!) as typeof project.columns;
  await project.save();
  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:columns', {
    project: presented,
    actorId: actor.sub,
  });
  return { project: presented };
}

export async function createTask(
  actor: Actor,
  projectId: string,
  input: {
    title: string;
    description?: string;
    type?: string;
    priority?: string;
    estimateHours?: number;
    assigneeName?: string;
    assigneeId?: string;
    dueDate?: string;
    startDate?: string;
    endDate?: string;
    labels?: string[];
    status?: string;
    teamId?: string | null;
    sprintId?: string | null;
  },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  const displayName = await actorName(actor);
  let firstCol = project.columns[0]?.id ?? 'todo';
  let sprintOid: Types.ObjectId | null = null;
  let columnIds = new Set((project.columns ?? []).map((c) => c.id));
  if (input.sprintId) {
    const sprint = await getSprintInProject(project, input.sprintId);
    sprintOid = sprint._id;
    firstCol = sprint.columns[0]?.id ?? firstCol;
    columnIds = new Set((sprint.columns ?? []).map((c) => c.id));
  }
  const status =
    input.status && columnIds.has(input.status) ? input.status : firstCol;
  project.taskSeq = (project.taskSeq ?? 0) + 1;
  await project.save();

  const assigneeName = input.assigneeName?.trim() || displayName;
  const matched = project.members.find(
    (m) =>
      m.id === input.assigneeId ||
      m.name.trim().toLowerCase() === assigneeName.toLowerCase(),
  );

  let teamOid: Types.ObjectId | null = null;
  if (input.teamId) {
    if (!Types.ObjectId.isValid(input.teamId)) {
      throw new AuthError('Team not found', 404, 'NOT_FOUND');
    }
    const team = await Team.findOne({ _id: input.teamId, projectId: project._id });
    if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');
    teamOid = team._id;
  }

  const estimate = Number(input.estimateHours) || 0;
  const task = await Task.create({
    orgId: project.orgId,
    projectId: project._id,
    key: `${project.key}-${project.taskSeq}`,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    type: input.type ?? 'task',
    priority: input.priority ?? 'medium',
    status,
    estimateHours: estimate,
    loggedHours: 0,
    remainingHours: estimate,
    createdBy: actor.sub,
    createdByName: displayName,
    reporterName: displayName,
    assigneeId: input.assigneeId || matched?.id || '',
    assigneeName: matched?.name || assigneeName,
    labels: (input.labels ?? []).map((label) => label.trim()).filter(Boolean).slice(0, 20),
    startDate: input.startDate ?? '',
    endDate: input.endDate ?? '',
    dueDate: input.dueDate ?? '',
    teamId: teamOid,
    sprintId: sprintOid,
    comments: [],
    attachments: [],
  });

  const presented = await presentTask(task);
  await broadcastProjectEvent(project, 'task:created', {
    task: presented,
    actorId: actor.sub,
  });

  const assigneeUserId = resolveMemberUserId(project.members, task.assigneeId);
  if (assigneeUserId && assigneeUserId !== actor.sub) {
    const name = displayName;
    void createAndEmit({
      orgId: String(project.orgId),
      recipientId: assigneeUserId,
      actorId: actor.sub,
      actorName: name,
      type: 'task.assigned',
      title: 'Task assigned to you',
      body: `${name} assigned you “${task.title}”`,
      href: boardTaskHref(String(project._id), String(task._id)),
      projectId: String(project._id),
      taskId: String(task._id),
      meta: { taskKey: task.key, taskTitle: task.title, projectName: project.name },
    }).catch((err) => console.error('[notifications] task.assigned', err));
  }

  return presented;
}

export async function updateTask(
  actor: Actor,
  taskId: string,
  patch: Record<string, unknown>,
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findById(taskId);
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(task.projectId), actor);
  requireMembership(project, actor.email);

  const prevAssigneeId = task.assigneeId;

  const allowed = [
    'title',
    'description',
    'type',
    'priority',
    'status',
    'estimateHours',
    'loggedHours',
    'assigneeId',
    'assigneeName',
    'reporterName',
    'labels',
    'startDate',
    'endDate',
    'dueDate',
  ] as const;

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (task as any)[key] = patch[key];
    }
  }

  if (patch.sprintId !== undefined) {
    const raw = patch.sprintId;
    if (raw === null || raw === '') {
      task.sprintId = null;
    } else if (typeof raw === 'string') {
      const sprint = await getSprintInProject(project, raw);
      task.sprintId = sprint._id;
    }
  }

  if (patch.teamId !== undefined) {
    const raw = patch.teamId;
    if (raw === null || raw === '') {
      task.teamId = null;
    } else if (typeof raw === 'string') {
      if (!Types.ObjectId.isValid(raw)) {
        throw new AuthError('Team not found', 404, 'NOT_FOUND');
      }
      const team = await Team.findOne({ _id: raw, projectId: task.projectId });
      if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');
      task.teamId = team._id;
    }
  }

  if (patch.estimateHours !== undefined || patch.loggedHours !== undefined) {
    task.remainingHours = Math.max((task.estimateHours ?? 0) - (task.loggedHours ?? 0), 0);
  }

  await task.save();
  const presented = await presentTask(task);
  await broadcastProjectEvent(project, 'task:updated', {
    task: presented,
    actorId: actor.sub,
    changed: Object.keys(patch),
  });

  if (
    patch.assigneeId !== undefined &&
    String(task.assigneeId ?? '') !== String(prevAssigneeId ?? '')
  ) {
    const assigneeUserId = resolveMemberUserId(project.members, task.assigneeId);
    if (assigneeUserId && assigneeUserId !== actor.sub) {
      const name = await actorName(actor);
      void createAndEmit({
        orgId: String(project.orgId),
        recipientId: assigneeUserId,
        actorId: actor.sub,
        actorName: name,
        type: 'task.assigned',
        title: 'Task assigned to you',
        body: `${name} assigned you “${task.title}”`,
        href: boardTaskHref(String(project._id), String(task._id)),
        projectId: String(project._id),
        taskId: String(task._id),
        meta: { taskKey: task.key, taskTitle: task.title, projectName: project.name },
      }).catch((err) => console.error('[notifications] task.assigned', err));
    }
  }

  return presented;
}

function collectAttachmentMedia(
  attachments: Array<{
    url?: string;
    mimeType?: string;
    storageProvider?: string | null;
    storageKey?: string | null;
  }> | undefined,
  into: StoredMediaRef[],
  seen: Set<string>,
) {
  for (const att of attachments ?? []) {
    const key = String(att.storageKey || att.url || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    into.push({
      url: att.url ?? '',
      provider: att.storageProvider,
      storageKey: att.storageKey,
      mimeType: att.mimeType,
    });
  }
}

export async function deleteTask(actor: Actor, taskId: string) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findById(taskId);
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(task.projectId), actor);
  requireMembership(project, actor.email);

  const linked = await TimelineItem.find({ taskId: task._id });
  const refs: StoredMediaRef[] = [];
  const seen = new Set<string>();
  collectAttachmentMedia(task.attachments, refs, seen);
  for (const comment of task.comments ?? []) {
    collectAttachmentMedia(comment.attachments, refs, seen);
  }
  for (const item of linked) {
    collectAttachmentMedia(item.attachments, refs, seen);
  }

  const id = String(task._id);
  const projectId = String(project._id);
  await TimelineItem.deleteMany({ taskId: task._id });
  await task.deleteOne();
  if (refs.length) await deleteStoredMediaMany(refs);

  await broadcastProjectEvent(project, 'task:deleted', {
    taskId: id,
    projectId,
    actorId: actor.sub,
  });

  return { ok: true as const, taskId: id, projectId };
}

export async function addComment(
  actor: Actor,
  taskId: string,
  body: string,
  files: Express.Multer.File[] = [],
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findById(taskId);
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(task.projectId), actor);
  requireMembership(project, actor.email);

  const displayName = await actorName(actor);
  const text = body.trim();
  const attachments = await Promise.all(
    files.map((f) => fileToAttachment(f, displayName)),
  );
  if (!text && attachments.length === 0) {
    throw new AuthError('Comment body or attachment required', 400);
  }

  const comment = {
    id: newId('cmt'),
    authorId: actor.sub,
    authorName: displayName,
    body: text,
    createdAt: new Date(),
    attachments,
  };
  task.comments.push(comment);
  await task.save();
  const presented = await presentTask(task);
  await broadcastProjectEvent(project, 'task:updated', {
    task: presented,
    actorId: actor.sub,
    changed: ['comments'],
  });

  const notifyIds = new Set<string>();
  const assigneeUserId = resolveMemberUserId(project.members, task.assigneeId);
  if (assigneeUserId) notifyIds.add(assigneeUserId);
  if (task.createdBy) notifyIds.add(String(task.createdBy));
  notifyIds.delete(actor.sub);

  for (const recipientId of notifyIds) {
    void createAndEmit({
      orgId: String(project.orgId),
      recipientId,
      actorId: actor.sub,
      actorName: displayName,
      type: 'task.commented',
      title: 'New comment on task',
      body: `${displayName} commented on “${task.title}”`,
      href: boardTaskHref(String(project._id), String(task._id)),
      projectId: String(project._id),
      taskId: String(task._id),
      meta: {
        taskKey: task.key,
        taskTitle: task.title,
        projectName: project.name,
        preview: text.slice(0, 120),
      },
    }).catch((err) => console.error('[notifications] task.commented', err));
  }

  return presented;
}

export async function addTaskAttachments(
  actor: Actor,
  taskId: string,
  files: Express.Multer.File[],
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findById(taskId);
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(task.projectId), actor);
  requireMembership(project, actor.email);

  const displayName = await actorName(actor);
  if (!files.length) throw new AuthError('No files uploaded', 400);

  const attachments = await Promise.all(
    files.map((f) => fileToAttachment(f, displayName)),
  );
  task.attachments.push(...attachments);
  await task.save();
  const presented = await presentTask(task);
  await broadcastProjectEvent(project, 'task:updated', {
    task: presented,
    actorId: actor.sub,
    changed: ['attachments'],
  });
  return presented;
}

export async function removeTaskAttachment(
  actor: Actor,
  taskId: string,
  attachmentId: string,
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findById(taskId);
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(task.projectId), actor);
  requireMembership(project, actor.email);

  const removed = task.attachments.find((a) => a.id === attachmentId);
  task.attachments = task.attachments.filter(
    (a) => a.id !== attachmentId,
  ) as typeof task.attachments;
  await task.save();
  if (removed) {
    await deleteStoredMediaMany([
      {
        url: removed.url,
        provider: (removed as { storageProvider?: string }).storageProvider,
        storageKey: (removed as { storageKey?: string }).storageKey,
        mimeType: removed.mimeType,
      } satisfies StoredMediaRef,
    ]);
  }
  const presented = await presentTask(task);
  await broadcastProjectEvent(project, 'task:updated', {
    task: presented,
    actorId: actor.sub,
    changed: ['attachments'],
  });
  return presented;
}

export async function createTimelineItem(
  actor: Actor,
  input: {
    projectId: string;
    title: string;
    description?: string;
    type?: string;
    priority?: string;
    dueDate?: string;
    teamId?: string | null;
  },
  files: Express.Multer.File[] = [],
) {
  const project = await getAccessibleProject(input.projectId, actor);
  requireAdmin(project, actor.email);

  let teamOid: Types.ObjectId | null = null;
  if (input.teamId) {
    if (!Types.ObjectId.isValid(input.teamId)) {
      throw new AuthError('Team not found', 404, 'NOT_FOUND');
    }
    const team = await Team.findOne({ _id: input.teamId, projectId: project._id });
    if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');
    teamOid = team._id;
  }

  const displayName = await actorName(actor);
  const item = await TimelineItem.create({
    orgId: project.orgId,
    projectId: project._id,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    type: input.type ?? 'task',
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ?? '',
    teamId: teamOid,
    attachments: await Promise.all(
      files.map((f) => fileToAttachment(f, displayName)),
    ),
    createdBy: actor.sub,
    createdByName: displayName,
    assigneeId: null,
    assigneeName: null,
    taskId: null,
    assignedAt: null,
  });

  return serializeTimeline(item);
}

export async function updateTimelineItem(
  actor: Actor,
  itemId: string,
  input: {
    title?: string;
    description?: string;
    type?: string;
    priority?: string;
    dueDate?: string;
    teamId?: string | null;
    removeAttachmentIds?: string[];
    assigneeId?: string | null;
    assigneeName?: string | null;
  },
  files: Express.Multer.File[] = [],
) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  }
  const item = await TimelineItem.findById(itemId);
  if (!item) throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(item.projectId), actor);
  requireAdmin(project, actor.email);

  const displayName = await actorName(actor);

  if (input.title !== undefined) item.title = input.title.trim();
  if (input.description !== undefined) item.description = input.description.trim();
  if (input.type !== undefined) item.type = input.type as typeof item.type;
  if (input.priority !== undefined) item.priority = input.priority as typeof item.priority;
  if (input.dueDate !== undefined) item.dueDate = input.dueDate;
  if (input.teamId !== undefined) {
    if (!input.teamId) {
      item.teamId = null;
    } else {
      if (!Types.ObjectId.isValid(input.teamId)) {
        throw new AuthError('Team not found', 404, 'NOT_FOUND');
      }
      const team = await Team.findOne({ _id: input.teamId, projectId: project._id });
      if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');
      item.teamId = team._id;
    }
  }

  const removeIds = new Set(input.removeAttachmentIds ?? []);
  const removedRefs: StoredMediaRef[] = [];
  if (removeIds.size > 0) {
    for (const a of item.attachments) {
      if (removeIds.has(a.id)) {
        removedRefs.push({
          url: a.url,
          provider: (a as { storageProvider?: string }).storageProvider,
          storageKey: (a as { storageKey?: string }).storageKey,
          mimeType: a.mimeType,
        });
      }
    }
    item.attachments = item.attachments.filter(
      (a) => !removeIds.has(a.id),
    ) as typeof item.attachments;
  }

  if (files.length) {
    item.attachments.push(
      ...(await Promise.all(files.map((f) => fileToAttachment(f, displayName)))),
    );
  }

  const assigneeProvided = input.assigneeId !== undefined;
  const nextAssigneeId = (input.assigneeId ?? '').trim();
  const nextAssigneeName = (input.assigneeName ?? '').trim();
  const wantsAssignee = assigneeProvided && Boolean(nextAssigneeId && nextAssigneeName);

  let task: TaskDoc | null = null;
  let taskWasCreated = false;

  if (wantsAssignee) {
    if (item.taskId) {
      task = await Task.findById(item.taskId);
      if (!task) throw new AuthError('Linked task not found', 404, 'NOT_FOUND');
      task.assigneeId = nextAssigneeId;
      task.assigneeName = nextAssigneeName;
      item.assigneeId = nextAssigneeId;
      item.assigneeName = nextAssigneeName;
      item.assignedAt = new Date();
    } else {
      // First assign from edit — create board task
      project.taskSeq = (project.taskSeq ?? 0) + 1;
      await project.save();
      const firstCol = project.columns[0]?.id ?? 'todo';
      task = await Task.create({
        orgId: project.orgId,
        projectId: project._id,
        key: `${project.key}-${project.taskSeq}`,
        title: item.title,
        description: item.description,
        type: item.type,
        priority: item.priority,
        status: firstCol,
        estimateHours: 0,
        loggedHours: 0,
        remainingHours: 0,
        createdBy: item.createdBy,
        createdByName: item.createdByName,
        reporterName: item.createdByName,
        assigneeId: nextAssigneeId,
        assigneeName: nextAssigneeName,
        labels: [],
        startDate: '',
        endDate: '',
        dueDate: item.dueDate,
        comments: [],
        attachments: [...(item.attachments ?? [])],
      });
      taskWasCreated = true;
      item.assigneeId = nextAssigneeId;
      item.assigneeName = nextAssigneeName;
      item.taskId = task._id;
      item.assignedAt = new Date();
    }
  } else if (assigneeProvided && !item.taskId) {
    // Clear pending assignee (no board task yet)
    item.assigneeId = null;
    item.assigneeName = null;
  }

  await item.save();
  if (removedRefs.length) await deleteStoredMediaMany(removedRefs);

  if (item.taskId) {
    if (!task) {
      task = await Task.findById(item.taskId);
    }
    if (task) {
      task.title = item.title;
      task.description = item.description ?? '';
      task.type = item.type;
      task.priority = item.priority;
      task.dueDate = item.dueDate ?? '';
      task.attachments = [...(item.attachments ?? [])] as typeof task.attachments;
      if (wantsAssignee) {
        task.assigneeId = nextAssigneeId;
        task.assigneeName = nextAssigneeName;
      }
      await task.save();
    }
  }

  const presentedTask = task ? await presentTask(task) : null;
  if (presentedTask) {
    await broadcastProjectEvent(
      project,
      taskWasCreated ? 'task:created' : 'task:updated',
      {
        task: presentedTask,
        actorId: actor.sub,
        changed: taskWasCreated
          ? undefined
          : ['title', 'description', 'type', 'priority', 'dueDate', 'assigneeId', 'assigneeName'],
      },
    );
  }

  return {
    item: serializeTimeline(item),
    task: presentedTask,
  };
}

export async function assignTimelineItem(
  actor: Actor,
  itemId: string,
  assignee: { id: string; name: string },
) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  }
  const item = await TimelineItem.findById(itemId);
  if (!item) throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(item.projectId), actor);
  requireAdmin(project, actor.email);

  // Reassign: update linked board task + timeline metadata
  if (item.taskId) {
    const task = await Task.findById(item.taskId);
    if (!task) throw new AuthError('Linked task not found', 404, 'NOT_FOUND');

    task.assigneeId = assignee.id;
    task.assigneeName = assignee.name;
    await task.save();

    item.assigneeId = assignee.id;
    item.assigneeName = assignee.name;
    item.assignedAt = new Date();
    await item.save();

    const presentedTask = await presentTask(task);
    await broadcastProjectEvent(project, 'task:updated', {
      task: presentedTask,
      actorId: actor.sub,
      changed: ['assigneeId', 'assigneeName'],
    });

    const assigneeUserId = resolveMemberUserId(project.members, assignee.id);
    if (assigneeUserId && assigneeUserId !== actor.sub) {
      const name = await actorName(actor);
      void createAndEmit({
        orgId: String(project.orgId),
        recipientId: assigneeUserId,
        actorId: actor.sub,
        actorName: name,
        type: 'task.assigned',
        title: 'Task assigned to you',
        body: `${name} assigned you “${task.title}”`,
        href: boardTaskHref(String(project._id), String(task._id)),
        projectId: String(project._id),
        taskId: String(task._id),
        meta: { taskKey: task.key, taskTitle: task.title, projectName: project.name },
      }).catch((err) => console.error('[notifications] task.assigned', err));
    }

    return {
      timelineItem: serializeTimeline(item),
      task: presentedTask,
    };
  }

  project.taskSeq = (project.taskSeq ?? 0) + 1;
  await project.save();

  const firstCol = project.columns[0]?.id ?? 'todo';
  const task = await Task.create({
    orgId: project.orgId,
    projectId: project._id,
    key: `${project.key}-${project.taskSeq}`,
    title: item.title,
    description: item.description,
    type: item.type,
    priority: item.priority,
    status: firstCol,
    estimateHours: 0,
    loggedHours: 0,
    remainingHours: 0,
    createdBy: item.createdBy,
    createdByName: item.createdByName,
    reporterName: item.createdByName,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    labels: [],
    startDate: '',
    endDate: '',
    dueDate: item.dueDate,
    teamId: item.teamId ?? null,
    comments: [],
    attachments: [...(item.attachments ?? [])],
  });

  item.assigneeId = assignee.id;
  item.assigneeName = assignee.name;
  item.taskId = task._id;
  item.assignedAt = new Date();
  await item.save();

  const presentedTask = await presentTask(task as TaskDoc);
  await broadcastProjectEvent(project, 'task:created', {
    task: presentedTask,
    actorId: actor.sub,
  });

  const assigneeUserId = resolveMemberUserId(project.members, assignee.id);
  if (assigneeUserId && assigneeUserId !== actor.sub) {
    const name = await actorName(actor);
    void createAndEmit({
      orgId: String(project.orgId),
      recipientId: assigneeUserId,
      actorId: actor.sub,
      actorName: name,
      type: 'task.assigned',
      title: 'Task assigned to you',
      body: `${name} assigned you “${task.title}”`,
      href: boardTaskHref(String(project._id), String(task._id)),
      projectId: String(project._id),
      taskId: String(task._id),
      meta: { taskKey: task.key, taskTitle: task.title, projectName: project.name },
    }).catch((err) => console.error('[notifications] task.assigned', err));
  }

  return {
    timelineItem: serializeTimeline(item),
    task: presentedTask,
  };
}

export async function deleteTimelineItem(actor: Actor, itemId: string) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  }
  const item = await TimelineItem.findById(itemId);
  if (!item) throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  if (item.taskId) {
    throw new AuthError('Cannot delete an assigned timeline item', 400);
  }

  const project = await getAccessibleProject(String(item.projectId), actor);
  requireAdmin(project, actor.email);

  const refs: StoredMediaRef[] = (item.attachments ?? []).map((a) => ({
    url: a.url,
    provider: (a as { storageProvider?: string }).storageProvider,
    storageKey: (a as { storageKey?: string }).storageKey,
    mimeType: a.mimeType,
  }));
  await item.deleteOne();
  await deleteStoredMediaMany(refs);
  return { ok: true };
}

function eligibleTeamMemberIds(
  project: ProjectDoc,
  memberIds: string[] | undefined,
): string[] {
  const allowed = new Set(
    project.members
      .filter((m) => m.status !== 'pending')
      .map((m) => m.id),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of memberIds ?? []) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function createPhases(
  actor: Actor,
  projectId: string,
  input: { phases: Array<{ name: string; startDate?: string; endDate?: string }> },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const rows = input.phases
    .map((p) => ({
      name: p.name.trim(),
      startDate: optionalIsoDay(p.startDate),
      endDate: optionalIsoDay(p.endDate),
    }))
    .filter((p) => p.name);
  if (rows.length === 0) throw new AuthError('At least one phase name is required', 400);

  for (const row of rows) {
    if (row.startDate && row.endDate && row.endDate < row.startDate) {
      throw new AuthError('Phase end date must be on or after the start date', 400);
    }
  }

  const last = await Phase.findOne({ projectId: project._id }).sort({ order: -1 }).select('order').lean();
  let order = (last?.order ?? -1) + 1;
  const created = await Phase.insertMany(
    rows.map((row) => ({
      orgId: project.orgId,
      projectId: project._id,
      name: row.name,
      order: order++,
      status: 'planned' as const,
      startDate: row.startDate,
      endDate: row.endDate,
    })),
  );

  const plan = await broadcastPlan(project, actor.sub);
  return { ...plan, created: created.map(serializePhase) };
}

export async function startPhase(actor: Actor, projectId: string, phaseId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);
  const phase = await getPhaseInProject(project, phaseId);
  if (phase.status === 'done') {
    throw new AuthError('This phase is already complete', 400);
  }
  if (phase.status !== 'active') {
    const otherActive = await Phase.findOne({
      projectId: project._id,
      status: 'active',
      _id: { $ne: phase._id },
    });
    if (otherActive) {
      throw new AuthError('Another phase is already active. Complete it first.', 409, 'PHASE_ACTIVE');
    }
    phase.status = 'active';
    phase.startedAt = new Date();
    await phase.save();
  }
  return broadcastPlan(project, actor.sub);
}

export async function completePhase(actor: Actor, projectId: string, phaseId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);
  const phase = await getPhaseInProject(project, phaseId);
  if (phase.status === 'done') return broadcastPlan(project, actor.sub);

  const sprints = await Sprint.find({ projectId: project._id, phaseId: phase._id });
  const moved: TaskDoc[] = [];
  for (const sprint of sprints) {
    moved.push(...(await completeSprintDoc(project, sprint)));
  }
  phase.status = 'done';
  phase.completedAt = new Date();
  await phase.save();

  const plan = await broadcastPlan(project, actor.sub);
  if (moved.length) {
    const presentedTasks = await presentTasks(moved);
    for (const task of presentedTasks) {
      await broadcastProjectEvent(project, 'task:updated', {
        task,
        actorId: actor.sub,
        changed: ['sprintId', 'status'],
      });
    }
  }
  return plan;
}

export async function createSprint(
  actor: Actor,
  projectId: string,
  input: { name: string; phaseId?: string | null; startDate: string; endDate: string },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const name = input.name.trim();
  if (!name) throw new AuthError('Sprint name required', 400);
  const startDate = requireIsoDay(input.startDate, 'Start date');
  const endDate = requireIsoDay(input.endDate, 'End date');
  if (endDate < startDate) {
    throw new AuthError('Sprint end date must be on or after the start date', 400);
  }

  let phaseOid: Types.ObjectId | null = null;
  if (input.phaseId) {
    const phase = await getPhaseInProject(project, input.phaseId);
    if (phase.status === 'done') {
      throw new AuthError('Cannot add a sprint to a completed phase', 400);
    }
    phaseOid = phase._id;
  }

  const sprint = await Sprint.create({
    orgId: project.orgId,
    projectId: project._id,
    phaseId: phaseOid,
    name,
    startDate,
    endDate,
    status: 'planned',
    columns: cloneColumns((project.columns ?? []) as BoardColumnLike[]),
  });

  const plan = await broadcastPlan(project, actor.sub);
  return { ...plan, sprint: serializeSprint(sprint) };
}

export async function startSprint(actor: Actor, projectId: string, sprintId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);
  const sprint = await getSprintInProject(project, sprintId);
  if (sprint.status === 'done') {
    throw new AuthError('This sprint is already complete', 400);
  }
  if (sprint.status === 'active') return broadcastPlan(project, actor.sub);

  if (sprint.phaseId) {
    const phase = await Phase.findById(sprint.phaseId);
    if (!phase || phase.status !== 'active') {
      throw new AuthError('Start the phase before starting this sprint', 400);
    }
    const other = await Sprint.findOne({
      projectId: project._id,
      phaseId: sprint.phaseId,
      status: 'active',
      _id: { $ne: sprint._id },
    });
    if (other) {
      throw new AuthError('Another sprint is already active in this phase', 409, 'SPRINT_ACTIVE');
    }
  } else {
    const other = await Sprint.findOne({
      projectId: project._id,
      phaseId: null,
      status: 'active',
      _id: { $ne: sprint._id },
    });
    if (other) {
      throw new AuthError('Another sprint is already active', 409, 'SPRINT_ACTIVE');
    }
  }

  sprint.status = 'active';
  sprint.startedAt = new Date();
  await sprint.save();
  return broadcastPlan(project, actor.sub);
}

export async function extendSprint(
  actor: Actor,
  projectId: string,
  sprintId: string,
  endDateRaw: string,
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);
  const sprint = await getSprintInProject(project, sprintId);
  if (sprint.status === 'done') {
    throw new AuthError('Cannot extend a completed sprint', 400);
  }
  const endDate = requireIsoDay(endDateRaw, 'End date');
  if (endDate <= sprint.endDate) {
    throw new AuthError('New end date must be after the current end date', 400);
  }
  if (endDate < sprint.startDate) {
    throw new AuthError('End date must be on or after the start date', 400);
  }
  sprint.endDate = endDate;
  await sprint.save();
  return broadcastPlan(project, actor.sub);
}

export async function completeSprint(actor: Actor, projectId: string, sprintId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);
  const sprint = await getSprintInProject(project, sprintId);
  const moved = await completeSprintDoc(project, sprint);
  const plan = await broadcastPlan(project, actor.sub);
  if (moved.length) {
    const presentedTasks = await presentTasks(moved);
    for (const task of presentedTasks) {
      await broadcastProjectEvent(project, 'task:updated', {
        task,
        actorId: actor.sub,
        changed: ['sprintId', 'status'],
      });
    }
  }
  return plan;
}

export async function createTeam(
  actor: Actor,
  projectId: string,
  input: { name: string; memberIds?: string[] },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireAdmin(project, actor.email);

  const name = input.name.trim();
  if (!name) throw new AuthError('Team name is required', 400);
  if (name.length > 80) throw new AuthError('Team name is too long', 400);

  const memberIds = eligibleTeamMemberIds(project, input.memberIds);

  try {
    const team = await Team.create({
      orgId: project.orgId,
      projectId: project._id,
      name,
      memberIds,
    });
    const serialized = serializeTeam(team);
    await broadcastProjectEvent(project, 'team:upserted', {
      team: serialized,
      actorId: actor.sub,
    });
    return serialized;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AuthError('A team with that name already exists', 409, 'NAME_TAKEN');
    }
    throw err;
  }
}

export async function updateTeam(
  actor: Actor,
  teamId: string,
  input: { name?: string; memberIds?: string[] },
) {
  if (!Types.ObjectId.isValid(teamId)) {
    throw new AuthError('Team not found', 404, 'NOT_FOUND');
  }
  const team = await Team.findById(teamId);
  if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(team.projectId), actor);
  requireAdmin(project, actor.email);

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AuthError('Team name is required', 400);
    if (name.length > 80) throw new AuthError('Team name is too long', 400);
    team.name = name;
  }
  if (input.memberIds !== undefined) {
    team.memberIds = eligibleTeamMemberIds(project, input.memberIds);
  }

  try {
    await team.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AuthError('A team with that name already exists', 409, 'NAME_TAKEN');
    }
    throw err;
  }
  const serialized = serializeTeam(team);
  await broadcastProjectEvent(project, 'team:upserted', {
    team: serialized,
    actorId: actor.sub,
  });
  return serialized;
}

export async function addTeamMembers(
  actor: Actor,
  teamId: string,
  memberIds: string[],
) {
  if (!Types.ObjectId.isValid(teamId)) {
    throw new AuthError('Team not found', 404, 'NOT_FOUND');
  }
  const team = await Team.findById(teamId);
  if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(team.projectId), actor);
  requireAdmin(project, actor.email);

  const toAdd = eligibleTeamMemberIds(project, memberIds);
  if (toAdd.length === 0) {
    throw new AuthError('No valid project members to add', 400);
  }

  const existing = new Set(team.memberIds ?? []);
  for (const id of toAdd) existing.add(id);
  team.memberIds = [...existing];
  await team.save();

  const serialized = serializeTeam(team);
  await broadcastProjectEvent(project, 'team:upserted', {
    team: serialized,
    actorId: actor.sub,
  });
  return serialized;
}

export async function removeTeamMember(
  actor: Actor,
  teamId: string,
  memberId: string,
) {
  if (!Types.ObjectId.isValid(teamId)) {
    throw new AuthError('Team not found', 404, 'NOT_FOUND');
  }
  const team = await Team.findById(teamId);
  if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(team.projectId), actor);
  requireAdmin(project, actor.email);

  if (!(team.memberIds ?? []).includes(memberId)) {
    throw new AuthError('Member is not on this team', 404, 'NOT_FOUND');
  }

  team.memberIds = (team.memberIds ?? []).filter((id) => id !== memberId);
  await team.save();

  const serialized = serializeTeam(team);
  await broadcastProjectEvent(project, 'team:upserted', {
    team: serialized,
    actorId: actor.sub,
  });
  return serialized;
}

export async function deleteTeam(actor: Actor, teamId: string) {
  if (!Types.ObjectId.isValid(teamId)) {
    throw new AuthError('Team not found', 404, 'NOT_FOUND');
  }
  const team = await Team.findById(teamId);
  if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');

  const project = await getAccessibleProject(String(team.projectId), actor);
  requireAdmin(project, actor.email);

  const id = String(team._id);
  await Task.updateMany({ teamId: team._id }, { $set: { teamId: null } });
  await team.deleteOne();
  await broadcastProjectEvent(project, 'team:deleted', {
    teamId: id,
    actorId: actor.sub,
  });
  return { ok: true, teamId: id };
}

export async function listProjectTeams(actor: Actor, projectId: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);
  const teams = await Team.find({ projectId: project._id }).sort({ name: 1 });
  return teams.map(serializeTeam);
}

export async function listProjectTasks(
  actor: Actor,
  projectId: string,
  opts?: { teamId?: string | null },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  const filter: Record<string, unknown> = { projectId: project._id };
  if (opts?.teamId === 'global') {
    filter.teamId = null;
  } else if (opts?.teamId) {
    if (!Types.ObjectId.isValid(opts.teamId)) {
      throw new AuthError('Team not found', 404, 'NOT_FOUND');
    }
    const team = await Team.findOne({ _id: opts.teamId, projectId: project._id });
    if (!team) throw new AuthError('Team not found', 404, 'NOT_FOUND');
    filter.teamId = team._id;
  }

  const tasks = await Task.find(filter).sort({ updatedAt: -1 });
  return Promise.all(tasks.map((t) => presentTask(t as TaskDoc)));
}

