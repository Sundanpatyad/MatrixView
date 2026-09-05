import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  workspaceApi,
  type BoardTask,
  type PickedFile,
  type Project,
  type ProjectPhase,
  type ProjectRole,
  type ProjectSprint,
  type ProjectTeam,
  type TimelineItem,
} from '@/lib/api';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/api/workspace';
import { patchSocketHandlers, socketActions } from '@/lib/socket/socket';

import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';

const ACTIVE_PROJECT_KEY = 'dockx.activeProjectId';

export type ActiveProjectId = string | 'all';

interface WorkspaceContextValue {
  projects: Project[];
  tasks: BoardTask[];
  timeline: TimelineItem[];
  teams: ProjectTeam[];
  phases: ProjectPhase[];
  sprints: ProjectSprint[];
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
  phasesForProject: (projectId: string) => ProjectPhase[];
  sprintsForProject: (projectId: string) => ProjectSprint[];
  boardSprintId: string | null;
  setBoardSprintId: (id: string | null) => void;

  createProject: (input: { name: string; key: string; description?: string }) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  uploadProjectAvatar: (projectId: string, file: PickedFile) => Promise<void>;

  createTask: (projectId: string, input: CreateTaskInput) => Promise<BoardTask>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<BoardTask>;
  moveTask: (taskId: string, status: string) => Promise<void>;
  addComment: (taskId: string, body: string, files?: PickedFile[]) => Promise<BoardTask>;
  addTaskAttachments: (taskId: string, files: PickedFile[]) => Promise<BoardTask>;
  removeTaskAttachment: (taskId: string, attachmentId: string) => Promise<BoardTask>;

  addColumn: (projectId: string, label: string, sprintId?: string) => Promise<void>;
  renameColumn: (projectId: string, columnId: string, label: string, sprintId?: string) => Promise<void>;
  removeColumn: (projectId: string, columnId: string, moveTo?: string, sprintId?: string) => Promise<void>;

  addMember: (projectId: string, input: { name?: string; email: string; role?: ProjectRole }) => Promise<{
    result: 'added' | 'invited';
    inviteLink: string | null;
  }>;
  removeMember: (projectId: string, memberId: string) => Promise<void>;
  updateMemberRole: (projectId: string, memberId: string, role: ProjectRole) => Promise<void>;

  createTeam: (projectId: string, input: { name: string; memberIds?: string[] }) => Promise<void>;
  updateTeam: (teamId: string, input: { name?: string; memberIds?: string[] }) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;

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
  const { connected: socketConnected } = useSocket();
  const toast = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [boardSprintId, setBoardSprintId] = useState<string | null>(null);
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
    setPhases((prev) => prev.filter((p) => p.projectId !== projectId));
    setSprints((prev) => prev.filter((s) => s.projectId !== projectId));
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
      setPhases(snapshot.phases ?? []);
      setSprints(snapshot.sprints ?? []);
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
      setPhases([]);
      setSprints([]);
      setBoardSprintId(null);
      setPendingInvites([]);
      joinedRooms.current.clear();
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  // Board realtime only reaches sockets that have joined the project room.
  useEffect(() => {
    if (!isAuthenticated || !socketConnected) return;
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
  }, [isAuthenticated, projects, socketConnected]);

