// Records the session in the viewer: the tablet's screen, with the tablet's
// audio and the viewer's microphone mixed in, as WebM. Parts of at least
// 5 MiB (S3's multipart minimum; the last may be smaller) upload one at a
// time while the session runs, so a closed window loses at most the part
// still buffering.
export const MIN_PART_BYTES = 5 * 1024 * 1024;
const TIMESLICE_MS = 4000;
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
  private mix: MediaStreamAudioDestinationNode | null = null;
  private chunks: Blob[] = [];
  private bufferedBytes = 0;
  private nextPart = 1;
  private queue: Promise<void> = Promise.resolve();
  private failed = false;
  private stopped: Promise<void> | null = null;

  constructor(
    private readonly upload: UploadPart,
    private readonly onFailure: (message: string) => void,
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
    // Always one audio track, so the file has audio for transcription.
    const recorded = new MediaStream([video, ...this.mix.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(recorded, { mimeType, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 });
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      this.chunks.push(event.data);
      this.bufferedBytes += event.data.size;
      if (this.bufferedBytes >= MIN_PART_BYTES) this.flush();
    };
    recorder.onerror = () => this.fail("Recording stopped unexpectedly.");
    recorder.start(TIMESLICE_MS);
  };

  // Mixes a stream's audio (the tablet's, or the viewer's microphone) in.
  addAudio = (stream: MediaStream) => {
    if (!this.audio || !this.mix || stream.getAudioTracks().length === 0) return;
    this.audio.createMediaStreamSource(stream).connect(this.mix);
  };

  // Stops, uploads what is left, and resolves once every part is up. False
  // when anything failed.
  stop = (): Promise<boolean> => {
    this.stopped ??= new Promise<void>((done) => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === "inactive") return done();
      recorder.onstop = () => done();
      recorder.stop();
    }).then(async () => {
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
