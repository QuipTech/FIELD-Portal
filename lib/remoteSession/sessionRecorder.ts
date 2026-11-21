// Records the session in the viewer: the tablet's screen, with the tablet's
// audio and the viewer's microphone mixed in, as WebM. Parts of at least
// 5 MiB (S3's multipart minimum; the last may be smaller) upload one at a
// time while the session runs, so a closed window loses at most the part
// still buffering.
export const MIN_PART_BYTES = 5 * 1024 * 1024;
const TIMESLICE_MS = 4000;
// The recording draws the tablet's video onto a canvas at this rate, so a
// reconnect (a new video track) carries on in the same file.
const RECORD_FPS = 15;
const RECORD_SIZE = { width: 1280, height: 720 };
const UPLOAD_ATTEMPTS = 4;

type UploadPart = (partNumber: number, part: Blob) => Promise<unknown>;

const pickMimeType = () =>
  ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"].find(
    (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
  );

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

export class SessionRecorder {
  private recorder: MediaRecorder | null = null;
  private audio: AudioContext | null = null;
  private readonly mixedTracks = new WeakSet<MediaStreamTrack>();
  private mix: MediaStreamAudioDestinationNode | null = null;
  private chunks: Blob[] = [];
  private bufferedBytes = 0;
  private nextPart = 1;
  private queue: Promise<void> = Promise.resolve();
  private failed = false;
  private stopped: Promise<void> | null = null;
  private stopping = false;
  private canvasTrack: MediaStreamTrack | null = null;
  private source: HTMLVideoElement | null = null;
  private drawTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly upload: UploadPart,
    private readonly onFailure: (message: string) => void,
    // Called whenever the recorder starts or stops, so the UI shows the truth.
    private readonly onStateChange: (recording: boolean) => void = () => undefined,
    // The <video> showing the tablet on the page, the best source of frames.
    private readonly visibleVideo?: () => HTMLVideoElement | null,
  ) {}

  static isSupported = () => Boolean(pickMimeType()) && typeof AudioContext !== "undefined";

  get isRecording() {
    return this.recorder?.state === "recording";
  }

  start = (remote: MediaStream) => {
    const mimeType = pickMimeType();
    const video = remote.getVideoTracks()[0];
    if (!mimeType || !video) {
      this.fail("This browser can't record the session.");
      return;
    }
    this.audio = new AudioContext();
    this.mix = this.audio.createMediaStreamDestination();
    this.addAudio(remote);
    const canvasTrack = this.startCanvas(video);
    // Always one audio track, so the file has audio for transcription.
    const recorded = new MediaStream([canvasTrack, ...this.mix.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(recorded, { mimeType, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 });
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      this.chunks.push(event.data);
      this.bufferedBytes += event.data.size;
      if (this.bufferedBytes >= MIN_PART_BYTES) this.flush();
    };
    recorder.onerror = () => this.fail("Recording stopped unexpectedly.");
    recorder.onstart = () => this.onStateChange(true);
    recorder.onstop = () => {
      this.onStateChange(false);
      if (!this.stopping) this.fail("Recording stopped unexpectedly.");
    };
    recorder.start(TIMESLICE_MS);
  };

  // After a reconnect: record the new video track in the same file.
  setVideo = (track: MediaStreamTrack | undefined) => {
    if (!track || !this.source) return;
    const current = (this.source.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (current === track) return;
    this.source.srcObject = new MediaStream([track]);
    void this.source.play().catch(() => undefined);
  };

  // Draws the tablet's video onto a fixed-size canvas and records that, so
  // a reconnect (a new video track) carries on in the same file. Frames come
  // from the visible <video> on the page when there is one: Chrome pauses
  // muted videos that aren't on screen, so an off-screen copy gets no frames.
  private startCanvas(track: MediaStreamTrack): MediaStreamTrack {
    const canvas = document.createElement("canvas");
    // Fixed for the whole file: resizing a canvas while it's recorded can
    // stop the recorder. Other shapes are letterboxed.
    canvas.width = RECORD_SIZE.width;
    canvas.height = RECORD_SIZE.height;
    const context = canvas.getContext("2d");
    const fallback = document.createElement("video");
    fallback.muted = true;
    fallback.playsInline = true;
    fallback.srcObject = new MediaStream([track]);
    void fallback.play().catch(() => undefined);
    this.source = fallback;
    const ready = (video: HTMLVideoElement | null | undefined): video is HTMLVideoElement =>
      Boolean(video && video.readyState >= 2 && video.videoWidth && video.videoHeight);
    if (context) {
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    this.drawTimer = setInterval(() => {
      if (!context) return;
      const visible = this.visibleVideo?.();
      const source = ready(visible) ? visible : ready(fallback) ? fallback : null;
      if (!source) {
        // No picture right now (connecting or reconnecting): keep the last
        // frame and touch one pixel so the recording keeps its timeline.
        context.fillStyle = "#000";
        context.fillRect(0, 0, 1, 1);
        return;
      }
      const scale = Math.min(canvas.width / source.videoWidth, canvas.height / source.videoHeight);
      const width = source.videoWidth * scale;
      const height = source.videoHeight * scale;
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    }, 1000 / RECORD_FPS);
    this.canvasTrack = canvas.captureStream(RECORD_FPS).getVideoTracks()[0];
    return this.canvasTrack;
  }


  private stopCanvas() {
    if (this.drawTimer !== null) clearInterval(this.drawTimer);
    this.drawTimer = null;
    if (this.source) this.source.srcObject = null;
    this.canvasTrack?.stop();
  }

  // Mixes a stream's audio (the tablet's, or the viewer's microphone) in.
  addAudio = (stream: MediaStream) => {
    if (!this.audio || !this.mix) return;
    for (const track of stream.getAudioTracks()) {
      if (this.mixedTracks.has(track)) continue;
      this.mixedTracks.add(track);
      this.audio.createMediaStreamSource(new MediaStream([track])).connect(this.mix);
    }
  };

  resumeAudio = () => this.audio?.resume().catch(() => undefined);

  // Stops, uploads what is left, and resolves once every part is up. False
  // when anything failed.
  stop = (): Promise<boolean> => {
    this.stopping = true;
    this.stopped ??= new Promise<void>((done) => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === "inactive") return done();
      recorder.onstop = () => {
        this.onStateChange(false);
        done();
      };
      recorder.stop();
    }).then(async () => {
      this.stopCanvas();
      this.flush();
      await this.queue;
      await this.audio?.close().catch(() => undefined);
    });
    return this.stopped.then(() => !this.failed && this.nextPart > 1);
  };

  private flush() {
    if (this.chunks.length === 0) return;
    const part = new Blob(this.chunks, { type: "video/webm" });
    const partNumber = this.nextPart;
    this.nextPart += 1;
    this.chunks = [];
    this.bufferedBytes = 0;
    this.queue = this.queue.then(() => this.uploadWithRetry(partNumber, part));
  }

  private async uploadWithRetry(partNumber: number, part: Blob) {
    if (this.failed) return;
    for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
      try {
        await this.upload(partNumber, part);
        return;
      } catch {
        if (attempt < UPLOAD_ATTEMPTS) await wait(1000 * 2 ** attempt);
      }
    }
    this.fail("Part of the recording couldn't be uploaded.");
  }

  private fail(message: string) {
    if (this.failed) return;
    this.failed = true;
    this.onFailure(message);
  }
}
