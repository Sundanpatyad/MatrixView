import { IconFile, IconForward, IconImage, IconVideo } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';

export type MessagePreviewKind = 'photo' | 'video' | 'file' | 'forwarded' | 'text';

export function parseMessagePreview(raw: string | null | undefined): {
  kind: MessagePreviewKind;
  label: string;
} {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'text', label: '' };

  const withoutEmoji = text
    .replace(/^(📷|📸|🎬|🎥|📎|↪)\s*/u, '')
    .trim();

  if (/^forwarded:\s*/i.test(withoutEmoji) || text.startsWith('↪')) {
    const label = withoutEmoji.replace(/^forwarded:\s*/i, '').trim() || 'Forwarded message';
    const nested = parseMessagePreview(label);
    if (nested.kind !== 'text' && nested.kind !== 'forwarded') {
      return { kind: nested.kind, label: nested.label };
    }
    return { kind: 'forwarded', label };
  }

  if (/^(photo|image)$/i.test(withoutEmoji)) return { kind: 'photo', label: 'Photo' };
  if (/^video$/i.test(withoutEmoji)) return { kind: 'video', label: 'Video' };
  if (/^attachment:\s*/i.test(withoutEmoji) || text.startsWith('📎')) {
    return {
      kind: 'file',
      label: withoutEmoji.replace(/^attachment:\s*/i, '').trim() || 'Attachment',
    };
  }

  return { kind: 'text', label: withoutEmoji || text };
}

export function MessagePreviewLabel({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const { kind, label } = parseMessagePreview(text);
  if (!label) return null;

  const Icon =
    kind === 'photo'
      ? IconImage
      : kind === 'video'
        ? IconVideo
        : kind === 'file'
          ? IconFile
          : kind === 'forwarded'
            ? IconForward
            : null;

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
