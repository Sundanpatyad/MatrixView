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

import { chatApi } from '@/lib/api';
import {
  callSocket,
  clearSocketHandlerKeys,
  connectSocket,
  ensureSocketConnected,
  holdSocketConnection,
  isSocketConnected,
  patchSocketHandlers,
  releaseSocketConnection,
  waitUntilSocketConnected,
  type CallIncomingPayload,
  type CallMediaKind,
  type CallRoom,
} from '@/lib/socket/socket';
import {
  dismissIncomingCallNotification,
  presentIncomingCallNotification,
  subscribeCallDismiss,
  subscribeIncomingCall,
} from '@/lib/push/incomingCall';
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

  /**
   * A call can start or be answered while the socket is still asleep — pushed
   * from the background, resumed from a killed app — so signaling waits for a
   * live socket instead of failing with "you appear to be offline".
   */
  const ensureCallSocket = useCallback(async () => {
    if (isSocketConnected()) return true;
    await connectSocket();
    ensureSocketConnected();
    return waitUntilSocketConnected();
  }, []);

  const endCall = useCallback(
    (error: string | null = null) => {
      const callId = stateRef.current.callId;
      stopRinging();
      if (callId) void dismissIncomingCallNotification(callId);
      session.end(error);
    },
    [session, stopRinging],
  );

  const acceptRef = useRef<() => Promise<void>>(async () => undefined);

  const applyIncoming = useCallback(
    (payload: CallIncomingPayload, autoAccept = false) => {
      const current = stateRef.current;
      if (current.callId === payload.callId && current.phase !== 'idle') {
        if (autoAccept && current.phase === 'incoming') void acceptRef.current();
        return;
      }
      if (current.phase !== 'idle') {
        void chatApi
          .respondToCall({
            callId: payload.callId,
            conversationId: payload.conversationId,
            action: 'decline',
          })
          .catch(() => undefined);
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
      void presentIncomingCallNotification(payload);
      if (autoAccept) void acceptRef.current();
    },
    [session],
  );

  // Keep the socket alive across backgrounding for as long as a call is live,
  // otherwise answering from the lock screen would drop the signaling channel.
  useEffect(() => {
    if (call.phase === 'idle') {
      releaseSocketConnection('call');
      return undefined;
    }
    holdSocketConnection('call');
    // A call that arrived by push may have woken us with the socket down.
    void ensureCallSocket();
    return () => releaseSocketConnection('call');
  }, [call.phase, ensureCallSocket]);

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
    return subscribeIncomingCall((event) => {
      applyIncoming(event.payload, Boolean(event.autoAccept));
    });
  }, [applyIncoming]);

  useEffect(() => {
    return subscribeCallDismiss((callId) => {
      if (stateRef.current.callId !== callId) return;
      if (stateRef.current.phase === 'idle') return;
      stopRinging();
      session.end();
    });
  }, [session, stopRinging]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    patchSocketHandlers({
      onCallIncoming: (payload) => {
        applyIncoming(payload);
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
  }, [isAuthenticated, callingSupported, session, endCall, applyIncoming]);

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

      if (!(await ensureCallSocket())) {
        endCall('You appear to be offline.');
        return;
      }

      // The callee does not have to be online: the server rings their socket if
      // it can and always sends a high-priority call push as well.
      const ack = await callSocket.invite({
        conversationId: input.conversationId,
        callId,
        mediaKind: input.mediaKind,
      });

      if (!ack.ok) {
        endCall(ack.error ?? 'Could not start the call.');
      }
    },
    [callingSupported, endCall, ensureCallSocket, session, toast],
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
    void dismissIncomingCallNotification(current.callId);

    if (!callingSupported) {
      toast.error(CALLING_UNSUPPORTED_MESSAGE);
      callSocket.reject({ callId: current.callId, conversationId: current.conversationId });
      endCall();
      return;
    }

    try {
      await session.acceptIncoming();
    } catch (error) {
      callSocket.reject({ callId: current.callId, conversationId: current.conversationId });
      endCall(error instanceof Error ? error.message : 'Could not access your microphone.');
      return;
    }

    if (!(await ensureCallSocket())) {
      endCall('Could not reconnect to the call.');
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
  }, [callingSupported, endCall, ensureCallSocket, session, stopRinging, toast, user?.id]);

  acceptRef.current = acceptCall;

  const rejectCall = useCallback(() => {
    const current = stateRef.current;
    if (!current.callId || !current.conversationId) return;
    void chatApi
      .respondToCall({
        callId: current.callId,
        conversationId: current.conversationId,
        action: 'decline',
      })
      .catch(() => undefined);
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
