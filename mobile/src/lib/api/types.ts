export type ProjectRole = 'admin' | 'member';
export type TaskType = 'task' | 'bug' | 'story' | 'time';
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  orgId: string;
  orgName: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface InvitePreview {
  email: string;
  name: string;
  role: ProjectRole;
  projectName: string;
  orgName: string;
  expiresAt: string;
}

export interface BoardColumn {
  id: string;
  label: string;
  accent: string;
  locked?: boolean;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
  status?: 'active' | 'pending';
  userId?: string | null;
  avatarUrl?: string | null;
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  avatarUrl?: string | null;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string | null;
  columns: BoardColumn[];
  members: ProjectMember[];
}

export interface ProjectTeam {
  id: string;
  projectId: string;
  name: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  dataUrl?: string;
  createdAt: string;
  uploadedBy: string;
}

export interface TaskComment {
  id: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  attachments: TaskAttachment[];
}

export interface BoardTask {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: string;
  estimateHours: number;
  loggedHours: number;
  remainingHours: number;
  createdBy: string;
  createdByName: string;
  assigneeId: string;
  assigneeName: string;
  reporterName: string;
  labels: string[];
  startDate: string;
  endDate: string;
  dueDate: string;
  teamId: string | null;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  teamId?: string | null;
  attachments: TaskAttachment[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
  taskId: string | null;
  assignedAt: string | null;
}

export interface ChatMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  checkedIn?: boolean;
  online?: boolean;
}

export interface ChatConversation {
  id: string;
  type: 'dm' | 'group';
  name: string;
  rawName: string;
  avatarUrl?: string | null;
  memberIds: string[];
  members: ChatMember[];
  createdBy: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  createdAt: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  kind: 'image' | 'video' | 'audio' | 'document' | 'other';
}

export interface ChatReplyPreview {
  id: string;
  body: string;
  senderName: string;
  deleted: boolean;
}

export interface ChatCallMeta {
  callId: string;
  outcome: 'answered' | 'missed' | 'rejected' | 'cancelled' | 'failed';
  mediaKind?: 'audio' | 'video';
  durationSeconds: number;
  initiatedBy: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  type?: 'text' | 'call';
  body: string;
  replyTo: ChatReplyPreview | null;
  attachments: ChatAttachment[];
  call?: ChatCallMeta | null;
  status?: 'sent' | 'delivered' | 'read';
  localState?: 'sending' | 'failed' | null;
  receipts?: Array<{ userId: string; deliveredAt: string | null; readAt: string | null }>;
  forwarded?: boolean;
  forwardedFrom?: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export type NotificationType =
  | 'task.assigned'
  | 'task.commented'
  | 'message.new'
  | 'project.added'
  | 'project.invited'
  | 'team.added';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  actorId: string | null;
  actorName: string;
  actorAvatarUrl?: string | null;
  projectId: string | null;
  taskId: string | null;
  conversationId: string | null;
  messageId: string | null;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  createdAt?: string;
  projects: Array<{ id: string; name: string; key: string }>;
}

export interface AppUsage {
  appName: string;
  processName: string;
  durationMs: number;
  lastWindowTitle: string;
  lastSeenAt?: string;
}

export interface SiteUsage {
  host: string;
  url: string;
  title: string;
  browserName: string;
  durationMs: number;
  lastSeenAt?: string;
}

export interface ActivitySession {
  id: string;
  userId: string;
  orgId: string;
  status: 'active' | 'closed';
  startedAt: string;
  endedAt: string | null;
  totalTrackedMs: number;
  totalAwayMs?: number;
  apps: AppUsage[];
  sites?: SiteUsage[];
}

export interface AttendanceStatus {
  checkedIn: boolean;
  session: ActivitySession | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lastSession: ActivitySession | null;
}

export interface TodayActivity {
  date: string;
  totalTrackedMs: number;
  totalWebsiteMs: number;
  sessions: ActivitySession[];
  apps: AppUsage[];
  sites: SiteUsage[];
}

export interface PresenceUser {
  userId: string;
  checkedIn: boolean;
  online: boolean;
}

/** Local file descriptor produced by the image / document pickers. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}
