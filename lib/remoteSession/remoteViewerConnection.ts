import type { RemoteSignalingConnection } from "../types/remoteSession";
import type { ControlMessage } from "./controlInput";
import { decodeSignalingMessage, encodeSignalingAction } from "./kvsSignaling";

export type ViewerConnectionState = "connecting" | "connected" | "disconnected" | "failed" | "closed";

const OFFER_RETRY_MS = 3000;

interface ViewerHandlers {
  onStream: (stream: MediaStream) => void;
  onState: (state: ViewerConnectionState) => void;
  onControlReady: (ready: boolean) => void;
}

// The Portal side of the media: a WebRTC viewer that receives the tablet's
// screen (and its microphone, if it sends one), can send the viewer's own
// microphone, and sends control input on the "control" data channel. The
// offer goes over the session's Kinesis signaling channel.
export class RemoteViewerConnection {
  private socket: WebSocket | null = null;
  private peer: RTCPeerConnection | null = null;
  private control: RTCDataChannel | null = null;
  private audioSender: RTCRtpSender | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private localOffer: string | null = null;
  private localCandidates: string[] = [];
  private offerTimer: ReturnType<typeof setInterval> | null = null;
  private applyingAnswer = false;
  private failed = false;
  private closed = false;
  private readonly stream = new MediaStream();

  constructor(
    private readonly connection: RemoteSignalingConnection,
    private readonly handlers: ViewerHandlers,
  ) {}

  start = () => {
    const peer = new RTCPeerConnection({ iceServers: this.connection.iceServers });
    this.peer = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    this.audioSender = peer.addTransceiver("audio", { direction: "sendrecv" }).sender;
    const control = peer.createDataChannel("control", { ordered: true });
    this.control = control;
    control.onopen = () => {
      if (!this.closed) this.handlers.onControlReady(this.connection.controlAllowed);
    };
    control.onclose = () => {
      if (!this.closed) this.handlers.onControlReady(false);
    };

    peer.ontrack = (event) => {
      if (this.closed) return;
      if (!this.stream.getTracks().includes(event.track)) this.stream.addTrack(event.track);
      this.handlers.onStream(this.stream);
    };
    peer.onicecandidate = ({ candidate }) => {
      if (!candidate || this.closed) return;
      const frame = encodeSignalingAction("ICE_CANDIDATE", candidate.toJSON());
      if (!peer.remoteDescription) this.localCandidates.push(frame);
      if (this.localOffer) this.signal(frame);
    };
    peer.onconnectionstatechange = () => {
      if (this.closed) return;
      const state = peer.connectionState;
      if (state === "connected") this.handlers.onState("connected");
      else if (state === "disconnected") this.handlers.onState("disconnected");
      else if (state === "failed") this.fail();
    };

    this.handlers.onState("connecting");
    const socket = new WebSocket(this.connection.signalingUrl);
    this.socket = socket;
    socket.onopen = () => void this.offer(peer).catch(this.fail);
    socket.onmessage = (event) => void this.receive(String(event.data)).catch(this.fail);
    const onSignalingLost = () => {
      if (peer.connectionState !== "connected") this.fail();
    };
    socket.onerror = onSignalingLost;
    socket.onclose = onSignalingLost;
  };

  send = (message: ControlMessage): boolean => {
    if (!this.connection.controlAllowed || this.peer?.connectionState !== "connected" || this.control?.readyState !== "open") return false;
    try {
      this.control.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  };

  // The viewer's microphone to the tablet; null mutes it.
  setMicrophone = async (track: MediaStreamTrack | null) => {
    await this.audioSender?.replaceTrack(track);
  };

  close = () => {
    this.closed = true;
    this.stopOfferRetry();
    this.handlers.onControlReady(false);
    this.control?.close();
    this.peer?.close();
    this.socket?.close();
    this.stream.getTracks().forEach((track) => track.stop());
    this.handlers.onState("closed");
  };

  private async offer(peer: RTCPeerConnection) {
    const offer = await peer.createOffer();
    if (this.closed) return;
    await peer.setLocalDescription(offer);
    if (this.closed || this.failed) return;
    this.localOffer = encodeSignalingAction("SDP_OFFER", peer.localDescription?.toJSON() ?? offer);
    // The Windows MASTER may open its socket only after the screen picker.
    this.offerTimer = setInterval(this.sendOffer, OFFER_RETRY_MS);
    this.sendOffer();
  }

  private sendOffer = () => {
    if (!this.localOffer || this.peer?.remoteDescription) return;
    try {
      this.signal(this.localOffer);
      for (const candidate of this.localCandidates) this.signal(candidate);
    } catch {
      this.fail();
    }
  };

  private stopOfferRetry() {
    if (this.offerTimer !== null) clearInterval(this.offerTimer);
    this.offerTimer = null;
    this.localCandidates = [];
  }

  private fail = () => {
    if (this.closed || this.failed) return;
    this.failed = true;
    this.stopOfferRetry();
    this.handlers.onState("failed");
  };

  private signal(frame: string) {
    if (!this.closed && !this.failed && this.socket?.readyState === WebSocket.OPEN) this.socket.send(frame);
  }

  private async receive(data: string) {
    const decoded = decodeSignalingMessage(data);
    const peer = this.peer;
    if (!decoded || !peer || this.closed || this.failed) return;
    const { message, payload } = decoded;
    if (message.messageType === "SDP_ANSWER") {
      if (this.applyingAnswer || peer.remoteDescription) return;
      this.applyingAnswer = true;
      await peer.setRemoteDescription(payload as RTCSessionDescriptionInit);
      this.stopOfferRetry();
      for (const candidate of this.pendingCandidates.splice(0)) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      }
    } else if (message.messageType === "ICE_CANDIDATE") {
      const candidate = payload as RTCIceCandidateInit;
      if (peer.remoteDescription) await peer.addIceCandidate(candidate).catch(() => undefined);
      else this.pendingCandidates.push(candidate);
    } else if (message.messageType === "GO_AWAY") {
      this.socket?.close();
    }
  }
}
