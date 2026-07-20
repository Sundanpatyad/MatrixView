import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emitCallAccept,
  emitCallAnswer,
  emitCallHangup,
  emitCallHand,
  emitCallIce,
  emitCallInvite,
  emitCallJoin,
  emitCallOffer,
  emitCallReaction,
  emitCallReject,
  emitCallScreen,
  emitCallSpotlight,
  setChatSocketHandlers,
  type CallAcceptedPayload,
  type CallEndedPayload,
  type CallHandPayload,
  type CallIcePayload,
  type CallIncomingPayload,
  type CallPeerJoinedPayload,
  type CallPeerLeftPayload,
  type CallReactionPayload,
  type CallRoomPayload,
  type CallScreenPayload,
  type CallSdpPayload,
  type CallSpotlightPayload,
} from '@/lib/socket/chatSocket';
import {
  AudioCallSession,
  type AudioCallState,
  type CallMediaKind,
} from '@/lib/webrtc/audioCall';
import { CallRingtone } from '@/lib/webrtc/callRingtone';
import {
  GroupCallSession,
  type GroupCallState,
  type GroupPeerInfo,
} from '@/lib/webrtc/groupCall';
import type { CaptureTarget } from '@/lib/webrtc/screenShare';

export type CallLayoutMode = 'auto' | 'grid' | 'spotlight' | 'sidebar';

export type CallFloatingReaction = {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  at: number;
};

const REACTION_TTL_MS = 3200;
const MAX_FLOATING_REACTIONS = 24;

export type UnifiedCallState = {
  scope: 'dm' | 'group' | null;
  phase: AudioCallState['phase'] | GroupCallState['phase'];
  callId: string | null;
  conversationId: string | null;
  peerUserId: string | null;
  peerName: string;
  conversationName: string;
  mediaKind: CallMediaKind;
  muted: boolean;
  cameraOff: boolean;
  sharingScreen: boolean;
  /** Remote user currently presenting (screen share). */
  presentingUserId: string | null;
  error: string | null;
  isGroup: boolean;
  peers: GroupPeerInfo[];
  fromName: string;
};

export type ActiveGroupRoom = {
  callId: string;
  conversationId: string;
  mediaKind: CallMediaKind;
  participantCount: number;
  participants: Array<{ userId: string; name: string }>;
  members: Array<{ userId: string; name: string | null; joined: boolean }>;
};

const idle: UnifiedCallState = {
  scope: null,
  phase: 'idle',
  callId: null,
  conversationId: null,
  peerUserId: null,
  peerName: '',
  conversationName: '',
  mediaKind: 'audio',
  muted: false,
  cameraOff: false,
  sharingScreen: false,
  presentingUserId: null,
  error: null,
  isGroup: false,
  peers: [],
  fromName: '',
};

function fromDm(s: AudioCallState, presentingUserId: string | null = null): UnifiedCallState {
  return {
    scope: s.phase === 'idle' ? null : 'dm',
    phase: s.phase,
    callId: s.callId,
    conversationId: s.conversationId,
    peerUserId: s.peerUserId,
    peerName: s.peerName,
    conversationName: s.peerName,
    mediaKind: s.mediaKind,
    muted: s.muted,
    cameraOff: s.cameraOff,
    sharingScreen: s.sharingScreen,
    presentingUserId: s.phase === 'idle' ? null : presentingUserId,
    error: s.error,
    isGroup: false,
    peers: [],
    fromName: s.peerName,
  };
}

function fromGroup(s: GroupCallState, presentingUserId: string | null = null): UnifiedCallState {
  return {
    scope: s.phase === 'idle' ? null : 'group',
    phase: s.phase,
    callId: s.callId,
    conversationId: s.conversationId,
    peerUserId: null,
    peerName: s.conversationName || s.fromName,
    conversationName: s.conversationName,
    mediaKind: s.mediaKind,
    muted: s.muted,
    cameraOff: s.cameraOff,
    sharingScreen: s.sharingScreen,
    presentingUserId: s.phase === 'idle' ? null : presentingUserId,
    error: s.error,
    isGroup: true,
    peers: s.peers,
    fromName: s.fromName,
  };
}

/**
 * Wire DM + group call signaling into socket handlers.
 */
