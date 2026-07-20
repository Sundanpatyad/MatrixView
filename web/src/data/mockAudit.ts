export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
};

export const mockAudit: AuditEvent[] = [
  {
    id: 'au1',
    at: 'Jul 19 · 15:42',
    actor: 'Neha Sharma',
    action: 'Employee invited',
    target: 'meera@client.co',
    ip: '103.21.x.x',
  },
  {
    id: 'au2',
    at: 'Jul 19 · 14:10',
    actor: 'Arjun Desai',
    action: 'Org policy changed',
    target: 'enforce_2fa → on',
    ip: '103.21.x.x',
  },
  {
    id: 'au3',
    at: 'Jul 19 · 11:05',
    actor: 'System',
    action: 'Login success',
    target: 'karan@acme.dev',
    ip: '49.36.x.x',
  },
  {
    id: 'au4',
    at: 'Jul 18 · 18:22',
    actor: 'Neha Sharma',
    action: 'Attendance edited',
    target: 'Riya Patel · Jul 18 checkout',
    ip: '103.21.x.x',
  },
  {
    id: 'au5',
    at: 'Jul 18 · 09:01',
    actor: 'Arjun Desai',
    action: 'Role changed',
    target: 'Vikram Shah → Employee',
    ip: '103.21.x.x',
  },
];
