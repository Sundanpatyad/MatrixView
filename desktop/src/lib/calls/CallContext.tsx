import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthContext';
import { useOffline } from '@/lib/offline/OfflineContext';
import {
  clearChatSocketHandlerKeys,
  connectChatSocket,
  disconnectChatSocket,
  ensureChatSocketConnected,
  getChatSocket,
  patchChatSocketHandlers,
} from '@/lib/socket/chatSocket';
import {
  useAudioCall,
  type ActiveGroupRoom,
  type UnifiedCallState,
} from '@/lib/webrtc/useAudioCall';
import { CallOverlay } from '@/components/calls/CallOverlay';

type CallContextValue = {
  call: UnifiedCallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenShareStream: MediaStream | null;
  activeRooms: Record<string, ActiveGroupRoom>;
  socketReady: boolean;
  socketRetrying: boolean;
  reconnectSocket: () => Promise<boolean>;
  focusConversationId: string | null;
  clearFocusConversationId: () => void;
  startCall: ReturnType<typeof useAudioCall>['startCall'];
  joinGroupCall: ReturnType<typeof useAudioCall>['joinGroupCall'];
  acceptCall: ReturnType<typeof useAudioCall>['acceptCall'];
  rejectCall: ReturnType<typeof useAudioCall>['rejectCall'];
  hangup: ReturnType<typeof useAudioCall>['hangup'];
  toggleMute: ReturnType<typeof useAudioCall>['toggleMute'];
  toggleCamera: ReturnType<typeof useAudioCall>['toggleCamera'];
  toggleScreenShare: ReturnType<typeof useAudioCall>['toggleScreenShare'];
};

const CallContext = createContext<CallContextValue | null>(null);

