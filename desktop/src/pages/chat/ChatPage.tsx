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
import {
  IconFile,
  IconForward,
  IconGallery,
  IconImage,
  IconMic,
  IconPaperclip,
  IconPlus,
  IconReply,
  IconSearch,
  IconSend,
  IconStop,
  IconUsers,
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
import { ApiError } from '@/lib/api/client';
import {
  connectChatSocket,
  disconnectChatSocket,
  emitMessagesRead,
  emitTypingStart,
  emitTypingStop,
  joinConversation,
  leaveConversation,
  setChatSocketHandlers,
  type PresenceUser,
} from '@/lib/socket/chatSocket';
import {
  buildOptimisticMessage,
  chatSendQueue,
  persistOptimisticLocal,
} from '@/lib/chat/sendQueue';
import {
  appendMessageSorted,
  loadConversations,
  openConversationsFromLocal,
  openMessagesFromLocal,
  replaceMessageById,
  sortConversationsByRecent,
  sortMessagesByTime,
  syncConversationsFromApi,
  syncLatestMessagesFromApi,
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

function errMsg(err: unknown) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
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
      <span className="ml-0.5 inline-flex text-white/55" title="Sending" aria-label="Sending">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full border border-white/70 border-t-transparent" />
      </span>
    );
  }
  if (localState === 'failed') {
    return (
      <span className="ml-0.5 font-semibold text-rose-200" title="Failed to send" aria-label="Failed">
        !
      </span>
    );
  }
  const tone =
    status === 'read'
      ? 'text-emerald-300'
      : status === 'delivered'
        ? 'text-white/80'
        : 'text-white/55';
  return (
    <span className={cn('ml-0.5 inline-flex font-semibold tracking-tight', tone)} aria-label={status ?? 'sent'}>
      {status === 'delivered' || status === 'read' ? '✓✓' : '✓'}
    </span>
  );
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
  const active = Boolean(checkedIn);
  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white',
        active ? 'bg-emerald-500' : 'bg-ink-300',
        online && active && 'ring-1 ring-emerald-300',
        className,
      )}
      title={active ? 'Checked in' : 'Checked out'}
    />
  );
}

