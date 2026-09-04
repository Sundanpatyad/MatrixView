import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  workspaceApi,
  type BoardTask,
  type PickedFile,
  type Project,
  type ProjectRole,
  type ProjectTeam,
  type TimelineItem,
} from '@/lib/api';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/api/workspace';
import { patchSocketHandlers, socketActions } from '@/lib/socket/socket';

import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const ACTIVE_PROJECT_KEY = 'dockx.activeProjectId';

export type ActiveProjectId = string | 'all';

interface WorkspaceContextValue {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
  pendingInvites: workspaceApi.PendingInvite[];
  isLoading: boolean;
  error: string | null;

  activeProjectId: ActiveProjectId;
  setActiveProjectId: (id: ActiveProjectId) => void;
  activeProject: Project | null;
  visibleTasks: BoardTask[];

  refresh: () => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<Project>;
  declineInvite: (inviteId: string) => Promise<void>;
  isProjectAdmin: (projectId: string) => boolean;
  getProject: (projectId: string) => Project | undefined;
  getTask: (taskId: string) => BoardTask | undefined;
  teamsForProject: (projectId: string) => ProjectTeam[];

  createProject: (input: { name: string; key: string; description?: string }) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  uploadProjectAvatar: (projectId: string, file: PickedFile) => Promise<void>;

  createTask: (projectId: string, input: CreateTaskInput) => Promise<BoardTask>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<BoardTask>;
  moveTask: (taskId: string, status: string) => Promise<void>;
  addComment: (taskId: string, body: string, files?: PickedFile[]) => Promise<BoardTask>;
  addTaskAttachments: (taskId: string, files: PickedFile[]) => Promise<BoardTask>;
  removeTaskAttachment: (taskId: string, attachmentId: string) => Promise<BoardTask>;

  addColumn: (projectId: string, label: string) => Promise<void>;
  renameColumn: (projectId: string, columnId: string, label: string) => Promise<void>;
  removeColumn: (projectId: string, columnId: string, moveTo?: string) => Promise<void>;

  addMember: (projectId: string, input: { name?: string; email: string; role?: ProjectRole }) => Promise<{
    result: 'added' | 'invited';
    inviteLink: string | null;
  }>;
  removeMember: (projectId: string, memberId: string) => Promise<void>;
  updateMemberRole: (projectId: string, memberId: string, role: ProjectRole) => Promise<void>;

  createTeam: (projectId: string, input: { name: string; memberIds?: string[] }) => Promise<void>;
  updateTeam: (teamId: string, input: { name?: string; memberIds?: string[] }) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;

  assignTimelineItem: (itemId: string, assignee: { id: string; name: string }) => Promise<void>;
  deleteTimelineItem: (itemId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = item;
  return next;
}

function isActiveProjectMember(
  project: { members: Array<{ email: string; userId?: string | null; status?: string }> },
  viewer?: { email?: string; id?: string } | null,
) {
  if (!viewer?.email && !viewer?.id) return true;
  return project.members.some((member) => {
    if (member.status === 'pending') return false;
    if (viewer.id && member.userId && member.userId === viewer.id) return true;
    if (viewer.email && member.email.toLowerCase() === viewer.email.toLowerCase()) return true;
    return false;
  });
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [pendingInvites, setPendingInvites] = useState<workspaceApi.PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectIdState] = useState<ActiveProjectId>('all');

