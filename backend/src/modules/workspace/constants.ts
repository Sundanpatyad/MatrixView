export const COLUMN_ACCENTS = [
  'bg-ink-500',
  'bg-amber-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-orange-600',
  'bg-teal-700',
  'bg-fuchsia-600',
] as const;

export const DEFAULT_BOARD_COLUMNS = [
  { id: 'todo', label: 'To Do', accent: 'bg-ink-500', locked: true },
  { id: 'in_progress', label: 'In Progress', accent: 'bg-amber-600', locked: true },
  { id: 'review', label: 'In Review', accent: 'bg-sky-600', locked: true },
  { id: 'done', label: 'Done', accent: 'bg-emerald-600', locked: true },
] as const;

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
