import { firstHttpUrl, hostOf, tokenizeLinks } from '@/lib/chat/links';
import { openExternalUrl } from '@/lib/chat/openExternal';
import { cn } from '@/lib/cn';

export function LinkifiedText({
  text,
  mine,
  className,
}: {
  text: string;
  mine?: boolean;
  className?: string;
}) {
  const tokens = tokenizeLinks(text);
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {tokens.map((token, index) => {
        if (token.type !== 'link') return <span key={index}>{token.value}</span>;
        return (
          <a
            key={index}
            href={token.href}
            title={token.href}
            className={cn(
              'underline decoration-current/50 underline-offset-2 hover:opacity-80',
              mine ? 'text-[#083318]' : 'text-brand-300',
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openExternalUrl(token.href);
            }}
          >
            {token.value}
          </a>
        );
      })}
    </span>
  );
}

export function hasLinkPreviewSource(text: string) {
  return Boolean(firstHttpUrl(text));
}

export { firstHttpUrl, hostOf };