  const joinedRooms = useRef<Set<string>>(new Set());
  const projectIdsRef = useRef<Set<string>>(new Set());
  projectIdsRef.current = new Set(projects.map((project) => project.id));

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_PROJECT_KEY)
      .then((stored) => {
        if (stored) setActiveProjectIdState(stored as ActiveProjectId);
      })
      .catch(() => undefined);
  }, []);

  const setActiveProjectId = useCallback((id: ActiveProjectId) => {
    setActiveProjectIdState(id);
    AsyncStorage.setItem(ACTIVE_PROJECT_KEY, id).catch(() => undefined);
  }, []);

  const dropLocalProject = useCallback((projectId: string) => {
    socketActions.leaveProject(projectId);
    joinedRooms.current.delete(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setTasks((prev) => prev.filter((t) => t.projectId !== projectId));
    setTimeline((prev) => prev.filter((t) => t.projectId !== projectId));
    setTeams((prev) => prev.filter((t) => t.projectId !== projectId));
    setActiveProjectIdState((cur) => {
      if (cur !== projectId) return cur;
      AsyncStorage.setItem(ACTIVE_PROJECT_KEY, 'all').catch(() => undefined);
      return 'all';
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const [snapshot, inviteData] = await Promise.all([
        workspaceApi.fetchWorkspace(),
        workspaceApi.listInvitesRequest().catch(() => ({ invites: [] as workspaceApi.PendingInvite[] })),
      ]);
      setProjects(snapshot.projects ?? []);
      setTasks(snapshot.tasks ?? []);
      setTimeline(snapshot.timeline ?? []);
      setTeams(snapshot.teams ?? []);
      setPendingInvites(inviteData.invites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your workspace.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProjects([]);
      setTasks([]);
      setTimeline([]);
      setTeams([]);
      setPendingInvites([]);
      joinedRooms.current.clear();
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  // Board realtime only reaches sockets that have joined the project room.
  useEffect(() => {
    if (!isAuthenticated) return;
    const wanted = new Set(projects.map((project) => project.id));

    wanted.forEach((projectId) => {
      if (!joinedRooms.current.has(projectId)) {
        socketActions.joinProject(projectId);
        joinedRooms.current.add(projectId);
      }
    });

    joinedRooms.current.forEach((projectId) => {
      if (!wanted.has(projectId)) {
        socketActions.leaveProject(projectId);
        joinedRooms.current.delete(projectId);
      }
    });
  }, [isAuthenticated, projects]);

  useEffect(() => {
    const applyProject = (project: Project, updatedTasks?: BoardTask[]) => {
      if (!isActiveProjectMember(project, user)) {
        dropLocalProject(project.id);
        return;
      }
      setProjects((prev) => upsertById(prev, project));
      if (updatedTasks?.length) {
        setTasks((prev) => updatedTasks.reduce((acc, task) => upsertById(acc, task), prev));
      }
    };

    patchSocketHandlers({
      onTaskCreated: ({ task }) => {
        if (!projectIdsRef.current.has(task.projectId)) return;
        setTasks((prev) => upsertById(prev, task));
      },
      onTaskUpdated: ({ task }) => {
        if (!projectIdsRef.current.has(task.projectId)) return;
        setTasks((prev) => upsertById(prev, task));
      },
      onProjectColumns: ({ project, tasks: updatedTasks }) => {
        applyProject(project, updatedTasks);
      },
      onProjectUpdated: ({ project }) => {
        if (project) applyProject(project);
      },
      onProjectRemoved: ({ projectId, projectName }) => {
        dropLocalProject(projectId);
        toast.info(
          projectName ? `You were removed from ${projectName}` : 'You were removed from a project',
        );
      },
      onTeamUpserted: ({ team }) => {
        if (team) setTeams((prev) => upsertById(prev, team));
      },
      onTeamDeleted: ({ teamId }) => {
        if (teamId) setTeams((prev) => prev.filter((team) => team.id !== teamId));
      },
    });
  }, [dropLocalProject, toast, user]);

  const getProject = useCallback((projectId: string) => projects.find((p) => p.id === projectId), [projects]);
  const getTask = useCallback((taskId: string) => tasks.find((t) => t.id === taskId), [tasks]);
  const teamsForProject = useCallback(
    (projectId: string) => teams.filter((team) => team.projectId === projectId),
    [teams],
  );

  const isProjectAdmin = useCallback(
    (projectId: string) => {
      if ((user?.role ?? '').toLowerCase() === 'admin') return true;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return false;
      return project.members.some(
        (member) => (member.userId === user?.id || member.email === user?.email) && member.role === 'admin',
      );
    },
    [projects, user],
  );

  const activeProject = useMemo(
    () => (activeProjectId === 'all' ? null : projects.find((p) => p.id === activeProjectId) ?? null),
    [activeProjectId, projects],
  );

  const visibleTasks = useMemo(
    () => (activeProjectId === 'all' ? tasks : tasks.filter((task) => task.projectId === activeProjectId)),
    [activeProjectId, tasks],
  );

  const createProject = useCallback(async (input: { name: string; key: string; description?: string }) => {
    const { project } = await workspaceApi.createProjectRequest(input);
    setProjects((prev) => upsertById(prev, project));
    return project;
  }, []);

  const deleteProject = useCallback(
    async (projectId: string) => {
      await workspaceApi.deleteProjectRequest(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setTasks((prev) => prev.filter((t) => t.projectId !== projectId));
      setTeams((prev) => prev.filter((t) => t.projectId !== projectId));
      if (activeProjectId === projectId) setActiveProjectId('all');
    },
    [activeProjectId, setActiveProjectId],
  );

  const uploadProjectAvatar = useCallback(async (projectId: string, file: PickedFile) => {
    const { project } = await workspaceApi.uploadProjectAvatarRequest(projectId, file);
    setProjects((prev) => upsertById(prev, project));
  }, []);

  const createTask = useCallback(async (projectId: string, input: CreateTaskInput) => {
    const { task } = await workspaceApi.createTaskRequest(projectId, input);
    setTasks((prev) => upsertById(prev, task));
    return task;
  }, []);

  const updateTask = useCallback(async (taskId: string, input: UpdateTaskInput) => {
    const { task } = await workspaceApi.updateTaskRequest(taskId, input);
    setTasks((prev) => upsertById(prev, task));
    return task;
  }, []);

  /** Optimistic so column drops feel instant; the socket echo confirms it. */
  const moveTask = useCallback(async (taskId: string, status: string) => {
    let previous: BoardTask | undefined;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        previous = task;
        return { ...task, status };
      }),
    );
    try {
      const { task } = await workspaceApi.updateTaskRequest(taskId, { status });
      setTasks((prev) => upsertById(prev, task));
    } catch (err) {
      if (previous) {
        const restore = previous;
        setTasks((prev) => prev.map((task) => (task.id === taskId ? restore : task)));
      }
      throw err;
    }
  }, []);

  const addComment = useCallback(async (taskId: string, body: string, files: PickedFile[] = []) => {
    const { task } = await workspaceApi.addCommentRequest(taskId, body, files);
    setTasks((prev) => upsertById(prev, task));
    return task;
  }, []);

  const addTaskAttachments = useCallback(async (taskId: string, files: PickedFile[]) => {
    const { task } = await workspaceApi.addTaskAttachmentsRequest(taskId, files);
    setTasks((prev) => upsertById(prev, task));
    return task;
  }, []);

  const removeTaskAttachment = useCallback(async (taskId: string, attachmentId: string) => {
    const { task } = await workspaceApi.removeTaskAttachmentRequest(taskId, attachmentId);
    setTasks((prev) => upsertById(prev, task));
    return task;
  }, []);

  const addColumn = useCallback(async (projectId: string, label: string) => {
    const { project } = await workspaceApi.addColumnRequest(projectId, label);
    setProjects((prev) => upsertById(prev, project));
  }, []);

  const renameColumn = useCallback(async (projectId: string, columnId: string, label: string) => {
    const { project } = await workspaceApi.renameColumnRequest(projectId, columnId, label);
    setProjects((prev) => upsertById(prev, project));
  }, []);

  const removeColumn = useCallback(async (projectId: string, columnId: string, moveTo?: string) => {
    const { project, tasks: moved } = await workspaceApi.removeColumnRequest(projectId, columnId, moveTo);
    setProjects((prev) => upsertById(prev, project));
    if (moved?.length) setTasks((prev) => moved.reduce((acc, task) => upsertById(acc, task), prev));
  }, []);

  const acceptInvite = useCallback(
    async (inviteId: string) => {
      const { project } = await workspaceApi.acceptInviteRequest(inviteId);
      setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      await refresh();
      return project;
    },
    [refresh],
  );

  const declineInvite = useCallback(async (inviteId: string) => {
    await workspaceApi.declineInviteRequest(inviteId);
    setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
  }, []);

  const addMember = useCallback(
    async (projectId: string, input: { name?: string; email: string; role?: ProjectRole }) => {
      const response = await workspaceApi.addMemberRequest(projectId, input);
      setProjects((prev) => upsertById(prev, response.project));
      return { result: response.result, inviteLink: response.inviteLink };
    },
    [],
  );

  const removeMember = useCallback(async (projectId: string, memberId: string) => {
    const { project, tasks, timeline } = await workspaceApi.removeMemberRequest(projectId, memberId);
    setProjects((prev) => upsertById(prev, project));
    if (tasks?.length) {
      setTasks((prev) => tasks.reduce((acc, task) => upsertById(acc, task), prev));
    } else {
      setTasks((prev) =>
        prev.map((task) =>
          task.projectId === projectId && task.assigneeId === memberId
            ? { ...task, assigneeId: '', assigneeName: 'Unassigned' }
            : task,
        ),
      );
    }
    if (timeline?.length) {
      setTimeline((prev) => timeline.reduce((acc, item) => upsertById(acc, item), prev));
    } else {
      setTimeline((prev) =>
        prev.map((item) =>
          item.projectId === projectId && item.assigneeId === memberId
            ? { ...item, assigneeId: null, assigneeName: null }
            : item,
        ),
      );
    }
  }, []);

  const updateMemberRole = useCallback(async (projectId: string, memberId: string, role: ProjectRole) => {
    const { project } = await workspaceApi.updateMemberRoleRequest(projectId, memberId, role);
    setProjects((prev) => upsertById(prev, project));
  }, []);

  const createTeam = useCallback(async (projectId: string, input: { name: string; memberIds?: string[] }) => {
    const { team } = await workspaceApi.createTeamRequest(projectId, input);
    setTeams((prev) => upsertById(prev, team));
  }, []);

  const updateTeam = useCallback(async (teamId: string, input: { name?: string; memberIds?: string[] }) => {
    const { team } = await workspaceApi.updateTeamRequest(teamId, input);
    setTeams((prev) => upsertById(prev, team));
  }, []);

  const deleteTeam = useCallback(async (teamId: string) => {
    await workspaceApi.deleteTeamRequest(teamId);
    setTeams((prev) => prev.filter((team) => team.id !== teamId));
  }, []);

  const assignTimelineItem = useCallback(async (itemId: string, assignee: { id: string; name: string }) => {
    const { timelineItem, task } = await workspaceApi.assignTimelineRequest(itemId, assignee);
    setTimeline((prev) => upsertById(prev, timelineItem));
    setTasks((prev) => upsertById(prev, task));
  }, []);

  const deleteTimelineItem = useCallback(async (itemId: string) => {
    await workspaceApi.deleteTimelineRequest(itemId);
    setTimeline((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      projects,
      tasks,
      timeline,
      teams,
      pendingInvites,
      isLoading,
      error,
      activeProjectId,
      setActiveProjectId,
      activeProject,
      visibleTasks,
      refresh,
      acceptInvite,
      declineInvite,
      isProjectAdmin,
      getProject,
      getTask,
      teamsForProject,
      createProject,
      deleteProject,
      uploadProjectAvatar,
      createTask,
      updateTask,
      moveTask,
      addComment,
      addTaskAttachments,
      removeTaskAttachment,
      addColumn,
      renameColumn,
      removeColumn,
      addMember,
      removeMember,
      updateMemberRole,
      createTeam,
      updateTeam,
      deleteTeam,
      assignTimelineItem,
      deleteTimelineItem,
    }),
    [
      projects,
      tasks,
      timeline,
      teams,
      pendingInvites,
      isLoading,
      error,
      activeProjectId,
      setActiveProjectId,
      activeProject,
      visibleTasks,
      refresh,
      acceptInvite,
      declineInvite,
      isProjectAdmin,
      getProject,
      getTask,
      teamsForProject,
      createProject,
      deleteProject,
      uploadProjectAvatar,
      createTask,
      updateTask,
      moveTask,
      addComment,
      addTaskAttachments,
      removeTaskAttachment,
      addColumn,
      renameColumn,
      removeColumn,
      addMember,
      removeMember,
      updateMemberRole,
      createTeam,
      updateTeam,
      deleteTeam,
      assignTimelineItem,
      deleteTimelineItem,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
