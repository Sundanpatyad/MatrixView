import { useEffect, useState } from 'react';
import { getChatLinkPreview, type ChatLinkPreview } from '@/lib/api/chat';
import { firstHttpUrl, hostOf } from '@/lib/chat/links';
import { openExternalUrl } from '@/lib/chat/openExternal';
import { cn } from '@/lib/cn';

export function LinkPreviewCard({
  preview,
  body,
  mine,
}: {
  preview?: ChatLinkPreview | null;
  body: string;
  mine?: boolean;
}) {
  const url = preview?.url || firstHttpUrl(body);
  const [data, setData] = useState<ChatLinkPreview | null>(preview ?? null);
  const [loading, setLoading] = useState(!preview && Boolean(url));

  useEffect(() => {
    if (preview) {
      setData(preview);
      setLoading(false);
      return;
    }
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    void getChatLinkPreview(url)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, url]);

  if (!url) return null;

  const host = data?.host || hostOf(url);
  const title = data?.title || host;
  const description = data?.description ?? '';
  const imageUrl = data?.imageUrl ?? null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void openExternalUrl(data?.url || url);
      }}
      className={cn(
        'mb-1.5 w-full overflow-hidden rounded-lg text-left',
        mine ? 'bg-black/15' : 'bg-ink-900/80',
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-[132px] w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : loading ? (
        <div className={cn('h-16 w-full animate-pulse', mine ? 'bg-black/10' : 'bg-ink-700')} />
      ) : null}
      <div className="px-2.5 py-2">
        <p
          className={cn(
            'truncate text-[10px] font-semibold uppercase tracking-wide',
            mine ? 'text-white/65' : 'text-ink-400',
          )}
        >
          {host}
        </p>
        <p
          className={cn(
            'mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug',
            mine ? 'text-white' : 'text-ink-50',
          )}
        >
          {title}
        </p>
        {description ? (
          <p
            className={cn(
              'mt-0.5 line-clamp-2 text-[11px] leading-snug',
              mine ? 'text-white/75' : 'text-ink-300',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </button>
  );
}
