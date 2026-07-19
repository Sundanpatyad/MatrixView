export type AttendanceRow = {
  id: string;
  employee: string;
  date: string;
  checkIn: string;
  checkOut: string;
  breakMins: number;
  status: 'present' | 'late' | 'absent' | 'remote';
};

export const mockAttendance: AttendanceRow[] = [
  {
    id: 'a1',
    employee: 'Riya Patel',
    date: 'Jul 19',
    checkIn: '09:04',
    checkOut: '—',
    breakMins: 25,
    status: 'present',
  },
  {
    id: 'a2',
    employee: 'Karan Mehta',
    date: 'Jul 19',
    checkIn: '09:42',
    checkOut: '—',
    breakMins: 0,
    status: 'late',
  },
  {
    id: 'a3',
    employee: 'Vikram Shah',
    date: 'Jul 19',
    checkIn: '—',
    checkOut: '—',
    breakMins: 0,
    status: 'absent',
  },
  {
    id: 'a4',
    employee: 'Neha Sharma',
    date: 'Jul 19',
    checkIn: '08:55',
    checkOut: '—',
    breakMins: 40,
    status: 'remote',
  },
];
