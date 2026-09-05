import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast/ToastContext';
import {
  addColumnRequest,
  addCommentRequest,
  addMemberRequest,
  addTaskAttachmentsRequest,
  assignTimelineRequest,
  createProjectRequest,
  createTaskRequest,
  createTimelineRequest,
  createTeamRequest,
  deleteProjectRequest,
  deleteTeamRequest,
  deleteTimelineRequest,
  completeSprintRequest,
  completePhaseRequest,
  createPhasesRequest,
  createSprintRequest,
  extendSprintRequest,
  startPhaseRequest,
  startSprintRequest,
  fetchWorkspace,
  listInvitesRequest,
  acceptInviteRequest,
  declineInviteRequest,
  removeProjectAvatarRequest,
  updateTimelineRequest,
  updateTeamRequest,
  addTeamMembersRequest,
  removeTeamMemberRequest,
  removeColumnRequest,
  removeMemberRequest,
  removeTaskAttachmentRequest,
  renameColumnRequest,
  reorderColumnsRequest,
  updateMemberRoleRequest,
  updateTaskRequest,
  uploadProjectAvatarRequest,
} from '@/lib/api/workspace';
import {
  clearChatSocketHandlerKeys,
  joinProject,
  leaveProject,
  patchChatSocketHandlers,
  type BoardColumnsEventPayload,
  type BoardTaskEventPayload,
  type BoardTeamEventPayload,
} from '@/lib/socket/chatSocket';
import { useSocket } from '@/lib/socket/SocketContext';
import {
  ensureProjectColumns,
  ensureTaskFields,
  type BoardColumn,
  type BoardTask,
  type Project,
  type ProjectMember,
  type ProjectPhase,
  type ProjectRole,
  type ProjectSprint,
  type ProjectTeam,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  type TimelineItem,
} from './types';
import type { PendingInvite } from '@/lib/api/workspace';

type WorkspaceState = {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
};

type CreateProjectInput = {
  name: string;
  key: string;
  description: string;
};

type CreateTaskInput = {
  projectId: string;
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
};

type CreateTimelineInput = {
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  teamId?: string | null;
  files?: File[];
};

type UpdateTimelineInput = {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  teamId?: string | null;
  files?: File[];
  removeAttachmentIds?: string[];
  assigneeId?: string;
  assigneeName?: string;
};

const ACTIVE_PROJECT_KEY = 'dockx.activeProjectId';

export type ActiveProjectId = string | 'all';

