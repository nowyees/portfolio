// Synthesised sound for the robot cell (no audio files): room hum, servo whine
// that follows each robot's joint speed, camera whoosh and an end-of-travel clunk.
export class LabAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private servos: { gain: GainNode; osc: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode }[] = [];
  private noise!: AudioBuffer;
  muted = false;

  get started() {
    return !!this.ctx;
  }

  start(servoCount: number) {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, ctx.currentTime, 0.4);
    this.master.connect(comp);

    // brown noise buffer (shared by hum and whoosh)
    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }

    // room tone: low rumble + mains hum
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noise;
    rumble.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const rg = ctx.createGain();
    rg.gain.value = 0.22;
    rumble.connect(lp).connect(rg).connect(this.master);
    rumble.start();
    for (const [f, g] of [[55, 0.025], [110, 0.008]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.master);
      o.start();
    }

    // one servo voice per robot, silent until it moves
    for (let i = 0; i < servoCount; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 80;
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 161;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      filter.Q.value = 3;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      pan.pan.value = i % 2 === 0 ? -0.5 : 0.5;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain).connect(pan).connect(this.master);
      osc.start();
      osc2.start();
      this.servos.push({ gain, osc, osc2, filter });
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.15);
  }

  /** speed: 0..~1 (joint travel per second) */
  setServo(i: number, speed: number) {
    const ctx = this.ctx;
    const s = this.servos[i];
    if (!ctx || !s) return;
    const v = Math.min(1, Math.abs(speed) * 1.6);
    const now = ctx.currentTime;
    s.gain.gain.setTargetAtTime(v * 0.09, now, 0.06);
    s.osc.frequency.setTargetAtTime(70 + v * 120, now, 0.08);
    s.osc2.frequency.setTargetAtTime(143 + v * 241, now, 0.08);
    s.filter.frequency.setTargetAtTime(450 + v * 1500, now, 0.08);
  }

  whoosh(duration = 1.6) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(250, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + duration * 0.5);
    bp.frequency.exponentialRampToValueAtTime(300, now + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.5, now + duration * 0.45);
    g.gain.linearRampToValueAtTime(0, now + duration);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now, Math.random() * 1.5, duration + 0.1);
  }

  clunk() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(95, now);
    o.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.32);
    // metallic tick
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.25, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(hp).connect(tg).connect(this.master);
    src.start(now, 0, 0.08);
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
  }
}
