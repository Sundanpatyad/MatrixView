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
import { TimelineItem } from './models/TimelineItem.js';
import {
  presentProject,
  presentTask,
  presentProjects,
  presentTasks,
  serializeTimeline,
} from './serialize.js';
import {
  deleteStoredMedia,
  deleteStoredMediaMany,
  type StoredMediaRef,
} from '../../storage/media.js';
import { fileToAttachment, newId } from './upload.js';

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

async function getProjectInOrg(projectId: string, orgId: string): Promise<ProjectDoc> {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new AuthError('Project not found', 404, 'NOT_FOUND');
  }
  const project = await Project.findOne({ _id: projectId, orgId });
  if (!project) throw new AuthError('Project not found', 404, 'NOT_FOUND');
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
    throw new AuthError('Admin access required', 403, 'FORBIDDEN');
  }
  return member;
}

export async function getWorkspace(actor: Actor) {
  const orgId = actor.orgId;
  const projects = await Project.find({ orgId }).sort({ createdAt: -1 });
  const memberProjectIds = projects
    .filter((p) => p.members.some((m) => m.email.toLowerCase() === actor.email.toLowerCase()))
    .map((p) => p._id);

  // Org admins see all; members see only projects they belong to
  const visible =
    actor.role === 'Admin'
      ? projects
      : projects.filter((p) =>
          p.members.some((m) => m.email.toLowerCase() === actor.email.toLowerCase()),
        );

  const visibleIds = visible.map((p) => p._id);
  const tasks = await Task.find({ orgId, projectId: { $in: visibleIds } }).sort({
    createdAt: 1,
  });
  const timeline = await TimelineItem.find({
    orgId,
    projectId: { $in: memberProjectIds.length ? memberProjectIds : visibleIds },
  }).sort({ createdAt: -1 });

  return {
    projects: await presentProjects(visible),
    tasks: await presentTasks(tasks),
    timeline: timeline.map(serializeTimeline),
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

export async function addMember(
  actor: Actor,
  projectId: string,
  input: { name?: string; email: string; role: 'admin' | 'member' },
) {
  const project = await getProjectInOrg(projectId, actor.orgId);
  requireAdmin(project, actor.email);

  const email = input.email.trim().toLowerCase();
  if (!email) throw new AuthError('Email required', 400);

  const existingOnProject = project.members.find((m) => m.email === email);
  if (existingOnProject && existingOnProject.status !== 'pending') {
    throw new AuthError('Member already on project', 409, 'MEMBER_EXISTS');
  }

  const existingInOrg = await User.findOne({ orgId: actor.orgId, email });
  const existingElsewhere = existingInOrg
    ? null
    : await User.findOne({ email });

  if (existingElsewhere) {
    throw new AuthError(
      'This email already belongs to another organization',
      409,
      'EMAIL_OTHER_ORG',
    );
  }

  const displayName =
    existingInOrg?.name ??
    (input.name?.trim() || email.split('@')[0] || 'Invited user');

  // Existing org user → add immediately
  if (existingInOrg) {
    if (existingOnProject) {
      existingOnProject.userId = existingInOrg._id;
      existingOnProject.name = existingInOrg.name;
      existingOnProject.role = input.role;
      existingOnProject.status = 'active';
    } else {
      project.members.push({
        id: newId('mem'),
        userId: existingInOrg._id,
        name: existingInOrg.name,
        email,
        role: input.role,
        status: 'active',
        addedAt: new Date(),
      } as (typeof project.members)[number]);
    }
    await project.save();
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
    { orgId: actor.orgId, projectId: project._id, email, status: 'pending' },
    { $set: { status: 'revoked' } },
  );

  await ProjectInvite.create({
    orgId: actor.orgId,
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
  const org = await Organization.findById(actor.orgId).lean();
  const inviter = await User.findById(actor.sub).lean();

  let emailSent = false;
  try {
    const mail = await sendInviteEmail({
      to: email,
      inviterName: inviter?.name ?? actor.email,
      projectName: project.name,
      orgName: org?.name ?? 'TaskTrack',
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
  const org = await Organization.findById(invite.orgId).lean();
  return {
    email: invite.email,
    name: invite.name || '',
    role: invite.role as 'admin' | 'member',
    projectName: project?.name ?? 'Project',
    orgName: org?.name ?? 'Organization',
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
  const orgId = user.orgId;

  const projects = await Project.find({
    orgId,
    'members.email': email,
  });

  for (const project of projects) {
    const member = project.members.find((m) => m.email === email);
    if (!member) continue;
    member.userId = user._id;
    member.name = user.name;
    member.status = 'active';
    await project.save();
  }

  await ProjectInvite.updateMany(
    { orgId, email, status: 'pending' },
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

  const user = await User.create({
    orgId: invite.orgId,
    email,
    name: input.name.trim() || invite.name || email.split('@')[0],
    passwordHash: await hashPassword(input.password),
    role: 'Member',
    status: 'active',
  });

  const project = await Project.findOne({ _id: invite.projectId, orgId: invite.orgId });
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
  const project = await getProjectInOrg(projectId, actor.orgId);
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
  const project = await getProjectInOrg(projectId, actor.orgId);
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
  return presentProject(project);
}

export async function addColumn(actor: Actor, projectId: string, label: string) {
  const project = await getProjectInOrg(projectId, actor.orgId);
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
  return { project: await presentProject(project), column };
}

export async function renameColumn(
  actor: Actor,
  projectId: string,
  columnId: string,
  label: string,
) {
  const project = await getProjectInOrg(projectId, actor.orgId);
  requireMembership(project, actor.email);
  const trimmed = label.trim();
  if (!trimmed) throw new AuthError('Column label required', 400);

  const col = project.columns.find((c) => c.id === columnId);
  if (!col) throw new AuthError('Column not found', 404, 'NOT_FOUND');
  col.label = trimmed;
  await project.save();
  return presentProject(project);
}

export async function removeColumn(
  actor: Actor,
  projectId: string,
  columnId: string,
  moveToStatus?: string,
) {
  const project = await getProjectInOrg(projectId, actor.orgId);
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
  return {
    project: await presentProject(project),
    tasks: await presentTasks(tasks),
  };
}

export async function reorderColumns(
  actor: Actor,
  projectId: string,
  columnIds: string[],
) {
  const project = await getProjectInOrg(projectId, actor.orgId);
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
  return presentProject(project);
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
  },
) {
  const project = await getProjectInOrg(projectId, actor.orgId);
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

  const estimate = Number(input.estimateHours) || 0;
  const task = await Task.create({
    orgId: actor.orgId,
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
    comments: [],
    attachments: [],
  });

  return presentTask(task);
}

export async function updateTask(
  actor: Actor,
  taskId: string,
  patch: Record<string, unknown>,
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findOne({ _id: taskId, orgId: actor.orgId });
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getProjectInOrg(String(task.projectId), actor.orgId);
  requireMembership(project, actor.email);

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

  if (patch.estimateHours !== undefined || patch.loggedHours !== undefined) {
    task.remainingHours = Math.max((task.estimateHours ?? 0) - (task.loggedHours ?? 0), 0);
  }

  await task.save();
  return presentTask(task);
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
  const task = await Task.findOne({ _id: taskId, orgId: actor.orgId });
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getProjectInOrg(String(task.projectId), actor.orgId);
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
  return presentTask(task);
}

export async function addTaskAttachments(
  actor: Actor,
  taskId: string,
  files: Express.Multer.File[],
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findOne({ _id: taskId, orgId: actor.orgId });
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getProjectInOrg(String(task.projectId), actor.orgId);
  requireMembership(project, actor.email);

  const displayName = await actorName(actor);
  if (!files.length) throw new AuthError('No files uploaded', 400);

  const attachments = await Promise.all(
    files.map((f) => fileToAttachment(f, displayName)),
  );
  task.attachments.push(...attachments);
  await task.save();
  return presentTask(task);
}

export async function removeTaskAttachment(
  actor: Actor,
  taskId: string,
  attachmentId: string,
) {
  if (!Types.ObjectId.isValid(taskId)) {
    throw new AuthError('Task not found', 404, 'NOT_FOUND');
  }
  const task = await Task.findOne({ _id: taskId, orgId: actor.orgId });
  if (!task) throw new AuthError('Task not found', 404, 'NOT_FOUND');

  const project = await getProjectInOrg(String(task.projectId), actor.orgId);
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
  return presentTask(task);
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
  },
  files: Express.Multer.File[] = [],
) {
  const project = await getProjectInOrg(input.projectId, actor.orgId);
  requireAdmin(project, actor.email);

  const displayName = await actorName(actor);
  const item = await TimelineItem.create({
    orgId: actor.orgId,
    projectId: project._id,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    type: input.type ?? 'task',
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ?? '',
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
    removeAttachmentIds?: string[];
    assigneeId?: string | null;
    assigneeName?: string | null;
  },
  files: Express.Multer.File[] = [],
) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  }
  const item = await TimelineItem.findOne({ _id: itemId, orgId: actor.orgId });
  if (!item) throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');

  const project = await getProjectInOrg(String(item.projectId), actor.orgId);
  requireAdmin(project, actor.email);

  const displayName = await actorName(actor);

  if (input.title !== undefined) item.title = input.title.trim();
  if (input.description !== undefined) item.description = input.description.trim();
  if (input.type !== undefined) item.type = input.type as typeof item.type;
  if (input.priority !== undefined) item.priority = input.priority as typeof item.priority;
  if (input.dueDate !== undefined) item.dueDate = input.dueDate;

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

  if (wantsAssignee) {
    if (item.taskId) {
      task = await Task.findOne({ _id: item.taskId, orgId: actor.orgId });
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
        orgId: actor.orgId,
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
      task = await Task.findOne({ _id: item.taskId, orgId: actor.orgId });
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

  return {
    item: serializeTimeline(item),
    task: task ? await presentTask(task) : null,
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
  const item = await TimelineItem.findOne({ _id: itemId, orgId: actor.orgId });
  if (!item) throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');

  const project = await getProjectInOrg(String(item.projectId), actor.orgId);
  requireAdmin(project, actor.email);

  // Reassign: update linked board task + timeline metadata
  if (item.taskId) {
    const task = await Task.findOne({ _id: item.taskId, orgId: actor.orgId });
    if (!task) throw new AuthError('Linked task not found', 404, 'NOT_FOUND');

    task.assigneeId = assignee.id;
    task.assigneeName = assignee.name;
    await task.save();

    item.assigneeId = assignee.id;
    item.assigneeName = assignee.name;
    item.assignedAt = new Date();
    await item.save();

    return {
      timelineItem: serializeTimeline(item),
      task: await presentTask(task),
    };
  }

  project.taskSeq = (project.taskSeq ?? 0) + 1;
  await project.save();

  const firstCol = project.columns[0]?.id ?? 'todo';
  const task = await Task.create({
    orgId: actor.orgId,
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
    comments: [],
    attachments: [...(item.attachments ?? [])],
  });

  item.assigneeId = assignee.id;
  item.assigneeName = assignee.name;
  item.taskId = task._id;
  item.assignedAt = new Date();
  await item.save();

  return {
    timelineItem: serializeTimeline(item),
    task: await presentTask(task as TaskDoc),
  };
}

export async function deleteTimelineItem(actor: Actor, itemId: string) {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  }
  const item = await TimelineItem.findOne({ _id: itemId, orgId: actor.orgId });
  if (!item) throw new AuthError('Timeline item not found', 404, 'NOT_FOUND');
  if (item.taskId) {
    throw new AuthError('Cannot delete an assigned timeline item', 400);
  }

  const project = await getProjectInOrg(String(item.projectId), actor.orgId);
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
