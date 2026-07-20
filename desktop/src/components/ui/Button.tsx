import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white border border-brand-500 hover:bg-brand-600 hover:border-brand-600 shadow-sm',
  secondary:
    'bg-ink-800 text-ink-100 border border-ink-600 hover:border-ink-500 hover:bg-ink-700 hover:text-ink-50',
  ghost: 'bg-transparent text-ink-200 border border-transparent hover:bg-ink-600 hover:text-ink-50',
  danger:
    'bg-[#ed4245]/15 text-[#c03537] dark:text-[#ed4245] border border-[#ed4245]/30 hover:bg-[#ed4245]/25 hover:border-[#ed4245]/40',
  inverse: 'bg-ink-700 text-ink-50 border border-ink-600 hover:bg-ink-600',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1 rounded-md',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-4 text-sm gap-2 rounded-lg',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
