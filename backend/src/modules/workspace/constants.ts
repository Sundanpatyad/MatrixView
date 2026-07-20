export const COLUMN_ACCENTS = [
  'bg-ink-500',
  'bg-[#f0b232]',
  'bg-[#00a8fc]',
  'bg-[#23a559]',
  'bg-[#5865f2]',
  'bg-[#eb459e]',
  'bg-[#57f287]',
  'bg-[#ed4245]',
  'bg-brand-500',
  'bg-[#fee75c]',
] as const;

export const DEFAULT_BOARD_COLUMNS = [
  { id: 'todo', label: 'To Do', accent: 'bg-ink-500', locked: true },
  { id: 'in_progress', label: 'In Progress', accent: 'bg-[#f0b232]', locked: true },
  { id: 'review', label: 'In Review', accent: 'bg-[#00a8fc]', locked: true },
  { id: 'done', label: 'Done', accent: 'bg-[#23a559]', locked: true },
] as const;

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
