import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  IconHand,
  IconLayoutGrid,
  IconLayoutSidebar,
  IconMic,
  IconMicOff,
  IconPhone,
  IconPhoneOff,
  IconPin,
  IconScreenShare,
  IconScreenShareOff,
  IconVideo,
  IconVideoOff,
  IconX,
} from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type {
  CallFloatingReaction,
  CallLayoutMode,
  UnifiedCallState,
} from '@/lib/webrtc/useAudioCall';
import {
  isTauriApp,
  listNativeCaptureTargets,
  type CaptureTarget,
} from '@/lib/webrtc/screenShare';

const REACTION_EMOJIS = ['👍', '👏', '❤️', '😂', '😮', '🎉'] as const;

function isScreenTrack(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0];
  if (!track) return false;
  const settings = track.getSettings() as MediaTrackSettings & {
    displaySurface?: string;
  };
  if (settings.displaySurface) return true;
  const label = track.label.toLowerCase();
  if (
    label.includes('screen') ||
    label.includes('window') ||
    label.includes('web contents') ||
    label.includes('monitor') ||
    label.includes('display')
  ) {
    return true;
  }
  return track.contentHint === 'detail';
}

type TilePerson = {
  userId: string;
  name: string;
  stream: MediaStream | null;
  muted?: boolean;
  screenShare?: boolean;
  handRaised?: boolean;
  pinned?: boolean;
};

function ControlBtn({
  active,
  danger,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'bg-[#ea4335] text-white hover:bg-[#d93025]'
          : active
            ? 'bg-brand-500 text-white hover:bg-brand-600'
            : 'bg-ink-700 text-ink-50 hover:bg-ink-600',
      )}
    >
      {children}
    </button>
  );
}