  useEffect(() => {
    const applyProject = (
      project: Project,
      updatedTasks?: BoardTask[],
      extra?: {
        sprint?: ProjectSprint;
        phases?: ProjectPhase[];
        sprints?: ProjectSprint[];
      },
    ) => {
      if (!isActiveProjectMember(project, user)) {
        dropLocalProject(project.id);
        return;
      }
      setProjects((prev) => upsertById(prev, project));
      if (updatedTasks?.length) {
        setTasks((prev) => updatedTasks.reduce((acc, task) => upsertById(acc, task), prev));
      }
      if (extra?.phases) {
        const projectId = project.id;
        setPhases((prev) => [
          ...prev.filter((p) => p.projectId !== projectId),
          ...extra.phases!,
        ]);
      }
      if (extra?.sprints) {
        const projectId = project.id;
        setSprints((prev) => [
          ...prev.filter((s) => s.projectId !== projectId),
          ...extra.sprints!,
        ]);
      } else if (extra?.sprint) {
        const sprint = extra.sprint;
        setSprints((prev) => upsertById(prev, sprint));
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
      onProjectColumns: ({ project, tasks: updatedTasks, sprint, phases: nextPhases, sprints: nextSprints }) => {
        applyProject(project, updatedTasks, { sprint, phases: nextPhases, sprints: nextSprints });
      },
      onProjectUpdated: ({ project, phases: nextPhases, sprints: nextSprints, sprint }) => {
        if (project) applyProject(project, undefined, { sprint, phases: nextPhases, sprints: nextSprints });
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
      onInviteNew: ({ invite }) => {
        if (!invite?.id) return;
        setPendingInvites((prev) => upsertById(prev, invite));
      },
      onInviteResolved: ({ inviteId }) => {
        if (!inviteId) return;
        setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      },
    });
  }, [dropLocalProject, toast, user]);

  const getProject = useCallback((projectId: string) => projects.find((p) => p.id === projectId), [projects]);
  const getTask = useCallback((taskId: string) => tasks.find((t) => t.id === taskId), [tasks]);
  const teamsForProject = useCallback(
    (projectId: string) => teams.filter((team) => team.projectId === projectId),
    [teams],
  );
  const phasesForProject = useCallback(
    (projectId: string) =>
      phases.filter((phase) => phase.projectId === projectId).sort((a, b) => a.order - b.order),
    [phases],
  );
  const sprintsForProject = useCallback(
    (projectId: string) =>
      sprints
        .filter((sprint) => sprint.projectId === projectId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [sprints],
  );

  const isProjectAdmin = useCallback(
    (projectId: string) => {
      if (!user) return false;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return false;
      const email = user.email.toLowerCase();
      return project.members.some((member) => {
        if (member.role !== 'admin') return false;
        if (member.userId && member.userId === user.id) return true;
        return member.email.toLowerCase() === email;
      });
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
      setTimeline((prev) => prev.filter((t) => t.projectId !== projectId));
      setTeams((prev) => prev.filter((t) => t.projectId !== projectId));
      setPhases((prev) => prev.filter((p) => p.projectId !== projectId));
      setSprints((prev) => prev.filter((s) => s.projectId !== projectId));
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

  const addColumn = useCallback(async (projectId: string, label: string, sprintId?: string) => {
    const { project, sprint } = await workspaceApi.addColumnRequest(projectId, label, sprintId);
    setProjects((prev) => upsertById(prev, project));
    if (sprint) setSprints((prev) => upsertById(prev, sprint));
  }, []);

  const renameColumn = useCallback(async (projectId: string, columnId: string, label: string, sprintId?: string) => {
    const { project, sprint } = await workspaceApi.renameColumnRequest(projectId, columnId, label, sprintId);
    setProjects((prev) => upsertById(prev, project));
    if (sprint) setSprints((prev) => upsertById(prev, sprint));
  }, []);

  const removeColumn = useCallback(async (projectId: string, columnId: string, moveTo?: string, sprintId?: string) => {
    const { project, tasks: moved, sprint } = await workspaceApi.removeColumnRequest(
      projectId,
      columnId,
      moveTo,
      sprintId,
    );
    setProjects((prev) => upsertById(prev, project));
    if (moved?.length) setTasks((prev) => moved.reduce((acc, task) => upsertById(acc, task), prev));
    if (sprint) setSprints((prev) => upsertById(prev, sprint));
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

  const mergePlan = useCallback((projectId: string, nextPhases: ProjectPhase[], nextSprints: ProjectSprint[]) => {
    setPhases((prev) => [...prev.filter((phase) => phase.projectId !== projectId), ...nextPhases]);
    setSprints((prev) => [...prev.filter((sprint) => sprint.projectId !== projectId), ...nextSprints]);
  }, []);

  const createPhases = useCallback(
    async (projectId: string, rows: Array<{ name: string; startDate?: string; endDate?: string }>) => {
      const res = await workspaceApi.createPhasesRequest(projectId, rows);
      mergePlan(projectId, res.phases, res.sprints);
    },
    [mergePlan],
  );

  const startPhase = useCallback(
    async (projectId: string, phaseId: string) => {
      const res = await workspaceApi.startPhaseRequest(projectId, phaseId);
      mergePlan(projectId, res.phases, res.sprints);
    },
    [mergePlan],
  );

  const completePhase = useCallback(
    async (projectId: string, phaseId: string) => {
      const res = await workspaceApi.completePhaseRequest(projectId, phaseId);
      mergePlan(projectId, res.phases, res.sprints);
      await refresh();
    },
    [mergePlan, refresh],
  );

  const createSprint = useCallback(
    async (
      projectId: string,
      input: { name: string; phaseId?: string | null; startDate: string; endDate: string },
    ) => {
      const res = await workspaceApi.createSprintRequest(projectId, input);
      mergePlan(projectId, res.phases, res.sprints);
      return res.sprint;
    },
    [mergePlan],
  );

  const startSprint = useCallback(
    async (projectId: string, sprintId: string) => {
      const res = await workspaceApi.startSprintRequest(projectId, sprintId);
      mergePlan(projectId, res.phases, res.sprints);
    },
    [mergePlan],
  );

  const extendSprint = useCallback(
    async (projectId: string, sprintId: string, endDate: string) => {
      const res = await workspaceApi.extendSprintRequest(projectId, sprintId, endDate);
      mergePlan(projectId, res.phases, res.sprints);
    },
    [mergePlan],
  );

  const completeSprintFn = useCallback(
    async (projectId: string, sprintId: string) => {
      const res = await workspaceApi.completeSprintRequest(projectId, sprintId);
      mergePlan(projectId, res.phases, res.sprints);
      await refresh();
    },
    [mergePlan, refresh],
  );

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
      phases,
      sprints,
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
      phasesForProject,
      sprintsForProject,
      boardSprintId,
      setBoardSprintId,
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
      createPhases,
      startPhase,
      completePhase,
      createSprint,
      startSprint,
      extendSprint,
      completeSprint: completeSprintFn,
      assignTimelineItem,
      deleteTimelineItem,
    }),
    [
      projects,
      tasks,
      timeline,
      teams,
      phases,
      sprints,
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
      phasesForProject,
      sprintsForProject,
      boardSprintId,
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
      createPhases,
      startPhase,
      completePhase,
      createSprint,
      startSprint,
      extendSprint,
      completeSprintFn,
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