type WorkspaceContextValue = {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
  pendingInvites: PendingInvite[];
  isLoading: boolean;
  /** Currently focused project on dashboard / filters (`all` = every membership). */
  activeProjectId: ActiveProjectId;
  setActiveProjectId: (id: ActiveProjectId) => void;
  refresh: () => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<Project>;
  declineInvite: (inviteId: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  uploadProjectAvatar: (projectId: string, file: File) => Promise<Project>;
  removeProjectAvatar: (projectId: string) => Promise<Project>;
  getProject: (id: string) => Project | undefined;
  getProjectTasks: (projectId: string) => BoardTask[];
  createTask: (input: CreateTaskInput) => Promise<BoardTask>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateTask: (taskId: string, patch: Partial<BoardTask>) => Promise<void>;
  addComment: (taskId: string, body: string, files?: File[]) => Promise<void>;
  addTaskAttachments: (taskId: string, files: File[]) => Promise<void>;
  removeTaskAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  getTask: (taskId: string) => BoardTask | undefined;
  addColumn: (projectId: string, label: string, sprintId?: string) => Promise<BoardColumn | null>;
  renameColumn: (projectId: string, columnId: string, label: string, sprintId?: string) => Promise<void>;
  removeColumn: (
    projectId: string,
    columnId: string,
    moveToStatus?: string,
    sprintId?: string,
  ) => Promise<void>;
  reorderColumns: (projectId: string, columnIds: string[], sprintId?: string) => Promise<void>;
  addMember: (
    projectId: string,
    input: { name?: string; email: string; role: ProjectRole },
  ) => Promise<{
    member: ProjectMember | null;
    result: 'added' | 'invited';
    emailSent: boolean;
    inviteLink: string | null;
  }>;
  updateMemberRole: (
    projectId: string,
    memberId: string,
    role: ProjectRole,
  ) => Promise<void>;
  removeMember: (projectId: string, memberId: string) => Promise<void>;
  createTimelineItem: (input: CreateTimelineInput) => Promise<TimelineItem>;
  updateTimelineItem: (itemId: string, input: UpdateTimelineInput) => Promise<TimelineItem>;
  assignTimelineItem: (
    itemId: string,
    assignee: { id: string; name: string },
  ) => Promise<BoardTask | null>;
  deleteTimelineItem: (itemId: string) => Promise<void>;
  createTeam: (
    projectId: string,
    input: { name: string; memberIds?: string[] },
  ) => Promise<ProjectTeam>;
  updateTeam: (
    teamId: string,
    input: { name?: string; memberIds?: string[] },
  ) => Promise<ProjectTeam>;
  addTeamMembers: (teamId: string, memberIds: string[]) => Promise<ProjectTeam>;
  removeTeamMember: (teamId: string, memberId: string) => Promise<ProjectTeam>;
  deleteTeam: (teamId: string) => Promise<void>;
  getProjectTeams: (projectId: string) => ProjectTeam[];
  getProjectPhases: (projectId: string) => ProjectPhase[];
  getProjectSprints: (projectId: string) => ProjectSprint[];
  createPhases: (
    projectId: string,
    phases: Array<{ name: string; startDate?: string; endDate?: string }>,
  ) => Promise<void>;
  startPhase: (projectId: string, phaseId: string) => Promise<void>;
  completePhase: (projectId: string, phaseId: string) => Promise<void>;
  createSprint: (
    projectId: string,
    input: { name: string; phaseId?: string | null; startDate: string; endDate: string },
  ) => Promise<ProjectSprint | undefined>;
  startSprint: (projectId: string, sprintId: string) => Promise<void>;
  extendSprint: (projectId: string, sprintId: string, endDate: string) => Promise<void>;
  completeSprint: (projectId: string, sprintId: string) => Promise<void>;
  isProjectAdmin: (projectId: string) => boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function upsertProject(projects: Project[], project: Project) {
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx === -1) return [project, ...projects];
  const next = [...projects];
  next[idx] = project;
  return next;
}

function upsertTask(tasks: BoardTask[], task: BoardTask) {
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx === -1) return [...tasks, task];
  const next = [...tasks];
  next[idx] = task;
  return next;
}

function isActiveProjectMember(
  project: { members: Array<{ email: string; userId?: string | null; status?: string }> },
  viewer?: { email?: string; id?: string } | null,
) {
  if (!viewer?.email && !viewer?.id) return true;
  return project.members.some((m) => {
    if (m.status === 'pending') return false;
    if (viewer.id && m.userId && m.userId === viewer.id) return true;
    if (viewer.email && m.email.toLowerCase() === viewer.email.toLowerCase()) return true;
    return false;
  });
}

