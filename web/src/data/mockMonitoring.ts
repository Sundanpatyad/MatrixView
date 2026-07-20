export type LiveEmployee = {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'offline' | 'break';
  app: string;
  task: string;
  todayMins: number;
};

export const mockLive: LiveEmployee[] = [
  {
    id: 'm1',
    name: 'Riya Patel',
    status: 'active',
    app: 'VS Code',
    task: 'Wire invite email template',
    todayMins: 214,
  },
  {
    id: 'm2',
    name: 'Karan Mehta',
    status: 'idle',
    app: 'Slack',
    task: 'Idle threshold config',
    todayMins: 168,
  },
  {
    id: 'm3',
    name: 'Neha Sharma',
    status: 'active',
    app: 'Figma',
    task: 'Export attendance CSV',
    todayMins: 192,
  },
  {
    id: 'm4',
    name: 'Vikram Shah',
    status: 'offline',
    app: '—',
    task: '—',
    todayMins: 0,
  },
];
