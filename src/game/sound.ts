import { loadSoundOn, saveSoundOn } from '../utils/storage';

/**
 * Sound manager (placeholder).
 *
 * Real audio assets are not in yet — this class keeps the on/off preference
 * and exposes a play() API the engine already calls, so wiring in actual
 * sounds later is just filling in the `play` switch.
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

export class SoundManager {
  private enabled: boolean = loadSoundOn();

  get on(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    saveSoundOn(this.enabled);
    return this.enabled;
  }

  /** No-op until audio assets land. */
  play(_id: SoundId): void {
    if (!this.enabled) return;
    // TODO: hook up real SFX (e.g. Howler.js or WebAudio) per SoundId.
  }
}
