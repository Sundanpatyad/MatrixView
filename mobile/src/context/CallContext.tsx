import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Vibration } from 'react-native';

import {
  callSocket,
  clearSocketHandlerKeys,
  patchSocketHandlers,
  type CallMediaKind,
  type CallRoom,
} from '@/lib/socket/socket';
import {
  CallSession,
  idleCallState,
  type CallState,
} from '@/lib/webrtc/callSession';
import { CALLING_UNSUPPORTED_MESSAGE, isCallingSupported } from '@/lib/webrtc/webrtcModule';

import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

/** Repeating pattern that approximates a ringtone without shipping an audio asset. */
const RING_PATTERN = [0, 700, 900];

interface StartCallInput {
  conversationId: string;
  title: string;
  mediaKind: CallMediaKind;
  isGroup: boolean;
  peerUserId?: string | null;
}

interface JoinCallInput {
  conversationId: string;
  callId: string;
  mediaKind: CallMediaKind;
  title: string;
}

interface CallContextValue {
  call: CallState;
  /** Group calls in progress, keyed by conversation id, for the join banner. */
  activeRooms: Record<string, CallRoom>;
  callingSupported: boolean;
  startCall: (input: StartCallInput) => Promise<void>;
  joinGroupCall: (input: JoinCallInput) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

function newCallId(isGroup: boolean): string {
  const prefix = isGroup ? 'gcall' : 'call';
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  const [call, setCall] = useState<CallState>(idleCallState());
  const [activeRooms, setActiveRooms] = useState<Record<string, CallRoom>>({});

  const callingSupported = useMemo(() => isCallingSupported(), []);

  /**
   * Signaling handlers fire outside React, so the session reads call identity
   * from a ref rather than from captured state.
   */
  const stateRef = useRef<CallState>(idleCallState());
  const sessionRef = useRef<CallSession | null>(null);

  if (!sessionRef.current) {
    const target = (toUserId: string) => ({
      callId: stateRef.current.callId ?? '',
      conversationId: stateRef.current.conversationId ?? '',
      toUserId,
    });

    sessionRef.current = new CallSession(
      (next) => {
        stateRef.current = next;
        setCall(next);
      },
      {
        sendOffer: (toUserId, sdp) => callSocket.offer({ ...target(toUserId), sdp }),
        sendAnswer: (toUserId, sdp) => callSocket.answer({ ...target(toUserId), sdp }),
        sendIce: (toUserId, candidate) => callSocket.ice({ ...target(toUserId), candidate }),
      },
    );
  }

  const session = sessionRef.current;

  const stopRinging = useCallback(() => {
    Vibration.cancel();
  }, []);

  const endCall = useCallback(
    (error: string | null = null) => {
      stopRinging();
      session.end(error);
    },
    [session, stopRinging],
  );

  // Ring only while an incoming call is pending.
  useEffect(() => {
    if (call.phase === 'incoming') {
      Vibration.vibrate(RING_PATTERN, true);
      return () => Vibration.cancel();
    }
    Vibration.cancel();
    return undefined;
  }, [call.phase]);

  // Teardown reasons are reported once, then cleared so they cannot re-fire.
  useEffect(() => {
    if (!call.error) return;
    toast.error(call.error);
    session.clearError();
  }, [call.error, session, toast]);

  // A signed-out user must not be left in a call.
  useEffect(() => {
    if (!isAuthenticated && stateRef.current.phase !== 'idle') {
      endCall();
      setActiveRooms({});
    }
  }, [isAuthenticated, endCall]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    patchSocketHandlers({
      onCallIncoming: (payload) => {
        const busy = stateRef.current.phase !== 'idle';
        if (busy || !callingSupported) {
          callSocket.reject({ callId: payload.callId, conversationId: payload.conversationId });
          return;
        }

        session.ringIncoming({
          callId: payload.callId,
          conversationId: payload.conversationId,
          isGroup: Boolean(payload.isGroup),
          mediaKind: payload.mediaKind ?? 'audio',
          title: payload.isGroup ? (payload.conversationName ?? 'Group call') : payload.fromName,
          peerUserId: payload.fromUserId,
        });
      },

      // DM only: the callee picked up, so the caller drives the offer.
      onCallAccepted: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        session.markConnecting();
        void session.addPeerAndOffer(payload.fromUserId, stateRef.current.title);
      },

      onCallEnded: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        const reason =
          payload.reason === 'rejected'
            ? 'Call declined'
            : payload.reason === 'disconnected'
              ? 'The other side lost connection'
              : null;
        endCall(reason);
      },

      onCallOffer: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        void session.onRemoteOffer(payload.fromUserId, payload.fromName ?? 'Participant', payload.sdp);
      },

      onCallAnswer: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        void session.onRemoteAnswer(payload.fromUserId, payload.sdp);
      },

