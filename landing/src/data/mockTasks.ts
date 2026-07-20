export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type Task = {
  id: string;
  title: string;
  project: string;
  assignee: string;
  priority: TaskPriority;
  status: TaskStatus;
  due: string;
};

export const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'Wire invite email template',
    project: 'Client Portal Redesign',
    assignee: 'Riya Patel',
    priority: 'high',
    status: 'in_progress',
    due: 'Jul 21',
  },
  {
    id: 't2',
    title: 'Org chart empty states',
    project: 'Client Portal Redesign',
    assignee: 'Vikram Shah',
    priority: 'medium',
    status: 'todo',
    due: 'Jul 22',
  },
  {
    id: 't3',
    title: 'Attendance correction flow',
    project: 'Desktop Agent MVP',
    assignee: 'Karan Mehta',
    priority: 'urgent',
    status: 'review',
    due: 'Jul 20',
  },
  {
    id: 't4',
    title: 'Kanban drag polish',
    project: 'Client Portal Redesign',
    assignee: 'Riya Patel',
    priority: 'low',
    status: 'todo',
    due: 'Jul 25',
  },
  {
    id: 't5',
    title: 'Export attendance CSV',
    project: 'Payroll Integrations',
    assignee: 'Neha Sharma',
    priority: 'medium',
    status: 'done',
    due: 'Jul 18',
  },
  {
    id: 't6',
    title: 'Idle threshold config',
    project: 'Desktop Agent MVP',
    assignee: 'Karan Mehta',
    priority: 'high',
    status: 'in_progress',
    due: 'Jul 23',
  },
];

export const kanbanColumns: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];
