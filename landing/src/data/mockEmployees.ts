export type EmployeeStatus = 'active' | 'invited' | 'on_leave' | 'deactivated';

export type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  team: string;
  status: EmployeeStatus;
};

export const mockEmployees: Employee[] = [
  {
    id: 'e1',
    name: 'Riya Patel',
    email: 'riya@acme.dev',
    role: 'Employee',
    department: 'Engineering',
    team: 'Platform',
    status: 'active',
  },
  {
    id: 'e2',
    name: 'Karan Mehta',
    email: 'karan@acme.dev',
    role: 'Team Lead',
    department: 'Engineering',
    team: 'Platform',
    status: 'active',
  },
  {
    id: 'e3',
    name: 'Neha Sharma',
    email: 'neha@acme.dev',
    role: 'Admin',
    department: 'People',
    team: 'HR Ops',
    status: 'active',
  },
  {
    id: 'e4',
    name: 'Arjun Desai',
    email: 'arjun@acme.dev',
    role: 'Org Owner',
    department: 'Leadership',
    team: 'Exec',
    status: 'active',
  },
  {
    id: 'e5',
    name: 'Meera Iyer',
    email: 'meera@client.co',
    role: 'Guest',
    department: '—',
    team: '—',
    status: 'invited',
  },
  {
    id: 'e6',
    name: 'Vikram Shah',
    email: 'vikram@acme.dev',
    role: 'Employee',
    department: 'Design',
    team: 'Brand',
    status: 'on_leave',
  },
];
