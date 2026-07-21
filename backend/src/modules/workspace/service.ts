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
} from './serialize.js';
import { broadcastProjectEvent } from './boardRealtime.js';
import {
  deleteStoredMedia,
  deleteStoredMediaMany,
  type StoredMediaRef,
} from '../../storage/media.js';
import { fileToAttachment, newId } from './upload.js';
import {
  boardTaskHref,
  createAndEmit,
  projectHref,
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
  return member;
}

function requireAdmin(project: ProjectDoc, email: string) {
  const member = requireMembership(project, email);
  if (member.role !== 'admin') {
    throw new AuthError('Project admin access required', 403, 'FORBIDDEN');
  }
  return member;
}

/** Projects the user belongs to — visibility is by project role, not org admin. */
export async function getWorkspace(actor: Actor) {
  const email = actor.email.toLowerCase();
  const visible = await Project.find({
    'members.email': email,
  }).sort({ createdAt: -1 });

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

  return {
    projects: await presentProjects(visible),
    tasks: await presentTasks(tasks),
    timeline: timeline.map(serializeTimeline),
    teams: teams.map(serializeTeam),
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

  const existingOnProject = project.members.find((m) => m.email === email);
  if (existingOnProject && existingOnProject.status !== 'pending') {
    throw new AuthError('Member already on project', 409, 'MEMBER_EXISTS');
  }

  // Any existing DockX account can be added (personal workspaces are separate)
  const existingUser = await User.findOne({ email });

  const displayName =
    existingUser?.name ??
    (input.name?.trim() || email.split('@')[0] || 'Invited user');

  // Existing user → add to project immediately with chosen role
  if (existingUser) {
    if (existingOnProject) {
      existingOnProject.userId = existingUser._id;
      existingOnProject.name = existingUser.name;
      existingOnProject.role = input.role;
      existingOnProject.status = 'active';
    } else {
      project.members.push({
        id: newId('mem'),
        userId: existingUser._id,
        name: existingUser.name,
        email,
        role: input.role,
        status: 'active',
        addedAt: new Date(),
      } as (typeof project.members)[number]);
    }
    await project.save();
    const name = await actorName(actor);
    void createAndEmit({
      orgId: String(project.orgId),
      recipientId: String(existingUser._id),
      actorId: actor.sub,
      actorName: name,
      type: 'project.added',
      title: 'Added to project',
      body: `${name} added you to ${project.name}`,
      href: projectHref(String(project._id)),
      projectId: String(project._id),
      meta: { projectName: project.name, role: input.role },
    }).catch((err) => console.error('[notifications] project.added', err));
    return {
      project: await presentProject(project),
      result: 'added' as const,
      emailSent: false,
      inviteLink: null as string | null,
    };
  }

  // New email → pending member + invite email
  if (existingOnProject) {
    existingOnProject.name = displayName;
    existingOnProject.role = input.role;
    existingOnProject.status = 'pending';
    existingOnProject.userId = null;
  } else {
    project.members.push({
      id: newId('mem'),
      userId: null,
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

  await ProjectInvite.create({
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

  const inviteLink = `${config.appUrl}/register?invite=${encodeURIComponent(rawToken)}`;
  const inviter = await User.findById(actor.sub).lean();

  let emailSent = false;
  try {
    const mail = await sendInviteEmail({
      to: email,
      inviterName: inviter?.name ?? actor.email,
      projectName: project.name,
      orgName: project.name,
      inviteLink,
    });
    emailSent = mail.sent;
  } catch (err) {
    console.error('[mail] Failed to send invite email', err);
  }

  return {
    project: await presentProject(project),
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
  return {
    email: invite.email,
    name: invite.name || '',
    role: invite.role as 'admin' | 'member',
    projectName: project?.name ?? 'Project',
    orgName: project?.name ?? 'DockX',
    expiresAt: invite.expiresAt.toISOString(),
  };
}

/** After signup/login — attach user to any pending project seats for this email. */
export async function claimPendingProjectInvites(user: {
  _id: Types.ObjectId;
  orgId: Types.ObjectId | string;
  email: string;
  name: string;
}) {
  const email = user.email.toLowerCase().trim();

  const projects = await Project.find({ 'members.email': email });

  for (const project of projects) {
    const member = project.members.find((m) => m.email === email);
    if (!member) continue;
    member.userId = user._id;
    member.name = user.name;
    member.status = 'active';
    await project.save();
  }

  await ProjectInvite.updateMany(
    { email, status: 'pending' },
    {
      $set: {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedUserId: user._id,
      },
    },
  );
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

  const project = await Project.findById(invite.projectId);
  if (project) {
    let member = project.members.find((m) => m.email === email);
    if (!member) {
      project.members.push({
        id: newId('mem'),
        userId: user._id,
        name: user.name,
        email,
        role: invite.role,
        status: 'active',
        addedAt: new Date(),
      } as (typeof project.members)[number]);
    } else {
      member.userId = user._id;
      member.name = user.name;
      member.role = invite.role as 'admin' | 'member';
      member.status = 'active';
    }
    await project.save();
  }

  invite.status = 'accepted';
  invite.acceptedAt = new Date();
  invite.acceptedUserId = user._id;
  await invite.save();

  await claimPendingProjectInvites(user);

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

  project.members = project.members.filter((m) => m.id !== memberId) as typeof project.members;
  await project.save();

  // Keep team membership in sync when a project member is removed
  await Team.updateMany(
    { projectId: project._id },
    { $pull: { memberIds: memberId } },
  );

  return presentProject(project);
}

export async function addColumn(actor: Actor, projectId: string, label: string) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  const trimmed = label.trim();
  if (!trimmed) throw new AuthError('Column label required', 400);

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
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);
  const trimmed = label.trim();
  if (!trimmed) throw new AuthError('Column label required', 400);

  const col = project.columns.find((c) => c.id === columnId);
  if (!col) throw new AuthError('Column not found', 404, 'NOT_FOUND');
  col.label = trimmed;
  await project.save();
  const presented = await presentProject(project);
  await broadcastProjectEvent(project, 'project:columns', {
    project: presented,
    actorId: actor.sub,
  });
  return presented;
}

export async function removeColumn(
  actor: Actor,
  projectId: string,
  columnId: string,
  moveToStatus?: string,
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

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
    { projectId: project._id, status: columnId },
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
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

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
  return presented;
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
    teamId?: string | null;
  },
) {
  const project = await getAccessibleProject(projectId, actor);
  requireMembership(project, actor.email);

  const displayName = await actorName(actor);
  const firstCol = project.columns[0]?.id ?? 'todo';
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
    status: firstCol,
    estimateHours: estimate,
    loggedHours: 0,
    remainingHours: estimate,
    createdBy: actor.sub,
    createdByName: displayName,
    reporterName: displayName,
    assigneeId: input.assigneeId || matched?.id || '',
    assigneeName: matched?.name || assigneeName,
    labels: [],
    startDate: '',
    endDate: '',
    dueDate: input.dueDate ?? '',
    teamId: teamOid,
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