function PeerVideoTile({
  person,
  compact = false,
  fill = false,
  onPin,
}: {
  person: TilePerson;
  compact?: boolean;
  fill?: boolean;
  onPin?: (userId: string) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const looksLikeScreen = Boolean(person.screenShare) || isScreenTrack(person.stream);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = person.stream;
    if (person.stream) void el.play().catch(() => undefined);
  }, [person.stream, person.screenShare]);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl bg-[#1a1b1e]',
        compact && 'h-[4.5rem] w-[7.5rem] shrink-0 sm:h-24 sm:w-36',
        fill && 'h-full min-h-0 w-full',
        !compact && !fill && 'min-h-[160px]',
        person.pinned && 'ring-2 ring-brand-400 ring-offset-2 ring-offset-ink-950',
      )}
    >
      <video
        ref={ref}
        className={cn(
          'h-full w-full',
          looksLikeScreen ? 'object-contain bg-[#0e0f11]' : 'object-cover',
        )}
        autoPlay
        playsInline
        muted={person.muted}
      />
      {!person.stream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1a1b1e]">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-700 text-sm font-semibold text-ink-100">
            {person.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="px-2 text-center text-xs text-ink-300">{person.name}</span>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-8">
          <p className="truncate text-xs font-medium text-white">
            {looksLikeScreen ? `${person.name} · Presenting` : person.name}
          </p>
        </div>
      )}
      {person.handRaised ? (
        <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-ink-950 shadow-md">
          <IconHand className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {onPin ? (
        <button
          type="button"
          className={cn(
            'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100',
            person.pinned && 'opacity-100 bg-brand-500',
          )}
          title={person.pinned ? 'Unpin' : 'Pin'}
          onClick={() => onPin(person.userId)}
        >
          <IconPin className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function StageVideo({
  stream,
  label,
  muted = true,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#0e0f11]">
      <video
        ref={ref}
        className="h-full w-full object-contain"
        autoPlay
        playsInline
        muted={muted}
      />
      {!stream ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">
          Connecting presentation…
        </div>
      ) : (
        <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}

function ReactionBurst({ reactions }: { reactions: CallFloatingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5] flex h-36 items-end justify-center gap-4 overflow-hidden sm:bottom-28">
      {reactions.map((r, i) => (
        <div
          key={r.id}
          className="animate-[callReaction_2.8s_ease-out_forwards] text-center"
          style={{ animationDelay: `${(i % 4) * 50}ms` }}
        >
          <div className="text-3xl drop-shadow-lg sm:text-4xl">{r.emoji}</div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80">{r.name}</div>
        </div>
      ))}
      <style>{`
        @keyframes callReaction {
          0% { opacity: 0; transform: translateY(20px) scale(0.7); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-72px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

type Props = {
  call: UnifiedCallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenShareStream: MediaStream | null;
  meId: string;
  raisedHands: Record<string, true>;
  handRaised: boolean;
  reactions: CallFloatingReaction[];
  spotlightUserId: string | null;
  pinnedUserId: string | null;
  layout: CallLayoutMode;
  onSetPinnedUserId: (userId: string | null) => void;
  onSetLayout: (layout: CallLayoutMode) => void;
  onSetSpotlight: (userId: string | null) => void;
  onToggleHand: () => void;
  onSendReaction: (emoji: string) => void;
  error: string | null;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: (opts?: { nativeTarget?: CaptureTarget }) => void;
  onDismissError: () => void;
};

function MeetingDock({
  call,
  shareBusy,
  handRaised,
  layout,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHand,
  onSendReaction,
  onSetLayout,
  onHangup,
}: {
  call: UnifiedCallState;
  shareBusy: boolean;
  handRaised: boolean;
  layout: CallLayoutMode;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleHand: () => void;
  onSendReaction: (emoji: string) => void;
  onSetLayout: (layout: CallLayoutMode) => void;
  onHangup: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const video = call.mediaKind === 'video';

  return (
    <div className="relative flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-[#202124]/95 px-2.5 py-2 shadow-2xl backdrop-blur-md sm:max-w-none sm:gap-2.5 sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ControlBtn
        title={call.muted ? 'Unmute' : 'Mute'}
        active={call.muted}
        onClick={onToggleMute}
      >
        {call.muted ? <IconMicOff className="h-5 w-5" /> : <IconMic className="h-5 w-5" />}
      </ControlBtn>

      {video ? (
        <ControlBtn
          title={call.cameraOff ? 'Turn camera on' : 'Turn camera off'}
          active={call.cameraOff}
          disabled={call.sharingScreen}
          onClick={onToggleCamera}
        >
          {call.cameraOff ? <IconVideoOff className="h-5 w-5" /> : <IconVideo className="h-5 w-5" />}
        </ControlBtn>
      ) : null}

      {video ? (
        <ControlBtn
          title={call.sharingScreen ? 'Stop presenting' : 'Present now'}
          active={call.sharingScreen}
          disabled={shareBusy}
          onClick={onToggleScreenShare}
        >
          {call.sharingScreen ? (
            <IconScreenShareOff className="h-5 w-5" />
          ) : (
            <IconScreenShare className="h-5 w-5" />
          )}
        </ControlBtn>
      ) : null}

      <ControlBtn title={handRaised ? 'Lower hand' : 'Raise hand'} active={handRaised} onClick={onToggleHand}>
        <IconHand className="h-5 w-5" />
      </ControlBtn>

      <div className="relative">
        <ControlBtn title="Send a reaction" active={reactOpen} onClick={() => { setReactOpen((v) => !v); setMoreOpen(false); }}>
          <span className="text-lg leading-none">☺</span>
        </ControlBtn>
        {reactOpen ? (
          <div className="absolute bottom-[calc(100%+10px)] left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-[#303134] p-1.5 shadow-xl">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10"
                onClick={() => {
                  onSendReaction(e);
                  setReactOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {video ? (
        <div className="relative">
          <ControlBtn
            title="Change layout"
            active={moreOpen || layout !== 'auto'}
            onClick={() => {
              setMoreOpen((v) => !v);
              setReactOpen(false);
            }}
          >
            <IconLayoutGrid className="h-5 w-5" />
          </ControlBtn>
          {moreOpen ? (
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 min-w-[160px] -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-[#303134] py-1 shadow-xl">
              {(
                [
                  { id: 'auto' as const, label: 'Auto', icon: <IconPin className="h-4 w-4" /> },
                  { id: 'grid' as const, label: 'Grid', icon: <IconLayoutGrid className="h-4 w-4" /> },
                  { id: 'spotlight' as const, label: 'Spotlight', icon: <IconPin className="h-4 w-4" /> },
                  { id: 'sidebar' as const, label: 'Sidebar', icon: <IconLayoutSidebar className="h-4 w-4" /> },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 hover:bg-white/10',
                    layout === opt.id && 'bg-white/10 text-white',
                  )}
                  onClick={() => {
                    onSetLayout(opt.id);
                    setMoreOpen(false);
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mx-0.5 h-6 w-px bg-white/15" />

      <ControlBtn title={call.isGroup ? 'Leave call' : 'End call'} danger onClick={onHangup}>
        <IconPhoneOff className="h-5 w-5" />
      </ControlBtn>
    </div>
  );
}

/** Global call UI — works on any authenticated page. */
export function CallOverlay({
  call,
  localStream,
  remoteStream,
  screenShareStream,
  meId,
  raisedHands,
  handRaised,
  reactions,
  spotlightUserId,
  pinnedUserId,
  layout,
  onSetPinnedUserId,
  onSetLayout,
  onSetSpotlight,
  onToggleHand,
  onSendReaction,
  error,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onDismissError,
}: Props) {
  const remoteIsScreen = useMemo(() => isScreenTrack(remoteStream), [remoteStream]);
  const [shareTargets, setShareTargets] = useState<CaptureTarget[] | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  const presentingPeer = useMemo(() => {
    if (!call.isGroup) return null;
    if (call.presentingUserId) {
      return call.peers.find((p) => p.userId === call.presentingUserId) ?? null;
    }
    return (
      call.peers.find((p) => p.sharingScreen) ??
      call.peers.find((p) => isScreenTrack(p.stream)) ??
      null
    );
  }, [call.isGroup, call.peers, call.presentingUserId]);

  const stageStream = useMemo(() => {
    if (call.sharingScreen && screenShareStream?.getVideoTracks().some((t) => t.readyState === 'live')) {
      return screenShareStream;
    }
    if (call.isGroup && presentingPeer?.stream?.getVideoTracks().some((t) => t.readyState === 'live')) {
      return presentingPeer.stream;
    }
    if (
      !call.isGroup &&
      remoteStream?.getVideoTracks().some((t) => t.readyState === 'live') &&
      (remoteIsScreen || Boolean(call.presentingUserId))
    ) {
      return remoteStream;
    }
    return null;
  }, [
    call.sharingScreen,
    call.isGroup,
    call.presentingUserId,
    screenShareStream,
    presentingPeer,
    remoteIsScreen,
    remoteStream,
  ]);

  const usePresentationLayout = Boolean(stageStream);

  const someoneSharing =
    call.sharingScreen ||
    Boolean(call.presentingUserId) ||
    remoteIsScreen ||
    Boolean(presentingPeer?.sharingScreen);

  const stageLabel = call.sharingScreen
    ? 'You are presenting'
    : presentingPeer
      ? `${presentingPeer.name} is presenting`
      : remoteIsScreen
        ? `${call.peerName} is presenting`
        : 'Presentation';

  const people = useMemo((): TilePerson[] => {
    const self: TilePerson = {
      userId: meId || 'local',
      name: 'You',
      stream: localStream,
      muted: true,
      handRaised: Boolean(meId && raisedHands[meId]),
      pinned: pinnedUserId === meId || pinnedUserId === 'local',
    };
    if (call.isGroup) {
      return [
        self,
        ...call.peers.map((p) => ({
          userId: p.userId,
          name: p.name,
          stream: p.stream,
          screenShare: p.sharingScreen || p.userId === call.presentingUserId,
          handRaised: Boolean(raisedHands[p.userId]),
          pinned: pinnedUserId === p.userId || spotlightUserId === p.userId,
        })),
      ];
    }
    return [
      self,
      {
        userId: call.peerUserId || 'peer',
        name: call.peerName || 'Peer',
        stream: remoteStream,
        screenShare: remoteIsScreen,
        handRaised: Boolean(call.peerUserId && raisedHands[call.peerUserId]),
        pinned:
          pinnedUserId === call.peerUserId ||
          spotlightUserId === call.peerUserId ||
          pinnedUserId === 'peer',
      },
    ];
  }, [
    meId,
    localStream,
    raisedHands,
    pinnedUserId,
    call,
    remoteStream,
    remoteIsScreen,
    spotlightUserId,
  ]);

  const focusUserId = pinnedUserId || spotlightUserId || null;

  const focusPerson = useMemo(() => {
    if (usePresentationLayout) return null;
    if (!focusUserId) return null;
    return people.find((p) => p.userId === focusUserId) ?? null;
  }, [usePresentationLayout, focusUserId, people]);

  const effectiveLayout: CallLayoutMode = useMemo(() => {
    if (usePresentationLayout) return 'spotlight';
    if (layout === 'auto') return focusPerson ? 'spotlight' : 'grid';
    return layout;
  }, [usePresentationLayout, layout, focusPerson]);

  const raisedHandList = useMemo(
    () => people.filter((p) => p.handRaised).map((p) => ({ userId: p.userId, name: p.name })),
    [people],
  );

  const handlePin = useCallback(
    (userId: string) => {
      if (pinnedUserId === userId) {
        onSetPinnedUserId(null);
        onSetSpotlight(null);
        return;
      }
      onSetPinnedUserId(userId);
      onSetSpotlight(userId);
      if (layout === 'grid') onSetLayout('spotlight');
    },
    [pinnedUserId, onSetPinnedUserId, onSetSpotlight, layout, onSetLayout],
  );

  const handleShareClick = useCallback(async () => {
    if (call.sharingScreen) {
      onToggleScreenShare();
      return;
    }
    setShareBusy(true);
    try {
      if (isTauriApp()) {
        const targets = await listNativeCaptureTargets();
        if (targets.length > 0) {
          setShareTargets(targets);
          return;
        }
      }
      onToggleScreenShare();
    } catch {
      onToggleScreenShare();
    } finally {
      setShareBusy(false);
    }
  }, [call.sharingScreen, onToggleScreenShare]);

  const pickShareTarget = useCallback(
    (target: CaptureTarget) => {
      setShareTargets(null);
      onToggleScreenShare({ nativeTarget: target });
    },
    [onToggleScreenShare],
  );

  useEffect(() => {
    if (!error || call.phase !== 'idle') return;
    const t = window.setTimeout(onDismissError, 4000);
    return () => window.clearTimeout(t);
  }, [error, call.phase, onDismissError]);

  useEffect(() => {
    if (call.phase === 'idle' || call.phase === 'ended') setShareTargets(null);
  }, [call.phase]);

  const inVideoCall =
    call.mediaKind === 'video' &&
    (call.phase === 'outgoing' || call.phase === 'connecting' || call.phase === 'connected');

  const inAudioCall =
    call.mediaKind === 'audio' &&
    (call.phase === 'outgoing' || call.phase === 'connecting' || call.phase === 'connected');

  const title = call.isGroup ? call.conversationName || 'Group call' : call.peerName || 'Call';
  const subtitle =
    call.phase === 'outgoing'
      ? 'Calling…'
      : call.phase === 'connecting'
        ? 'Connecting…'
        : call.isGroup
          ? `${call.peers.length + 1} people`
          : 'Connected';

  const renderGrid = (tiles: TilePerson[]) => (
    <div
      className={cn(
        'grid min-h-0 flex-1 gap-3 p-3 sm:p-4',
        tiles.length <= 1
          ? 'grid-cols-1'
          : tiles.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : tiles.length <= 4
              ? 'grid-cols-2'
              : 'grid-cols-2 lg:grid-cols-3',
      )}
    >
      {tiles.map((p) => (
        <PeerVideoTile key={p.userId} person={p} onPin={handlePin} />
      ))}
    </div>
  );

  const renderSpotlight = (
    main: TilePerson | null,
    strip: TilePerson[],
    mainStream?: MediaStream | null,
    mainLabel?: string,
  ) => (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="min-h-0 flex-1">
        {mainStream ? (
          <StageVideo stream={mainStream} label={mainLabel || main?.name || 'Spotlight'} muted />
        ) : main ? (
          <PeerVideoTile person={{ ...main, pinned: true }} fill onPin={handlePin} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-[#1a1b1e] text-sm text-ink-400">
            Pin a participant to spotlight them
          </div>
        )}
      </div>
      {strip.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 sm:justify-center">
          {strip.map((p) => (
            <PeerVideoTile key={p.userId} person={p} compact onPin={handlePin} />
          ))}
        </div>
      ) : null}
    </div>
  );

  const renderSidebar = (main: TilePerson, strip: TilePerson[]) => (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 md:flex-row">
      <div className="relative min-h-[42vh] flex-1 md:min-h-0">
        <PeerVideoTile person={{ ...main, pinned: true }} fill onPin={handlePin} />
      </div>
      <div className="flex gap-2 overflow-x-auto md:w-40 md:shrink-0 md:flex-col md:overflow-y-auto md:overflow-x-hidden">
        {strip.map((p) => (
          <PeerVideoTile key={p.userId} person={p} compact onPin={handlePin} />
        ))}
      </div>
    </div>
  );

  const videoBody = () => {
    if (usePresentationLayout) {
      const strip = people.filter((p) => !(presentingPeer && p.userId === presentingPeer.userId));
      return renderSpotlight(null, strip, stageStream, stageLabel);
    }
    if (effectiveLayout === 'grid' || (!focusPerson && effectiveLayout !== 'sidebar')) {
      return renderGrid(people);
    }
    const main = focusPerson || people[0];
    const strip = people.filter((p) => p.userId !== main.userId);
    if (effectiveLayout === 'sidebar') return renderSidebar(main, strip);
    return renderSpotlight(main, strip);
  };

  return (
    <>
      {shareTargets ? (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[min(80vh,480px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#202124] shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-base font-semibold text-white">Present a window</p>
              <p className="mt-1 text-xs text-white/55">
                Choose a window or screen. Avoid sharing this call to prevent a mirror loop.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {shareTargets.map((t) => (
                <button
                  key={`${t.kind}-${t.id}`}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10"
                  onClick={() => pickShareTarget(t)}
                >
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                    {t.kind === 'monitor' ? 'Screen' : 'Window'}
                  </span>
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-white/10 px-4 py-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShareTargets(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {call.phase === 'incoming' ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[10050] flex justify-end p-3 sm:p-4"
          role="dialog"
          aria-label="Incoming call"
        >
          <div
            className={cn(
              'pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-2xl',
              'border border-white/10 bg-[#202124]/95 shadow-2xl backdrop-blur-md',
              'animate-[incoming-call-toast_0.32s_ease-out]',
            )}
          >
            <div className="flex items-start gap-3 px-4 pb-3 pt-4">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/25 text-brand-300">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />
                {call.mediaKind === 'video' ? (
                  <IconVideo className="relative h-5 w-5" />
                ) : (
                  <IconPhone className="relative h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Incoming {call.isGroup ? 'group ' : ''}
                  {call.mediaKind === 'video' ? 'video' : 'voice'} call
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">
                  {call.isGroup ? call.conversationName || 'Group' : call.peerName}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/55">
                  {call.isGroup
                    ? `${call.fromName || 'Someone'} started a call`
                    : 'is calling you'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={onReject}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-500/90 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
              >
                <IconPhoneOff className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-brand-400"
              >
                {call.mediaKind === 'video' ? (
                  <IconVideo className="h-4 w-4" />
                ) : (
                  <IconPhone className="h-4 w-4" />
                )}
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inVideoCall ? (
        <div className="fixed inset-0 z-[10045] flex flex-col bg-[#0e0f11]">
          <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <p className="truncate text-[11px] text-white/45">
                {subtitle}
                {someoneSharing ? ' · Presenting' : ''}
                {raisedHandList.length
                  ? ` · ${raisedHandList.map((h) => h.name).join(', ')} raised hand`
                  : ''}
              </p>
            </div>
            {call.phase === 'connected' ? (
              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70">
                {call.isGroup ? `${call.peers.length + 1} in call` : '1:1'}
              </span>
            ) : null}
          </header>

          <div className="relative min-h-0 flex-1">{videoBody()}</div>

          <ReactionBurst reactions={reactions} />

          <div className="flex justify-center px-3 pb-5 pt-2 sm:pb-6">
            <MeetingDock
              call={call}
              shareBusy={shareBusy}
              handRaised={handRaised}
              layout={layout}
              onToggleMute={onToggleMute}
              onToggleCamera={onToggleCamera}
              onToggleScreenShare={() => void handleShareClick()}
              onToggleHand={onToggleHand}
              onSendReaction={onSendReaction}
              onSetLayout={onSetLayout}
              onHangup={onHangup}
            />
          </div>
        </div>
      ) : null}

      {inAudioCall ? (
        <div className="fixed inset-x-0 bottom-0 z-[10040] flex justify-center p-4 sm:bottom-6 sm:p-0">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#202124]/95 p-4 shadow-2xl backdrop-blur-md sm:w-auto sm:min-w-[360px]">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/25 text-brand-300">
                <IconPhone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{title}</p>
                <p className="text-[11px] text-white/45">{subtitle}</p>
              </div>
            </div>
            <div className="flex justify-center">
              <MeetingDock
                call={call}
                shareBusy={false}
                handRaised={handRaised}
                layout={layout}
                onToggleMute={onToggleMute}
                onToggleCamera={onToggleCamera}
                onToggleScreenShare={() => undefined}
                onToggleHand={onToggleHand}
                onSendReaction={onSendReaction}
                onSetLayout={onSetLayout}
                onHangup={onHangup}
              />
            </div>
            <ReactionBurst reactions={reactions} />
          </div>
        </div>
      ) : null}

      {error && call.phase === 'idle' ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[10040] flex justify-end p-3 sm:p-4"
          role="status"
          aria-live="polite"
        >
          <div
            className={cn(
              'pointer-events-auto flex max-w-[280px] items-center gap-2 rounded-xl',
              'border border-ink-600 bg-ink-800/95 px-2.5 py-2 shadow-lg backdrop-blur-md',
              'animate-[incoming-call-toast_0.28s_ease-out]',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <IconPhoneOff className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-ink-100">{error}</p>
            <button
              type="button"
              title="Dismiss"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                onDismissError();
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-700 hover:text-ink-100"
            >
              <IconX className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
