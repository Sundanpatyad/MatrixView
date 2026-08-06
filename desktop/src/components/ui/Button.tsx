import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: [
    'bg-brand-500 text-[#062816] border border-brand-400/40',
    'hover:bg-[#6b76f4] hover:border-brand-300/50',
    'active:bg-brand-600',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
    'hover:shadow-[0_0_0_3px_rgba(88,101,242,0.22),inset_0_1px_0_rgba(255,255,255,0.18)]',
  ].join(' '),
  secondary: [
    'bg-ink-900/70 text-ink-100 border border-ink-500/70',
    'hover:border-brand-500/45 hover:bg-ink-800 hover:text-ink-50',
    'active:bg-ink-700',
  ].join(' '),
  ghost: [
    'bg-transparent text-ink-300 border border-transparent',
    'hover:bg-ink-800/80 hover:text-ink-50',
    'active:bg-ink-700',
  ].join(' '),
  danger: [
    'bg-[#ed4245]/12 text-[#ed4245] border border-[#ed4245]/35',
    'hover:bg-[#ed4245]/20 hover:border-[#ed4245]/55 hover:text-[#ff6b6e]',
    'active:bg-[#ed4245]/28',
  ].join(' '),
  inverse: [
    'bg-ink-700 text-ink-50 border border-ink-500/60',
    'hover:bg-ink-600 hover:border-ink-400',
    'active:bg-ink-500',
  ].join(' '),
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1 rounded-lg tracking-wide',
  sm: 'h-8 px-3.5 text-xs gap-1.5 rounded-lg tracking-wide',
  md: 'h-9 px-4 text-[13px] gap-2 rounded-lg tracking-wide',
  lg: 'h-10 px-5 text-sm gap-2 rounded-xl tracking-wide',
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
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-ink-900',
        'disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
