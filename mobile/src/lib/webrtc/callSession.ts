import type { CallMediaKind, IceCandidatePayload, SessionDescriptionPayload } from '../socket/socket';
import {
  ensureCallPermissions,
  getWebRTC,
  type RTCMediaStream,
  type RTCPeer,
} from './webrtcModule';
import { callIceServers } from './iceServers';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected';

export interface CallParticipant {
  userId: string;
  name: string;
  stream: RTCMediaStream | null;
  connected: boolean;
  sharing: boolean;
}

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  conversationId: string | null;
  isGroup: boolean;
  mediaKind: CallMediaKind;
  /** Peer name for a DM, conversation name for a group. */
  title: string;
  /** DM peer, or the caller while a call is ringing. */
  peerUserId: string | null;
  muted: boolean;
  cameraOff: boolean;
  localStream: RTCMediaStream | null;
  participants: CallParticipant[];
  connectedAt: number | null;
  error: string | null;
}

export interface CallSignals {
  sendOffer: (toUserId: string, sdp: SessionDescriptionPayload) => void;
  sendAnswer: (toUserId: string, sdp: SessionDescriptionPayload) => void;
  sendIce: (toUserId: string, candidate: IceCandidatePayload) => void;
}

interface PeerSlot {
  userId: string;
  name: string;
  pc: RTCPeer;
  stream: RTCMediaStream | null;
  /** The impolite side wins offer collisions; the joiner always yields. */
  polite: boolean;
  makingOffer: boolean;
  connected: boolean;
  sharing: boolean;
  /**
   * Candidates that arrive before the remote description is applied would be
   * discarded by the peer connection, which is common on mobile networks.
   */
  pendingIce: IceCandidatePayload[];
}

export function idleCallState(): CallState {
  return {
    phase: 'idle',
    callId: null,
    conversationId: null,
    isGroup: false,
    mediaKind: 'audio',
    title: '',
    peerUserId: null,
    muted: false,
    cameraOff: false,
    localStream: null,
    participants: [],
    connectedAt: null,
    error: null,
  };
}

export class CallSession {
  private state: CallState = idleCallState();
  private peers = new Map<string, PeerSlot>();
  private localStream: RTCMediaStream | null = null;
  /** Candidates that beat their peer's offer, keyed by sender. */
  private earlyIce = new Map<string, IceCandidatePayload[]>();

  constructor(
    private readonly onState: (state: CallState) => void,
    private readonly signals: CallSignals,
  ) {}

  getState(): CallState {
    return this.state;
  }

  clearError() {
    if (this.state.error) this.setState({ error: null });
  }

  private setState(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.onState(this.state);
  }

  private syncParticipants() {
    this.setState({
      participants: Array.from(this.peers.values()).map((slot) => ({
        userId: slot.userId,
        name: slot.name,
        stream: slot.stream,
        connected: slot.connected,
        sharing: slot.sharing,
      })),
    });
  }

  // ---------------------------------------------------------------- media

  private async acquireMedia(mediaKind: CallMediaKind): Promise<RTCMediaStream> {
    const webrtc = getWebRTC();
    if (!webrtc) throw new Error('Calling is not available in this build.');

    const granted = await ensureCallPermissions(mediaKind === 'video');
    if (!granted) {
      throw new Error(
        mediaKind === 'video'
          ? 'Camera and microphone access are required for video calls.'
          : 'Microphone access is required for calls.',
      );
    }

    if (this.localStream) return this.localStream;

    const constraints =
      mediaKind === 'video'
        ? {
            audio: true,
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          }
        : { audio: true, video: false };

    let stream: RTCMediaStream;
    try {
      stream = (await webrtc.mediaDevices.getUserMedia(constraints)) as RTCMediaStream;
    } catch (error) {
      // Some devices reject the ideal video profile outright; retry unconstrained.
      if (mediaKind !== 'video') throw error;
      stream = (await webrtc.mediaDevices.getUserMedia({ audio: true, video: true })) as RTCMediaStream;
    }

    this.localStream = stream;
    this.setState({ localStream: stream });
    return stream;
  }

  // ------------------------------------------------------------ lifecycle

