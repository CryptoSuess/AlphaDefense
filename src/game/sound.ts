import { loadSoundOn, saveSoundOn } from '../utils/storage';

/**
 * Sound manager — fully synthesized with the Web Audio API, no audio assets.
 *
 * Every effect is built from oscillators and noise bursts, so the bundle
 * stays tiny and there is nothing to download. If recorded SFX land later,
 * swap the relevant case in `synthesize()` for a sample player; the engine
 * call sites (`play(id)`) never change.
 *
 * Browser autoplay rules: the AudioContext is created lazily and resumed on
 * each play attempt. It stays silently suspended until the first user
 * gesture (which always happens — the game starts behind button clicks).
 */
export type SoundId =
  | 'shoot'
  | 'splash'
  | 'hit'
  | 'kill'
  | 'leak'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'wave'
  | 'boss'
  | 'gameover'
  | 'victory';

/** Minimum seconds between repeats of the same effect (rapid-fire safety). */
const THROTTLE: Partial<Record<SoundId, number>> = {
  shoot: 0.045,
  splash: 0.08,
  hit: 0.06,
  kill: 0.07,
  leak: 0.25,
};

const MASTER_VOL = 0.5;
const MUSIC_VOL = 0.05;

export class SoundManager {
  private enabled: boolean = loadSoundOn();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private lastPlayed = new Map<SoundId, number>();

  get on(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    saveSoundOn(this.enabled);
    if (this.enabled) this.startMusic();
    else this.stopMusic();
    return this.enabled;
  }

  /** Fire-and-forget SFX. Safe to call from the 60fps engine loop. */
  play(id: SoundId): void {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    if (t - last < (THROTTLE[id] ?? 0)) return;
    this.lastPlayed.set(id, t);
    this.synthesize(id, ctx, t);
  }

