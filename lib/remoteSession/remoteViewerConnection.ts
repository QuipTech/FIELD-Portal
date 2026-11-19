import type { RemoteSignalingConnection } from "../types/remoteSession";
import type { ControlMessage } from "./controlInput";
import { decodeSignalingMessage, encodeSignalingAction } from "./kvsSignaling";

export type ViewerConnectionState = "connecting" | "connected" | "disconnected" | "failed" | "closed";

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
  private outbox: string[] = [];
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
      if (candidate) this.signal(encodeSignalingAction("ICE_CANDIDATE", candidate.toJSON()));
    };
    peer.onconnectionstatechange = () => {
      if (this.closed) return;
      const state = peer.connectionState;
      if (state === "connected") this.handlers.onState("connected");
      else if (state === "disconnected") this.handlers.onState("disconnected");
      else if (state === "failed") this.handlers.onState("failed");
    };

    this.handlers.onState("connecting");
    const socket = new WebSocket(this.connection.signalingUrl);
    this.socket = socket;
    socket.onopen = async () => {
      this.outbox.splice(0).forEach((frame) => socket.send(frame));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.send(encodeSignalingAction("SDP_OFFER", peer.localDescription?.toJSON() ?? offer));
    };
    socket.onmessage = (event) => void this.receive(String(event.data));
    socket.onerror = () => {
      if (!this.closed && peer.connectionState !== "connected") this.handlers.onState("failed");
    };
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
    this.handlers.onControlReady(false);
    this.control?.close();
    this.peer?.close();
    this.socket?.close();
    this.stream.getTracks().forEach((track) => track.stop());
    this.handlers.onState("closed");
  };

  private signal(frame: string) {
    if (this.closed) return;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(frame);
    else this.outbox.push(frame);
  }

  private async receive(data: string) {
    const decoded = decodeSignalingMessage(data);
    const peer = this.peer;
    if (!decoded || !peer || this.closed) return;
    const { message, payload } = decoded;
    if (message.messageType === "SDP_ANSWER") {
      await peer.setRemoteDescription(payload as RTCSessionDescriptionInit);
      for (const candidate of this.pendingCandidates.splice(0)) await peer.addIceCandidate(candidate);
    } else if (message.messageType === "ICE_CANDIDATE") {
      const candidate = payload as RTCIceCandidateInit;
      if (peer.remoteDescription) await peer.addIceCandidate(candidate).catch(() => undefined);
      else this.pendingCandidates.push(candidate);
    } else if (message.messageType === "GO_AWAY") {
      this.socket?.close();
    }
  }
}