  /** Caller side: media is acquired before the invite so failures cancel early. */
  async startOutgoing(input: {
    callId: string;
    conversationId: string;
    isGroup: boolean;
    mediaKind: CallMediaKind;
    title: string;
    peerUserId?: string | null;
  }): Promise<void> {
    this.setState({
      ...idleCallState(),
      phase: 'outgoing',
      callId: input.callId,
      conversationId: input.conversationId,
      isGroup: input.isGroup,
      mediaKind: input.mediaKind,
      title: input.title,
      peerUserId: input.peerUserId ?? null,
    });

    await this.acquireMedia(input.mediaKind);
  }

  /** Callee side: ring without touching the mic until the call is accepted. */
  ringIncoming(input: {
    callId: string;
    conversationId: string;
    isGroup: boolean;
    mediaKind: CallMediaKind;
    title: string;
    peerUserId: string;
  }) {
    this.setState({
      ...idleCallState(),
      phase: 'incoming',
      callId: input.callId,
      conversationId: input.conversationId,
      isGroup: input.isGroup,
      mediaKind: input.mediaKind,
      title: input.title,
      peerUserId: input.peerUserId,
    });
  }

  async acceptIncoming(): Promise<void> {
    await this.acquireMedia(this.state.mediaKind);
    this.setState({ phase: 'connecting' });
  }

  /** Group join from a banner, where there was never an incoming ring. */
  async prepareJoin(input: {
    callId: string;
    conversationId: string;
    mediaKind: CallMediaKind;
    title: string;
  }): Promise<void> {
    this.setState({
      ...idleCallState(),
      phase: 'connecting',
      callId: input.callId,
      conversationId: input.conversationId,
      isGroup: true,
      mediaKind: input.mediaKind,
      title: input.title,
    });

    await this.acquireMedia(input.mediaKind);
  }

  markConnecting() {
    if (this.state.phase === 'outgoing' || this.state.phase === 'incoming') {
      this.setState({ phase: 'connecting' });
    }
  }

  /**
   * A host alone in a fresh group room has no peers to wait for, so the call is
   * already "up" as far as the UI is concerned.
   */
  markConnectedIfAlone() {
    if (this.peers.size === 0 && this.state.phase === 'connecting') {
      this.setState({ phase: 'connected', connectedAt: Date.now() });
    }
  }

