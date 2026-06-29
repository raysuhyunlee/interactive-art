// Synthesized wing-beat "whoosh": a short burst of noise swept downward through
// a bandpass filter. No audio asset needed. Browsers suspend AudioContext until
// a user gesture, so we resume on the first interaction.
export class FlapAudio {
  private ctx: AudioContext;
  private noise: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();

    const len = Math.floor(this.ctx.sampleRate * 0.3);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const resume = () => {
      void this.ctx.resume();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
  }

  // power (0..1) scales the loudness of the beat
  flap(power = 1): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.18);

    const gain = this.ctx.createGain();
    const vol = 0.3 * Math.max(0.35, Math.min(1, power));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.25);
  }
}
