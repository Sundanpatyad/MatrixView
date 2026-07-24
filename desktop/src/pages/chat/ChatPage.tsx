import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  IconChevronLeft,
  IconEdit,
  IconFile,
  IconForward,
  IconGallery,
  IconImage,
  IconMic,
  IconPaperclip,
  IconPhone,
  IconPhoneOff,
  IconPlus,
  IconReply,
  IconSearch,
  IconSend,
  IconStop,
  IconTrash,
  IconUsers,
  IconVideo,
  IconX,
} from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';
import { cn } from '@/lib/cn';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import {
  addGroupMembers,
  createDm,
  createGroup,
  deleteMessage,
  editMessage,
  listChatUsers,
  forwardMessage,
  removeGroupMember,
  updateGroup,
  uploadGroupAvatar,
  type ChatAttachment,
  type ChatConversation,
  type ChatMember,
  type ChatMessage,
} from '@/lib/api/chat';
import {
  connectChatSocket,
  clearChatSocketHandlerKeys,
  emitMessagesRead,
  emitTypingStart,
  emitTypingStop,
  getChatSocket,
  joinConversation,
  leaveConversation,
  patchChatSocketHandlers,
  requestPresenceSnapshot,
  type PresenceUser,
} from '@/lib/socket/chatSocket';
import { useCall } from '@/lib/calls/CallContext';
import {
  buildOptimisticMessage,
  chatSendQueue,
  persistOptimisticLocal,
} from '@/lib/chat/sendQueue';
import { useToast } from '@/lib/toast/ToastContext';
import {
  appendMessageSorted,
  loadConversations,
  mergeMessagesById,
  openConversationsFromLocal,
  openMessagesFromLocal,
  replaceMessageById,
  sortConversationsByRecent,
  sortMessagesByTime,
  syncConversationsFromApi,
  syncLatestMessagesFromApi,
  fetchLatestMessagesPage,
  fetchOlderMessagesPage,
} from '@/lib/offline/chatApi';
import {
  markOptimisticFailed,
  upsertCachedConversation,
  upsertLiveMessage,
} from '@/lib/offline/chatStore';
import { useOffline } from '@/lib/offline/OfflineContext';

