export type Project = {
  id: string;
  name: string;
  status: 'active' | 'on_hold' | 'completed';
  members: number;
  milestone: string;
  progress: number;
};

export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Client Portal Redesign',
    status: 'active',
    members: 6,
    milestone: 'Beta launch',
    progress: 62,
  },
  {
    id: 'p2',
    name: 'Payroll Integrations',
    status: 'active',
    members: 4,
    milestone: 'Provider sync',
    progress: 35,
  },
  {
    id: 'p3',
    name: 'Q2 Agency Retainer',
    status: 'on_hold',
    members: 3,
    milestone: 'Scope freeze',
    progress: 48,
  },
  {
    id: 'p4',
    name: 'Desktop Agent MVP',
    status: 'completed',
    members: 5,
    milestone: 'Shipped',
    progress: 100,
  },
];
