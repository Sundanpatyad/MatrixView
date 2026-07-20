/**
 * Mesh WebRTC group call — each participant connects to every other peer.
 * Best for small groups (≤8). Signaling via socket callbacks.
 */
import type { CallMediaKind, CallSignal } from '@/lib/webrtc/audioCall';
import {
  acquireScreenShare,
  type CaptureTarget,
} from '@/lib/webrtc/screenShare';

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function newCallId() {
  return `gcall_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type GroupPeerInfo = {
  userId: string;
  name: string;
  stream: MediaStream | null;
  connected: boolean;
  sharingScreen?: boolean;
};

export type GroupCallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended';

export type GroupCallState = {
  phase: GroupCallPhase;
  callId: string | null;
  conversationId: string | null;
  conversationName: string;
  mediaKind: CallMediaKind;
  muted: boolean;
  cameraOff: boolean;
  sharingScreen: boolean;
  error: string | null;
  peers: GroupPeerInfo[];
  /** Who invited (for incoming UI) */
  fromName: string;
};

const idleState = (): GroupCallState => ({
  phase: 'idle',
  callId: null,
  conversationId: null,
  conversationName: '',
  mediaKind: 'audio',
  muted: false,
  cameraOff: false,
  sharingScreen: false,
  error: null,
  peers: [],
  fromName: '',
});

export type GroupCallCallbacks = {
  onState: (state: GroupCallState) => void;
  onLocalStream?: (stream: MediaStream | null) => void;
  onScreenStream?: (stream: MediaStream | null) => void;
  sendOffer: (payload: CallSignal & { sdp: RTCSessionDescriptionInit }) => void;
  sendAnswer: (payload: CallSignal & { sdp: RTCSessionDescriptionInit }) => void;
  sendIce: (payload: CallSignal & { candidate: RTCIceCandidateInit | null }) => void;
  sendLeave: (payload: {
    callId: string;
    conversationId: string;
    reason?: string;
  }) => void;
};

type PeerSlot = {
  userId: string;
  name: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  connected: boolean;
  audioEl: HTMLAudioElement | null;
  makingOffer: boolean;
};

export class GroupCallSession {
  private localStream: MediaStream | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private screenShareStop: (() => void) | null = null;
  private state: GroupCallState = idleState();
  private meId = '';
  private peers = new Map<string, PeerSlot>();
  private remoteSharingUserIds = new Set<string>();

  constructor(private readonly cb: GroupCallCallbacks) {}

  getState() {
    return this.state;
  }

  getLocalStream() {
    return this.localStream;
  }

  private publishPeers() {
    const peers: GroupPeerInfo[] = [...this.peers.values()].map((p) => ({
      userId: p.userId,
      name: p.name,
      stream: p.stream,
      connected: p.connected,
      sharingScreen: this.remoteSharingUserIds.has(p.userId),
    }));
    this.setState({ peers });
  }

  /** Viewer-side: mark who is screen-sharing (from signaling). */
  setRemoteSharing(userId: string, active: boolean) {
    if (active) this.remoteSharingUserIds.add(userId);
    else this.remoteSharingUserIds.delete(userId);
    // Clone stream refs so React re-binds video elements after replaceTrack
    const slot = this.peers.get(userId);
    if (slot?.stream) {
      const tracks = slot.stream.getTracks();
      slot.stream = new MediaStream(tracks);
    }
    this.publishPeers();
  }

  private setState(patch: Partial<GroupCallState>) {
    this.state = { ...this.state, ...patch };
    this.cb.onState(this.state);
  }

  private async ensureMedia() {
    if (this.localStream) return this.localStream;
    const wantVideo = this.state.mediaKind === 'video';
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: wantVideo
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    });
    // Keep tracks enabled so remotes actually receive media after join races.
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !this.state.muted;
    });
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !this.state.cameraOff;
    });
    this.localStream = stream;
    this.cb.onLocalStream?.(stream);
    return stream;
  }

  /** Public: grab camera/mic before announcing join so early offers include our tracks. */
  async acquireMedia() {
    return this.ensureMedia();
  }

  /** Attach local A/V to a PC; returns true if any new sender was added. */
  private async attachLocalTracksTo(pc: RTCPeerConnection): Promise<boolean> {
    const stream = await this.ensureMedia();
    let added = false;
    for (const track of stream.getTracks()) {
      const already = pc.getSenders().some((s) => s.track?.id === track.id);
      if (!already) {
        pc.addTrack(track, stream);
        added = true;
      }
    }
    return added;
  }

  private refreshRemoteStream(slot: PeerSlot) {
    const tracks = slot.pc
      .getReceivers()
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => !!t && t.readyState !== 'ended');
    slot.stream = tracks.length ? new MediaStream(tracks) : null;
    if (this.state.mediaKind === 'audio' && slot.stream) {
      if (!slot.audioEl) {
        slot.audioEl = new Audio();
        slot.audioEl.autoplay = true;
      }
      slot.audioEl.srcObject = slot.stream;
      void slot.audioEl.play().catch(() => undefined);
    }
    this.publishPeers();
  }

  private createPeerConnection(peerUserId: string, peerName: string): PeerSlot {
    const existing = this.peers.get(peerUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE });
    const slot: PeerSlot = {
      userId: peerUserId,
      name: peerName,
      pc,
      stream: null,
      connected: false,
      audioEl: null,
      makingOffer: false,
    };
    this.peers.set(peerUserId, slot);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (ev) => {
      const { callId, conversationId } = this.state;
      if (!callId || !conversationId) return;
      this.cb.sendIce({
        callId,
        conversationId,
        fromUserId: this.meId,
        toUserId: peerUserId,
        candidate: ev.candidate ? ev.candidate.toJSON() : null,
      });
    };

    pc.ontrack = (ev) => {
      const video = ev.track.kind === 'video' ? ev.track : ev.streams[0]?.getVideoTracks()[0];
      if (video) {
        const refresh = () => this.refreshRemoteStream(slot);
        video.addEventListener('unmute', refresh);
        video.addEventListener('mute', refresh);
        video.addEventListener('ended', refresh);
      }
      this.refreshRemoteStream(slot);
    };

    pc.onconnectionstatechange = () => {
      slot.connected = pc.connectionState === 'connected';
      if (slot.connected && this.state.phase !== 'connected') {
        this.setState({ phase: 'connected', error: null });
      }
      this.publishPeers();
    };

    this.publishPeers();
    return slot;
  }

  private async offerTo(peerUserId: string) {
    const slot = this.peers.get(peerUserId);
    const { callId, conversationId } = this.state;
    if (!slot || !callId || !conversationId) return;
    await this.attachLocalTracksTo(slot.pc);
    slot.makingOffer = true;
    try {
      // Transceivers come from addTrack; avoid deprecated offerToReceive* flags.
      const offer = await slot.pc.createOffer();
      await slot.pc.setLocalDescription(offer);
      this.cb.sendOffer({
        callId,
        conversationId,
        fromUserId: this.meId,
        toUserId: peerUserId,
        sdp: slot.pc.localDescription!.toJSON(),
      });
    } finally {
      slot.makingOffer = false;
    }
  }

  async startHost(input: {
    meId: string;
    conversationId: string;
    conversationName: string;
    mediaKind?: CallMediaKind;
  }) {
    if (this.state.phase !== 'idle') throw new Error('Already in a call');
    this.meId = input.meId;
    const mediaKind = input.mediaKind ?? 'audio';
    const callId = newCallId();
    this.setState({
      phase: 'outgoing',
      callId,
      conversationId: input.conversationId,
      conversationName: input.conversationName,
      mediaKind,
      muted: false,
      cameraOff: false,
      sharingScreen: false,
      error: null,
      peers: [],
      fromName: '',
    });
    try {
      await this.ensureMedia();
    } catch {
      const need = mediaKind === 'video' ? 'Camera and microphone' : 'Microphone';
      this.setState({ ...idleState(), error: `${need} permission is required for calls` });
      throw new Error(`${need} permission denied`);
    }
    return callId;
  }

  ringIncoming(input: {
    meId: string;
    callId: string;
    conversationId: string;
    conversationName: string;
    fromName: string;
    mediaKind?: CallMediaKind;
  }) {
    if (this.state.phase !== 'idle') return false;
    this.meId = input.meId;
    this.setState({
      phase: 'incoming',
      callId: input.callId,
      conversationId: input.conversationId,
      conversationName: input.conversationName,
      mediaKind: input.mediaKind ?? 'audio',
      muted: false,
      cameraOff: false,
      sharingScreen: false,
      error: null,
      peers: [],
      fromName: input.fromName,
    });
    return true;
  }

  /** Seed call state to join an existing room (no incoming ring UI). */
  prepareJoin(input: {
    meId: string;
    callId: string;
    conversationId: string;
    conversationName: string;
    mediaKind?: CallMediaKind;
  }) {
    if (this.state.phase !== 'idle') return false;
    this.meId = input.meId;
    this.setState({
      phase: 'connecting',
      callId: input.callId,
      conversationId: input.conversationId,
      conversationName: input.conversationName,
      mediaKind: input.mediaKind ?? 'audio',
      muted: false,
      cameraOff: false,
      sharingScreen: false,
      error: null,
      peers: [],
      fromName: '',
    });
    return true;
  }

  /** After join/accept ack — connect to existing peers (they will offer to us). */
  async enterCall(input: {
    peers: Array<{ userId: string; name: string }>;
  }) {
    if (!this.state.callId) throw new Error('No call');
    this.setState({ phase: 'connecting' });
    try {
      await this.ensureMedia();
    } catch {
      const need = this.state.mediaKind === 'video' ? 'Camera and microphone' : 'Microphone';
      this.endLocal(`${need} permission denied`);
      throw new Error(`${need} permission denied`);
    }
    for (const p of input.peers) {
      if (p.userId === this.meId) continue;
      const slot = this.createPeerConnection(p.userId, p.name);
      // Offer may have already been answered without tracks — attach + renegotiate.
      const added = await this.attachLocalTracksTo(slot.pc);
      if (
        added &&
        slot.pc.signalingState === 'stable' &&
        slot.pc.remoteDescription &&
        slot.pc.localDescription
      ) {
        await this.offerTo(p.userId);
      }
    }
    // Host alone stays in connecting until someone joins → mark connected when alone
    if (input.peers.length === 0) {
      this.setState({ phase: 'connected' });
    }
  }

  /** Existing member: a new peer joined — we create the offer. */
  async onPeerJoined(peer: { userId: string; name: string }) {
    if (!this.state.callId || peer.userId === this.meId) return;
    if (this.state.phase === 'incoming' || this.state.phase === 'idle') return;
    try {
      await this.ensureMedia();
    } catch {
      return;
    }
    this.createPeerConnection(peer.userId, peer.name);
    await this.offerTo(peer.userId);
  }

  onPeerLeft(peerUserId: string) {
    const slot = this.peers.get(peerUserId);
    if (!slot) return;
    slot.pc.close();
    if (slot.audioEl) {
      slot.audioEl.pause();
      slot.audioEl.srcObject = null;
    }
    this.peers.delete(peerUserId);
    this.remoteSharingUserIds.delete(peerUserId);
    this.publishPeers();
  }

  async onRemoteOffer(fromUserId: string, fromName: string, sdp: RTCSessionDescriptionInit) {
    if (!this.state.callId) return;
    // Critical: media must exist before answering, or remotes never get our video.
    try {
      await this.ensureMedia();
    } catch {
      return;
    }
    const slot = this.createPeerConnection(fromUserId, fromName || 'Participant');
    await this.attachLocalTracksTo(slot.pc);
    const collision = slot.makingOffer || slot.pc.signalingState !== 'stable';
    // New joiner is polite — always accept offers from existing peers
    if (collision) {
      await slot.pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit).catch(
        () => undefined,
      );
    }
    await slot.pc.setRemoteDescription(sdp);
    const answer = await slot.pc.createAnswer();
    await slot.pc.setLocalDescription(answer);
    const { callId, conversationId } = this.state;
    if (!callId || !conversationId) return;
    this.cb.sendAnswer({
      callId,
      conversationId,
      fromUserId: this.meId,
      toUserId: fromUserId,
      sdp: slot.pc.localDescription!.toJSON(),
    });
    this.setState({ phase: 'connecting' });
  }

  async onRemoteAnswer(fromUserId: string, sdp: RTCSessionDescriptionInit) {
    const slot = this.peers.get(fromUserId);
    if (!slot) return;
    if (slot.pc.signalingState === 'have-local-offer') {
      await slot.pc.setRemoteDescription(sdp);
    }
  }

  async onRemoteIce(fromUserId: string, candidate: RTCIceCandidateInit | null) {
    const slot = this.peers.get(fromUserId);
    if (!slot) return;
    try {
      if (candidate) await slot.pc.addIceCandidate(candidate);
      else await slot.pc.addIceCandidate();
    } catch {
      /* ignore */
    }
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    this.setState({ muted });
  }

  setCameraOff(cameraOff: boolean) {
    if (this.state.sharingScreen) {
      this.setState({ cameraOff });
      return;
    }
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = !cameraOff;
    });
    if (this.cameraTrack) this.cameraTrack.enabled = !cameraOff;
    this.setState({ cameraOff });
  }

  async startScreenShare(opts?: { nativeTarget?: CaptureTarget }) {
    if (this.state.sharingScreen) return;
    if (this.state.mediaKind !== 'video') {
      throw new Error('Screen sharing is available on video calls');
    }
    if (
      this.state.phase !== 'connected' &&
      this.state.phase !== 'connecting' &&
      this.state.phase !== 'outgoing'
    ) {
      throw new Error('Join the call before sharing your screen');
    }

    const handle = await acquireScreenShare({
      nativeTarget: opts?.nativeTarget,
      preferNative: Boolean(opts?.nativeTarget),
    });
    const display = handle.stream;
    const screenTrack = display.getVideoTracks()[0];
    if (!screenTrack) {
      handle.stop();
      throw new Error('No screen capture track');
    }

    screenTrack.contentHint = 'detail';
    screenTrack.addEventListener('ended', () => {
      void this.stopScreenShare().catch(() => undefined);
    });

    const currentVideo = this.localStream?.getVideoTracks()[0] ?? null;
    if (currentVideo && currentVideo !== screenTrack) {
      this.cameraTrack = currentVideo;
    }

    for (const slot of this.peers.values()) {
      const sender = slot.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      else if (this.localStream) slot.pc.addTrack(screenTrack, this.localStream);
      // Renegotiate so receivers (esp. WKWebView) pick up the new track reliably
      try {
        const offer = await slot.pc.createOffer();
        await slot.pc.setLocalDescription(offer);
        const { callId, conversationId } = this.state;
        if (callId && conversationId) {
          this.cb.sendOffer({
            callId,
            conversationId,
            fromUserId: this.meId,
            toUserId: slot.userId,
            sdp: slot.pc.localDescription!.toJSON(),
          });
        }
      } catch {
        /* ignore renegotiation failures — replaceTrack alone often works */
      }
    }

    // Keep local preview on camera to avoid hall-of-mirrors when share includes DockX.
    if (this.cameraTrack && this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      const next = new MediaStream([
        ...audioTracks,
        ...(this.cameraTrack.readyState === 'live' ? [this.cameraTrack] : []),
      ]);
      this.localStream = next;
      this.cb.onLocalStream?.(next);
    }

    this.screenStream = display;
    this.screenShareStop = handle.stop;
    this.cb.onScreenStream?.(display);
    this.setState({ sharingScreen: true });
  }

  async stopScreenShare() {
    if (!this.state.sharingScreen && !this.screenStream) return;

    const cam = this.cameraTrack;

    for (const slot of this.peers.values()) {
      const sender = slot.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (!sender) continue;
      if (cam && cam.readyState === 'live') {
        cam.enabled = !this.state.cameraOff;
        await sender.replaceTrack(cam);
      } else {
        await sender.replaceTrack(null);
      }
    }

    try {
      this.screenShareStop?.();
    } catch {
      /* ignore */
    }
    this.screenShareStop = null;
    this.screenStream?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    this.screenStream = null;

    const audioTracks = this.localStream?.getAudioTracks() ?? [];
    if (cam && cam.readyState === 'live') {
      cam.enabled = !this.state.cameraOff;
    }
    const next = new MediaStream([
      ...audioTracks,
      ...(cam && cam.readyState === 'live' ? [cam] : []),
    ]);
    this.localStream = next;
    this.cb.onLocalStream?.(next);
    this.cb.onScreenStream?.(null);

    this.cameraTrack = null;
    this.setState({ sharingScreen: false });
  }

  leave(reason?: string) {
    if (this.state.phase === 'idle') return;
    const { callId, conversationId } = this.state;
    if (callId && conversationId) {
      this.cb.sendLeave({ callId, conversationId, reason });
    }
    this.endLocal(null);
  }

  endLocal(error: string | null = null) {
    try {
      this.screenShareStop?.();
    } catch {
      /* ignore */
    }
    this.screenShareStop = null;
    this.screenStream?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    this.screenStream = null;
    this.cameraTrack?.stop();
    this.cameraTrack = null;
    for (const slot of this.peers.values()) {
      slot.pc.close();
      if (slot.audioEl) {
        slot.audioEl.pause();
        slot.audioEl.srcObject = null;
      }
    }
    this.peers.clear();
    this.remoteSharingUserIds.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.cb.onLocalStream?.(null);
    this.cb.onScreenStream?.(null);
    this.setState({ ...idleState(), error });
  }

  clearError() {
    if (this.state.error) this.setState({ error: null });
  }
}