function ConversationAvatar({
  conversation,
  meId,
  size = 'lg',
  className,
}: {
  conversation: Pick<ChatConversation, 'type' | 'name' | 'avatarUrl' | 'members' | 'id'>;
  meId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  if (conversation.type === 'group') {
    if (conversation.avatarUrl) {
      return (
        <UserAvatar
          name={conversation.name}
          src={conversation.avatarUrl}
          seed={conversation.id}
          size={size}
          className={className}
        />
      );
    }
    const box =
      size === 'xl'
        ? 'h-20 w-20'
        : size === 'lg'
          ? 'h-10 w-10'
          : size === 'md'
            ? 'h-8 w-8'
            : 'h-6 w-6';
    const icon = size === 'xl' ? 'h-8 w-8' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-ink-700 text-white',
          box,
          className,
        )}
      >
        <IconUsers className={icon} />
      </span>
    );
  }

  const peer = conversation.members.find((m) => m.id !== meId);
  return (
    <UserAvatar
      name={peer?.name || conversation.name}
      src={peer?.avatarUrl}
      seed={peer?.id || conversation.id}
      size={size}
      className={className}
    />
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDay(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatCallDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function callHistoryLabel(msg: ChatMessage, meId: string) {
  const call = msg.call;
  if (!call) return msg.body || 'Voice call';
  if (msg.body) return msg.body;
  const iStarted = call.initiatedBy === meId;
  const isVideo = call.mediaKind === 'video';
  const noun = isVideo ? 'Video call' : 'Voice call';
  const lower = isVideo ? 'video call' : 'voice call';
  switch (call.outcome) {
    case 'answered':
      return `${noun} · ${formatCallDuration(call.durationSeconds)}`;
    case 'rejected':
      return iStarted ? `Declined ${lower}` : 'You declined';
    case 'cancelled':
      return iStarted ? 'Cancelled call' : `Missed ${lower}`;
    case 'missed':
      return iStarted ? 'No answer' : `Missed ${lower}`;
    case 'failed':
    default:
      return `${noun} failed`;
  }
}

function MessageTicks({
  status,
  localState,
  mine,
}: {
  status?: 'sent' | 'delivered' | 'read';
  localState?: 'sending' | 'failed' | null;
  mine: boolean;
}) {
  if (!mine) return null;
  if (localState === 'sending') {
    return (
      <span className="inline-flex text-white/50" title="Sending" aria-label="Sending">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full border border-current border-t-transparent" />
      </span>
    );
  }
  if (localState === 'failed') {
    return (
      <span className="font-semibold text-rose-200" title="Failed to send" aria-label="Failed">
        !
      </span>
    );
  }
  const read = status === 'read';
  const double = status === 'delivered' || status === 'read';
  return (
    <span
      className={cn('inline-flex', read ? 'text-[#57f287]' : 'text-white/65')}
      title={status ?? 'sent'}
      aria-label={status ?? 'sent'}
    >
      <svg viewBox="0 0 16 11" className="h-3 w-4" fill="none" aria-hidden>
        {double ? (
          <>
            <path
              d="M1.5 6.2 4.2 8.8 9.8 2.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.2 6.2 7.9 8.8 14.5 2.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <path
            d="M2.2 6.2 5 8.8 12.5 2.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}

function MediaPreviewModal({
  att,
  onClose,
}: {
  att: ChatAttachment;
  onClose: () => void;
}) {
  const src = resolveMediaUrl(att.url);
  const pdf = isPdfAttachment(att);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={att.name}
        className="relative z-10 flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-600 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-50">{att.name}</p>
            <p className="text-[11px] text-ink-400">
              {att.kind === 'image'
                ? 'Image'
                : att.kind === 'video'
                  ? 'Video'
                  : pdf
                    ? 'PDF'
                    : 'File'}
              {att.size ? ` · ${formatBytes(att.size)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-ink-800 dark:text-brand-300"
            >
              Open
            </a>
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-50"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-ink-950/80 p-3 sm:p-4">
          {att.kind === 'image' ? (
            <img
              src={src}
              alt={att.name}
              className="max-h-[min(78vh,820px)] max-w-full rounded-lg object-contain"
            />
          ) : att.kind === 'video' ? (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="max-h-[min(78vh,820px)] max-w-full rounded-lg bg-black"
            >
              <track kind="captions" />
            </video>
          ) : pdf ? (
            <iframe title={att.name} src={src} className="h-[min(78vh,820px)] w-full rounded-lg bg-white" />
          ) : (
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white"
            >
              Download file
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VoiceNotePlayer({
  att,
  mine,
}: {
  att: ChatAttachment;
  mine?: boolean;
}) {
  const toast = useToast();
  const src = resolveMediaUrl(att.url);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        'min-w-[160px] max-w-[220px] rounded-xl px-2.5 py-2',
        mine ? 'bg-black/15' : 'border border-ink-600 bg-ink-900/80',
      )}
    >
      <div
        className={cn(
          'mb-1 flex items-center gap-1.5 text-[11px] font-medium',
          mine ? 'text-white/90' : 'text-ink-200',
        )}
      >
        <IconMic className={cn('h-3.5 w-3.5', mine ? 'text-white/80' : 'text-brand-500')} />
        <span className="truncate">{att.name || 'Voice note'}</span>
      </div>
      {failed ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'text-[11px] font-semibold underline',
            mine ? 'text-white' : 'text-brand-600',
          )}
        >
          Open audio file
        </a>
      ) : (
        <audio
          key={src}
          controls
          preload="metadata"
          className="h-8 w-full"
          src={src}
          onError={() => {
            setFailed(true);
            toast.error('Couldn’t play this voice note. Try opening the file instead.');
          }}
        >
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}

function AttachmentBlock({
  att,
  mine,
  onPreview,
}: {
  att: ChatAttachment;
  mine?: boolean;
  onPreview: (att: ChatAttachment) => void;
}) {
  const src = resolveMediaUrl(att.url);
  if (att.kind === 'image') {
    return (
      <button
        type="button"
        onClick={() => onPreview(att)}
        className="group/media relative block w-[min(100%,16rem)] overflow-hidden rounded-xl bg-black/20 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        title="Preview image"
      >
        <img
          src={src}
          alt={att.name}
          loading="lazy"
          className="max-h-56 w-full object-cover transition duration-200 group-hover/media:brightness-95"
        />
      </button>
    );
  }
  if (att.kind === 'video') {
    return (
      <button
        type="button"
        onClick={() => onPreview(att)}
        className="group/media relative block w-[min(100%,16rem)] overflow-hidden rounded-xl bg-ink-950 text-left ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:ring-white/10"
        title="Preview video"
      >
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className="max-h-56 w-full bg-black object-cover"
        >
          <track kind="captions" />
        </video>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 transition group-hover/media:bg-black/45">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg ring-1 ring-white/20">
            <IconVideo className="h-5 w-5" />
          </span>
        </span>
      </button>
    );
  }
  if (att.kind === 'audio') {
    return <VoiceNotePlayer att={att} mine={mine} />;
  }
  if (att.kind === 'document' || att.kind === 'other') {
    const pdf = isPdfAttachment(att);
    return (
      <button
        type="button"
        onClick={() => (pdf ? onPreview(att) : window.open(src, '_blank', 'noopener,noreferrer'))}
        className={cn(
          'flex w-[min(100%,15rem)] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition',
          mine
            ? 'bg-black/15 text-white hover:bg-black/25'
            : 'border border-ink-600 bg-ink-900/70 text-ink-100 hover:bg-ink-900',
        )}
        title={pdf ? 'Preview PDF' : 'Open file'}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase tracking-wide',
            pdf
              ? mine
                ? 'bg-white/15 text-white'
                : 'bg-[#ed4245]/10 text-[#c03537] dark:text-[#ed4245]'
              : mine
                ? 'bg-white/15 text-white'
                : 'bg-ink-700 text-ink-200',
          )}
        >
          {pdf ? 'PDF' : <IconFile className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{att.name}</span>
          <span className={cn('mt-0.5 block text-[11px]', mine ? 'text-white/65' : 'text-ink-300')}>
            {pdf ? 'Tap to preview' : 'Document'}
            {att.size ? ` · ${formatBytes(att.size)}` : ''}
          </span>
        </span>
      </button>
    );
  }
  return null;
}

function PresenceDot({
  checkedIn,
  online,
  className,
}: {
  checkedIn?: boolean;
  online?: boolean;
  className?: string;
}) {
  // Socket-online takes priority for call affordances; checked-in is attendance.
  const socketOnline = Boolean(online);
  const title = socketOnline
    ? checkedIn
      ? 'Online · checked in'
      : 'Online'
    : checkedIn
      ? 'Checked in (offline for calls)'
      : 'Offline';
  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white',
        socketOnline ? 'bg-[#23a559]' : checkedIn ? 'bg-[#f0b232]' : 'bg-ink-300',
        socketOnline && 'ring-1 ring-[#23a559]/40',
        className,
      )}
      title={title}
    />
  );
}

function ChatListSkeleton() {
  return (
    <div className="space-y-1 p-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-ink-700" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-[55%] animate-pulse rounded bg-ink-700" />
            <div className="h-2.5 w-[75%] animate-pulse rounded bg-ink-900" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatThreadSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-6">
      <div className="mx-auto h-5 w-20 animate-pulse rounded-full bg-ink-700" />
      <div className="flex justify-start">
        <div className="h-12 w-[55%] animate-pulse rounded-2xl rounded-bl-md bg-ink-700" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-[45%] animate-pulse rounded-2xl rounded-br-md bg-brand-100" />
      </div>
      <div className="flex justify-start">
        <div className="h-16 w-[60%] animate-pulse rounded-2xl rounded-bl-md bg-ink-700" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-[40%] animate-pulse rounded-2xl rounded-br-md bg-brand-100" />
      </div>
      <div className="flex justify-start">
        <div className="h-8 w-[35%] animate-pulse rounded-2xl rounded-bl-md bg-ink-700" />
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfAttachment(att: ChatAttachment) {
  return (
    att.mimeType.includes('pdf') || att.name.toLowerCase().endsWith('.pdf')
  );
}

function ComposerAttachmentPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  useEffect(() => {
    if (!isImage && !isVideo) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isImage, isVideo]);

  return (
    <div className="group relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-sm">
      {isImage && url ? (
        <img src={url} alt={file.name} className="h-full w-full object-cover" />
      ) : isVideo && url ? (
        <>
          <video src={url} muted playsInline className="h-full w-full object-cover" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white">
              <IconVideo className="h-3.5 w-3.5" />
            </span>
          </span>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-1.5 text-center">
          <IconFile className="h-4 w-4 text-ink-300" />
          <span className="w-full truncate text-[9px] font-semibold uppercase tracking-wide text-ink-300">
            {fileKindLabel(file)}
          </span>
        </div>
      )}
      <button
        type="button"
        title={`Remove ${file.name}`}
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-950/80 text-ink-50 opacity-90 shadow transition hover:bg-[#ed4245] hover:opacity-100"
      >
        <IconX className="h-3 w-3" />
      </button>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[9px] font-medium text-white">
        {file.name}
      </span>
    </div>
  );
}

type AttachPickerKind = 'photo' | 'gallery' | 'document' | 'audio';

const ATTACH_ACCEPT: Record<AttachPickerKind, string> = {
  photo: 'image/*',
  gallery: 'image/*,video/*',
  document:
    '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  audio: 'audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac',
};

function fileKindLabel(file: File) {
  if (file.type.startsWith('image/')) return 'Photo';
  if (file.type.startsWith('video/')) return 'Video';
  if (file.type.startsWith('audio/')) return 'Audio';
  if (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) return 'PDF';
  return 'File';
}

type ModalProps = { onClose: () => void; children: React.ReactNode; title: string; subtitle?: string };

function ModalShell({ onClose, children, title, subtitle }: ModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md border border-ink-600 bg-ink-800 p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-50">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-300">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-300 hover:bg-ink-600 hover:text-ink-100"
            aria-label="Close"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function NewDmModal({
  users,
  meId,
  onClose,
  onCreated,
}: {
  users: ChatMember[];
  meId: string;
  onClose: () => void;
  onCreated: (c: ChatConversation) => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const filtered = users.filter(
    (u) =>
      u.id !== meId &&
      (u.name.toLowerCase().includes(q.toLowerCase()) ||
        u.email.toLowerCase().includes(q.toLowerCase())),
  );

  async function openDm(input: { userId?: string; email?: string }) {
    setBusy(true);
    try {
      const { conversation } = await createDm(input);
      onCreated(conversation);
      onClose();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Enter an email address');
      return;
    }
    await openDm({ email: trimmed });
  }

  return (
    <ModalShell
      onClose={onClose}
      title="New chat"
      subtitle="Project members, or anyone on DockX by email"
    >
      <form onSubmit={onEmailSubmit} className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-ink-200">
          Chat by email
        </label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            disabled={busy}
          />
          <Button type="submit" size="sm" disabled={busy}>
            Start
          </Button>
        </div>
        <p className="text-[11px] text-ink-300">
          They must already have a DockX account.
        </p>
      </form>

      <div className="mt-4 border-t border-ink-700 pt-3">
        <p className="mb-2 text-xs font-medium text-ink-200">Shared project members</p>
        <Input
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-300">
            {users.filter((u) => u.id !== meId).length === 0
              ? 'No shared project members — use email above'
              : 'No people found'}
          </p>
        ) : (
          filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => openDm({ userId: u.id })}
              className="flex w-full items-center gap-3 border-b border-ink-700 px-1 py-2.5 text-left hover:bg-ink-900 disabled:opacity-50"
            >
              <UserAvatar name={u.name} src={u.avatarUrl} seed={u.id} size="lg" className="!h-9 !w-9" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block truncate text-sm font-semibold text-ink-50">{u.name}</span>
                  {u.checkedIn ? (
                    <span className="shrink-0 text-[10px] font-semibold text-[#57f287]">
                      In
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-ink-300">{u.email}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </ModalShell>
  );
}

function NewGroupModal({
  users,
  meId,
  onClose,
  onCreated,
}: {
  users: ChatMember[];
  meId: string;
  onClose: () => void;
  onCreated: (c: ChatConversation) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const others = users.filter((u) => u.id !== meId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onPickAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Group photo must be an image');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let { conversation } = await createGroup({
        name: name.trim(),
        memberIds: [...selected],
      });
      if (avatarFile) {
        const uploaded = await uploadGroupAvatar(conversation.id, avatarFile);
        conversation = uploaded.conversation;
      }
      onCreated(conversation);
      onClose();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      onClose={onClose}
      title="New group"
      subtitle="Pick members from your shared projects"
    >
      <form onSubmit={onSubmit} className="mt-3 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Add group photo"
            onClick={() => avatarRef.current?.click()}
            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-700 text-white"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconUsers className="h-5 w-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <Input
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <button
              type="button"
              className="mt-1.5 text-xs font-semibold text-brand-700 hover:underline"
              onClick={() => avatarRef.current?.click()}
            >
              {avatarPreview ? 'Change photo' : 'Add group photo'}
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickAvatar(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto border border-ink-700">
          {others.map((u) => {
            const on = selected.has(u.id);
            return (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 border-b border-ink-700 px-3 py-2 hover:bg-ink-900"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(u.id)}
                  className="h-4 w-4 accent-brand-700"
                />
                <UserAvatar name={u.name} src={u.avatarUrl} seed={u.id} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-50">{u.name}</span>
                  <span className="block truncate text-xs text-ink-300">{u.email}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy || !name.trim() || selected.size === 0}>
            Create group
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function GroupManagePanel({
  conversation,
  users,
  meId,
  onUpdated,
  onClose,
}: {
  conversation: ChatConversation;
  users: ChatMember[];
  meId: string;
  onUpdated: (c: ChatConversation) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(conversation.rawName || conversation.name);
  const [busy, setBusy] = useState(false);
  const [addIds, setAddIds] = useState<Set<string>>(new Set());
  const [memberToRemove, setMemberToRemove] = useState<ChatMember | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const isCreator = conversation.createdBy === meId;
  const memberSet = new Set(conversation.memberIds);
  const candidates = users.filter((u) => !memberSet.has(u.id));

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { conversation: next } = await updateGroup(conversation.id, { name: name.trim() });
      onUpdated(next);
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Group photo must be an image');
      return;
    }
    setBusy(true);
    try {
      const { conversation: next } = await uploadGroupAvatar(conversation.id, file);
      onUpdated(next);
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusy(false);
    }
  }

  async function addMembers() {
    if (addIds.size === 0) return;
    setBusy(true);
    try {
      const { conversation: next } = await addGroupMembers(conversation.id, [...addIds]);
      onUpdated(next);
      setAddIds(new Set());
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove) return;
    setBusy(true);
    try {
      const { conversation: next } = await removeGroupMember(
        conversation.id,
        memberToRemove.id,
      );
      setMemberToRemove(null);
      onUpdated(next);
      if (memberToRemove.id === meId) onClose();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setBusy(false);
    }
  }

  const leaving = memberToRemove?.id === meId;

  return (
    <>
    <ModalShell
      onClose={onClose}
      title="Group info"
      subtitle={`${conversation.members.length} members`}
    >
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          title="Change group photo"
          disabled={busy}
          onClick={() => avatarRef.current?.click()}
          className="relative shrink-0 overflow-hidden rounded-full disabled:opacity-50"
        >
          <ConversationAvatar conversation={conversation} meId={meId} size="xl" />
        </button>
        <div className="min-w-0 flex-1">
          <form onSubmit={saveName} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
          </form>
          <button
            type="button"
            disabled={busy}
            className="mt-1.5 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
            onClick={() => avatarRef.current?.click()}
          >
            {conversation.avatarUrl ? 'Change group photo' : 'Add group photo'}
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onAvatarChange(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Members</p>
        <div className="mt-2 max-h-40 overflow-y-auto">
          {conversation.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 border-b border-ink-700 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-50">
                  {m.name}
                  {m.id === meId ? ' (you)' : ''}
                  {m.id === conversation.createdBy ? (
                    <span className="ml-1 text-[10px] font-semibold text-brand-700">Admin</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-300">{m.email}</p>
              </div>
              {(isCreator && m.id !== meId) || m.id === meId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => setMemberToRemove(m)}
                >
                  {m.id === meId ? 'Leave' : 'Remove'}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {candidates.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">Add members</p>
          <div className="mt-2 max-h-36 overflow-y-auto border border-ink-700">
            {candidates.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 border-b border-ink-700 px-2 py-1.5 text-sm hover:bg-ink-900"
              >
                <input
                  type="checkbox"
                  checked={addIds.has(u.id)}
                  onChange={() =>
                    setAddIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(u.id)) next.delete(u.id);
                      else next.add(u.id);
                      return next;
                    })
                  }
                />
                {u.name}
              </label>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={busy || addIds.size === 0}
            onClick={addMembers}
          >
            Add selected
          </Button>
        </div>
      ) : null}
    </ModalShell>

    <ConfirmModal
      open={Boolean(memberToRemove)}
      title={leaving ? 'Leave group?' : 'Remove member?'}
      message={
        leaving
          ? 'You’ll leave this group and won’t see new messages unless you’re added again.'
          : memberToRemove
            ? `Remove ${memberToRemove.name} from this group?`
            : ''
      }
      confirmLabel={leaving ? 'Leave' : 'Remove'}
      danger
      busy={busy}
      onCancel={() => setMemberToRemove(null)}
      onConfirm={() => confirmRemoveMember()}
    />
    </>
  );
}

export function ChatPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { online } = useOffline();
  const meId = user?.id ?? '';
  const {
    call,
    activeRooms,
    socketReady,
    socketRetrying,
    reconnectSocket,
    focusConversationId,
    clearFocusConversationId,
    startCall,
    joinGroupCall,
  } = useCall();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'dm' | 'group'>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConversationId = searchParams.get('c');
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [mediaPreview, setMediaPreview] = useState<ChatAttachment | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  /** Skeleton only when there is no local cache yet (first open). */
  const [showListSkeleton, setShowListSkeleton] = useState(true);
  const [showThreadSkeleton, setShowThreadSkeleton] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [orgUsers, setOrgUsers] = useState<ChatMember[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceUser>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<'dm' | 'group' | 'manage' | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<ChatMessage | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordError, setRecordError] = useState('');
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const prevActiveIdForScrollRef = useRef<string | null>(null);
  /** Keep pin-to-bottom unless the user scrolls up to read history. */
  const stickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const hasMoreOlderRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const typingTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  /** In-memory thread cache for instant chat switches (backed by SQLite). */
  const threadCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());

  activeIdRef.current = activeId;
  messagesRef.current = messages;
  hasMoreOlderRef.current = hasMoreOlder;

  useEffect(() => {
    if (!focusConversationId) return;
    setActiveId(focusConversationId);
    clearFocusConversationId();
  }, [focusConversationId, clearFocusConversationId]);

  useEffect(() => {
    if (!deepLinkConversationId) return;
    setActiveId(deepLinkConversationId);
    const next = new URLSearchParams(searchParams);
    next.delete('c');
    next.delete('m');
    setSearchParams(next, { replace: true });
  }, [deepLinkConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function scrollThreadToBottom() {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  const loadOlderMessages = useCallback(async () => {
    if (!activeId || !meId || !online) return;
    if (loadingOlderRef.current || !hasMoreOlderRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest?.createdAt) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = threadScrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;

    try {
      const page = await fetchOlderMessagesPage(meId, activeId, oldest.createdAt, 40);
      if (!page) {
        hasMoreOlderRef.current = false;
        setHasMoreOlder(false);
        return;
      }
      hasMoreOlderRef.current = page.hasMore;
      setHasMoreOlder(page.hasMore);
      if (page.messages.length === 0) return;

      setMessages((prev) => {
        const merged = mergeMessagesById(prev, page.messages);
        threadCacheRef.current.set(activeId, merged);
        return merged;
      });

      requestAnimationFrame(() => {
        const node = threadScrollRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight - prevHeight + prevTop;
      });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [activeId, meId, online]);

  function onThreadScroll() {
    const el = threadScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
    if (el.scrollTop < 80) {
      void loadOlderMessages();
    }
  }

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (listFilter === 'dm' && c.type !== 'dm') return false;
      if (listFilter === 'group' && c.type !== 'group') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q) ||
        c.members.some((m) => m.name.toLowerCase().includes(q))
      );
    });
  }, [conversations, query, listFilter]);

  const typingLabel = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return 'Several people are typing…';
  }, [typingUsers]);

  const peerPresence = useMemo(() => {
    if (!active) return null;
    if (active.type === 'dm') {
      const otherId = active.memberIds.find((id) => id !== meId);
      return otherId ? presence[otherId] ?? null : null;
    }
    const others = active.memberIds.filter((id) => id !== meId);
    const checkedInCount = others.filter((id) => presence[id]?.checkedIn).length;
    return { checkedInCount, total: others.length };
  }, [active, meId, presence]);

  const refreshList = useCallback(
    async (preferId?: string) => {
      if (!meId) return;
      const list = await loadConversations(meId);
      setConversations(list);
      setActiveId((prev) => {
        if (preferId && list.some((c) => c.id === preferId)) return preferId;
        if (prev && list.some((c) => c.id === prev)) return prev;
        const wide =
          typeof window !== 'undefined' &&
          window.matchMedia('(min-width: 768px)').matches;
        return wide ? (list[0]?.id ?? null) : null;
      });
    },
    [meId],
  );

  const upsertConversationQuiet = useCallback(
    (c: ChatConversation) => {
      setConversations((prev) =>
        sortConversationsByRecent([c, ...prev.filter((x) => x.id !== c.id)]),
      );
      if (meId) void upsertCachedConversation(meId, c);
    },
    [meId],
  );

  useEffect(() => {
    if (!meId) return;
    let cancelled = false;

    (async () => {
      // 1) Paint from SQLite immediately (WhatsApp-style)
      const local = await openConversationsFromLocal(meId);
      if (cancelled) return;
      if (local.conversations.length > 0) {
        setConversations(local.conversations);
        setActiveId((prev) => {
          if (prev) return prev;
          const wide =
            typeof window !== 'undefined' &&
            window.matchMedia('(min-width: 768px)').matches;
          return wide ? (local.conversations[0]?.id ?? null) : null;
        });
        setShowListSkeleton(false);
      } else {
        setShowListSkeleton(true);
      }

      // 2) Users list + background conversation sync (no full-page reload flicker)
      const [{ users }, remote] = await Promise.all([
        listChatUsers().catch(() => ({ users: [] as ChatMember[] })),
        syncConversationsFromApi(meId),
      ]);
      if (cancelled) return;
      setOrgUsers(users);
      setPresence((prev) => {
        const next = { ...prev };
        for (const u of users) {
          next[u.id] = {
            userId: u.id,
            checkedIn: Boolean(u.checkedIn),
            // Prefer live socket presence; fall back to API online flag
            online: prev[u.id]?.online ?? Boolean(u.online),
          };
        }
        return next;
      });
      if (remote) {
        setConversations(remote);
        setActiveId((prev) => {
          if (prev && remote.some((c) => c.id === prev)) return prev;
          if (prev) return prev;
          const wide =
            typeof window !== 'undefined' &&
            window.matchMedia('(min-width: 768px)').matches;
          return wide ? (remote[0]?.id ?? null) : null;
        });
      }
      setShowListSkeleton(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [meId]);

  useEffect(() => {
    if (!user) return;

    patchChatSocketHandlers({
      onPresenceSnapshot: (users) => {
        setPresence((prev) => {
          const next = { ...prev };
          for (const u of users) next[u.userId] = u;
          return next;
        });
      },
      onPresenceUpdate: (u) => {
        setPresence((prev) => ({
          ...prev,
          [u.userId]: {
            userId: u.userId,
            checkedIn: Boolean(u.checkedIn),
            online: Boolean(u.online),
          },
        }));
        setOrgUsers((prev) =>
          prev.map((m) =>
            m.id === u.userId
              ? { ...m, checkedIn: u.checkedIn, online: u.online }
              : m,
          ),
        );
      },
      onMessageNew: (message) => {
        void upsertLiveMessage(meId, message);
        const convId = message.conversationId;
        const prev = threadCacheRef.current.get(convId) ?? [];
        // Prefer replacing our optimistic bubble instead of duplicating
        let next: ChatMessage[];
        if (message.senderId === meId) {
          const opt = [...prev]
            .reverse()
            .find((m) => {
              if (
                !m.id.startsWith('lmsg_') ||
                m.senderId !== meId ||
                (m.localState !== 'sending' && m.localState !== 'failed')
              ) {
                return false;
              }
              if (m.body !== message.body) return false;
              if (m.attachments.length !== message.attachments.length) return false;
              // Voice notes often have empty body — match by attachment fingerprint.
              if (m.attachments.length > 0) {
                const a = m.attachments[0]!;
                const b = message.attachments[0]!;
                return (
                  a.kind === b.kind &&
                  a.name === b.name &&
                  Math.abs((a.size || 0) - (b.size || 0)) < 2048
                );
              }
              return true;
            });
          next = opt
            ? replaceMessageById(prev, opt.id, { ...message, localState: null })
            : appendMessageSorted(prev, { ...message, localState: null });
        } else {
          next = appendMessageSorted(prev, message);
        }
        threadCacheRef.current.set(convId, next);
        if (convId === activeIdRef.current) {
          setMessages(next);
          if (message.senderId !== meId) {
            emitMessagesRead(convId);
          }
        }
      },
      onMessageEdited: (message) => {
        void upsertLiveMessage(meId, message);
        const convId = message.conversationId;
        const prev = threadCacheRef.current.get(convId) ?? [];
        const next = sortMessagesByTime(
          prev.map((m) => (m.id === message.id ? message : m)),
        );
        threadCacheRef.current.set(convId, next);
        if (convId === activeIdRef.current) setMessages(next);
      },
      onMessageDeleted: (message) => {
        void upsertLiveMessage(meId, message);
        const convId = message.conversationId;
        const prev = threadCacheRef.current.get(convId) ?? [];
        const next = sortMessagesByTime(
          prev.map((m) => (m.id === message.id ? message : m)),
        );
        threadCacheRef.current.set(convId, next);
        if (convId === activeIdRef.current) setMessages(next);
      },
      onMessageStatus: (update) => {
        const convId = update.conversationId;
        const prev = threadCacheRef.current.get(convId) ?? [];
        const next = prev.map((m) =>
          m.id === update.messageId
            ? { ...m, status: update.status, receipts: update.receipts }
            : m,
        );
        threadCacheRef.current.set(convId, next);
        if (convId === activeIdRef.current) setMessages(next);
      },
      onTyping: (update) => {
        if (update.conversationId !== activeIdRef.current) return;
        if (update.userId === meId) return;
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (update.typing) next[update.userId] = update.userName || 'Someone';
          else delete next[update.userId];
          return next;
        });
      },
      onConversationUpsert: (conversation) => {
        upsertConversationQuiet(conversation);
      },
      onConversationRemoved: (conversationId) => {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        setActiveId((prev) => (prev === conversationId ? null : prev));
      },
    });

    // Socket is owned by Auth/CallProvider for the whole session — just ensure it's up
    if (online && !getChatSocket()?.connected) {
      void connectChatSocket().then((s) => {
        if (s?.connected) requestPresenceSnapshot();
      });
    } else if (getChatSocket()?.connected) {
      // Snapshot may have fired before Chat mounted — refresh online flags now
      requestPresenceSnapshot();
    }

    return () => {
      clearChatSocketHandlerKeys([
        'onPresenceSnapshot',
        'onPresenceUpdate',
        'onMessageNew',
        'onMessageEdited',
        'onMessageDeleted',
        'onMessageStatus',
        'onTyping',
        'onConversationUpsert',
        'onConversationRemoved',
      ]);
    };
  }, [user, meId, upsertConversationQuiet, online]);

  useEffect(() => {
    setAttachMenuOpen(false);
    setRecordError('');
    if (mediaRecorderRef.current?.state === 'recording') {
      cancelAudioNote();
    }

    if (!activeId || !meId) {
      setMessages([]);
      setTypingUsers({});
      setShowThreadSkeleton(false);
      setFiles([]);
      return;
    }
    let cancelled = false;
    const prevId = activeId;

    setReplyTo(null);
    setEditing(null);
    closeMessageMenus();
    setTypingUsers({});
    setFiles([]);
    setHasMoreOlder(false);
    hasMoreOlderRef.current = false;
    loadingOlderRef.current = false;

      // Instant paint from memory if we already opened this chat
    const mem = threadCacheRef.current.get(activeId);
    if (mem) {
      setMessages(sortMessagesByTime(mem));
      setShowThreadSkeleton(false);
    } else {
      // Avoid flashing the previous chat while SQLite loads
      setMessages([]);
      setShowThreadSkeleton(true);
    }

    (async () => {
      // 1) SQLite local thread — sorted by timestamp (oldest → newest)
      const local = await openMessagesFromLocal(meId, activeId);
      if (cancelled) return;
      const localSorted = sortMessagesByTime(local.messages);
      threadCacheRef.current.set(activeId, localSorted);
      setMessages(localSorted);
      // Skeleton only on true first open (nothing in local DB yet)
      setShowThreadSkeleton(!local.hasCache && localSorted.length === 0);

      if (online) joinConversation(activeId);

      // 2) Background: newer messages + whether older history may exist
      if (online) {
        if (!local.hasCache || localSorted.length === 0) {
          const page = await fetchLatestMessagesPage(meId, activeId, 40);
          if (!cancelled && page) {
            threadCacheRef.current.set(activeId, page.messages);
            setMessages(page.messages);
            hasMoreOlderRef.current = page.hasMore;
            setHasMoreOlder(page.hasMore);
          }
        } else {
          const merged = await syncLatestMessagesFromApi(meId, activeId);
          if (!cancelled && merged) {
            const sorted = sortMessagesByTime(merged);
            threadCacheRef.current.set(activeId, sorted);
            setMessages(sorted);
          }
          // Assume more history until a scroll-up page says otherwise
          if (!cancelled) {
            hasMoreOlderRef.current = true;
            setHasMoreOlder(true);
          }
        }
      }
      if (!cancelled) setShowThreadSkeleton(false);
    })();

    return () => {
      cancelled = true;
      leaveConversation(prevId);
      if (isTypingRef.current) {
        emitTypingStop(prevId);
        isTypingRef.current = false;
      }
    };
  }, [activeId, meId, online]);

  // Subscribe to every group conversation so all members receive live call:room updates
  useEffect(() => {
    if (!online || !socketReady) return;
    for (const c of conversations) {
      if (c.type === 'group') joinConversation(c.id);
    }
  }, [conversations, online, socketReady]);

  // Position at latest messages before paint — no visible smooth-scroll jump.
  useLayoutEffect(() => {
    if (!activeId || showThreadSkeleton) return;

    const switched = prevActiveIdForScrollRef.current !== activeId;
    if (switched) {
      prevActiveIdForScrollRef.current = activeId;
      stickToBottomRef.current = true;
    }

    if (switched || stickToBottomRef.current) {
      scrollThreadToBottom();
    }
  }, [activeId, messages, showThreadSkeleton, typingLabel]);

  function upsertConversation(c: ChatConversation) {
    upsertConversationQuiet(c);
    setActiveId(c.id);
  }

  function notifyTyping() {
    if (!activeId || editing) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTypingStart(activeId);
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      if (activeId && isTypingRef.current) {
        emitTypingStop(activeId);
        isTypingRef.current = false;
      }
    }, 1600);
  }

  function addFiles(list: File[]) {
    if (!list.length) return;
    setFiles((prev) => [...prev, ...list].slice(0, 5));
  }

  function openAttachPicker(kind: AttachPickerKind) {
    setAttachMenuOpen(false);
    const ref =
      kind === 'photo'
        ? photoInputRef
        : kind === 'gallery'
          ? galleryInputRef
          : kind === 'document'
            ? documentInputRef
            : audioInputRef;
    ref.current?.click();
  }

  function stopRecordTracks() {
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
  }

  function clearRecordTimer() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function startAudioNote() {
    setAttachMenuOpen(false);
    setRecordError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError('Audio recording is not supported in this environment.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      // Prefer mp4/aac — WebKit (Tauri/Safari) cannot play webm/opus voice notes.
      const mimeCandidates = [
        'audio/mp4',
        'audio/aac',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];
      const mimeType =
        mimeCandidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        clearRecordTimer();
        stopRecordTracks();
        const rawType = recorder.mimeType || mimeType || 'audio/mp4';
        const blobType = rawType.split(';')[0]?.trim() || 'audio/mp4';
        const blob = new Blob(recordChunksRef.current, { type: blobType });
        recordChunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecording(false);
        if (blob.size < 200) return;
        const ext = blobType.includes('mp4') || blobType.includes('aac')
          ? 'm4a'
          : blobType.includes('ogg')
            ? 'ogg'
            : 'webm';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const file = new File([blob], `voice-note-${stamp}.${ext}`, {
          type: blobType,
        });
        addFiles([file]);
      };
      // Timeslice keeps data flowing; some WebKit builds emit nothing without it.
      recorder.start(250);
      setRecording(true);
      setRecordSecs(0);
      clearRecordTimer();
      recordTimerRef.current = window.setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000);
    } catch {
      stopRecordTracks();
      setRecording(false);
      setRecordError('Microphone permission is required to record audio notes.');
    }
  }

  function stopAudioNote() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      clearRecordTimer();
      stopRecordTracks();
      setRecording(false);
    }
  }

  function cancelAudioNote() {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = () => {
        clearRecordTimer();
        stopRecordTracks();
        recordChunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecording(false);
      };
      if (recorder.state !== 'inactive') recorder.stop();
      else {
        clearRecordTimer();
        stopRecordTracks();
        recordChunksRef.current = [];
        mediaRecorderRef.current = null;
        setRecording(false);
      }
    } else {
      clearRecordTimer();
      stopRecordTracks();
      setRecording(false);
    }
  }

  useEffect(() => {
    if (!attachMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!attachMenuRef.current?.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [attachMenuOpen]);

  useEffect(() => {
    return () => {
      clearRecordTimer();
      stopRecordTracks();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!activeId || !user) return;
    const body = draft.trim();
    if (!body && files.length === 0 && !editing) return;

    if (isTypingRef.current) {
      emitTypingStop(activeId);
      isTypingRef.current = false;
    }

    // Edit stays blocking (small payload)
    if (editing) {
      setSending(true);
      try {
        const { message } = await editMessage(editing.id, body);
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
        setEditing(null);
        setDraft('');
      } catch (err) {
        toast.fromError(err);
      } finally {
        setSending(false);
      }
      return;
    }

    const conversationId = activeId;
    const stagedFiles = [...files];
    const stagedReply = replyTo;
    const jobInput = {
      userId: user.id,
      userName: user.name,
      userAvatarUrl: user.avatarUrl,
      conversationId,
      body,
      replyToId: stagedReply?.id,
      replyPreview: stagedReply
        ? {
            id: stagedReply.id,
            body: stagedReply.body,
            senderName: stagedReply.senderName,
            deleted: Boolean(stagedReply.deletedAt),
          }
        : null,
      files: stagedFiles,
    };

    // WhatsApp-style: clear composer immediately so the next message can be typed
    setDraft('');
    setFiles([]);
    setReplyTo(null);
    stickToBottomRef.current = true;

    const optimistic = buildOptimisticMessage(jobInput);
    setMessages((prev) => {
      const next = appendMessageSorted(prev, optimistic.message);
      threadCacheRef.current.set(conversationId, next);
      return next;
    });
    void persistOptimisticLocal(user.id, optimistic.message);
    void refreshList(conversationId);

    chatSendQueue.enqueue(optimistic, jobInput, {
      onSuccess: (server, localId) => {
        setMessages((prev) => {
          const base =
            activeIdRef.current === conversationId
              ? prev
              : threadCacheRef.current.get(conversationId) ?? prev;
          const next = replaceMessageById(base, localId, server);
          threadCacheRef.current.set(conversationId, next);
          if (activeIdRef.current === conversationId) return next;
          return prev;
        });
        void refreshList(conversationId);
      },
      onFailure: (err, localId) => {
        toast.fromError(err);
        setMessages((prev) => {
          const patch = (list: ChatMessage[]) =>
            list.map((m) =>
              m.id === localId ? { ...m, localState: 'failed' as const } : m,
            );
          const base =
            activeIdRef.current === conversationId
              ? prev
              : threadCacheRef.current.get(conversationId) ?? prev;
          const next = patch(base);
          threadCacheRef.current.set(conversationId, next);
          if (activeIdRef.current === conversationId) return next;
          return prev;
        });
        void markOptimisticFailed(localId, user.id);
      },
    });
  }

  function closeMessageMenus() {
    setMenuMsgId(null);
    setActionMsgId(null);
    setMenuPos(null);
  }

  function requestDelete(msg: ChatMessage) {
    closeMessageMenus();
    setDeleteMsg(msg);
  }

  function requestForward(msg: ChatMessage) {
    closeMessageMenus();
    setForwardMsg(msg);
  }

  async function confirmForward(targetId: string) {
    if (!forwardMsg) return;
    setForwardBusy(true);
    try {
      const { message, conversation } = await forwardMessage(forwardMsg.id, targetId);
      upsertConversationQuiet(conversation);
      if (activeId === targetId) {
        setMessages((prev) => {
          const next = appendMessageSorted(prev, message);
          threadCacheRef.current.set(targetId, next);
          return next;
        });
      }
      setForwardMsg(null);
      setActiveId(targetId);
    } catch (err) {
      toast.fromError(err);
    } finally {
      setForwardBusy(false);
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteMsg) return;
    setDeletingMsg(true);
    try {
      const { message } = await deleteMessage(deleteMsg.id);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      setDeleteMsg(null);
    } catch (err) {
      toast.fromError(err);
    } finally {
      setDeletingMsg(false);
    }
  }

  function startEdit(msg: ChatMessage) {
    closeMessageMenus();
    setEditing(msg);
    setReplyTo(null);
    setDraft(msg.body);
    setFiles([]);
  }

  function startReply(msg: ChatMessage) {
    closeMessageMenus();
    setReplyTo(msg);
    setEditing(null);
  }

  function openMessageActions(msgId: string) {
    setActionMsgId(msgId);
    setMenuMsgId(null);
    setMenuPos(null);
  }

  function toggleMoreMenu(msg: ChatMessage, anchor: HTMLElement) {
    if (menuMsgId === msg.id) {
      setMenuMsgId(null);
      setMenuPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 148;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setActionMsgId(msg.id);
    setMenuMsgId(msg.id);
    setMenuPos({ top: Math.min(rect.bottom + 6, window.innerHeight - 160), left });
  }

  const actionMessage = useMemo(
    () => (actionMsgId ? messages.find((m) => m.id === actionMsgId) ?? null : null),
    [actionMsgId, messages],
  );
  const menuMessage = useMemo(
    () => (menuMsgId ? messages.find((m) => m.id === menuMsgId) ?? null : null),
    [menuMsgId, messages],
  );

  useEffect(() => {
    if (!actionMsgId && !menuMsgId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMessageMenus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionMsgId, menuMsgId]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-ink-900">
      {/* Sidebar — full width on mobile until a chat is opened */}
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-ink-600/80 bg-ink-800 md:w-[300px]',
          activeId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="text-[15px] font-semibold tracking-tight text-ink-50">Messages</h1>
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  socketReady
                    ? 'bg-[#23a559]'
                    : online
                      ? 'bg-[#f0b232]'
                      : 'bg-ink-400',
                )}
                title={
                  socketReady
                    ? 'Live'
                    : online
                      ? 'Connecting…'
                      : 'Offline'
                }
              />
              {!socketReady && online ? (
                <button
                  type="button"
                  className="truncate text-[11px] font-medium text-ink-400 hover:text-ink-100 disabled:opacity-60"
                  disabled={socketRetrying}
                  title="Reconnect"
                  onClick={() => {
                    void reconnectSocket();
                  }}
                >
                  {socketRetrying ? 'Connecting…' : 'Reconnect'}
                </button>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                title="New direct message"
                onClick={() => setModal('dm')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50"
              >
                <IconPlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="New team chat"
                onClick={() => setModal('group')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50"
              >
                <IconUsers className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative mt-2.5">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-lg border-0 bg-ink-900/70 pr-3 pl-9 text-sm text-ink-50 outline-none placeholder:text-ink-400 ring-1 ring-ink-600/60 transition focus:bg-ink-900 focus:ring-brand-500/50"
            />
          </div>

          <div className="mt-2.5 flex rounded-lg bg-ink-900/60 p-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'dm', label: 'Direct' },
                { id: 'group', label: 'Team' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setListFilter(f.id)}
                className={cn(
                  'h-7 flex-1 rounded-md text-[12px] font-medium transition-colors',
                  listFilter === f.id
                    ? 'bg-ink-700 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {showListSkeleton ? (
            <ChatListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-ink-200">
                {listFilter === 'dm'
                  ? 'No direct chats'
                  : listFilter === 'group'
                    ? 'No team chats'
                    : query.trim()
                      ? 'No matches'
                      : 'No conversations yet'}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {listFilter === 'dm'
                  ? 'Start a DM to message someone.'
                  : listFilter === 'group'
                    ? 'Create a group for your team.'
                    : 'Use + to start a DM or team chat.'}
              </p>
            </div>
          ) : (
            filtered.map((c) => {
              const selected = c.id === activeId;
              const peerId =
                c.type === 'dm' ? c.memberIds.find((id) => id !== meId) : undefined;
              const peer = peerId ? presence[peerId] : undefined;
              const liveCall = c.type === 'group' ? activeRooms[c.id] : undefined;
              const preview = liveCall
                ? `${liveCall.participantCount} in call · tap to join`
                : c.lastMessagePreview ||
                  (c.type === 'group' ? 'Team chat' : 'Direct message');
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                    selected
                      ? 'bg-ink-700/90'
                      : 'hover:bg-ink-700/50',
                  )}
                >
                  <span className="relative shrink-0">
                    <ConversationAvatar conversation={c} meId={meId} size="lg" />
                    {c.type === 'dm' ? (
                      <PresenceDot checkedIn={peer?.checkedIn} online={peer?.online} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink-50">
                        {c.name}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-ink-400">
                        {liveCall ? (
                          <span className="font-semibold text-[#23a559]">Live</span>
                        ) : (
                          formatTime(c.lastMessageAt)
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-[12px]',
                        liveCall ? 'font-medium text-[#23a559]' : 'text-ink-400',
                      )}
                    >
                      {preview}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread — full screen on mobile when a chat is selected */}
      <section
        className={cn(
          'min-w-0 flex-1 flex-col bg-ink-700',
          activeId ? 'flex' : 'hidden md:flex',
        )}
      >
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-ink-400">
              <IconUsers className="h-7 w-7" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-100">Select a conversation</p>
              <p className="mt-1 max-w-xs text-xs text-ink-400">
                Pick a chat from the left, or start a new direct or team conversation.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-ink-600/70 bg-ink-800/80 px-2 backdrop-blur-sm sm:px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  aria-label="Back to chats"
                  title="Back to chats"
                  onClick={() => setActiveId(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50 md:hidden"
                >
                  <IconChevronLeft className="h-5 w-5" />
                </button>
                <span className="relative shrink-0">
                  <ConversationAvatar conversation={active} meId={meId} size="md" />
                  {active.type === 'dm' && peerPresence && 'checkedIn' in peerPresence ? (
                    <PresenceDot
                      checkedIn={peerPresence.checkedIn}
                      online={peerPresence.online}
                    />
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink-50">{active.name}</p>
                  <p className="truncate text-[11px] text-ink-400">
                    {typingLabel ? (
                      <span className="font-medium text-brand-300">{typingLabel}</span>
                    ) : active.type === 'group' ? (
                      <>
                        {active.members.length} members
                        {peerPresence && 'checkedInCount' in peerPresence
                          ? ` · ${peerPresence.checkedInCount} checked in`
                          : ''}
                      </>
                    ) : peerPresence && 'checkedIn' in peerPresence ? (
                      peerPresence.online ? (
                        <span className="text-[#23a559]">
                          Online
                          {peerPresence.checkedIn ? ' · checked in' : ''}
                        </span>
                      ) : peerPresence.checkedIn ? (
                        <span className="text-[#f0b232]">Checked in · offline for calls</span>
                      ) : (
                        'Offline'
                      )
                    ) : (
                      active.members.find((m) => m.id !== meId)?.email ?? 'Direct message'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {active.type === 'dm' || active.type === 'group' ? (
                  <>
                    <button
                      type="button"
                      title={
                        !socketReady
                          ? 'Connecting…'
                          : call.phase !== 'idle'
                            ? 'Already in a call'
                            : active.type === 'dm' &&
                                !(peerPresence && 'online' in peerPresence && peerPresence.online)
                              ? 'Peer is offline for calls'
                              : active.type === 'group'
                                ? 'Group audio call'
                                : 'Audio call'
                      }
                      disabled={
                        !socketReady ||
                        call.phase !== 'idle' ||
                        (active.type === 'dm' &&
                          !(peerPresence && 'online' in peerPresence && peerPresence.online))
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-35"
                      onClick={() => {
                        if (active.type === 'group') {
                          void startCall({
                            conversationId: active.id,
                            conversationName: active.name,
                            mediaKind: 'audio',
                            isGroup: true,
                          }).catch((err) => {
                            toast.fromError(err, 'Could not start call');
                          });
                          return;
                        }
                        const peerId = active.memberIds.find((id) => id !== meId);
                        if (!peerId) return;
                        void startCall({
                          conversationId: active.id,
                          peerUserId: peerId,
                          peerName: active.name,
                          mediaKind: 'audio',
                        }).catch((err) => {
                          toast.fromError(err, 'Could not start call');
                        });
                      }}
                    >
                      <IconPhone className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={
                        !socketReady
                          ? 'Connecting…'
                          : call.phase !== 'idle'
                            ? 'Already in a call'
                            : active.type === 'dm' &&
                                !(peerPresence && 'online' in peerPresence && peerPresence.online)
                              ? 'Peer is offline for calls'
                              : active.type === 'group'
                                ? 'Group video call'
                                : 'Video call'
                      }
                      disabled={
                        !socketReady ||
                        call.phase !== 'idle' ||
                        (active.type === 'dm' &&
                          !(peerPresence && 'online' in peerPresence && peerPresence.online))
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-35"
                      onClick={() => {
                        if (active.type === 'group') {
                          void startCall({
                            conversationId: active.id,
                            conversationName: active.name,
                            mediaKind: 'video',
                            isGroup: true,
                          }).catch((err) => {
                            toast.fromError(err, 'Could not start video call');
                          });
                          return;
                        }
                        const peerId = active.memberIds.find((id) => id !== meId);
                        if (!peerId) return;
                        void startCall({
                          conversationId: active.id,
                          peerUserId: peerId,
                          peerName: active.name,
                          mediaKind: 'video',
                        }).catch((err) => {
                          toast.fromError(err, 'Could not start video call');
                        });
                      }}
                    >
                      <IconVideo className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
                {active.type === 'group' ? (
                  <button
                    type="button"
                    title="Manage group"
                    onClick={() => setModal('manage')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 transition hover:bg-ink-700 hover:text-ink-50"
                  >
                    <IconUsers className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </header>

            {active.type === 'group' &&
            activeRooms[active.id] &&
            !(call.phase !== 'idle' && call.conversationId === active.id) ? (
              <div className="flex flex-col gap-2 border-b border-ink-600/70 bg-[#23a559]/10 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#23a559]/20 text-[#23a559]">
                    <IconPhone className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-50">
                      {activeRooms[active.id]!.mediaKind === 'video' ? 'Video' : 'Voice'} call in
                      progress
                    </p>
                    <p className="truncate text-[11px] text-ink-300">
                      {activeRooms[active.id]!.participantCount} joined
                      {active.members.length > activeRooms[active.id]!.participantCount
                        ? ` · ${active.members.length - activeRooms[active.id]!.participantCount} not in call`
                        : ''}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 rounded-lg"
                  disabled={!socketReady || call.phase !== 'idle'}
                  onClick={() => {
                    const room = activeRooms[active.id];
                    if (!room) return;
                    void joinGroupCall({
                      conversationId: active.id,
                      callId: room.callId,
                      mediaKind: room.mediaKind,
                      conversationName: active.name,
                    }).catch((err) => {
                      toast.fromError(err, 'Could not join call');
                    });
                  }}
                >
                  Join call
                </Button>
              </div>
            ) : null}

            <div
              ref={threadScrollRef}
              onScroll={onThreadScroll}
              className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 sm:px-5"
            >
              {loadingOlder ? (
                <div className="flex justify-center py-1">
                  <span className="text-[11px] font-medium text-ink-400">Loading earlier messages…</span>
                </div>
              ) : hasMoreOlder && messages.length > 0 ? (
                <div className="flex justify-center py-1">
                  <button
                    type="button"
                    className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                    onClick={() => void loadOlderMessages()}
                  >
                    Load earlier messages
                  </button>
                </div>
              ) : null}
              {showThreadSkeleton ? (
                <ChatThreadSkeleton />
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-1 text-center">
                  <p className="text-sm font-medium text-ink-200">No messages yet</p>
                  <p className="text-xs text-ink-400">Say hello to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const mine = msg.senderId === meId;
                  const deleted = Boolean(msg.deletedAt);
                  const prev = messages[i - 1];
                  const next = messages[i + 1];
                  const showDay =
                    !prev || formatDay(prev.createdAt) !== formatDay(msg.createdAt);
                  const isCall = msg.type === 'call' && msg.call;
                  const sameSenderAsPrev =
                    !!prev &&
                    prev.type !== 'call' &&
                    msg.type !== 'call' &&
                    prev.senderId === msg.senderId &&
                    formatDay(prev.createdAt) === formatDay(msg.createdAt);
                  const sameSenderAsNext =
                    !!next &&
                    next.type !== 'call' &&
                    msg.type !== 'call' &&
                    next.senderId === msg.senderId &&
                    formatDay(next.createdAt) === formatDay(msg.createdAt);
                  const showAvatar = !mine && !sameSenderAsNext;

                  if (isCall) {
                    const missed =
                      msg.call!.outcome === 'missed' ||
                      msg.call!.outcome === 'rejected' ||
                      (msg.call!.outcome === 'cancelled' && msg.call!.initiatedBy !== meId);
                    return (
                      <div key={msg.id}>
                        {showDay ? (
                          <div className="my-4 flex justify-center">
                            <span className="rounded-full bg-ink-800/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink-300 uppercase">
                              {formatDay(msg.createdAt)}
                            </span>
                          </div>
                        ) : null}
                        <div className="my-3 flex justify-center">
                          <div
                            className={cn(
                              'inline-flex max-w-[90%] items-center gap-2 rounded-full px-3 py-1.5 text-xs',
                              missed
                                ? 'bg-[#ed4245]/10 text-[#c03537] dark:text-[#ed4245]'
                                : 'bg-ink-800/80 text-ink-300',
                            )}
                          >
                            {missed ? (
                              <IconPhoneOff className="h-3.5 w-3.5 shrink-0" />
                            ) : msg.call!.mediaKind === 'video' ? (
                              <IconVideo className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <IconPhone className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="font-medium">{callHistoryLabel(msg, meId)}</span>
                            <span className="text-[10px] opacity-70">{formatTime(msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const hasVisualMedia =
                    !deleted &&
                    msg.attachments.some((a) => a.kind === 'image' || a.kind === 'video');
                  const textOnly =
                    !deleted &&
                    !!(msg.body ?? '').trim() &&
                    msg.attachments.length === 0 &&
                    !msg.replyTo;
                  const mediaOnly =
                    hasVisualMedia &&
                    !(msg.body ?? '').trim() &&
                    !msg.replyTo &&
                    msg.attachments.length > 0;

                  const meta = (
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 text-[10px] leading-none',
                        mine ? 'text-white/65' : 'text-ink-400',
                        textOnly && 'ml-2 translate-y-0.5',
                      )}
                    >
                      {msg.editedAt && !deleted ? <span>edited</span> : null}
                      <span>{formatTime(msg.createdAt)}</span>
                      {!deleted ? (
                        <MessageTicks
                          status={msg.status ?? 'sent'}
                          localState={
                            msg.localState === 'sending' || msg.localState === 'failed'
                              ? msg.localState
                              : null
                          }
                          mine={mine}
                        />
                      ) : null}
                    </span>
                  );

                  return (
                    <div key={msg.id} className={cn(sameSenderAsPrev ? 'mt-0.5' : 'mt-3')}>
                      {showDay ? (
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-ink-800/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink-300 uppercase">
                            {formatDay(msg.createdAt)}
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          'group flex items-end gap-2',
                          mine ? 'justify-end' : 'justify-start',
                        )}
                      >
                        {!mine ? (
                          showAvatar ? (
                            <UserAvatar
                              name={msg.senderName}
                              src={
                                msg.senderAvatarUrl ??
                                active.members.find((m) => m.id === msg.senderId)?.avatarUrl
                              }
                              seed={msg.senderId}
                              size="sm"
                              className="mb-0.5"
                            />
                          ) : (
                            <span className="mb-0.5 inline-block h-6 w-6 shrink-0" aria-hidden />
                          )
                        ) : null}
                        <div className="relative w-max max-w-[min(88%,22rem)] sm:max-w-[min(78%,22rem)]">
                          <div
                            role="button"
                            tabIndex={deleted ? -1 : 0}
                            onClick={(e) => {
                              if (deleted) return;
                              if (
                                window.matchMedia('(hover: hover) and (pointer: fine)').matches
                              ) {
                                return;
                              }
                              const t = e.target as HTMLElement;
                              if (t.closest('a, button, audio, video, [data-chat-media]')) return;
                              e.stopPropagation();
                              setActionMsgId((id) => (id === msg.id ? null : msg.id));
                              setMenuMsgId(null);
                              setMenuPos(null);
                            }}
                            onContextMenu={(e) => {
                              if (deleted) return;
                              e.preventDefault();
                              openMessageActions(msg.id);
                            }}
                            className={cn(
                              'relative overflow-hidden outline-none',
                              mediaOnly ? 'p-1' : 'px-3 py-2',
                              mine
                                ? cn(
                                    'bg-brand-500 text-white',
                                    sameSenderAsPrev
                                      ? 'rounded-2xl rounded-tr-md'
                                      : 'rounded-2xl rounded-br-md',
                                    sameSenderAsNext && 'rounded-br-2xl',
                                  )
                                : cn(
                                    'bg-ink-800 text-ink-50',
                                    sameSenderAsPrev
                                      ? 'rounded-2xl rounded-tl-md'
                                      : 'rounded-2xl rounded-bl-md',
                                    sameSenderAsNext && 'rounded-bl-2xl',
                                  ),
                              deleted && 'opacity-70',
                              actionMsgId === msg.id && 'ring-2 ring-brand-400/40',
                            )}
                          >
                          {!mine && active.type === 'group' && !sameSenderAsPrev ? (
                            <p
                              className={cn(
                                'mb-0.5 text-[11px] font-semibold text-brand-300',
                                mediaOnly && 'px-1.5 pt-0.5',
                              )}
                            >
                              {msg.senderName}
                            </p>
                          ) : null}

                          {msg.replyTo ? (
                            <div
                              className={cn(
                                'mb-1 rounded-lg border-l-2 px-2 py-1 text-[11px]',
                                mine
                                  ? 'border-white/50 bg-black/15 text-white/90'
                                  : 'border-brand-500 bg-ink-900 text-ink-200',
                              )}
                            >
                              <p className="font-semibold">{msg.replyTo.senderName}</p>
                              <p className="truncate">
                                {msg.replyTo.deleted
                                  ? 'Message deleted'
                                  : msg.replyTo.body || 'Attachment'}
                              </p>
                            </div>
                          ) : null}

                          {deleted ? (
                            <p className="text-sm italic opacity-80">This message was deleted</p>
                          ) : (
                            <>
                              {msg.attachments.length > 0 ? (
                                <div
                                  className={cn(
                                    (msg.body ?? '').trim() ? 'mb-1.5 space-y-1.5' : 'space-y-1.5',
                                  )}
                                >
                                  {msg.attachments.map((att) => (
                                    <AttachmentBlock
                                      key={att.id}
                                      att={att}
                                      mine={mine}
                                      onPreview={setMediaPreview}
                                    />
                                  ))}
                                </div>
                              ) : null}
                              {textOnly ? (
                                <div className="flex items-end">
                                  <p className="whitespace-pre-wrap break-words text-sm leading-snug">
                                    {msg.body}
                                  </p>
                                  {meta}
                                </div>
                              ) : msg.body ? (
                                <p
                                  className={cn(
                                    'whitespace-pre-wrap break-words text-sm leading-snug',
                                    mediaOnly && 'px-1.5 pt-1',
                                  )}
                                >
                                  {msg.body}
                                </p>
                              ) : null}
                            </>
                          )}

                          {!textOnly || deleted ? (
                            <div
                              className={cn(
                                'flex items-center justify-end',
                                mediaOnly ? 'mt-1 px-1 pb-0.5' : 'mt-1',
                              )}
                            >
                              {meta}
                            </div>
                          ) : null}
                          </div>

                          {!deleted ? (
                            <div
                              className={cn(
                                'absolute -top-3 z-20 hidden md:block',
                                'opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto',
                                (actionMsgId === msg.id || menuMsgId === msg.id) &&
                                  'opacity-100 pointer-events-auto',
                                mine ? 'right-0' : 'left-0',
                              )}
                            >
                              <div className="flex items-center gap-0.5 rounded-lg border border-ink-600/80 bg-ink-800/95 p-0.5 text-ink-300 shadow-lg backdrop-blur">
                                <button
                                  type="button"
                                  title="Reply"
                                  className="rounded-md p-1.5 transition hover:bg-ink-700 hover:text-ink-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startReply(msg);
                                  }}
                                >
                                  <IconReply className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Forward"
                                  className="rounded-md p-1.5 transition hover:bg-ink-700 hover:text-ink-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestForward(msg);
                                  }}
                                >
                                  <IconForward className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="More"
                                  className="rounded-md px-1.5 py-1 text-[11px] font-bold transition hover:bg-ink-700 hover:text-ink-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMoreMenu(msg, e.currentTarget);
                                  }}
                                >
                                  ···
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {(replyTo || editing) && (
              <div className="flex items-center justify-between gap-2 border-t border-ink-600/70 bg-ink-800/90 px-4 py-2">
                <div className="min-w-0 border-l-2 border-brand-500 pl-2.5 text-xs text-ink-200">
                  {editing ? (
                    <span>
                      <span className="font-semibold text-ink-100">Editing</span>
                      <span className="mt-0.5 block truncate text-ink-400">
                        {editing.body.slice(0, 80)}
                      </span>
                    </span>
                  ) : replyTo ? (
                    <span>
                      <span className="inline-flex items-center gap-1 font-semibold text-ink-100">
                        <IconReply className="h-3 w-3" />
                        {replyTo.senderName}
                      </span>
                      <span className="mt-0.5 block truncate text-ink-400">
                        {replyTo.body || 'Attachment'}
                      </span>
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-700 hover:text-ink-50"
                  onClick={() => {
                    setReplyTo(null);
                    setEditing(null);
                    setDraft('');
                  }}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            )}

            {files.length > 0 ? (
              <div className="border-t border-ink-600/70 bg-ink-800/60 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-ink-400">
                    {files.length} attachment{files.length === 1 ? '' : 's'}
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-ink-400 transition hover:text-ink-100"
                    onClick={() => setFiles([])}
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {files.map((f, i) => (
                    <ComposerAttachmentPreview
                      key={`${f.name}-${f.size}-${i}`}
                      file={f}
                      onRemove={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {recording ? (
              <div className="flex items-center justify-between gap-3 border-t border-ink-600/70 bg-[#ed4245]/10 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-[#ed4245]">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#ed4245]" />
                  Recording…
                  <span className="tabular-nums font-medium text-ink-200">
                    {String(Math.floor(recordSecs / 60)).padStart(2, '0')}:
                    {String(recordSecs % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancelAudioNote}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-300 hover:bg-ink-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopAudioNote}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#ed4245] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#c03537]"
                  >
                    <IconStop className="h-3.5 w-3.5" />
                    Attach
                  </button>
                </div>
              </div>
            ) : null}

            {recordError ? (
              <p className="border-t border-ink-600/70 bg-ink-800 px-4 py-2 text-xs text-[#ed4245]">
                {recordError}
              </p>
            ) : null}

            <form
              onSubmit={onSend}
              className="border-t border-ink-600/70 bg-ink-800/90 px-2.5 py-2.5 sm:px-4 sm:py-3"
            >
              <div className="flex items-end gap-1.5 rounded-2xl bg-ink-900/70 p-1 ring-1 ring-ink-600/50 focus-within:ring-brand-500/40">
              <input
                ref={photoInputRef}
                type="file"
                accept={ATTACH_ACCEPT.photo}
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept={ATTACH_ACCEPT.gallery}
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <input
                ref={documentInputRef}
                type="file"
                multiple
                accept={ATTACH_ACCEPT.document}
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <input
                ref={audioInputRef}
                type="file"
                multiple
                accept={ATTACH_ACCEPT.audio}
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              {!editing ? (
                <div className="relative mb-0.5" ref={attachMenuRef}>
                  <button
                    type="button"
                    title="Attach"
                    onClick={() => setAttachMenuOpen((o) => !o)}
                    className={cn(
                      'rounded-xl p-2 text-ink-400 transition hover:bg-ink-700 hover:text-ink-100',
                      attachMenuOpen && 'bg-ink-700 text-ink-50',
                    )}
                  >
                    <IconPaperclip className="h-5 w-5" />
                  </button>
                  {attachMenuOpen ? (
                    <div className="absolute bottom-full left-0 z-30 mb-2 w-48 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 py-1 shadow-xl">
                      <button
                        type="button"
                        onClick={() => openAttachPicker('photo')}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-700"
                      >
                        <IconImage className="h-4 w-4 text-ink-400" />
                        Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachPicker('document')}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-700"
                      >
                        <IconFile className="h-4 w-4 text-ink-400" />
                        Document
                      </button>
                      <button
                        type="button"
                        onClick={() => void startAudioNote()}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-700"
                      >
                        <IconMic className="h-4 w-4 text-ink-400" />
                        Audio note
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachPicker('audio')}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-700"
                      >
                        <IconMic className="h-4 w-4 text-ink-400" />
                        Audio file
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachPicker('gallery')}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-700"
                      >
                        <IconGallery className="h-4 w-4 text-ink-400" />
                        Gallery
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  notifyTyping();
                }}
                rows={1}
                placeholder={editing ? 'Edit message…' : 'Message'}
                className="max-h-28 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-sm text-ink-50 outline-none placeholder:text-ink-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void onSend(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="md"
                disabled={
                  sending ||
                  recording ||
                  (!editing && !draft.trim() && files.length === 0)
                }
                className="mb-0.5 h-10 w-10 shrink-0 rounded-xl !px-0"
                title={editing ? 'Save' : 'Send'}
              >
                <IconSend className="h-4 w-4" />
              </Button>
              </div>
            </form>
          </>
        )}
      </section>

      {modal === 'dm' && user ? (
        <NewDmModal
          users={orgUsers}
          meId={meId}
          onClose={() => setModal(null)}
          onCreated={upsertConversation}
        />
      ) : null}
      {modal === 'group' && user ? (
        <NewGroupModal
          users={orgUsers}
          meId={meId}
          onClose={() => setModal(null)}
          onCreated={upsertConversation}
        />
      ) : null}
      {modal === 'manage' && active?.type === 'group' ? (
        <GroupManagePanel
          conversation={active}
          users={orgUsers}
          meId={meId}
          onClose={() => setModal(null)}
          onUpdated={(c) => {
            upsertConversation(c);
            if (!c.memberIds.includes(meId)) {
              setActiveId(null);
              void refreshList();
              setModal(null);
            }
          }}
        />
      ) : null}

      <ConfirmModal
        open={Boolean(deleteMsg)}
        title="Delete message?"
        message="This message will be removed for everyone in the chat. This can’t be undone."
        confirmLabel="Delete"
        danger
        busy={deletingMsg}
        onCancel={() => setDeleteMsg(null)}
        onConfirm={() => confirmDeleteMessage()}
      />

      {forwardMsg ? (
        <ModalShell
          onClose={() => {
            if (!forwardBusy) setForwardMsg(null);
          }}
          title="Forward message"
          subtitle="Choose a chat"
        >
          <div className="mt-3 max-h-80 overflow-y-auto">
            {conversations.filter((c) => c.id !== activeId).length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-300">No other chats to forward to</p>
            ) : (
              conversations
                .filter((c) => c.id !== activeId)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={forwardBusy}
                    onClick={() => void confirmForward(c.id)}
                    className="flex w-full items-center gap-3 border-b border-ink-700 px-1 py-2.5 text-left hover:bg-ink-900 disabled:opacity-50"
                  >
                    <ConversationAvatar conversation={c} meId={meId} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-50">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-ink-300">
                        {c.type === 'group' ? 'Group' : 'Direct message'}
                      </span>
                    </span>
                  </button>
                ))
            )}
          </div>
          {forwardBusy ? (
            <p className="mt-2 text-xs font-medium text-ink-300">Forwarding…</p>
          ) : null}
        </ModalShell>
      ) : null}

      {mediaPreview ? (
        <MediaPreviewModal att={mediaPreview} onClose={() => setMediaPreview(null)} />
      ) : null}

      {/* Mobile message actions sheet */}
      {actionMessage && !actionMessage.deletedAt
        ? createPortal(
            <div className="fixed inset-0 z-[10050] md:hidden">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/50"
                onClick={closeMessageMenus}
              />
              <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-ink-600 bg-ink-800 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink-600" />
                <p className="mb-2 truncate px-1 text-xs text-ink-400">
                  {actionMessage.body?.trim()
                    ? actionMessage.body.slice(0, 80)
                    : actionMessage.attachments.length
                      ? 'Attachment'
                      : 'Message'}
                </p>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-ink-50 hover:bg-ink-700"
                  onClick={() => startReply(actionMessage)}
                >
                  <IconReply className="h-4 w-4 text-ink-300" />
                  Reply
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-ink-50 hover:bg-ink-700"
                  onClick={() => requestForward(actionMessage)}
                >
                  <IconForward className="h-4 w-4 text-ink-300" />
                  Forward
                </button>
                {actionMessage.senderId === meId ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-ink-50 hover:bg-ink-700"
                    onClick={() => startEdit(actionMessage)}
                  >
                    <IconEdit className="h-4 w-4 text-ink-300" />
                    Edit
                  </button>
                ) : null}
                {actionMessage.senderId === meId ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#ed4245] hover:bg-[#ed4245]/10"
                    onClick={() => requestDelete(actionMessage)}
                  >
                    <IconTrash className="h-4 w-4" />
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold text-ink-300 hover:bg-ink-700"
                  onClick={closeMessageMenus}
                >
                  Cancel
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Desktop ··· menu (portal so it isn’t clipped) */}
      {menuMessage && menuPos && !menuMessage.deletedAt
        ? createPortal(
            <div className="fixed inset-0 z-[10050] hidden md:block">
              <button
                type="button"
                aria-label="Close menu"
                className="absolute inset-0 cursor-default"
                onClick={closeMessageMenus}
              />
              <div
                className="absolute min-w-[9rem] overflow-hidden rounded-lg border border-ink-600 bg-ink-800 py-1 text-ink-100 shadow-lg"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                {menuMessage.senderId === meId ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-ink-100 hover:bg-ink-900"
                    onClick={() => startEdit(menuMessage)}
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-ink-100 hover:bg-ink-900"
                  onClick={() => requestForward(menuMessage)}
                >
                  Forward
                </button>
                {menuMessage.senderId === meId ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-[#ed4245] hover:bg-[#ed4245]/10"
                    onClick={() => requestDelete(menuMessage)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
