import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-ink-200 bg-white', className)}>
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-ink-50 text-ink-500">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-ink-100">{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={cn('hover:bg-ink-50/70', className)}>{children}</tr>;
}

export function TH({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={cn('px-4 py-3 font-semibold whitespace-nowrap', className)}>
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn('px-4 py-3 text-ink-800', className)}>{children}</td>;
}
