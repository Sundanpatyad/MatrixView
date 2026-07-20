import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
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
  fetchWorkspace,
  removeProjectAvatarRequest,
  updateTimelineRequest,
  updateTeamRequest,
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
  ensureProjectColumns,
  ensureTaskFields,
  type BoardColumn,
  type BoardTask,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type ProjectTeam,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  type TimelineItem,
} from './types';

type WorkspaceState = {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
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
};

type CreateTimelineInput = {
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  files?: File[];
};

type UpdateTimelineInput = {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
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
  isLoading: boolean;
  /** Currently focused project on dashboard / filters (`all` = every membership). */
  activeProjectId: ActiveProjectId;
  setActiveProjectId: (id: ActiveProjectId) => void;
  refresh: () => Promise<void>;
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
  addColumn: (projectId: string, label: string) => Promise<BoardColumn | null>;
  renameColumn: (projectId: string, columnId: string, label: string) => Promise<void>;
  removeColumn: (
    projectId: string,
    columnId: string,
    moveToStatus?: string,
  ) => Promise<void>;
  reorderColumns: (projectId: string, columnIds: string[]) => Promise<void>;
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
  deleteTeam: (teamId: string) => Promise<void>;
  getProjectTeams: (projectId: string) => ProjectTeam[];
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
  const [state, setState] = useState<WorkspaceState>({
    projects: [],
    tasks: [],
    timeline: [],
    teams: [],
  });
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

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ projects: [], tasks: [], timeline: [], teams: [] });
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchWorkspace();
      setState({
        projects: data.projects.map(ensureProjectColumns),
        tasks: data.tasks.map(ensureTaskFields),
        timeline: data.timeline.map((item) => ({
          ...item,
          attachments: item.attachments ?? [],
        })),
        teams: data.teams ?? [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isBootstrapping) return;
    void refresh();
  }, [isBootstrapping, refresh, user?.id]);

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

  const addColumn = useCallback(async (projectId: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const { project, column } = await addColumnRequest(projectId, trimmed);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, ensureProjectColumns(project)),
    }));
    return column;
  }, []);

  const renameColumn = useCallback(
    async (projectId: string, columnId: string, label: string) => {
      const { project } = await renameColumnRequest(projectId, columnId, label);
      setState((prev) => ({
        ...prev,
        projects: upsertProject(prev.projects, ensureProjectColumns(project)),
      }));
    },
    [],
  );

  const removeColumn = useCallback(
    async (projectId: string, columnId: string, moveToStatus?: string) => {
      const { project, tasks } = await removeColumnRequest(projectId, columnId, moveToStatus);
      setState((prev) => ({
        ...prev,
        projects: upsertProject(prev.projects, ensureProjectColumns(project)),
        tasks: prev.tasks.map((t) => {
          const updated = tasks.find((x) => x.id === t.id);
          return updated ? ensureTaskFields(updated) : t;
        }),
      }));
    },
    [],
  );

  const reorderColumns = useCallback(async (projectId: string, columnIds: string[]) => {
    const { project } = await reorderColumnsRequest(projectId, columnIds);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, ensureProjectColumns(project)),
    }));
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
    const { project } = await removeMemberRequest(projectId, memberId);
    setState((prev) => ({
      ...prev,
      projects: upsertProject(prev.projects, ensureProjectColumns(project)),
    }));
  }, []);

  const isProjectAdmin = useCallback(
    (projectId: string) => {
      if (!user) return false;
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return false;
      return project.members.some(
        (m) =>
          m.role === 'admin' &&
          m.email.toLowerCase() === user.email.toLowerCase(),
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

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      projects: state.projects.map(ensureProjectColumns),
      tasks: state.tasks.map(ensureTaskFields),
      timeline: state.timeline,
      teams: state.teams,
      isLoading,
      activeProjectId,
      setActiveProjectId,
      refresh,
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
      deleteTeam,
      getProjectTeams: (projectId) => state.teams.filter((t) => t.projectId === projectId),
      isProjectAdmin,
    }),
    [
      state,
      isLoading,
      activeProjectId,
      setActiveProjectId,
      refresh,
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
      deleteTeam,
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
