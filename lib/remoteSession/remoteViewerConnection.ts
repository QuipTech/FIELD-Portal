import type { RemoteSignalingConnection } from "../types/remoteSession";
import type { ControlMessage } from "./controlInput";
import { decodeSignalingMessage, encodeSignalingAction } from "./kvsSignaling";
import { candidateType, describeError, remoteLog, signalingHost, summarizeIceServers } from "./remoteDebugLog";

export type ViewerConnectionState = "connecting" | "connected" | "disconnected" | "failed" | "closed";

const OFFER_RETRY_MS = 3000;
// Debug only: warn every this many unanswered offers (~15 s).
const OFFER_WARN_EVERY = 5;

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
  private offersSent = 0;
  private answersIgnored = 0;
  private readonly startedAt = Date.now();
  private failed = false;
  private closed = false;
  private readonly stream = new MediaStream();

  constructor(
    private readonly connection: RemoteSignalingConnection,
    private readonly handlers: ViewerHandlers,
  ) {}

  private elapsed = () => `${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`;

  start = () => {
    remoteLog.info("viewer: starting WebRTC viewer", {
      sessionId: this.connection.sessionId,
      role: this.connection.role,
      region: this.connection.region,
      channelArn: this.connection.channelArn,
      clientId: this.connection.clientId,
      viewerClientId: this.connection.viewerClientId,
      controlAllowed: this.connection.controlAllowed,
      signalingHost: signalingHost(this.connection.signalingUrl),
      signedUrlExpiresAt: this.connection.expiresAt,
      iceServers: summarizeIceServers(this.connection.iceServers),
    });
    const ice = summarizeIceServers(this.connection.iceServers);
    if (!ice.turnUdp && !ice.turnTcp && !ice.turns) {
      remoteLog.warn("viewer: no TURN servers were returned; connection fails if a direct/STUN path is blocked");
    }
    const peer = new RTCPeerConnection({ iceServers: this.connection.iceServers });
    this.peer = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    this.audioSender = peer.addTransceiver("audio", { direction: "sendrecv" }).sender;
    const control = peer.createDataChannel("control", { ordered: true });
    this.control = control;
    control.onopen = () => {
      remoteLog.info("viewer: control data channel open", { controlAllowed: this.connection.controlAllowed, after: this.elapsed() });
      if (!this.closed) this.handlers.onControlReady(this.connection.controlAllowed);
    };
    control.onclose = () => {
      remoteLog.info("viewer: control data channel closed", { after: this.elapsed() });
      if (!this.closed) this.handlers.onControlReady(false);
    };

    peer.ontrack = (event) => {
      if (this.closed) return;
      remoteLog.info("viewer: received media track from tablet", { kind: event.track?.kind, after: this.elapsed() });
      if (!this.stream.getTracks().includes(event.track)) this.stream.addTrack(event.track);
      this.handlers.onStream(this.stream);
    };
    peer.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        if (!this.closed) remoteLog.info("viewer: local ICE gathering complete", { after: this.elapsed() });
        return;
      }
      if (this.closed) return;
      remoteLog.info("viewer: local ICE candidate", { type: candidateType(candidate.candidate), protocol: candidate.protocol ?? undefined });
      const frame = encodeSignalingAction("ICE_CANDIDATE", candidate.toJSON());
      if (!peer.remoteDescription) this.localCandidates.push(frame);
      if (this.localOffer) this.signal(frame);
    };
    peer.onconnectionstatechange = () => {
      if (this.closed) return;
      const state = peer.connectionState;
      (state === "failed" ? remoteLog.error : remoteLog.info)("viewer: peer connectionState", { state, after: this.elapsed() });
      if (state === "connected") void this.logSelectedPair(peer);
      if (state === "connected") this.handlers.onState("connected");
      else if (state === "disconnected") this.handlers.onState("disconnected");
      else if (state === "failed") this.fail("peer connectionState became failed");
    };

    peer.oniceconnectionstatechange = () => {
      if (this.closed) return;
      const state = peer.iceConnectionState;
      (state === "failed" ? remoteLog.error : remoteLog.info)("viewer: iceConnectionState", { state, after: this.elapsed() });
      if (state === "failed") {
        remoteLog.error("viewer: ICE failed — no network path between browser and tablet. Check TURN candidates on both sides and the tablet's firewall/UDP.");
      }
    };
    peer.onicegatheringstatechange = () => {
      if (!this.closed) remoteLog.info("viewer: iceGatheringState", { state: peer.iceGatheringState });
    };
    peer.onsignalingstatechange = () => {
      if (!this.closed) remoteLog.info("viewer: signalingState", { state: peer.signalingState });
    };

    this.handlers.onState("connecting");
    remoteLog.info("viewer: opening KVS signaling WebSocket", { host: signalingHost(this.connection.signalingUrl) });
    const socket = new WebSocket(this.connection.signalingUrl);
    this.socket = socket;
    socket.onopen = () => {
      remoteLog.info("viewer: signaling WebSocket open", { after: this.elapsed() });
      void this.offer(peer).catch((error: unknown) => this.fail("creating the offer failed", error));
    };
    socket.onmessage = (event) =>
      void this.receive(String(event.data)).catch((error: unknown) => this.fail("handling a signaling message failed", error));
    socket.onerror = () => {
      remoteLog.error("viewer: signaling WebSocket error (403 = signed URL rejected / IAM ConnectAsViewer missing, or URL expired)", {
        after: this.elapsed(),
        connectionState: peer.connectionState,
      });
      if (peer.connectionState !== "connected") this.fail("signaling WebSocket error");
    };
    socket.onclose = (event) => {
      if (!this.closed) {
        remoteLog.warn("viewer: signaling WebSocket closed", {
          code: event?.code,
          reason: event?.reason || undefined,
          wasClean: event?.wasClean,
          after: this.elapsed(),
          connectionState: peer.connectionState,
          offersSent: this.offersSent,
          gotAnswer: Boolean(peer.remoteDescription),
        });
      }
      if (peer.connectionState !== "connected") this.fail("signaling WebSocket closed before the peer connected");
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
    if (!this.closed) remoteLog.info("viewer: closing", { after: this.elapsed(), offersSent: this.offersSent });
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
    remoteLog.info("viewer: SDP offer created", { sdpBytes: (peer.localDescription?.sdp ?? offer.sdp ?? "").length });
    // The Windows MASTER may open its socket only after the screen picker.
    this.offerTimer = setInterval(this.sendOffer, OFFER_RETRY_MS);
    this.sendOffer();
  }

  private sendOffer = () => {
    if (!this.localOffer || this.peer?.remoteDescription) return;
    try {
      this.signal(this.localOffer);
      for (const candidate of this.localCandidates) this.signal(candidate);
      this.offersSent += 1;
      remoteLog.info("viewer: sent SDP_OFFER to tablet", {
        attempt: this.offersSent,
        iceCandidates: this.localCandidates.length,
        socketOpen: this.socket?.readyState === WebSocket.OPEN,
        after: this.elapsed(),
      });
      if (this.offersSent % OFFER_WARN_EVERY === 0) {
        remoteLog.warn(
          "viewer: still no SDP_ANSWER from the tablet. The tablet MASTER is not connected to the signaling channel, has not picked a screen, or is ignoring the offer (check its senderClientId filter).",
          { offersSent: this.offersSent, viewerClientId: this.connection.viewerClientId, after: this.elapsed() },
        );
      }
    } catch (error) {
      this.fail("sending the offer failed", error);
    }
  };

  private stopOfferRetry() {
    if (this.offerTimer !== null) clearInterval(this.offerTimer);
    this.offerTimer = null;
    this.localCandidates = [];
  }

  private fail = (reason = "peer connection failed", error?: unknown) => {
    if (this.closed || this.failed) return;
    remoteLog.error(`viewer: failed — ${reason}`, {
      ...(error ? describeError(error) : {}),
      after: this.elapsed(),
      offersSent: this.offersSent,
      gotAnswer: Boolean(this.peer?.remoteDescription),
      connectionState: this.peer?.connectionState,
      iceConnectionState: this.peer?.iceConnectionState,
    });
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
    if (!decoded) {
      if (data) remoteLog.warn("viewer: unreadable signaling frame", { bytes: data.length, preview: data.slice(0, 120) });
      return;
    }
    if (!peer || this.closed || this.failed) return;
    const { message, payload } = decoded;
    if (message.messageType !== "ICE_CANDIDATE") {
      remoteLog.info("viewer: signaling message received", {
        type: message.messageType,
        senderClientId: message.senderClientId,
        after: this.elapsed(),
      });
    }
    if (message.messageType === "STATUS_RESPONSE") {
      remoteLog.error("viewer: KVS rejected a signaling message", { ...message.statusResponse });
      return;
    }
    if (message.messageType === "SDP_ANSWER") {
      if (this.applyingAnswer || peer.remoteDescription) {
        this.answersIgnored += 1;
        remoteLog.warn(
          "viewer: extra SDP_ANSWER ignored. The tablet answered more than one (retried) offer; if it keeps only its latest peer, the two sides no longer match and ICE fails.",
          { answersIgnored: this.answersIgnored },
        );
        return;
      }
      this.applyingAnswer = true;
      try {
        await peer.setRemoteDescription(payload as RTCSessionDescriptionInit);
      } catch (error) {
        remoteLog.error("viewer: tablet's SDP answer was rejected by the browser", {
          ...describeError(error),
          answerType: (payload as { type?: unknown } | null)?.type,
          hasVideo: /m=video/.test(String((payload as { sdp?: unknown } | null)?.sdp ?? "")),
        });
        throw error;
      }
      remoteLog.info("viewer: tablet's SDP answer applied", {
        offersSentBeforeAnswer: this.offersSent,
        hasVideo: /m=video/.test(String((payload as { sdp?: unknown } | null)?.sdp ?? "")),
        hasDataChannel: /m=application/.test(String((payload as { sdp?: unknown } | null)?.sdp ?? "")),
        bufferedRemoteCandidates: this.pendingCandidates.length,
        after: this.elapsed(),
      });
      this.stopOfferRetry();
      for (const candidate of this.pendingCandidates.splice(0)) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      }
    } else if (message.messageType === "ICE_CANDIDATE") {
      const candidate = payload as RTCIceCandidateInit;
      remoteLog.info("viewer: remote ICE candidate from tablet", {
        type: candidateType(candidate?.candidate),
        beforeAnswer: !peer.remoteDescription,
      });
      if (peer.remoteDescription) await peer.addIceCandidate(candidate).catch(() => undefined);
      else this.pendingCandidates.push(candidate);
    } else if (message.messageType === "GO_AWAY") {
      remoteLog.warn("viewer: KVS sent GO_AWAY; closing signaling");
      this.socket?.close();
    }
  }

  // Debug: whether media goes direct, via STUN, or relayed through TURN.
  private async logSelectedPair(peer: RTCPeerConnection) {
    try {
      if (typeof peer.getStats !== "function") return;
      const stats = await peer.getStats();
      let pairId: string | undefined;
      stats.forEach((report) => {
        if (report.type === "transport" && report.selectedCandidatePairId) pairId = report.selectedCandidatePairId;
      });
      stats.forEach((report) => {
        if (!pairId && report.type === "candidate-pair" && report.nominated && report.state === "succeeded") pairId = report.id;
      });
      const pair = pairId ? stats.get(pairId) : undefined;
      if (!pair) return;
      const local = stats.get(pair.localCandidateId);
      const remote = stats.get(pair.remoteCandidateId);
      remoteLog.info("viewer: connected via", {
        local: local?.candidateType,
        localProtocol: local?.protocol,
        remote: remote?.candidateType,
        rttMs: typeof pair.currentRoundTripTime === "number" ? Math.round(pair.currentRoundTripTime * 1000) : undefined,
      });
    } catch {
      // Stats are only for the log.
    }
  }
}