/**
 * Keeps the chat socket + call signaling alive while logged in,
 * so incoming audio/video calls show Accept/Decline anywhere in the app.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { online } = useOffline();
  const navigate = useNavigate();
  const meId = user?.id ?? '';
  const [socketReady, setSocketReady] = useState(false);
  const [socketRetrying, setSocketRetrying] = useState(false);
  const [focusConversationId, setFocusConversationId] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const {
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
  } = useAudioCall(meId);

  const callHandlersRef = useRef(callHandlers);
  callHandlersRef.current = callHandlers;

  useEffect(() => {
    if (!isAuthenticated || !meId) {
      disconnectChatSocket();
      setSocketReady(false);
      return;
    }

    const get = () => callHandlersRef.current();
    patchChatSocketHandlers({
      onConnect: () => setSocketReady(true),
      onDisconnect: () => setSocketReady(false),
      onCallIncoming: (p) => get().onCallIncoming?.(p),
      onCallAccepted: (p) => get().onCallAccepted?.(p),
      onCallOffer: (p) => get().onCallOffer?.(p),
      onCallAnswer: (p) => get().onCallAnswer?.(p),
      onCallIce: (p) => get().onCallIce?.(p),
      onCallEnded: (p) => get().onCallEnded?.(p),
      onCallPeerJoined: (p) => get().onCallPeerJoined?.(p),
      onCallPeerLeft: (p) => get().onCallPeerLeft?.(p),
      onCallRoom: (p) => get().onCallRoom?.(p),
      onCallScreen: (p) => get().onCallScreen?.(p),
      onCallHand: (p) => get().onCallHand?.(p),
      onCallReaction: (p) => get().onCallReaction?.(p),
      onCallSpotlight: (p) => get().onCallSpotlight?.(p),
    });

    if (online) {
      void connectChatSocket().then((s) => {
        if (s?.connected) setSocketReady(true);
      });
    } else {
      disconnectChatSocket();
      setSocketReady(false);
    }

    return () => {
      clearChatSocketHandlerKeys([
        'onCallIncoming',
        'onCallAccepted',
        'onCallOffer',
        'onCallAnswer',
        'onCallIce',
        'onCallEnded',
        'onCallPeerJoined',
        'onCallPeerLeft',
        'onCallRoom',
        'onCallScreen',
        'onCallHand',
        'onCallReaction',
        'onCallSpotlight',
        // Keep onConnect/onDisconnect so reconnects during effect churn still update ready state.
      ]);
    };
  }, [isAuthenticated, meId, online]);

  const reconnectSocket = useCallback(async () => {
    if (!isAuthenticated || !meId || !online) return false;
    setSocketRetrying(true);
    try {
      const s = await ensureChatSocketConnected({ attempts: 5, force: true });
      const ok = !!s?.connected;
      setSocketReady(ok);
      return ok;
    } finally {
      setSocketRetrying(false);
    }
  }, [isAuthenticated, meId, online]);

  // Auto-retry while authenticated + online but socket is down.
  useEffect(() => {
    if (!isAuthenticated || !meId || !online) return;

    let cancelled = false;
    let timer: number | undefined;

    const sync = () => {
      const connected = !!getChatSocket()?.connected;
      setSocketReady(connected);
      return connected;
    };

    const loop = async () => {
      if (cancelled) return;
      if (sync()) {
        timer = window.setTimeout(loop, 15_000);
        return;
      }
      setSocketRetrying(true);
      try {
        await ensureChatSocketConnected({ attempts: 3 });
        sync();
      } finally {
        if (!cancelled) setSocketRetrying(false);
      }
      if (!cancelled) {
        timer = window.setTimeout(loop, getChatSocket()?.connected ? 15_000 : 4_000);
      }
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isAuthenticated, meId, online]);

  // Tear down socket when logging out (provider unmounts with auth routes)
  useEffect(() => {
    return () => {
      hangup();
      disconnectChatSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on unmount
  }, []);

  // Keep socketReady in sync if already connected
  useEffect(() => {
    const s = getChatSocket();
    if (s?.connected) setSocketReady(true);
  }, []);

  const clearFocusConversationId = useCallback(() => setFocusConversationId(null), []);

  const handleAccept = useCallback(async () => {
    const convId = call.conversationId;
    try {
      await acceptCall();
      if (convId) {
        setFocusConversationId(convId);
        navigate('/chat');
      }
      setOverlayError(null);
    } catch (err) {
      setOverlayError(err instanceof Error ? err.message : 'Could not accept call');
    }
  }, [acceptCall, call.conversationId, navigate]);

  const handleReject = useCallback(() => {
    rejectCall();
    setOverlayError(null);
  }, [rejectCall]);

  const value = useMemo<CallContextValue>(
    () => ({
      call,
      localStream,
      remoteStream,
      screenShareStream,
      activeRooms,
      socketReady,
      socketRetrying,
      reconnectSocket,
      focusConversationId,
      clearFocusConversationId,
      startCall,
      joinGroupCall,
      acceptCall,
      rejectCall,
      hangup,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
    }),
    [
      call,
      localStream,
      remoteStream,
      screenShareStream,
      activeRooms,
      socketReady,
      socketRetrying,
      reconnectSocket,
      focusConversationId,
      clearFocusConversationId,
      startCall,
      joinGroupCall,
      acceptCall,
      rejectCall,
      hangup,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
    ],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {isAuthenticated ? (
        <CallOverlay
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          screenShareStream={screenShareStream}
          meId={meId}
          raisedHands={raisedHands}
          handRaised={handRaised}
          reactions={reactions}
          spotlightUserId={spotlightUserId}
          pinnedUserId={pinnedUserId}
          layout={layout}
          onSetPinnedUserId={setPinnedUserId}
          onSetLayout={setLayout}
          onSetSpotlight={setRoomSpotlight}
          onToggleHand={toggleHand}
          onSendReaction={sendReaction}
          error={overlayError || call.error}
          onAccept={() => void handleAccept()}
          onReject={handleReject}
          onHangup={hangup}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={(opts) =>
            void toggleScreenShare(opts).catch((err) => {
              setOverlayError(err instanceof Error ? err.message : 'Could not share screen');
            })
          }
          onDismissError={() => {
            setOverlayError(null);
            clearCallError();
          }}
        />
      ) : null}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
