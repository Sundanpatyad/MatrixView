import { loadAvatarMap } from '../auth/avatars.js';
import type { ProjectDoc } from './models/Project.js';
import type { TaskDoc } from './models/Task.js';
import type { TimelineDoc } from './models/TimelineItem.js';

function iso(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return d.toISOString();
}

function mapAttachment(a: {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt?: Date | string;
  uploadedBy: string;
}) {
  return {
    id: a.id,
    name: a.name,
    size: a.size,
    mimeType: a.mimeType,
    url: a.url,
    dataUrl: a.url,
    createdAt: iso(a.createdAt),
    uploadedBy: a.uploadedBy,
  };
}

export function serializeProject(doc: ProjectDoc) {
  return {
    id: String(doc._id),
    name: doc.name,
    key: doc.key,
    description: doc.description ?? '',
    avatarUrl: (doc as { avatarUrl?: string | null }).avatarUrl ?? null,
    createdAt: iso(doc.createdAt),
    createdBy: doc.createdBy,
    createdByUserId: doc.createdByUserId ? String(doc.createdByUserId) : null,
    columns: (doc.columns ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      accent: c.accent,
      locked: Boolean(c.locked),
    })),
    members: (doc.members ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role as 'admin' | 'member',
      status: ((m as { status?: string }).status === 'pending' ? 'pending' : 'active') as
        | 'active'
        | 'pending',
      addedAt: iso(m.addedAt),
      userId: m.userId ? String(m.userId) : null,
      avatarUrl: null as string | null,
    })),
  };
}

export function serializeTask(doc: TaskDoc) {
  return {
    id: String(doc._id),
    projectId: String(doc.projectId),
    key: doc.key,
    title: doc.title,
    description: doc.description ?? '',
    type: doc.type,
    priority: doc.priority,
    status: doc.status,
    estimateHours: doc.estimateHours ?? 0,
    loggedHours: doc.loggedHours ?? 0,
    remainingHours:
      doc.remainingHours ??
      Math.max((doc.estimateHours ?? 0) - (doc.loggedHours ?? 0), 0),
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    assigneeId: doc.assigneeId ?? '',
    assigneeName: doc.assigneeName ?? '',
    reporterName: doc.reporterName || doc.createdByName || 'Unknown',
    labels: doc.labels ?? [],
    startDate: doc.startDate ?? '',
    endDate: doc.endDate ?? '',
    dueDate: doc.dueDate ?? '',
    comments: (doc.comments ?? []).map((c) => ({
      id: c.id,
      authorId: c.authorId ?? '',
      authorName: c.authorName,
      authorAvatarUrl: null as string | null,
      body: c.body ?? '',
      createdAt: iso(c.createdAt),
      attachments: (c.attachments ?? []).map(mapAttachment),
    })),
    attachments: (doc.attachments ?? []).map(mapAttachment),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function serializeTimeline(doc: TimelineDoc) {
  return {
    id: String(doc._id),
    projectId: String(doc.projectId),
    title: doc.title,
    description: doc.description ?? '',
    type: doc.type,
    priority: doc.priority,
    dueDate: doc.dueDate ?? '',
    attachments: (doc.attachments ?? []).map(mapAttachment),
    createdBy: doc.createdBy,
    createdByName: doc.createdByName,
    createdAt: iso(doc.createdAt),
    assigneeId: doc.assigneeId ?? null,
    assigneeName: doc.assigneeName ?? null,
    taskId: doc.taskId ? String(doc.taskId) : null,
    assignedAt: doc.assignedAt ? iso(doc.assignedAt) : null,
  };
}

type SerializedProject = ReturnType<typeof serializeProject>;
type SerializedTask = ReturnType<typeof serializeTask>;

export async function presentProjects(docs: ProjectDoc[]): Promise<SerializedProject[]> {
  const serialized = docs.map(serializeProject);
  const avatars = await loadAvatarMap(serialized.flatMap((p) => p.members.map((m) => m.userId)));
  return serialized.map((p) => ({
    ...p,
    members: p.members.map((m) => ({
      ...m,
      avatarUrl: m.userId ? avatars.get(m.userId) ?? null : null,
    })),
  }));
}

export async function presentProject(doc: ProjectDoc): Promise<SerializedProject> {
  const [project] = await presentProjects([doc]);
  return project;
}

export async function presentTasks(docs: TaskDoc[]): Promise<SerializedTask[]> {
  const serialized = docs.map(serializeTask);
  const avatars = await loadAvatarMap(
    serialized.flatMap((t) => t.comments.map((c) => c.authorId)),
  );
  return serialized.map((t) => ({
    ...t,
    comments: t.comments.map((c) => ({
      ...c,
      authorAvatarUrl: c.authorId ? avatars.get(c.authorId) ?? null : null,
    })),
  }));
}

export async function presentTask(doc: TaskDoc): Promise<SerializedTask> {
  const [task] = await presentTasks([doc]);
  return task;
}
