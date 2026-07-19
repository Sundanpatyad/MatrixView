export type DesktopTaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type DesktopTaskPriority = 'low' | 'medium' | 'high';

export type DesktopTask = {
  id: string;
  title: string;
  subtitle: string;
  project: string;
  priority: DesktopTaskPriority;
  status: DesktopTaskStatus;
  due: string;
  progressDone: number;
  progressTotal: number;
  comments: number;
  attachments: number;
  assignees: string[];
};

export const myTasks: DesktopTask[] = [
  {
    id: 'dt1',
    title: 'Wire invite email template',
    subtitle: 'Auth flow',
    project: 'Client Portal',
    priority: 'high',
    status: 'in_progress',
    due: 'Jul 21, 2026',
    progressDone: 2,
    progressTotal: 5,
    comments: 3,
    attachments: 1,
    assignees: ['RP', 'KM'],
  },
  {
    id: 'dt2',
    title: 'Fix attendance timezone edge case',
    subtitle: 'Desktop agent',
    project: 'Desktop Agent',
    priority: 'medium',
    status: 'todo',
    due: 'Jul 22, 2026',
    progressDone: 0,
    progressTotal: 4,
    comments: 1,
    attachments: 0,
    assignees: ['RP'],
  },
  {
    id: 'dt3',
    title: 'Review PR: idle detection',
    subtitle: 'Code review',
    project: 'Desktop Agent',
    priority: 'high',
    status: 'todo',
    due: 'Jul 20, 2026',
    progressDone: 0,
    progressTotal: 3,
    comments: 5,
    attachments: 2,
    assignees: ['RP', 'NS'],
  },
  {
    id: 'dt4',
    title: 'Update profile photo',
    subtitle: 'Personal',
    project: 'Personal',
    priority: 'low',
    status: 'done',
    due: 'Jul 18, 2026',
    progressDone: 1,
    progressTotal: 1,
    comments: 0,
    attachments: 1,
    assignees: ['RP'],
  },
  {
    id: 'dt5',
    title: 'Kanban polish pass',
    subtitle: 'UI',
    project: 'Client Portal',
    priority: 'medium',
    status: 'review',
    due: 'Jul 23, 2026',
    progressDone: 4,
    progressTotal: 5,
    comments: 2,
    attachments: 0,
    assignees: ['RP', 'VS'],
  },
  {
    id: 'dt6',
    title: 'Document check-in API',
    subtitle: 'Docs',
    project: 'Desktop Agent',
    priority: 'low',
    status: 'in_progress',
    due: 'Jul 24, 2026',
    progressDone: 1,
    progressTotal: 3,
    comments: 0,
    attachments: 1,
    assignees: ['RP'],
  },
  {
    id: 'dt7',
    title: 'Ship attendance CSV export',
    subtitle: 'Reports',
    project: 'Payroll',
    priority: 'medium',
    status: 'review',
    due: 'Jul 21, 2026',
    progressDone: 5,
    progressTotal: 5,
    comments: 4,
    attachments: 2,
    assignees: ['NS', 'RP'],
  },
  {
    id: 'dt8',
    title: 'Silent login edge cases',
    subtitle: 'Auth',
    project: 'Desktop Agent',
    priority: 'high',
    status: 'done',
    due: 'Jul 17, 2026',
    progressDone: 3,
    progressTotal: 3,
    comments: 1,
    attachments: 0,
    assignees: ['RP'],
  },
];

export const boardColumns: { id: DesktopTaskStatus; label: string; accent: string }[] = [
  { id: 'todo', label: 'Not started', accent: 'bg-ink-400' },
  { id: 'in_progress', label: 'In progress', accent: 'bg-amber-500' },
  { id: 'review', label: 'Under review', accent: 'bg-sky-500' },
  { id: 'done', label: 'Completed', accent: 'bg-emerald-500' },
];