function ChatListSkeleton() {
  return (
    <div className="space-y-0 p-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-ink-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-[66%] animate-pulse rounded bg-ink-100" />
            <div className="h-2.5 w-[80%] animate-pulse rounded bg-ink-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatThreadSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-4 py-6">
      <div className="mx-auto h-5 w-20 animate-pulse rounded-full bg-ink-100" />
      <div className="flex justify-start">
        <div className="h-12 w-[55%] animate-pulse rounded-2xl rounded-bl-md bg-ink-100" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-[45%] animate-pulse rounded-2xl rounded-br-md bg-brand-100" />
      </div>
      <div className="flex justify-start">
        <div className="h-16 w-[60%] animate-pulse rounded-2xl rounded-bl-md bg-ink-100" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-[40%] animate-pulse rounded-2xl rounded-br-md bg-brand-100" />
      </div>
      <div className="flex justify-start">
        <div className="h-8 w-[35%] animate-pulse rounded-2xl rounded-bl-md bg-ink-100" />
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

function VoiceNotePlayer({ att }: { att: ChatAttachment }) {
  const src = resolveMediaUrl(att.url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [src]);

  return (
    <div className="min-w-[220px] max-w-xs border border-ink-200/80 bg-white/80 px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-700">
        <IconMic className="h-3.5 w-3.5 text-brand-600" />
        <span className="truncate">{att.name || 'Voice note'}</span>
      </div>
      {error ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-rose-700">{error}</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-brand-700 underline"
          >
            Open audio file
          </a>
        </div>
      ) : (
        <audio
          key={src}
          controls
          preload="metadata"
          className="w-full"
          src={src}
          onError={() =>
            setError('Couldn’t play this voice note. Try opening the file instead.')
          }
        >
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}

function AttachmentBlock({ att }: { att: ChatAttachment }) {
  const src = resolveMediaUrl(att.url);
  if (att.kind === 'image') {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md">
        <img src={src} alt={att.name} className="max-h-56 max-w-full object-cover" />
      </a>
    );
  }
  if (att.kind === 'video') {
    return (
      <video controls className="max-h-56 max-w-full rounded-md" src={src}>
        <track kind="captions" />
      </video>
    );
  }
  if (att.kind === 'audio') {
    return <VoiceNotePlayer att={att} />;
  }
  if (att.kind === 'document' || att.kind === 'other') {
    const pdf = isPdfAttachment(att);
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-[200px] max-w-xs items-center gap-2.5 rounded-md border border-ink-200/80 bg-white/80 px-2.5 py-2.5 text-xs text-ink-800 hover:bg-white"
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase tracking-wide',
            pdf ? 'bg-rose-100 text-rose-700' : 'bg-ink-100 text-ink-700',
          )}
        >
          {pdf ? 'PDF' : <IconFile className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{att.name}</span>
          <span className="mt-0.5 block text-[11px] text-ink-500">
            {pdf ? 'PDF document' : 'Document'}
            {att.size ? ` · ${formatBytes(att.size)}` : ''}
          </span>
        </span>
      </a>
    );
  }
  return null;
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-950/35 p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md border border-ink-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
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
  const [q, setQ] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filtered = users.filter(
    (u) =>
      u.id !== meId &&
      (u.name.toLowerCase().includes(q.toLowerCase()) ||
        u.email.toLowerCase().includes(q.toLowerCase())),
  );

  async function openDm(input: { userId?: string; email?: string }) {
    setBusy(true);
    setError('');
    try {
      const { conversation } = await createDm(input);
      onCreated(conversation);
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter an email address');
      return;
    }
    await openDm({ email: trimmed });
  }

  return (
    <ModalShell
      onClose={onClose}
      title="New chat"
      subtitle="Project members, or anyone on TaskTrack by email"
    >
      <form onSubmit={onEmailSubmit} className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-ink-600">
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
        <p className="text-[11px] text-ink-500">
          They must already have a TaskTrack account.
        </p>
      </form>

      <div className="mt-4 border-t border-ink-100 pt-3">
        <p className="mb-2 text-xs font-medium text-ink-600">Shared project members</p>
        <Input
          placeholder="Search people…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={busy}
        />
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      <div className="mt-3 max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">
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
              className="flex w-full items-center gap-3 border-b border-ink-100 px-1 py-2.5 text-left hover:bg-ink-50 disabled:opacity-50"
            >
              <UserAvatar name={u.name} src={u.avatarUrl} seed={u.id} size="lg" className="!h-9 !w-9" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block truncate text-sm font-semibold text-ink-900">{u.name}</span>
                  {u.checkedIn ? (
                    <span className="shrink-0 text-[10px] font-semibold text-emerald-700">
                      In
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-ink-500">{u.email}</span>
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
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      setError('Group photo must be an image');
      return;
    }
    setError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
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
      setError(errMsg(err));
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
        <div className="max-h-56 overflow-y-auto border border-ink-100">
          {others.map((u) => {
            const on = selected.has(u.id);
            return (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 border-b border-ink-100 px-3 py-2 hover:bg-ink-50"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(u.id)}
                  className="h-4 w-4 accent-brand-700"
                />
                <UserAvatar name={u.name} src={u.avatarUrl} seed={u.id} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-900">{u.name}</span>
                  <span className="block truncate text-xs text-ink-500">{u.email}</span>
                </span>
              </label>
            );
          })}
        </div>
        {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
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
  const [name, setName] = useState(conversation.rawName || conversation.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addIds, setAddIds] = useState<Set<string>>(new Set());
  const [memberToRemove, setMemberToRemove] = useState<ChatMember | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const isCreator = conversation.createdBy === meId;
  const memberSet = new Set(conversation.memberIds);
  const candidates = users.filter((u) => !memberSet.has(u.id));

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { conversation: next } = await updateGroup(conversation.id, { name: name.trim() });
      onUpdated(next);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Group photo must be an image');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { conversation: next } = await uploadGroupAvatar(conversation.id, file);
      onUpdated(next);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function addMembers() {
    if (addIds.size === 0) return;
    setBusy(true);
    setError('');
    try {
      const { conversation: next } = await addGroupMembers(conversation.id, [...addIds]);
      onUpdated(next);
      setAddIds(new Set());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove) return;
    setBusy(true);
    setError('');
    try {
      const { conversation: next } = await removeGroupMember(
        conversation.id,
        memberToRemove.id,
      );
      setMemberToRemove(null);
      onUpdated(next);
      if (memberToRemove.id === meId) onClose();
    } catch (err) {
      setError(errMsg(err));
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Members</p>
        <div className="mt-2 max-h-40 overflow-y-auto">
          {conversation.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 border-b border-ink-100 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">
                  {m.name}
                  {m.id === meId ? ' (you)' : ''}
                  {m.id === conversation.createdBy ? (
                    <span className="ml-1 text-[10px] font-semibold text-brand-700">Admin</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-ink-500">{m.email}</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Add members</p>
          <div className="mt-2 max-h-36 overflow-y-auto border border-ink-100">
            {candidates.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 border-b border-ink-100 px-2 py-1.5 text-sm hover:bg-ink-50"
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

      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
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
  const { user } = useAuth();
  const { online } = useOffline();
  const meId = user?.id ?? '';
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  /** Skeleton only when there is no local cache yet (first open). */
  const [showListSkeleton, setShowListSkeleton] = useState(true);
  const [showThreadSkeleton, setShowThreadSkeleton] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [orgUsers, setOrgUsers] = useState<ChatMember[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceUser>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [socketReady, setSocketReady] = useState(false);
  const [modal, setModal] = useState<'dm' | 'group' | 'manage' | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
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
  const typingTimerRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);
  /** In-memory thread cache for instant chat switches (backed by SQLite). */
  const threadCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());

  activeIdRef.current = activeId;

  function scrollThreadToBottom() {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function onThreadScroll() {
    const el = threadScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q) ||
        c.members.some((m) => m.name.toLowerCase().includes(q)),
    );
  }, [conversations, query]);

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
        return list[0]?.id ?? null;
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
      setError('');
      // 1) Paint from SQLite immediately (WhatsApp-style)
      const local = await openConversationsFromLocal(meId);
      if (cancelled) return;
      if (local.conversations.length > 0) {
        setConversations(local.conversations);
        setActiveId((prev) => prev ?? local.conversations[0]?.id ?? null);
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
            online: prev[u.id]?.online ?? false,
          };
        }
        return next;
      });
      if (remote) {
        setConversations(remote);
        setActiveId((prev) => {
          if (prev && remote.some((c) => c.id === prev)) return prev;
          return prev ?? remote[0]?.id ?? null;
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

    setChatSocketHandlers({
      onConnect: () => setSocketReady(true),
      onDisconnect: () => setSocketReady(false),
      onPresenceSnapshot: (users) => {
        setPresence((prev) => {
          const next = { ...prev };
          for (const u of users) next[u.userId] = u;
          return next;
        });
      },
      onPresenceUpdate: (u) => {
        setPresence((prev) => ({ ...prev, [u.userId]: u }));
        setOrgUsers((prev) =>
          prev.map((m) => (m.id === u.userId ? { ...m, checkedIn: u.checkedIn } : m)),
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

    if (online) void connectChatSocket();
    return () => {
      disconnectChatSocket();
      setSocketReady(false);
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
    setMenuMsgId(null);
    setTypingUsers({});
    setError('');
    setFiles([]);

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

      // 2) Background: only newer messages; merge keeps timestamp order (no shuffle)
      if (online) {
        const merged = await syncLatestMessagesFromApi(meId, activeId);
        if (!cancelled && merged) {
          const sorted = sortMessagesByTime(merged);
          threadCacheRef.current.set(activeId, sorted);
          setMessages(sorted);
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

    setError('');

    // Edit stays blocking (small payload)
    if (editing) {
      setSending(true);
      try {
        const { message } = await editMessage(editing.id, body);
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
        setEditing(null);
        setDraft('');
      } catch (err) {
        setError(errMsg(err));
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
        setError(errMsg(err));
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

  function requestDelete(msg: ChatMessage) {
    setMenuMsgId(null);
    setDeleteMsg(msg);
  }

  function requestForward(msg: ChatMessage) {
    setMenuMsgId(null);
    setForwardMsg(msg);
  }

  async function confirmForward(targetId: string) {
    if (!forwardMsg) return;
    setForwardBusy(true);
    setError('');
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
      setError(errMsg(err));
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
      setError(errMsg(err));
    } finally {
      setDeletingMsg(false);
    }
  }

  function startEdit(msg: ChatMessage) {
    setMenuMsgId(null);
    setEditing(msg);
    setReplyTo(null);
    setDraft(msg.body);
    setFiles([]);
  }

  function startReply(msg: ChatMessage) {
    setMenuMsgId(null);
    setReplyTo(msg);
    setEditing(null);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-[480px] overflow-hidden border border-ink-200 bg-white">
      {/* Sidebar */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-ink-200 bg-ink-50/40">
        <div className="border-b border-ink-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-ink-900">Chat</h1>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  socketReady ? 'bg-emerald-500' : 'bg-ink-300',
                )}
                title={socketReady ? 'Live' : 'Connecting…'}
              />
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="xs" onClick={() => setModal('dm')} title="New chat">
                <IconPlus className="h-3.5 w-3.5" />
                DM
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setModal('group')}
                title="New group"
              >
                <IconUsers className="h-3.5 w-3.5" />
                Group
              </Button>
            </div>
          </div>
          <div className="relative mt-2">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="h-9 w-full rounded-md border border-ink-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showListSkeleton ? (
            <ChatListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-ink-500">
              <p>No chats yet.</p>
              <p className="mt-1 text-xs">Start a DM or create a group.</p>
            </div>
          ) : (
            filtered.map((c) => {
              const selected = c.id === activeId;
              const peerId =
                c.type === 'dm' ? c.memberIds.find((id) => id !== meId) : undefined;
              const peer = peerId ? presence[peerId] : undefined;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    'flex w-full items-start gap-3 border-b border-ink-100 px-3 py-3 text-left transition-colors',
                    selected ? 'bg-brand-50' : 'hover:bg-white',
                  )}
                >
                  <span className="relative mt-0.5 shrink-0">
                    <ConversationAvatar conversation={c} meId={meId} size="lg" />
                    {c.type === 'dm' ? (
                      <PresenceDot checkedIn={peer?.checkedIn} online={peer?.online} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink-900">{c.name}</span>
                      <span className="shrink-0 text-[10px] text-ink-400">
                        {formatTime(c.lastMessageAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">
                      {c.type === 'dm' && peer?.checkedIn
                        ? 'Checked in'
                        : c.lastMessagePreview ||
                          (c.type === 'group' ? 'Group chat' : 'Direct message')}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#f8faf9_0%,#f1f5f4_100%)]">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ink-500">
            <IconUsers className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">Select a chat or start a new one</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative shrink-0">
                  <ConversationAvatar conversation={active} meId={meId} size="lg" />
                  {active.type === 'dm' && peerPresence && 'checkedIn' in peerPresence ? (
                    <PresenceDot
                      checkedIn={peerPresence.checkedIn}
                      online={peerPresence.online}
                    />
                  ) : null}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{active.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {typingLabel ? (
                      <span className="font-medium text-brand-700">{typingLabel}</span>
                    ) : active.type === 'group' ? (
                      <>
                        {active.members.length} members
                        {peerPresence && 'checkedInCount' in peerPresence
                          ? ` · ${peerPresence.checkedInCount} checked in`
                          : ''}
                      </>
                    ) : peerPresence && 'checkedIn' in peerPresence ? (
                      peerPresence.checkedIn ? (
                        <span className="font-medium text-emerald-700">
                          Checked in{peerPresence.online ? ' · online' : ''}
                        </span>
                      ) : (
                        'Checked out'
                      )
                    ) : (
                      active.members.find((m) => m.id !== meId)?.email ?? 'Direct message'
                    )}
                  </p>
                </div>
              </div>
              {active.type === 'group' ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => setModal('manage')}>
                  Manage
                </Button>
              ) : null}
            </header>

            <div
              ref={threadScrollRef}
              onScroll={onThreadScroll}
              className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
            >
              {showThreadSkeleton ? (
                <ChatThreadSkeleton />
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-ink-500">No messages yet. Say hello.</p>
              ) : (
                messages.map((msg, i) => {
                  const mine = msg.senderId === meId;
                  const deleted = Boolean(msg.deletedAt);
                  const prev = messages[i - 1];
                  const showDay =
                    !prev || formatDay(prev.createdAt) !== formatDay(msg.createdAt);
                  return (
                    <div key={msg.id}>
                      {showDay ? (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-white/80 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500 shadow-sm">
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
                        ) : null}
                        <div
                          className={cn(
                            'relative max-w-[75%] rounded-2xl px-3 py-2 shadow-sm',
                            mine
                              ? 'rounded-br-md bg-brand-700 text-white'
                              : 'rounded-bl-md bg-white text-ink-900',
                            deleted && 'opacity-70',
                          )}
                        >
                          {!mine && active.type === 'group' ? (
                            <p className="mb-0.5 text-[11px] font-semibold text-brand-700">
                              {msg.senderName}
                            </p>
                          ) : null}

                          {msg.replyTo ? (
                            <div
                              className={cn(
                                'mb-1.5 rounded-md border-l-2 px-2 py-1 text-[11px]',
                                mine
                                  ? 'border-white/50 bg-black/15 text-white/90'
                                  : 'border-brand-500 bg-ink-50 text-ink-600',
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
                                <div className="mb-1.5 space-y-1.5">
                                  {msg.attachments.map((att) => (
                                    <AttachmentBlock key={att.id} att={att} />
                                  ))}
                                </div>
                              ) : null}
                              {msg.body ? (
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                  {msg.body}
                                </p>
                              ) : null}
                            </>
                          )}

                          <div
                            className={cn(
                              'mt-1 flex items-center justify-end gap-1 text-[10px]',
                              mine ? 'text-white/70' : 'text-ink-400',
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
                          </div>

                          {!deleted ? (
                            <div
                              className={cn(
                                'absolute -top-3 z-20 opacity-0 transition-opacity group-hover:opacity-100',
                                menuMsgId === msg.id && 'opacity-100',
                                mine ? 'right-0' : 'left-0',
                              )}
                            >
                              <div className="relative flex items-center gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5 text-ink-700 shadow-md">
                                <button
                                  type="button"
                                  title="Reply"
                                  className="rounded-md p-1.5 hover:bg-ink-100"
                                  onClick={() => startReply(msg)}
                                >
                                  <IconReply className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Forward"
                                  className="rounded-md p-1.5 hover:bg-ink-100"
                                  onClick={() => requestForward(msg)}
                                >
                                  <IconForward className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="More"
                                  className="rounded-md px-1.5 py-1 text-[11px] font-bold hover:bg-ink-100"
                                  onClick={() =>
                                    setMenuMsgId((id) => (id === msg.id ? null : msg.id))
                                  }
                                >
                                  ···
                                </button>
                                {menuMsgId === msg.id ? (
                                  <div
                                    className={cn(
                                      'absolute top-full z-30 mt-1 min-w-[7.5rem] overflow-hidden rounded-lg border border-ink-200 bg-white py-1 text-ink-800 shadow-lg',
                                      mine ? 'right-0' : 'left-0',
                                    )}
                                  >
                                    {mine ? (
                                      <button
                                        type="button"
                                        className="block w-full px-3 py-1.5 text-left text-xs font-medium text-ink-800 hover:bg-ink-50"
                                        onClick={() => startEdit(msg)}
                                      >
                                        Edit
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-1.5 text-left text-xs font-medium text-ink-800 hover:bg-ink-50"
                                      onClick={() => requestForward(msg)}
                                    >
                                      Forward
                                    </button>
                                    {mine ? (
                                      <button
                                        type="button"
                                        className="block w-full px-3 py-1.5 text-left text-xs font-medium text-red-700 hover:bg-red-50"
                                        onClick={() => requestDelete(msg)}
                                      >
                                        Delete
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
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

            {error ? (
              <p className="border-t border-red-100 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {(replyTo || editing) && (
              <div className="flex items-center justify-between gap-2 border-t border-ink-200 bg-white px-4 py-2">
                <div className="min-w-0 text-xs text-ink-600">
                  {editing ? (
                    <span>
                      Editing message:{' '}
                      <span className="font-medium text-ink-800">{editing.body.slice(0, 80)}</span>
                    </span>
                  ) : replyTo ? (
                    <span className="flex items-center gap-1.5">
                      <IconReply className="h-3.5 w-3.5" />
                      Replying to <span className="font-semibold">{replyTo.senderName}</span>:{' '}
                      <span className="truncate">{replyTo.body || 'Attachment'}</span>
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-ink-500 hover:bg-ink-100"
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
              <div className="flex flex-wrap gap-2 border-t border-ink-200 bg-white px-4 py-2">
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-xs text-ink-700"
                  >
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      {fileKindLabel(f)}
                    </span>
                    <span className="min-w-0 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-ink-400 hover:text-ink-700"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {recording ? (
              <div className="flex items-center justify-between gap-3 border-t border-ink-200 bg-rose-50/80 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm text-rose-700">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                  Recording audio note…
                  <span className="tabular-nums font-medium">
                    {String(Math.floor(recordSecs / 60)).padStart(2, '0')}:
                    {String(recordSecs % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancelAudioNote}
                    className="rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={stopAudioNote}
                    className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                  >
                    <IconStop className="h-3.5 w-3.5" />
                    Stop & attach
                  </button>
                </div>
              </div>
            ) : null}

            {recordError ? (
              <p className="border-t border-ink-200 bg-white px-4 py-2 text-xs text-rose-600">
                {recordError}
              </p>
            ) : null}

            <form
              onSubmit={onSend}
              className="flex items-end gap-2 border-t border-ink-200 bg-white px-3 py-3"
            >
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
                      'rounded-md p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-800',
                      attachMenuOpen && 'bg-ink-100 text-ink-800',
                    )}
                  >
                    <IconPaperclip className="h-5 w-5" />
                  </button>
                  {attachMenuOpen ? (
                    <div className="absolute bottom-full left-0 z-30 mb-2 w-52 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => openAttachPicker('photo')}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50"
                      >
                        <IconImage className="h-4 w-4 text-brand-600" />
                        Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachPicker('document')}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50"
                      >
                        <IconFile className="h-4 w-4 text-brand-600" />
                        Document
                      </button>
                      <button
                        type="button"
                        onClick={() => void startAudioNote()}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50"
                      >
                        <IconMic className="h-4 w-4 text-brand-600" />
                        Audio note
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachPicker('audio')}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50"
                      >
                        <IconMic className="h-4 w-4 text-ink-500" />
                        Audio file
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachPicker('gallery')}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-800 hover:bg-ink-50"
                      >
                        <IconGallery className="h-4 w-4 text-brand-600" />
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
                placeholder={editing ? 'Edit message…' : 'Type a message…'}
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-ink-200 bg-ink-50/50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
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
                className="mb-0.5 shrink-0"
              >
                <IconSend className="h-4 w-4" />
                {editing ? 'Save' : 'Send'}
              </Button>
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
              <p className="py-6 text-center text-sm text-ink-500">No other chats to forward to</p>
            ) : (
              conversations
                .filter((c) => c.id !== activeId)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={forwardBusy}
                    onClick={() => void confirmForward(c.id)}
                    className="flex w-full items-center gap-3 border-b border-ink-100 px-1 py-2.5 text-left hover:bg-ink-50 disabled:opacity-50"
                  >
                    <ConversationAvatar conversation={c} meId={meId} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {c.type === 'group' ? 'Group' : 'Direct message'}
                      </span>
                    </span>
                  </button>
                ))
            )}
          </div>
          {forwardBusy ? (
            <p className="mt-2 text-xs font-medium text-ink-500">Forwarding…</p>
          ) : null}
        </ModalShell>
      ) : null}
    </div>
  );
}
