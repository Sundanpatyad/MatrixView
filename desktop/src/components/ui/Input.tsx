import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full border border-ink-600 bg-ink-800 px-3 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