export function useAudioCall(meId: string) {
  const [call, setCall] = useState<UnifiedCallState>(idle);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [activeRooms, setActiveRooms] = useState<Record<string, ActiveGroupRoom>>({});
  const [presentingUserId, setPresentingUserId] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<Record<string, true>>({});
  const [handRaised, setHandRaised] = useState(false);
  const [reactions, setReactions] = useState<CallFloatingReaction[]>([]);
  const [spotlightUserId, setSpotlightUserId] = useState<string | null>(null);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [layout, setLayout] = useState<CallLayoutMode>('auto');
  const dmRef = useRef<AudioCallSession | null>(null);
  const groupRef = useRef<GroupCallSession | null>(null);
  const scopeRef = useRef<'dm' | 'group' | null>(null);
  const ringtoneRef = useRef<CallRingtone | null>(null);
  const presentingUserIdRef = useRef<string | null>(null);
  presentingUserIdRef.current = presentingUserId;

  const clearMeetingUx = useCallback(() => {
    setRaisedHands({});
    setHandRaised(false);
    setReactions([]);
    setSpotlightUserId(null);
    setPinnedUserId(null);
    setLayout('auto');
  }, []);

  const pushReaction = useCallback((entry: Omit<CallFloatingReaction, 'id' | 'at'>) => {
    const id = `rx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const at = Date.now();
    setReactions((prev) => {
      const next = [...prev, { ...entry, id, at }];
      return next.length > MAX_FLOATING_REACTIONS ? next.slice(-MAX_FLOATING_REACTIONS) : next;
    });
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, REACTION_TTL_MS);
  }, []);

  const getRingtone = useCallback(() => {
    if (!ringtoneRef.current) ringtoneRef.current = new CallRingtone();
    return ringtoneRef.current;
  }, []);

  const getDm = useCallback(() => {
    if (!dmRef.current) {
      dmRef.current = new AudioCallSession({
        onState: (s) => {
          if (scopeRef.current === 'group') return;
          scopeRef.current = s.phase === 'idle' ? null : 'dm';
          if (s.phase === 'idle') {
            setScreenShareStream(null);
            setPresentingUserId(null);
            clearMeetingUx();
          }
          setCall(fromDm(s, presentingUserIdRef.current));
        },
        onLocalStream: setLocalStream,
        onRemoteStream: setRemoteStream,
        onScreenStream: setScreenShareStream,
        sendOffer: (p) =>
          emitCallOffer({
            callId: p.callId,
            conversationId: p.conversationId,
            toUserId: p.toUserId,
            sdp: p.sdp,
          }),
        sendAnswer: (p) =>
          emitCallAnswer({
            callId: p.callId,
            conversationId: p.conversationId,
            toUserId: p.toUserId,
            sdp: p.sdp,
          }),
        sendIce: (p) =>
          emitCallIce({
            callId: p.callId,
            conversationId: p.conversationId,
            toUserId: p.toUserId,
            candidate: p.candidate,
          }),
        sendHangup: (p) =>
          emitCallHangup({
            callId: p.callId,
            conversationId: p.conversationId,
            reason: p.reason,
          }),
      });
    }
    return dmRef.current;
  }, [clearMeetingUx]);

  const getGroup = useCallback(() => {
    if (!groupRef.current) {
      groupRef.current = new GroupCallSession({
        onState: (s) => {
          if (scopeRef.current === 'dm') return;
          scopeRef.current = s.phase === 'idle' ? null : 'group';
          if (s.phase === 'idle') {
            setRemoteStream(null);
            setScreenShareStream(null);
            setPresentingUserId(null);
            clearMeetingUx();
          }
          setCall(fromGroup(s, presentingUserIdRef.current));
        },
        onLocalStream: setLocalStream,
        onScreenStream: setScreenShareStream,
        sendOffer: (p) =>
          emitCallOffer({
            callId: p.callId,
            conversationId: p.conversationId,
            toUserId: p.toUserId,
            sdp: p.sdp,
          }),
        sendAnswer: (p) =>
          emitCallAnswer({
            callId: p.callId,
            conversationId: p.conversationId,
            toUserId: p.toUserId,
            sdp: p.sdp,
          }),
        sendIce: (p) =>
          emitCallIce({
            callId: p.callId,
            conversationId: p.conversationId,
            toUserId: p.toUserId,
            candidate: p.candidate,
          }),
        sendLeave: (p) =>
          emitCallHangup({
            callId: p.callId,
            conversationId: p.conversationId,
            reason: p.reason,
          }),
      });
    }
    return groupRef.current;
  }, [clearMeetingUx]);

  const activeCallMeta = useCallback(() => {
    const state =
      scopeRef.current === 'group' ? getGroup().getState() : getDm().getState();
    if (!state.callId || !state.conversationId) return null;
    return {
      callId: state.callId,
      conversationId: state.conversationId,
      toUserId:
        scopeRef.current === 'dm' ? getDm().getState().peerUserId ?? undefined : undefined,
    };
  }, [getDm, getGroup]);

  const toggleHand = useCallback(() => {
    const meta = activeCallMeta();
    if (!meta || !meId) return;
    const next = !handRaised;
    setHandRaised(next);
    setRaisedHands((prev) => {
      const copy = { ...prev };
      if (next) copy[meId] = true;
      else delete copy[meId];
      return copy;
    });
    emitCallHand({ ...meta, raised: next });
  }, [activeCallMeta, handRaised, meId]);

  const sendReaction = useCallback(
    (emoji: string) => {
      const meta = activeCallMeta();
      if (!meta || !meId) return;
      pushReaction({ userId: meId, name: 'You', emoji });
      emitCallReaction({ ...meta, emoji });
    },
    [activeCallMeta, meId, pushReaction],
  );

  const setRoomSpotlight = useCallback(
    (targetUserId: string | null) => {
      const meta = activeCallMeta();
      if (!meta) return;
      setSpotlightUserId(targetUserId);
      if (targetUserId) setPinnedUserId(targetUserId);
      emitCallSpotlight({ ...meta, targetUserId });
    },
    [activeCallMeta],
  );

  useEffect(() => {
    return () => {
      ringtoneRef.current?.dispose();
      ringtoneRef.current = null;
      dmRef.current?.endLocal(null);
      groupRef.current?.endLocal(null);
      dmRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const tone = getRingtone();
    if (call.phase === 'incoming') tone.start('incoming');
    else if (call.phase === 'outgoing') tone.start('outgoing');
    else tone.stop();
  }, [call.phase, getRingtone]);

  const startCall = useCallback(
    async (input: {
      conversationId: string;
      peerUserId?: string;
      peerName?: string;
      conversationName?: string;
      mediaKind?: CallMediaKind;
      isGroup?: boolean;
    }) => {
      if (!meId) throw new Error('Not signed in');
      if (scopeRef.current) throw new Error('Already in a call');
      const mediaKind = input.mediaKind ?? 'audio';

      if (input.isGroup) {
        scopeRef.current = 'group';
        const session = getGroup();
        const callId = await session.startHost({
          meId,
          conversationId: input.conversationId,
          conversationName: input.conversationName ?? 'Group',
          mediaKind,
        });
        const res = await emitCallInvite({
          conversationId: input.conversationId,
          callId,
          mediaKind,
        });
        if (!res.ok) {
          session.endLocal(res.error ?? 'Could not start call');
          scopeRef.current = null;
          throw new Error(res.error ?? 'Could not start call');
        }
        await session.enterCall({ peers: res.peers ?? [] });
        return;
      }

      if (!input.peerUserId) throw new Error('Missing peer');
      scopeRef.current = 'dm';
      const session = getDm();
      const callId = await session.startOutgoing({
        meId,
        conversationId: input.conversationId,
        peerUserId: input.peerUserId,
        peerName: input.peerName ?? 'User',
        mediaKind,
      });
      const res = await emitCallInvite({
        conversationId: input.conversationId,
        callId,
        mediaKind,
      });
      if (!res.ok) {
        session.endLocal(res.error ?? 'Could not start call');
        scopeRef.current = null;
        throw new Error(res.error ?? 'Could not start call');
      }
    },
    [getDm, getGroup, meId],
  );

  const joinGroupCall = useCallback(
    async (input: {
      conversationId: string;
      callId: string;
      mediaKind?: CallMediaKind;
      conversationName?: string;
    }) => {
      if (!meId) throw new Error('Not signed in');
      if (scopeRef.current) throw new Error('Already in a call');
      scopeRef.current = 'group';
      const session = getGroup();
      const ok = session.prepareJoin({
        meId,
        callId: input.callId,
        conversationId: input.conversationId,
        conversationName: input.conversationName ?? 'Group',
        mediaKind: input.mediaKind ?? 'audio',
      });
      if (!ok) {
        scopeRef.current = null;
        throw new Error('Already in a call');
      }
      getRingtone().stop();
      // Acquire media before join signal so peer offers are answered with A/V tracks.
      try {
        await session.acquireMedia();
      } catch {
        session.endLocal(
          (input.mediaKind ?? 'audio') === 'video'
            ? 'Camera and microphone permission denied'
            : 'Microphone permission denied',
        );
        scopeRef.current = null;
        throw new Error('Media permission denied');
      }
      const res = await emitCallJoin({
        callId: input.callId,
        conversationId: input.conversationId,
      });
      if (!res.ok) {
        session.endLocal(res.error ?? 'Could not join call');
        scopeRef.current = null;
        throw new Error(res.error ?? 'Could not join call');
      }
      await session.enterCall({ peers: res.peers ?? [] });
    },
    [getGroup, getRingtone, meId],
  );

  const acceptCall = useCallback(async () => {
    getRingtone().stop();
    if (scopeRef.current === 'group' || call.isGroup) {
      const session = getGroup();
      const st = session.getState();
      if (!st.callId || !st.conversationId) return;
      try {
        await session.acquireMedia();
      } catch {
        session.endLocal(
          st.mediaKind === 'video'
            ? 'Camera and microphone permission denied'
            : 'Microphone permission denied',
        );
        scopeRef.current = null;
        throw new Error('Media permission denied');
      }
      const res = await emitCallAccept({
        callId: st.callId,
        conversationId: st.conversationId,
      });
      if (!res.ok) {
        session.endLocal(res.error ?? 'Could not accept');
        scopeRef.current = null;
        throw new Error(res.error ?? 'Could not accept');
      }
      await session.enterCall({ peers: res.peers ?? [] });
      return;
    }
    const session = getDm();
    const st = session.getState();
    if (!st.callId || !st.conversationId) return;
    await session.acceptIncoming();
    await emitCallAccept({ callId: st.callId, conversationId: st.conversationId });
  }, [call.isGroup, getDm, getGroup, getRingtone]);

  const rejectCall = useCallback(() => {
    getRingtone().stop();
    if (scopeRef.current === 'group' || call.isGroup) {
      const session = getGroup();
      const st = session.getState();
      if (st.callId && st.conversationId) {
        emitCallReject({ callId: st.callId, conversationId: st.conversationId });
      }
      session.endLocal(null);
      scopeRef.current = null;
      return;
    }
    const session = getDm();
    const st = session.getState();
    if (st.callId && st.conversationId) {
      emitCallReject({ callId: st.callId, conversationId: st.conversationId });
    }
    session.rejectIncoming();
    scopeRef.current = null;
  }, [call.isGroup, getDm, getGroup, getRingtone]);

  const hangup = useCallback(() => {
    getRingtone().stop();
    if (scopeRef.current === 'group') {
      getGroup().leave('hangup');
      scopeRef.current = null;
      return;
    }
    if (scopeRef.current === 'dm') {
      getDm().hangup('hangup');
      scopeRef.current = null;
    }
  }, [getDm, getGroup, getRingtone]);

  const clearCallError = useCallback(() => {
    getDm().clearError();
    getGroup().clearError();
  }, [getDm, getGroup]);

  const toggleMute = useCallback(() => {
    if (scopeRef.current === 'group') {
      const s = getGroup();
      s.setMuted(!s.getState().muted);
      return;
    }
    const s = getDm();
    s.setMuted(!s.getState().muted);
  }, [getDm, getGroup]);

  const toggleCamera = useCallback(() => {
    if (scopeRef.current === 'group') {
      const s = getGroup();
      s.setCameraOff(!s.getState().cameraOff);
      return;
    }
    const s = getDm();
    s.setCameraOff(!s.getState().cameraOff);
  }, [getDm, getGroup]);

  const toggleScreenShare = useCallback(
    async (opts?: { nativeTarget?: CaptureTarget }) => {
      const announce = (active: boolean) => {
        const state =
          scopeRef.current === 'group' ? getGroup().getState() : getDm().getState();
        if (!state.callId || !state.conversationId) return;
        emitCallScreen({
          callId: state.callId,
          conversationId: state.conversationId,
          active,
          toUserId: scopeRef.current === 'dm' ? getDm().getState().peerUserId ?? undefined : undefined,
        });
        setPresentingUserId(active ? meId || null : null);
        setCall((c) => ({
          ...c,
          presentingUserId: active ? meId || null : null,
        }));
      };

      if (scopeRef.current === 'group') {
        const s = getGroup();
        if (s.getState().sharingScreen) {
          await s.stopScreenShare();
          announce(false);
        } else {
          await s.startScreenShare(opts);
          announce(true);
        }
        return;
      }
      const s = getDm();
      if (s.getState().sharingScreen) {
        await s.stopScreenShare();
        announce(false);
      } else {
        await s.startScreenShare(opts);
        announce(true);
      }
    },
    [getDm, getGroup, meId],
  );

  const callHandlers = useCallback(
    () => ({
      onCallIncoming: (payload: CallIncomingPayload) => {
        if (!meId) return;
        if (scopeRef.current) {
          emitCallReject({
            callId: payload.callId,
            conversationId: payload.conversationId,
          });
          return;
        }
        if (payload.isGroup) {
          scopeRef.current = 'group';
          const ok = getGroup().ringIncoming({
            meId,
            callId: payload.callId,
            conversationId: payload.conversationId,
            conversationName: payload.conversationName ?? 'Group',
            fromName: payload.fromName,
            mediaKind: payload.mediaKind === 'video' ? 'video' : 'audio',
          });
          if (!ok) {
            scopeRef.current = null;
            emitCallReject({
              callId: payload.callId,
              conversationId: payload.conversationId,
            });
          }
          return;
        }
        scopeRef.current = 'dm';
        const ok = getDm().ringIncoming({
          meId,
          callId: payload.callId,
          conversationId: payload.conversationId,
          peerUserId: payload.fromUserId,
          peerName: payload.fromName,
          mediaKind: payload.mediaKind === 'video' ? 'video' : 'audio',
        });
        if (!ok) {
          scopeRef.current = null;
          emitCallReject({
            callId: payload.callId,
            conversationId: payload.conversationId,
          });
        }
      },
      onCallAccepted: (payload: CallAcceptedPayload) => {
        if (scopeRef.current !== 'dm') return;
        const st = getDm().getState();
        if (st.callId !== payload.callId) return;
        getRingtone().stop();
        void getDm().onAcceptedByPeer();
      },
      onCallOffer: (payload: CallSdpPayload) => {
        if (scopeRef.current === 'group') {
          const st = getGroup().getState();
          if (st.callId !== payload.callId) return;
          void getGroup().onRemoteOffer(
            payload.fromUserId,
            payload.fromName ?? 'Participant',
            payload.sdp,
          );
          return;
        }
        if (scopeRef.current !== 'dm') return;
        const st = getDm().getState();
        if (st.callId !== payload.callId) return;
        void getDm().onRemoteOffer(payload.sdp);
      },
      onCallAnswer: (payload: CallSdpPayload) => {
        if (scopeRef.current === 'group') {
          const st = getGroup().getState();
          if (st.callId !== payload.callId) return;
          void getGroup().onRemoteAnswer(payload.fromUserId, payload.sdp);
          return;
        }
        if (scopeRef.current !== 'dm') return;
        const st = getDm().getState();
        if (st.callId !== payload.callId) return;
        void getDm().onRemoteAnswer(payload.sdp);
      },
      onCallIce: (payload: CallIcePayload) => {
        if (scopeRef.current === 'group') {
          const st = getGroup().getState();
          if (st.callId !== payload.callId) return;
          void getGroup().onRemoteIce(payload.fromUserId, payload.candidate);
          return;
        }
        if (scopeRef.current !== 'dm') return;
        const st = getDm().getState();
        if (st.callId !== payload.callId) return;
        void getDm().onRemoteIce(payload.candidate);
      },
      onCallEnded: (payload: CallEndedPayload) => {
        getRingtone().stop();
        if (scopeRef.current === 'group') {
          const st = getGroup().getState();
          if (st.callId && st.callId !== payload.callId) return;
          getGroup().endLocal(null);
          scopeRef.current = null;
          return;
        }
        const st = getDm().getState();
        if (st.callId && st.callId !== payload.callId) return;
        const reason =
          payload.reason === 'rejected'
            ? 'Call declined'
            : payload.reason === 'disconnected'
              ? 'Peer disconnected'
              : null;
        getDm().endLocal(reason);
        scopeRef.current = null;
      },
      onCallPeerJoined: (payload: CallPeerJoinedPayload) => {
        if (scopeRef.current !== 'group') return;
        const st = getGroup().getState();
        if (st.callId !== payload.callId) return;
        void getGroup().onPeerJoined({
          userId: payload.userId,
          name: payload.name,
        });
        // Re-announce if we are already sharing so the new viewer gets presentation layout
        if (st.sharingScreen && st.callId && st.conversationId) {
          emitCallScreen({
            callId: st.callId,
            conversationId: st.conversationId,
            active: true,
          });
        }
      },
      onCallPeerLeft: (payload: CallPeerLeftPayload) => {
        if (scopeRef.current !== 'group') return;
        const st = getGroup().getState();
        if (st.callId !== payload.callId) return;
        getGroup().onPeerLeft(payload.userId);
        setRaisedHands((prev) => {
          if (!prev[payload.userId]) return prev;
          const next = { ...prev };
          delete next[payload.userId];
          return next;
        });
        setSpotlightUserId((cur) => (cur === payload.userId ? null : cur));
        setPinnedUserId((cur) => (cur === payload.userId ? null : cur));
        if (presentingUserIdRef.current === payload.userId) {
          setPresentingUserId(null);
          setCall((c) => ({ ...c, presentingUserId: null }));
        }
      },
      onCallScreen: (payload: CallScreenPayload) => {
        const activeCallId =
          scopeRef.current === 'group'
            ? getGroup().getState().callId
            : getDm().getState().callId;
        if (!activeCallId || activeCallId !== payload.callId) return;
        const nextId = payload.active ? payload.fromUserId : null;
        presentingUserIdRef.current = nextId;
        setPresentingUserId(nextId);
        if (scopeRef.current === 'group') {
          getGroup().setRemoteSharing(payload.fromUserId, payload.active);
          setCall(fromGroup(getGroup().getState(), nextId));
        } else {
          setCall(fromDm(getDm().getState(), nextId));
        }
      },
      onCallRoom: (payload: CallRoomPayload) => {
        setActiveRooms((prev) => {
          const next = { ...prev };
          if (!payload.active || !payload.room) {
            delete next[payload.conversationId];
          } else {
            next[payload.conversationId] = {
              callId: payload.room.callId,
              conversationId: payload.room.conversationId,
              mediaKind: payload.room.mediaKind,
              participantCount: payload.room.participantCount,
              participants: payload.room.participants,
              members: payload.room.members ?? payload.room.participants.map((p) => ({
                userId: p.userId,
                name: p.name,
                joined: true,
              })),
            };
            if (payload.room.raisedHands) {
              const hands: Record<string, true> = {};
              for (const id of payload.room.raisedHands) hands[id] = true;
              setRaisedHands(hands);
              setHandRaised(Boolean(meId && hands[meId]));
            }
            if (payload.room.spotlightUserId !== undefined) {
              setSpotlightUserId(payload.room.spotlightUserId);
            }
          }
          return next;
        });
      },
      onCallHand: (payload: CallHandPayload) => {
        const activeCallId =
          scopeRef.current === 'group'
            ? getGroup().getState().callId
            : getDm().getState().callId;
        if (!activeCallId || activeCallId !== payload.callId) return;
        setRaisedHands((prev) => {
          const next = { ...prev };
          if (payload.raised) next[payload.fromUserId] = true;
          else delete next[payload.fromUserId];
          return next;
        });
      },
      onCallReaction: (payload: CallReactionPayload) => {
        const activeCallId =
          scopeRef.current === 'group'
            ? getGroup().getState().callId
            : getDm().getState().callId;
        if (!activeCallId || activeCallId !== payload.callId) return;
        const peerName =
          scopeRef.current === 'group'
            ? getGroup().getState().peers.find((p) => p.userId === payload.fromUserId)?.name
            : getDm().getState().peerName;
        pushReaction({
          userId: payload.fromUserId,
          name: peerName || 'Someone',
          emoji: payload.emoji,
        });
      },
      onCallSpotlight: (payload: CallSpotlightPayload) => {
        const activeCallId =
          scopeRef.current === 'group'
            ? getGroup().getState().callId
            : getDm().getState().callId;
        if (!activeCallId || activeCallId !== payload.callId) return;
        setSpotlightUserId(payload.targetUserId);
      },
    }),
    [getDm, getGroup, getRingtone, meId, pushReaction],
  );

  return {
    call,
    localStream,
    remoteStream,
    screenShareStream,
    activeRooms,
    raisedHands,
    handRaised,
    reactions,
    spotlightUserId,
    pinnedUserId,
    layout,
    setPinnedUserId,
    setLayout,
    setRoomSpotlight,
    toggleHand,
    sendReaction,
    startCall,
    joinGroupCall,
    acceptCall,
    rejectCall,
    hangup,
    clearCallError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    callHandlers,
  };
}

/** Helper so ChatPage can merge call handlers without importing types twice. */
export function mergeCallSocketHandlers(
  base: Parameters<typeof setChatSocketHandlers>[0],
  callHandlers: ReturnType<ReturnType<typeof useAudioCall>['callHandlers']>,
) {
  setChatSocketHandlers({ ...base, ...callHandlers });
}