  end(error: string | null = null) {
    this.peers.forEach((slot) => {
      try {
        slot.pc.close();
      } catch {
        /* already torn down */
      }
    });
    this.peers.clear();
    this.earlyIce.clear();

    this.localStream?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    });
    this.localStream = null;

    this.setState({ ...idleCallState(), error });
  }

  // ----------------------------------------------------------------- peers

  private createSlot(userId: string, name: string, polite: boolean): PeerSlot {
    const webrtc = getWebRTC();
    if (!webrtc) throw new Error('Calling is not available in this build.');

    const pc = new webrtc.RTCPeerConnection({ iceServers: callIceServers() }) as RTCPeer;
    const slot: PeerSlot = {
      userId,
      name,
      pc,
      stream: null,
      polite,
      makingOffer: false,
      connected: false,
      sharing: false,
      pendingIce: this.earlyIce.get(userId) ?? [],
    };
    this.earlyIce.delete(userId);

    this.localStream?.getTracks().forEach((track) => {
      try {
        pc.addTrack(track, this.localStream!);
      } catch {
        /* duplicate track */
      }
    });

    // @ts-expect-error react-native-webrtc events are loosely typed
    pc.addEventListener('icecandidate', (event) => {
      this.signals.sendIce(userId, event?.candidate ? event.candidate.toJSON() : null);
    });

    // @ts-expect-error react-native-webrtc events are loosely typed
    pc.addEventListener('track', (event) => {
      const stream = event?.streams?.[0] as RTCMediaStream | undefined;
      if (!stream) return;
      slot.stream = stream;
      this.syncParticipants();
    });

    // @ts-expect-error react-native-webrtc events are loosely typed
    pc.addEventListener('connectionstatechange', () => {
      const connectionState = pc.connectionState;
      if (connectionState === 'connected') {
        slot.connected = true;
        this.syncParticipants();
        if (this.state.phase !== 'connected') {
          this.setState({ phase: 'connected', connectedAt: this.state.connectedAt ?? Date.now() });
        }
      } else if (connectionState === 'failed' || connectionState === 'closed') {
        slot.connected = false;
        this.syncParticipants();
      }
    });

    this.peers.set(userId, slot);
    this.syncParticipants();
    return slot;
  }

  /** Existing participants offer to whoever joins after them. */
  async addPeerAndOffer(userId: string, name: string) {
    if (this.peers.has(userId)) return;
    const slot = this.createSlot(userId, name, false);
    await this.offerTo(slot);
  }

  /** Peers we expect offers from (we joined after them). */
  addExpectedPeer(userId: string, name: string) {
    if (this.peers.has(userId)) return;
    this.createSlot(userId, name, true);
  }

  private async offerTo(slot: PeerSlot) {
    try {
      slot.makingOffer = true;
      const offer = await slot.pc.createOffer({});
      await slot.pc.setLocalDescription(offer);
      const local = slot.pc.localDescription;
      if (local) {
        this.signals.sendOffer(slot.userId, {
          type: local.type ?? undefined,
          sdp: local.sdp ?? undefined,
        });
      }
    } catch {
      /* the peer will retry via its own offer */
    } finally {
      slot.makingOffer = false;
    }
  }

  async onRemoteOffer(fromUserId: string, name: string, sdp: SessionDescriptionPayload) {
    const webrtc = getWebRTC();
    if (!webrtc) return;

    let slot = this.peers.get(fromUserId);
    if (!slot) slot = this.createSlot(fromUserId, name, true);

    try {
      const collision = slot.makingOffer || slot.pc.signalingState !== 'stable';
      if (collision) {
        if (!slot.polite) return;
        await slot.pc.setLocalDescription({ type: 'rollback' } as never).catch(() => undefined);
      }

      await slot.pc.setRemoteDescription(new webrtc.RTCSessionDescription(sdp as never));
      await this.flushPendingIce(slot);

      const answer = await slot.pc.createAnswer();
      await slot.pc.setLocalDescription(answer);

      const local = slot.pc.localDescription;
      if (local) {
        this.signals.sendAnswer(fromUserId, {
          type: local.type ?? undefined,
          sdp: local.sdp ?? undefined,
        });
      }
    } catch {
      /* renegotiation will be retried by the offering side */
    }
  }

  async onRemoteAnswer(fromUserId: string, sdp: SessionDescriptionPayload) {
    const webrtc = getWebRTC();
    const slot = this.peers.get(fromUserId);
    if (!webrtc || !slot) return;

    try {
      await slot.pc.setRemoteDescription(new webrtc.RTCSessionDescription(sdp as never));
      await this.flushPendingIce(slot);
    } catch {
      /* stale answer */
    }
  }

  async onRemoteIce(fromUserId: string, candidate: IceCandidatePayload) {
    const webrtc = getWebRTC();
    if (!webrtc) return;

    const slot = this.peers.get(fromUserId);
    if (!slot) {
      const queued = this.earlyIce.get(fromUserId) ?? [];
      queued.push(candidate);
      this.earlyIce.set(fromUserId, queued);
      return;
    }

    if (!slot.pc.remoteDescription) {
      slot.pendingIce.push(candidate);
      return;
    }

    await this.applyIce(slot, candidate);
  }

  private async applyIce(slot: PeerSlot, candidate: IceCandidatePayload) {
    const webrtc = getWebRTC();
    if (!webrtc) return;
    try {
      if (candidate) await slot.pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate as never));
    } catch {
      /* late or malformed candidate */
    }
  }

  private async flushPendingIce(slot: PeerSlot) {
    const queued = slot.pendingIce;
    slot.pendingIce = [];
    for (const candidate of queued) {
      await this.applyIce(slot, candidate);
    }
  }

  removePeer(userId: string) {
    this.earlyIce.delete(userId);
    const slot = this.peers.get(userId);
    if (!slot) return;
    try {
      slot.pc.close();
    } catch {
      /* already closed */
    }
    this.peers.delete(userId);
    this.syncParticipants();
  }

  setPeerSharing(userId: string, sharing: boolean) {
    const slot = this.peers.get(userId);
    if (!slot) return;
    slot.sharing = sharing;
    this.syncParticipants();
  }

  peerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  // -------------------------------------------------------------- controls

  toggleMute(): boolean {
    const muted = !this.state.muted;
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.setState({ muted });
    return muted;
  }

  toggleCamera(): boolean {
    const cameraOff = !this.state.cameraOff;
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
    this.setState({ cameraOff });
    return cameraOff;
  }

  switchCamera() {
    this.localStream?.getVideoTracks().forEach((track) => {
      const flip = (track as { _switchCamera?: () => void })._switchCamera;
      if (typeof flip === 'function') flip.call(track);
    });
  }
}
