import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md';

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-10 px-3 text-sm',
};

export const fieldControlClass = [
  'w-full rounded-lg border border-ink-500/70 bg-ink-900/70 text-ink-50',
  'placeholder:text-ink-400',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'hover:border-brand-500/40',
  'focus:border-brand-500/60 focus:bg-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
  'disabled:cursor-not-allowed disabled:opacity-45',
].join(' ');

export function Input({
  className,
  size = 'md',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: Size }) {
  return (
    <input
      className={cn(fieldControlClass, sizes[size], className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldControlClass, 'min-h-[5.5rem] resize-y px-3 py-2.5 text-sm leading-relaxed', className)}
      {...props}
    />
  );
}