  /** Starts the ambient background loop (idempotent). */
  startMusic(): void {
    if (!this.enabled || this.musicTimer !== null) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.nextNoteTime = ctx.currentTime + 0.1;
    // Lookahead scheduler: wake every 200ms, schedule notes due in the next
    // 400ms. Survives main-thread jank without drifting.
    this.musicTimer = setInterval(() => this.scheduleMusic(), 200);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Releases audio resources (engine teardown). */
  dispose(): void {
    this.stopMusic();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = MASTER_VOL;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = MUSIC_VOL;
        this.musicGain.connect(this.master);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /**
   * One enveloped oscillator note. `freqEnd` glides the pitch over the note,
   * which is what makes lasers fall, alarms wail and coins rise.
   */
  private tone(
    ctx: AudioContext,
    opts: {
      at: number;
      freq: number;
      freqEnd?: number;
      type?: OscillatorType;
      dur?: number;
      vol?: number;
      attack?: number;
      dest?: AudioNode;
    },
  ): void {
    const { at, freq, freqEnd, type = 'sine', dur = 0.15, vol = 0.15, attack = 0.005 } = opts;
    const dest = opts.dest ?? this.master;
    if (!dest) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), at + dur);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** Short filtered white-noise burst (impacts, explosions). */
  private noise(
    ctx: AudioContext,
    opts: { at: number; dur?: number; vol?: number; lowpass?: number },
  ): void {
    const { at, dur = 0.12, vol = 0.12, lowpass = 1200 } = opts;
    if (!this.master) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(at);
  }

  private synthesize(id: SoundId, ctx: AudioContext, t: number): void {
    switch (id) {
      case 'shoot': // quick falling zap
        this.tone(ctx, { at: t, freq: 900, freqEnd: 350, type: 'square', dur: 0.07, vol: 0.05 });
        break;
      case 'splash': // boom: low thud + noise
        this.tone(ctx, { at: t, freq: 140, freqEnd: 45, type: 'sine', dur: 0.25, vol: 0.2 });
        this.noise(ctx, { at: t, dur: 0.2, vol: 0.1, lowpass: 700 });
        break;
      case 'hit': // tiny tick
        this.tone(ctx, { at: t, freq: 1700, freqEnd: 1200, type: 'triangle', dur: 0.03, vol: 0.04 });
        break;
      case 'kill': // rising coin ding
        this.tone(ctx, { at: t, freq: 660, type: 'triangle', dur: 0.07, vol: 0.08 });
        this.tone(ctx, { at: t + 0.06, freq: 990, type: 'triangle', dur: 0.12, vol: 0.08 });
        break;
      case 'leak': // descending alarm
        this.tone(ctx, { at: t, freq: 520, freqEnd: 260, type: 'sawtooth', dur: 0.3, vol: 0.14 });
        this.tone(ctx, { at: t + 0.05, freq: 390, freqEnd: 195, type: 'square', dur: 0.3, vol: 0.07 });
        break;
      case 'place': // solid thunk + confirm chime
        this.noise(ctx, { at: t, dur: 0.08, vol: 0.12, lowpass: 500 });
        this.tone(ctx, { at: t + 0.03, freq: 523, type: 'triangle', dur: 0.1, vol: 0.08 });
        break;
      case 'upgrade': // ascending arpeggio
        [523, 659, 784].forEach((f, i) =>
          this.tone(ctx, { at: t + i * 0.07, freq: f, type: 'triangle', dur: 0.12, vol: 0.09 }),
        );
        break;
      case 'sell': // descending two-tone
        this.tone(ctx, { at: t, freq: 660, type: 'triangle', dur: 0.08, vol: 0.08 });
        this.tone(ctx, { at: t + 0.08, freq: 440, type: 'triangle', dur: 0.14, vol: 0.08 });
        break;
      case 'wave': // horn swell
        this.tone(ctx, { at: t, freq: 220, type: 'sawtooth', dur: 0.4, vol: 0.08, attack: 0.12 });
        this.tone(ctx, { at: t, freq: 330, type: 'sawtooth', dur: 0.4, vol: 0.06, attack: 0.12 });
        break;
      case 'boss': // ominous low growl
        this.tone(ctx, { at: t, freq: 80, freqEnd: 55, type: 'sawtooth', dur: 0.9, vol: 0.18, attack: 0.2 });
        this.tone(ctx, { at: t, freq: 120, freqEnd: 82, type: 'square', dur: 0.9, vol: 0.07, attack: 0.2 });
        this.noise(ctx, { at: t + 0.1, dur: 0.5, vol: 0.05, lowpass: 300 });
        break;
      case 'gameover': // sad descending phrase
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone(ctx, { at: t + i * 0.22, freq: f, type: 'triangle', dur: 0.3, vol: 0.12 }),
        );
        break;
      case 'victory': // triumphant fanfare
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(ctx, { at: t + i * 0.13, freq: f, type: 'square', dur: 0.2, vol: 0.07 }),
        );
        this.tone(ctx, { at: t + 0.52, freq: 1047, type: 'triangle', dur: 0.5, vol: 0.12 });
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Ambient music loop: a slow minor-key bass walk with an airy fifth above,
  // quiet enough to sit under the SFX.
  // -------------------------------------------------------------------------

  /** Bass pattern in Hz (A1, C2, E2, G1), one note per beat at ~64 BPM. */
  private static readonly BASS = [55, 65.41, 82.41, 49];

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const beat = 60 / 64;
    while (this.nextNoteTime < ctx.currentTime + 0.4) {
      const idx = this.noteIndex % SoundManager.BASS.length;
      const freq = SoundManager.BASS[idx];
      this.tone(ctx, {
        at: this.nextNoteTime,
        freq,
        type: 'triangle',
        dur: beat * 0.9,
        vol: 0.5,
        attack: 0.05,
        dest: this.musicGain,
      });
      // Sparse airy fifth on the first beat of each bar.
      if (idx === 0) {
        this.tone(ctx, {
          at: this.nextNoteTime,
          freq: freq * 3,
          type: 'sine',
          dur: beat * 3.5,
          vol: 0.18,
          attack: 0.4,
          dest: this.musicGain,
        });
      }
      this.nextNoteTime += beat;
      this.noteIndex++;
    }
  }
}