function readStoredActiveProject(): ActiveProjectId {
  try {
    const v = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (!v || v === 'all') return 'all';
    return v;
  } catch {
    return 'all';
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isBootstrapping } = useAuth();
  const { connected: socketConnected } = useSocket();
  const toast = useToast();
  const [state, setState] = useState<WorkspaceState>({
    projects: [],
    tasks: [],
    timeline: [],
    teams: [],
    phases: [],
    sprints: [],
  });
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeProjectId, setActiveProjectIdState] = useState<ActiveProjectId>(readStoredActiveProject);

  const setActiveProjectId = useCallback((id: ActiveProjectId) => {
    setActiveProjectIdState(id);
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const dropLocalProject = useCallback((projectId: string) => {
    leaveProject(projectId);
    setState((prev) => ({
      projects: prev.projects.filter((p) => p.id !== projectId),
      tasks: prev.tasks.filter((t) => t.projectId !== projectId),
      timeline: prev.timeline.filter((t) => t.projectId !== projectId),
      teams: prev.teams.filter((t) => t.projectId !== projectId),
      phases: prev.phases.filter((p) => p.projectId !== projectId),
      sprints: prev.sprints.filter((s) => s.projectId !== projectId),
    }));
    setActiveProjectIdState((cur) => {
      const next: ActiveProjectId = cur === projectId ? 'all' : cur;
      try {
        localStorage.setItem(ACTIVE_PROJECT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ projects: [], tasks: [], timeline: [], teams: [], phases: [], sprints: [] });
      setPendingInvites([]);
      return;
    }
    setIsLoading(true);
    try {
      const [data, inviteData] = await Promise.all([
        fetchWorkspace(),
        listInvitesRequest().catch(() => ({ invites: [] as PendingInvite[] })),
      ]);
      setState({
        projects: data.projects.map(ensureProjectColumns),
        tasks: data.tasks.map(ensureTaskFields),
        timeline: data.timeline.map((item) => ({
          ...item,
          attachments: item.attachments ?? [],
        })),
        teams: data.teams ?? [],
        phases: data.phases ?? [],
        sprints: data.sprints ?? [],
      });
      setPendingInvites(inviteData.invites ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isBootstrapping) return;
    void refresh();
  }, [isBootstrapping, refresh, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const pullInvites = () => {
      void listInvitesRequest()
        .then((data) => setPendingInvites(data.invites ?? []))
        .catch(() => undefined);
    };
    window.addEventListener('dockx:pending-invites', pullInvites);
    window.addEventListener('focus', pullInvites);
    return () => {
      window.removeEventListener('dockx:pending-invites', pullInvites);
      window.removeEventListener('focus', pullInvites);
    };
  }, [isAuthenticated]);

  const projectIds = useMemo(
    () => state.projects.map((p) => p.id).sort().join(','),
    [state.projects],
  );
  const projectIdsRef = useRef<string[]>([]);
  projectIdsRef.current = state.projects.map((p) => p.id);

  // Realtime board sync — join project rooms + apply remote task/column changes
  useEffect(() => {
    if (!isAuthenticated || isBootstrapping) return;

    const applyTask = (payload: BoardTaskEventPayload) => {
      if (!payload?.task?.id) return;
      // Always apply remote state (including own actor) so optimistic status
      // converges to the server payload for every open board.
      setState((prev) => {
        if (!prev.projects.some((p) => p.id === payload.task.projectId)) return prev;
        return {
          ...prev,
          tasks: upsertTask(prev.tasks, ensureTaskFields(payload.task)),
        };
      });
    };

    const applyColumns = (payload: BoardColumnsEventPayload) => {
      if (!payload?.project?.id) return;
      if (!isActiveProjectMember(payload.project, user)) {
        dropLocalProject(payload.project.id);
        return;
      }
      setState((prev) => {
        let tasks = prev.tasks;
        if (payload.tasks) {
          const projectId = payload.project.id;
          const others = prev.tasks.filter((t) => t.projectId !== projectId);
          tasks = [...others, ...payload.tasks.map(ensureTaskFields)];
        }
        return {
          ...prev,
          projects: upsertProject(prev.projects, ensureProjectColumns(payload.project)),
          tasks,
          phases: payload.phases
            ? [
                ...prev.phases.filter((p) => p.projectId !== payload.project.id),
                ...payload.phases,
              ].sort((a, b) => a.order - b.order)
            : prev.phases,
          sprints: payload.sprint
            ? prev.sprints.map((s) => (s.id === payload.sprint!.id ? payload.sprint! : s))
            : payload.sprints
              ? [
                  ...prev.sprints.filter((s) => s.projectId !== payload.project.id),
                  ...payload.sprints,
                ]
              : prev.sprints,
        };
      });
    };

    const applyTeamUpsert = (payload: BoardTeamEventPayload) => {
      if (!payload?.team?.id) return;
      const team = payload.team;
      setState((prev) => ({
        ...prev,
        teams: [...prev.teams.filter((t) => t.id !== team.id), team].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
    };

    const applyTeamDeleted = (payload: BoardTeamEventPayload) => {
      if (!payload?.teamId) return;
      const teamId = payload.teamId;
      setState((prev) => ({
        ...prev,
        teams: prev.teams.filter((t) => t.id !== teamId),
        tasks: prev.tasks.map((t) =>
          t.teamId === teamId ? ensureTaskFields({ ...t, teamId: null }) : t,
        ),
      }));
    };

    patchChatSocketHandlers({
      onTaskCreated: applyTask,
      onTaskUpdated: applyTask,
      onProjectColumns: applyColumns,
      onProjectUpdated: applyColumns,
      onProjectRemoved: (payload) => {
        dropLocalProject(payload.projectId);
        toast.info(
          payload.projectName
            ? `You were removed from ${payload.projectName}`
            : 'You were removed from a project',
        );
      },
      onTeamUpserted: applyTeamUpsert,
      onTeamDeleted: applyTeamDeleted,
      onInviteNew: ({ invite }) => {
        if (!invite?.id) return;
        setPendingInvites((prev) => {
          const without = prev.filter((entry) => entry.id !== invite.id);
          return [invite, ...without];
        });
      },
      onInviteResolved: ({ inviteId }) => {
        if (!inviteId) return;
        setPendingInvites((prev) => prev.filter((entry) => entry.id !== inviteId));
      },
    });

    const joinAll = () => {
      for (const id of projectIdsRef.current) joinProject(id);
    };

    if (socketConnected) joinAll();

    return () => {
      for (const id of projectIdsRef.current) leaveProject(id);
      clearChatSocketHandlerKeys([
        'onTaskCreated',
        'onTaskUpdated',
        'onProjectColumns',
        'onProjectUpdated',
        'onProjectRemoved',
        'onTeamUpserted',
        'onTeamDeleted',
        'onInviteNew',
        'onInviteResolved',
      ]);
    };
  }, [dropLocalProject, isAuthenticated, isBootstrapping, socketConnected, toast, user]);

  // Re-join when project list changes (new project created / invited)
  useEffect(() => {
    if (!isAuthenticated || !socketConnected || !projectIds) return;
    for (const id of projectIdsRef.current) joinProject(id);
  }, [isAuthenticated, projectIds, socketConnected]);

  // Drop stale selection if project was removed / no longer visible
  useEffect(() => {
    if (activeProjectId === 'all') return;
    if (!state.projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId('all');
    }
  }, [state.projects, activeProjectId, setActiveProjectId]);

  const createProject = useCallback(async (input: CreateProjectInput) => {
    const { project } = await createProjectRequest(input);
    const normalized = ensureProjectColumns(project);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, normalized),
    }));
    setActiveProjectId(normalized.id);
    return normalized;
  }, [setActiveProjectId]);

  const deleteProject = useCallback(async (projectId: string) => {
    await deleteProjectRequest(projectId);
    setState((prev) => ({
      projects: prev.projects.filter((p) => p.id !== projectId),
      tasks: prev.tasks.filter((t) => t.projectId !== projectId),
      timeline: prev.timeline.filter((t) => t.projectId !== projectId),
      teams: prev.teams.filter((t) => t.projectId !== projectId),
      phases: prev.phases.filter((p) => p.projectId !== projectId),
      sprints: prev.sprints.filter((s) => s.projectId !== projectId),
    }));
    setActiveProjectIdState((cur) => {
      const next: ActiveProjectId = cur === projectId ? 'all' : cur;
      try {
        localStorage.setItem(ACTIVE_PROJECT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const uploadProjectAvatar = useCallback(async (projectId: string, file: File) => {
    const { project } = await uploadProjectAvatarRequest(projectId, file);
    const normalized = ensureProjectColumns(project);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, normalized),
    }));
    return normalized;
  }, []);

  const removeProjectAvatar = useCallback(async (projectId: string) => {
    const { project } = await removeProjectAvatarRequest(projectId);
    const normalized = ensureProjectColumns(project);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, normalized),
    }));
    return normalized;
  }, []);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    const { task } = await createTaskRequest(input.projectId, input);
    const normalized = ensureTaskFields(task);
    setState((prev) => ({ ...prev, tasks: upsertTask(prev.tasks, normalized) }));
    return normalized;
  }, []);

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    // Optimistic UI so drag-and-drop feels instant
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? ensureTaskFields({ ...t, status }) : t,
      ),
    }));
    try {
      const { task } = await updateTaskRequest(taskId, { status });
      setState((prev) => ({
        ...prev,
        tasks: upsertTask(prev.tasks, ensureTaskFields(task)),
      }));
    } catch (err) {
      // Re-fetch / revert by refreshing workspace on failure
      await refresh();
      throw err;
    }
  }, [refresh]);

  const updateTask = useCallback(async (taskId: string, patch: Partial<BoardTask>) => {
    const { task } = await updateTaskRequest(taskId, patch);
    setState((prev) => ({
      ...prev,
      tasks: upsertTask(prev.tasks, ensureTaskFields(task)),
    }));
  }, []);

  const addComment = useCallback(async (taskId: string, body: string, files: File[] = []) => {
    const { task } = await addCommentRequest(taskId, body, files);
    setState((prev) => ({
      ...prev,
      tasks: upsertTask(prev.tasks, ensureTaskFields(task)),
    }));
  }, []);

  const addTaskAttachments = useCallback(async (taskId: string, files: File[]) => {
    if (!files.length) return;
    const { task } = await addTaskAttachmentsRequest(taskId, files);
    setState((prev) => ({
      ...prev,
      tasks: upsertTask(prev.tasks, ensureTaskFields(task)),
    }));
  }, []);

  const removeTaskAttachment = useCallback(async (taskId: string, attachmentId: string) => {
    const { task } = await removeTaskAttachmentRequest(taskId, attachmentId);
    setState((prev) => ({
      ...prev,
      tasks: upsertTask(prev.tasks, ensureTaskFields(task)),
    }));
  }, []);

  const addColumn = useCallback(async (projectId: string, label: string, sprintId?: string) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const { project, column, sprint } = await addColumnRequest(projectId, trimmed, sprintId);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, ensureProjectColumns(project)),
      sprints: sprint
        ? prev.sprints.map((s) => (s.id === sprint.id ? sprint : s))
        : prev.sprints,
    }));
    return column;
  }, []);

  const renameColumn = useCallback(
    async (projectId: string, columnId: string, label: string, sprintId?: string) => {
      const { project, sprint } = await renameColumnRequest(projectId, columnId, label, sprintId);
      setState((prev) => ({
        ...prev,
        projects: upsertProject(prev.projects, ensureProjectColumns(project)),
        sprints: sprint
          ? prev.sprints.map((s) => (s.id === sprint.id ? sprint : s))
          : prev.sprints,
      }));
    },
    [],
  );

  const removeColumn = useCallback(
    async (projectId: string, columnId: string, moveToStatus?: string, sprintId?: string) => {
      const { project, tasks, sprint } = await removeColumnRequest(
        projectId,
        columnId,
        moveToStatus,
        sprintId,
      );
      setState((prev) => ({
        ...prev,
        projects: upsertProject(prev.projects, ensureProjectColumns(project)),
        tasks: prev.tasks.map((t) => {
          const updated = tasks.find((x) => x.id === t.id);
          return updated ? ensureTaskFields(updated) : t;
        }),
        sprints: sprint
          ? prev.sprints.map((s) => (s.id === sprint.id ? sprint : s))
          : prev.sprints,
      }));
    },
    [],
  );

  const reorderColumns = useCallback(async (projectId: string, columnIds: string[], sprintId?: string) => {
    const { project, sprint } = await reorderColumnsRequest(projectId, columnIds, sprintId);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, ensureProjectColumns(project)),
      sprints: sprint
        ? prev.sprints.map((s) => (s.id === sprint.id ? sprint : s))
        : prev.sprints,
    }));
  }, []);

  const acceptInvite = useCallback(async (inviteId: string) => {
    const { project } = await acceptInviteRequest(inviteId);
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    await refresh();
    return ensureProjectColumns(project);
  }, [refresh]);

  const declineInvite = useCallback(async (inviteId: string) => {
    await declineInviteRequest(inviteId);
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);

  const addMember = useCallback(
    async (
      projectId: string,
      input: { name?: string; email: string; role: ProjectRole },
    ) => {
      const res = await addMemberRequest(projectId, input);
      const normalized = ensureProjectColumns(res.project);
      setState((prev) => ({
        ...prev,
        projects: upsertProject(prev.projects, normalized),
      }));
      const email = input.email.trim().toLowerCase();
      return {
        member: normalized.members.find((m) => m.email === email) ?? null,
        result: res.result,
        emailSent: res.emailSent,
        inviteLink: res.inviteLink,
      };
    },
    [],
  );

  const updateMemberRole = useCallback(
    async (projectId: string, memberId: string, role: ProjectRole) => {
      const { project } = await updateMemberRoleRequest(projectId, memberId, role);
      setState((prev) => ({
        ...prev,
        projects: upsertProject(prev.projects, ensureProjectColumns(project)),
      }));
    },
    [],
  );

  const removeMember = useCallback(async (projectId: string, memberId: string) => {
    const { project, tasks, timeline } = await removeMemberRequest(projectId, memberId);
    setState((prev) => {
      const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));
      const timelineById = new Map((timeline ?? []).map((item) => [item.id, item]));
      return {
        ...prev,
        projects: upsertProject(prev.projects, ensureProjectColumns(project)),
        teams: prev.teams.map((t) =>
          t.projectId === projectId
            ? { ...t, memberIds: t.memberIds.filter((id) => id !== memberId) }
            : t,
        ),
        tasks: prev.tasks.map((t) => {
          const next = taskById.get(t.id);
          if (next) return ensureTaskFields(next);
          if (t.projectId === projectId && t.assigneeId === memberId) {
            return ensureTaskFields({ ...t, assigneeId: '', assigneeName: 'Unassigned' });
          }
          return t;
        }),
        timeline: prev.timeline.map((item) => {
          const next = timelineById.get(item.id);
          if (next) return next;
          if (item.projectId === projectId && item.assigneeId === memberId) {
            return { ...item, assigneeId: null, assigneeName: null };
          }
          return item;
        }),
      };
    });
  }, []);

  const isProjectAdmin = useCallback(
    (projectId: string) => {
      if (!user) return false;
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return false;
      return project.members.some(
        (m) =>
          m.role === 'admin' &&
          (m.userId === user.id || m.email.toLowerCase() === user.email.toLowerCase()),
      );
    },
    [state.projects, user],
  );

  const createTimelineItem = useCallback(async (input: CreateTimelineInput) => {
    const { item } = await createTimelineRequest(
      {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        dueDate: input.dueDate,
        teamId: input.teamId,
      },
      input.files ?? [],
    );
    setState((prev) => ({
      ...prev,
      timeline: [item, ...prev.timeline],
    }));
    return item;
  }, []);

  const updateTimelineItem = useCallback(
    async (itemId: string, input: UpdateTimelineInput) => {
      const { item, task } = await updateTimelineRequest(
        itemId,
        {
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          dueDate: input.dueDate,
          teamId: input.teamId,
          removeAttachmentIds: input.removeAttachmentIds,
          assigneeId: input.assigneeId,
          assigneeName: input.assigneeName,
        },
        input.files ?? [],
      );
      setState((prev) => ({
        ...prev,
        timeline: prev.timeline.map((t) => (t.id === itemId ? item : t)),
        tasks: task ? upsertTask(prev.tasks, ensureTaskFields(task)) : prev.tasks,
      }));
      return item;
    },
    [],
  );

  const assignTimelineItem = useCallback(
    async (itemId: string, assignee: { id: string; name: string }) => {
      const { timelineItem, task } = await assignTimelineRequest(itemId, assignee);
      setState((prev) => ({
        ...prev,
        tasks: upsertTask(prev.tasks, ensureTaskFields(task)),
        timeline: prev.timeline.map((t) => (t.id === itemId ? timelineItem : t)),
      }));
      return ensureTaskFields(task);
    },
    [],
  );

  const deleteTimelineItem = useCallback(async (itemId: string) => {
    await deleteTimelineRequest(itemId);
    setState((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((t) => t.id !== itemId),
    }));
  }, []);

  const createTeam = useCallback(
    async (projectId: string, input: { name: string; memberIds?: string[] }) => {
      const { team } = await createTeamRequest(projectId, input);
      setState((prev) => ({
        ...prev,
        teams: [...prev.teams.filter((t) => t.id !== team.id), team].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
      return team;
    },
    [],
  );

  const updateTeam = useCallback(
    async (teamId: string, input: { name?: string; memberIds?: string[] }) => {
      const { team } = await updateTeamRequest(teamId, input);
      setState((prev) => ({
        ...prev,
        teams: prev.teams
          .map((t) => (t.id === teamId ? team : t))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
      return team;
    },
    [],
  );

  const addTeamMembers = useCallback(async (teamId: string, memberIds: string[]) => {
    const { team } = await addTeamMembersRequest(teamId, memberIds);
    setState((prev) => ({
      ...prev,
      teams: prev.teams
        .map((t) => (t.id === teamId ? team : t))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return team;
  }, []);

  const removeTeamMember = useCallback(async (teamId: string, memberId: string) => {
    const { team } = await removeTeamMemberRequest(teamId, memberId);
    setState((prev) => ({
      ...prev,
      teams: prev.teams
        .map((t) => (t.id === teamId ? team : t))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return team;
  }, []);

  const deleteTeam = useCallback(async (teamId: string) => {
    await deleteTeamRequest(teamId);
    setState((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== teamId),
      tasks: prev.tasks.map((t) =>
        t.teamId === teamId ? ensureTaskFields({ ...t, teamId: null }) : t,
      ),
    }));
  }, []);

  const mergePlan = useCallback(
    (projectId: string, phases: ProjectPhase[], sprints: ProjectSprint[], project?: Project) => {
      setState((prev) => ({
        ...prev,
        projects: project
          ? upsertProject(prev.projects, ensureProjectColumns(project))
          : prev.projects,
        phases: [...prev.phases.filter((p) => p.projectId !== projectId), ...phases].sort(
          (a, b) => a.order - b.order,
        ),
        sprints: [...prev.sprints.filter((s) => s.projectId !== projectId), ...sprints],
      }));
    },
    [],
  );

  const createPhases = useCallback(
    async (
      projectId: string,
      phases: Array<{ name: string; startDate?: string; endDate?: string }>,
    ) => {
      const res = await createPhasesRequest(projectId, phases);
      mergePlan(projectId, res.phases, res.sprints, res.project);
    },
    [mergePlan],
  );

  const startPhase = useCallback(
    async (projectId: string, phaseId: string) => {
      const res = await startPhaseRequest(projectId, phaseId);
      mergePlan(projectId, res.phases, res.sprints, res.project);
    },
    [mergePlan],
  );

  const completePhase = useCallback(
    async (projectId: string, phaseId: string) => {
      const res = await completePhaseRequest(projectId, phaseId);
      mergePlan(projectId, res.phases, res.sprints, res.project);
      await refresh();
    },
    [mergePlan, refresh],
  );

  const createSprint = useCallback(
    async (
      projectId: string,
      input: { name: string; phaseId?: string | null; startDate: string; endDate: string },
    ) => {
      const res = await createSprintRequest(projectId, input);
      mergePlan(projectId, res.phases, res.sprints, res.project);
      return res.sprint;
    },
    [mergePlan],
  );

  const startSprint = useCallback(
    async (projectId: string, sprintId: string) => {
      const res = await startSprintRequest(projectId, sprintId);
      mergePlan(projectId, res.phases, res.sprints, res.project);
    },
    [mergePlan],
  );

  const extendSprint = useCallback(
    async (projectId: string, sprintId: string, endDate: string) => {
      const res = await extendSprintRequest(projectId, sprintId, endDate);
      mergePlan(projectId, res.phases, res.sprints, res.project);
    },
    [mergePlan],
  );

  const completeSprint = useCallback(
    async (projectId: string, sprintId: string) => {
      const res = await completeSprintRequest(projectId, sprintId);
      mergePlan(projectId, res.phases, res.sprints, res.project);
      await refresh();
    },
    [mergePlan, refresh],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      projects: state.projects.map(ensureProjectColumns),
      tasks: state.tasks.map(ensureTaskFields),
      timeline: state.timeline,
      teams: state.teams,
      phases: state.phases,
      sprints: state.sprints,
      pendingInvites,
      isLoading,
      activeProjectId,
      setActiveProjectId,
      refresh,
      acceptInvite,
      declineInvite,
      createProject,
      deleteProject,
      uploadProjectAvatar,
      removeProjectAvatar,
      getProject: (id) => {
        const p = state.projects.find((x) => x.id === id);
        return p ? ensureProjectColumns(p) : undefined;
      },
      getProjectTasks: (projectId) =>
        state.tasks.filter((t) => t.projectId === projectId).map(ensureTaskFields),
      createTask,
      updateTaskStatus,
      updateTask,
      addComment,
      addTaskAttachments,
      removeTaskAttachment,
      getTask: (id) => {
        const t = state.tasks.find((x) => x.id === id);
        return t ? ensureTaskFields(t) : undefined;
      },
      addColumn,
      renameColumn,
      removeColumn,
      reorderColumns,
      addMember,
      updateMemberRole,
      removeMember,
      createTimelineItem,
      updateTimelineItem,
      assignTimelineItem,
      deleteTimelineItem,
      createTeam,
      updateTeam,
      addTeamMembers,
      removeTeamMember,
      deleteTeam,
      getProjectTeams: (projectId) => state.teams.filter((t) => t.projectId === projectId),
      getProjectPhases: (projectId) =>
        state.phases.filter((p) => p.projectId === projectId).sort((a, b) => a.order - b.order),
      getProjectSprints: (projectId) =>
        state.sprints
          .filter((s) => s.projectId === projectId)
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      createPhases,
      startPhase,
      completePhase,
      createSprint,
      startSprint,
      extendSprint,
      completeSprint,
      isProjectAdmin,
    }),
    [
      state,
      pendingInvites,
      isLoading,
      activeProjectId,
      setActiveProjectId,
      refresh,
      acceptInvite,
      declineInvite,
      createProject,
      deleteProject,
      uploadProjectAvatar,
      removeProjectAvatar,
      createTask,
      updateTaskStatus,
      updateTask,
      addComment,
      addTaskAttachments,
      removeTaskAttachment,
      addColumn,
      renameColumn,
      removeColumn,
      reorderColumns,
      addMember,
      updateMemberRole,
      removeMember,
      createTimelineItem,
      updateTimelineItem,
      assignTimelineItem,
      deleteTimelineItem,
      createTeam,
      updateTeam,
      addTeamMembers,
      removeTeamMember,
      deleteTeam,
      createPhases,
      startPhase,
      completePhase,
      createSprint,
      startSprint,
      extendSprint,
      completeSprint,
      isProjectAdmin,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
