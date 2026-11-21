// One audio track for the whole recording that never goes silent-and-
// stalled. Chrome's MediaRecorder writes nothing (video included) while an
// audio track has no samples, and a new window's AudioContext stays
// suspended until someone clicks in it. This track is fed from a live
// source when one delivers audio (the mixed AudioContext output, or the
// tablet's own track) and with silence otherwise, so recording can start
// the moment the screen appears. Chrome/Edge (MediaStreamTrackGenerator).

const SAMPLE_RATE = 48_000;
const CHUNK_FRAMES = 960; // 20 ms
const TICK_MS = 20;
// A live source quiet this long is treated as gone; silence fills in.
const LIVE_STALE_MS = 120;

interface GeneratorTrack extends MediaStreamTrack {
  writable: WritableStream<AudioData>;
}
type GeneratorConstructor = new (init: { kind: "audio" }) => GeneratorTrack;
type ProcessorConstructor = new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<AudioData> };

const globals = globalThis as unknown as {
  MediaStreamTrackGenerator?: GeneratorConstructor;
  MediaStreamTrackProcessor?: ProcessorConstructor;
  AudioData?: typeof AudioData;
};

export class AudioPump {
  readonly track: MediaStreamTrack;
  private readonly writer: WritableStreamDefaultWriter<AudioData>;
  private readonly startedAt = performance.now();
  private written = 0;
  private lastLiveAt = 0;
  private timer: ReturnType<typeof setInterval>;
  private live: ReadableStreamDefaultReader<AudioData> | null = null;
  private stopped = false;

  static isSupported = () =>
    Boolean(globals.MediaStreamTrackGenerator && globals.MediaStreamTrackProcessor && globals.AudioData);

  constructor() {
    const generator = new globals.MediaStreamTrackGenerator!({ kind: "audio" });
    this.track = generator;
    this.writer = generator.writable.getWriter();
    this.timer = setInterval(this.fillSilence, TICK_MS);
    this.fillSilence();
  }

  // Feeds this track from `source` (replacing any earlier source). Only
  // its first channel is kept, resampling isn't done: give it 48 kHz audio.
  useSource = (source: MediaStreamTrack) => {
    if (this.stopped) return;
    void this.live?.cancel().catch(() => undefined);
    const reader = new globals.MediaStreamTrackProcessor!({ track: source }).readable.getReader();
    this.live = reader;
    const pump = async () => {
      for (;;) {
        const { value: frame, done } = await reader.read();
        if (done || !frame || this.live !== reader || this.stopped) {
          frame?.close();
          return;
        }
        try {
          if (frame.sampleRate === SAMPLE_RATE) {
            const samples = new Float32Array(frame.numberOfFrames);
            frame.copyTo(samples, { planeIndex: 0, format: "f32-planar" });
            this.lastLiveAt = performance.now();
            this.write(samples);
          }
        } finally {
          frame.close();
        }
      }
    };
    void pump().catch(() => undefined);
  };

  stop = () => {
    this.stopped = true;
    clearInterval(this.timer);
    void this.live?.cancel().catch(() => undefined);
    void this.writer.close().catch(() => undefined);
    this.track.stop();
  };

  // Keeps the track at wall-clock time with silence while no live source
  // is delivering (timers are throttled in background windows, so it
  // catches up in one go).
  private fillSilence = () => {
    if (this.stopped || performance.now() - this.lastLiveAt < LIVE_STALE_MS) return;
    const due = Math.floor(((performance.now() - this.startedAt) / 1000) * SAMPLE_RATE);
    while (this.written + CHUNK_FRAMES <= due) this.write(new Float32Array(CHUNK_FRAMES));
  };

  private write(samples: Float32Array<ArrayBuffer>) {
    const data = new globals.AudioData!({
      format: "f32-planar",
      sampleRate: SAMPLE_RATE,
      numberOfFrames: samples.length,
      numberOfChannels: 1,
      timestamp: Math.round((this.written / SAMPLE_RATE) * 1_000_000),
      data: samples,
    });
    this.written += samples.length;
    void this.writer.write(data).catch(() => undefined);
  }
}
