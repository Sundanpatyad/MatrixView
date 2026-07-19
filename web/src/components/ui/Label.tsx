import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Props = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: Props) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-ink-700', className)}
      {...props}
    />
  );
}
