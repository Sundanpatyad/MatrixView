/**
 * 1:1 WebRTC audio / video call helper.
 * Signaling is handled by the caller via callbacks (socket relay).
 */
import {
  acquireScreenShare,
  type CaptureTarget,
} from '@/lib/webrtc/screenShare';

export type CallMediaKind = 'audio' | 'video';

export type CallSignal = {
  callId: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
};

export type IceServer = RTCIceServer;

const DEFAULT_ICE: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function newCallId() {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type AudioCallCallbacks = {
  onState: (state: AudioCallState) => void;
  onLocalStream?: (stream: MediaStream | null) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
  /** Local screen-share preview (separate from camera self-view). */
  onScreenStream?: (stream: MediaStream | null) => void;
  sendOffer: (payload: CallSignal & { sdp: RTCSessionDescriptionInit }) => void;
  sendAnswer: (payload: CallSignal & { sdp: RTCSessionDescriptionInit }) => void;
  sendIce: (payload: CallSignal & { candidate: RTCIceCandidateInit | null }) => void;
  sendHangup: (payload: CallSignal & { reason?: string }) => void;
};

export type AudioCallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended';

export type AudioCallState = {
  phase: AudioCallPhase;
  callId: string | null;
  conversationId: string | null;
  peerUserId: string | null;
  peerName: string;
  mediaKind: CallMediaKind;
  muted: boolean;
  cameraOff: boolean;
  sharingScreen: boolean;
  error: string | null;
};

const idleState = (): AudioCallState => ({
  phase: 'idle',
  callId: null,
  conversationId: null,
  peerUserId: null,
  peerName: '',
  mediaKind: 'audio',
  muted: false,
  cameraOff: false,
  sharingScreen: false,
  error: null,
});

export class AudioCallSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private screenShareStop: (() => void) | null = null;
  private state: AudioCallState = idleState();
  private meId = '';
  private makingOffer = false;
  private polite = false;

  constructor(private readonly cb: AudioCallCallbacks) {}

  getState() {
    return this.state;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  private setState(patch: Partial<AudioCallState>) {
    this.state = { ...this.state, ...patch };
    this.cb.onState(this.state);
  }

  private async ensureMedia() {
    if (this.localStream) return this.localStream;
    const wantVideo = this.state.mediaKind === 'video';
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: wantVideo
        ? {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : false,
    });
    this.localStream = stream;
    this.cb.onLocalStream?.(stream);
    return stream;
  }

  private ensurePeerConnection() {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE });
    this.pc = pc;

    pc.onicecandidate = (ev) => {
      const { callId, conversationId, peerUserId } = this.state;
      if (!callId || !conversationId || !peerUserId) return;
      this.cb.sendIce({
        callId,
        conversationId,
        fromUserId: this.meId,
        toUserId: peerUserId,
        candidate: ev.candidate ? ev.candidate.toJSON() : null,
      });
    };

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (!stream) return;
      // Always use a fresh MediaStream wrapper so React re-renders after replaceTrack
      this.remoteStream = new MediaStream(stream.getTracks());
      this.cb.onRemoteStream?.(this.remoteStream);

      const video = stream.getVideoTracks()[0];
      if (video) {
        const refresh = () => {
          this.remoteStream = new MediaStream(stream.getTracks());
          this.cb.onRemoteStream?.(this.remoteStream);
        };
        video.addEventListener('unmute', refresh);
        video.addEventListener('mute', refresh);
      }

      if (this.state.mediaKind === 'audio') {
        if (!this.remoteAudio) {
          this.remoteAudio = new Audio();
          this.remoteAudio.autoplay = true;
        }
        this.remoteAudio.srcObject = stream;
        void this.remoteAudio.play().catch(() => undefined);
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') {
        this.setState({ phase: 'connected', error: null });
      } else if (s === 'failed' || s === 'disconnected') {
        if (this.state.phase === 'connected' || this.state.phase === 'connecting') {
          this.endLocal('Connection lost');
        }
      }
    };

    return pc;
  }

  private async attachLocalTracks() {
    const stream = await this.ensureMedia();
    const pc = this.ensurePeerConnection();
    for (const track of stream.getTracks()) {
      const already = pc.getSenders().some((s) => s.track?.id === track.id);
      if (!already) pc.addTrack(track, stream);
    }
  }

  async startOutgoing(input: {
    meId: string;
    conversationId: string;
    peerUserId: string;
    peerName: string;
    mediaKind?: CallMediaKind;
  }) {
    if (this.state.phase !== 'idle') {
      throw new Error('Already in a call');
    }
    this.meId = input.meId;
    this.polite = false;
    const mediaKind = input.mediaKind ?? 'audio';
    const callId = newCallId();
    this.setState({
      phase: 'outgoing',
      callId,
      conversationId: input.conversationId,
      peerUserId: input.peerUserId,
      peerName: input.peerName,
      mediaKind,
      muted: false,
      cameraOff: false,
      sharingScreen: false,
      error: null,
    });
    try {
      await this.attachLocalTracks();
    } catch {
      const need = mediaKind === 'video' ? 'Camera and microphone' : 'Microphone';
      this.setState({ ...idleState(), error: `${need} permission is required for calls` });
      throw new Error(`${need} permission denied`);
    }
    return callId;
  }

  /** Callee received invite — show ringing UI; media starts on accept. */
  ringIncoming(input: {
    meId: string;
    callId: string;
    conversationId: string;
    peerUserId: string;
    peerName: string;
    mediaKind?: CallMediaKind;
  }) {
    if (this.state.phase !== 'idle') return false;
    this.meId = input.meId;
    this.polite = true;
    this.setState({
      phase: 'incoming',
      callId: input.callId,
      conversationId: input.conversationId,
      peerUserId: input.peerUserId,
      peerName: input.peerName,
      mediaKind: input.mediaKind ?? 'audio',
      muted: false,
      cameraOff: false,
      sharingScreen: false,
      error: null,
    });
    return true;
  }

  async acceptIncoming() {
    if (this.state.phase !== 'incoming' || !this.state.callId || !this.state.peerUserId) {
      throw new Error('No incoming call');
    }
    this.setState({ phase: 'connecting' });
    try {
      await this.attachLocalTracks();
    } catch {
      const need = this.state.mediaKind === 'video' ? 'Camera and microphone' : 'Microphone';
      this.endLocal(`${need} permission denied`);
      throw new Error(`${need} permission denied`);
    }
  }

  async onAcceptedByPeer() {
    if (this.state.phase !== 'outgoing') return;
    this.setState({ phase: 'connecting' });
    await this.createAndSendOffer();
  }

  private async createAndSendOffer() {
    const { callId, conversationId, peerUserId, mediaKind } = this.state;
    if (!callId || !conversationId || !peerUserId) return;
    const pc = this.ensurePeerConnection();
    this.makingOffer = true;
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: mediaKind === 'video',
      });
      await pc.setLocalDescription(offer);
      this.cb.sendOffer({
        callId,
        conversationId,
        fromUserId: this.meId,
        toUserId: peerUserId,
        sdp: pc.localDescription!.toJSON(),
      });
    } finally {
      this.makingOffer = false;
    }
  }

  async onRemoteOffer(sdp: RTCSessionDescriptionInit) {
    const { callId, conversationId, peerUserId } = this.state;
    if (!callId || !conversationId || !peerUserId) return;
    const pc = this.ensurePeerConnection();
    const offerCollision = this.makingOffer || pc.signalingState !== 'stable';
    if (offerCollision && !this.polite) return;

    // Attach local tracks before answering so the peer receives our camera/mic.
    try {
      await this.attachLocalTracks();
    } catch {
      return;
    }
    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.cb.sendAnswer({
      callId,
      conversationId,
      fromUserId: this.meId,
      toUserId: peerUserId,
      sdp: pc.localDescription!.toJSON(),
    });
    this.setState({ phase: 'connecting' });
  }

  async onRemoteAnswer(sdp: RTCSessionDescriptionInit) {
    const pc = this.pc;
    if (!pc) return;
    if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(sdp);
    }
  }

  async onRemoteIce(candidate: RTCIceCandidateInit | null) {
    const pc = this.pc;
    if (!pc) return;
    try {
      if (candidate) await pc.addIceCandidate(candidate);
      else await pc.addIceCandidate();
    } catch {
      /* ignore late/failed ICE */
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

  /** Share entire screen, window, or browser tab. */
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

    const pc = this.ensurePeerConnection();
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    const currentVideo =
      sender?.track ?? this.localStream?.getVideoTracks()[0] ?? null;

    // Keep camera track alive for local self-view; only the sender uses the screen track.
    if (currentVideo && currentVideo !== screenTrack) {
      this.cameraTrack = currentVideo;
    }

    if (sender) {
      await sender.replaceTrack(screenTrack);
    } else if (this.localStream) {
      pc.addTrack(screenTrack, this.localStream);
    } else {
      handle.stop();
      throw new Error('No local media to attach screen share');
    }

    // Renegotiate so the remote peer reliably receives the screen track
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const { callId, conversationId, peerUserId } = this.state;
      if (callId && conversationId && peerUserId && pc.localDescription) {
        this.cb.sendOffer({
          callId,
          conversationId,
          fromUserId: this.meId,
          toUserId: peerUserId,
          sdp: pc.localDescription.toJSON(),
        });
      }
    } catch {
      /* replaceTrack alone often works */
    }

    // Keep local preview on camera — rendering the share locally causes a mirror loop
    // when the shared screen/window includes this call UI.
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

    const pc = this.pc;
    const sender = pc?.getSenders().find((s) => s.track?.kind === 'video');
    const cam = this.cameraTrack;

    // Replace screen with camera before stopping the share track
    if (sender) {
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

  hangup(reason?: string) {
    if (this.state.phase === 'idle') return;
    const { callId, conversationId, peerUserId } = this.state;
    if (callId && conversationId && peerUserId) {
      this.cb.sendHangup({
        callId,
        conversationId,
        fromUserId: this.meId,
        toUserId: peerUserId,
        reason,
      });
    }
    // Hangup is intentional — don't surface it as an error toast
    this.endLocal(null);
  }

  rejectIncoming() {
    const { callId, conversationId, peerUserId } = this.state;
    if (callId && conversationId && peerUserId) {
      this.cb.sendHangup({
        callId,
        conversationId,
        fromUserId: this.meId,
        toUserId: peerUserId,
        reason: 'rejected',
      });
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
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.cb.onLocalStream?.(null);
    this.cb.onRemoteStream?.(null);
    this.cb.onScreenStream?.(null);
    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }
    this.makingOffer = false;
    this.setState({ ...idleState(), error });
  }

  clearError() {
    if (this.state.error) this.setState({ error: null });
  }
}