      onCallIce: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        void session.onRemoteIce(payload.fromUserId, payload.candidate);
      },

      // We were here first, so we offer to the newcomer.
      onCallPeerJoined: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        session.markConnecting();
        void session.addPeerAndOffer(payload.userId, payload.name);
      },

      onCallPeerLeft: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        session.removePeer(payload.userId);
      },

      onCallRoom: (payload) => {
        setActiveRooms((prev) => {
          const next = { ...prev };
          if (payload.active && payload.room) next[payload.conversationId] = payload.room;
          else delete next[payload.conversationId];
          return next;
        });
      },

      onCallScreen: (payload) => {
        if (payload.callId !== stateRef.current.callId) return;
        session.setPeerSharing(payload.fromUserId, payload.active);
      },
    });

    return () =>
      clearSocketHandlerKeys([
        'onCallIncoming',
        'onCallAccepted',
        'onCallEnded',
        'onCallOffer',
        'onCallAnswer',
        'onCallIce',
        'onCallPeerJoined',
        'onCallPeerLeft',
        'onCallRoom',
        'onCallScreen',
      ]);
  }, [isAuthenticated, callingSupported, session, endCall]);

  const startCall = useCallback(
    async (input: StartCallInput) => {
      if (!callingSupported) {
        toast.error(CALLING_UNSUPPORTED_MESSAGE);
        return;
      }
      if (stateRef.current.phase !== 'idle') {
        toast.info('You are already on a call.');
        return;
      }

      const callId = newCallId(input.isGroup);

      try {
        await session.startOutgoing({
          callId,
          conversationId: input.conversationId,
          isGroup: input.isGroup,
          mediaKind: input.mediaKind,
          title: input.title,
          peerUserId: input.peerUserId ?? null,
        });
      } catch (error) {
        endCall(error instanceof Error ? error.message : 'Could not access your microphone.');
        return;
      }

      const ack = await callSocket.invite({
        conversationId: input.conversationId,
        callId,
        mediaKind: input.mediaKind,
      });

      if (!ack.ok) {
        endCall(ack.error ?? 'Could not start the call.');
      }
    },
    [callingSupported, endCall, session, toast],
  );

  const joinGroupCall = useCallback(
    async (input: JoinCallInput) => {
      if (!callingSupported) {
        toast.error(CALLING_UNSUPPORTED_MESSAGE);
        return;
      }
      if (stateRef.current.phase !== 'idle') {
        toast.info('You are already on a call.');
        return;
      }

      try {
        await session.prepareJoin(input);
      } catch (error) {
        endCall(error instanceof Error ? error.message : 'Could not access your microphone.');
        return;
      }

      const ack = await callSocket.join({ callId: input.callId, conversationId: input.conversationId });
      if (!ack.ok) {
        endCall(ack.error ?? 'Could not join the call.');
        return;
      }

      // Everyone already in the room offers to us, so we only prepare slots.
      (ack.peers ?? [])
        .filter((peer) => peer.userId !== user?.id)
        .forEach((peer) => session.addExpectedPeer(peer.userId, peer.name));
      session.markConnectedIfAlone();
    },
    [callingSupported, endCall, session, toast, user?.id],
  );

  const acceptCall = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'incoming' || !current.callId || !current.conversationId) return;

    stopRinging();

    try {
      await session.acceptIncoming();
    } catch (error) {
      callSocket.reject({ callId: current.callId, conversationId: current.conversationId });
      endCall(error instanceof Error ? error.message : 'Could not access your microphone.');
      return;
    }

    const ack = await callSocket.accept({
      callId: current.callId,
      conversationId: current.conversationId,
    });

    if (!ack.ok) {
      endCall(ack.error ?? 'The call is no longer available.');
      return;
    }

    if (ack.isGroup) {
      (ack.peers ?? [])
        .filter((peer) => peer.userId !== user?.id)
        .forEach((peer) => session.addExpectedPeer(peer.userId, peer.name));
      session.markConnectedIfAlone();
    }
  }, [endCall, session, stopRinging, user?.id]);

  const rejectCall = useCallback(() => {
    const current = stateRef.current;
    if (!current.callId || !current.conversationId) return;
    callSocket.reject({ callId: current.callId, conversationId: current.conversationId });
    endCall();
  }, [endCall]);

  const hangup = useCallback(() => {
    const current = stateRef.current;
    if (current.callId && current.conversationId) {
      callSocket.hangup({
        callId: current.callId,
        conversationId: current.conversationId,
        reason: 'hangup',
      });
    }
    endCall();
  }, [endCall]);

  const toggleMute = useCallback(() => session.toggleMute(), [session]);
  const toggleCamera = useCallback(() => session.toggleCamera(), [session]);
  const switchCamera = useCallback(() => session.switchCamera(), [session]);

  const value = useMemo<CallContextValue>(
    () => ({
      call,
      activeRooms,
      callingSupported,
      startCall,
      joinGroupCall,
      acceptCall,
      rejectCall,
      hangup,
      toggleMute,
      toggleCamera,
      switchCamera,
    }),
    [
      call,
      activeRooms,
      callingSupported,
      startCall,
      joinGroupCall,
      acceptCall,
      rejectCall,
      hangup,
      toggleMute,
      toggleCamera,
      switchCamera,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
}
