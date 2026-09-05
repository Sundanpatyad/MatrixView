import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

export function FieldLabel({ htmlFor, required, optional, className, children }: Props) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ink-300 uppercase',
        className,
      )}
    >
      <span>{children}</span>
      {required ? (
        <span className="text-[#ed4245]" aria-hidden>
          *
        </span>
      ) : null}
      {optional ? (
        <span className="normal-case tracking-normal font-medium text-ink-400">(optional)</span>
      ) : null}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[11px] font-medium text-[#ed4245]">{children}</p>;
}
