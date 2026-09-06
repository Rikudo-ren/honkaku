import type { SfxName } from './types';

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  to?: number;
  type?: Wave;
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
}

const BATTLE_LEAD = [
  69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 72, 0, 69, 0, 67, 0, 65, 0, 69, 0, 72, 0, 69, 0, 71, 0, 74, 0, 72, 0, 71, 0,
  69, 0, 72, 0, 76, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0, 71, 0, 67, 0,
];
const BATTLE_BASS = [
  45, 45, 0, 45, 45, 45, 0, 45, 41, 41, 0, 41, 43, 43, 0, 43, 45, 45, 0, 45, 45, 45, 0, 45, 41, 41, 0, 41, 43, 43, 0, 43,
  45, 45, 0, 45, 45, 45, 0, 45, 41, 41, 0, 41, 43, 43, 0, 43, 40, 40, 0, 40, 41, 41, 0, 41, 43, 43, 0, 43, 43, 0, 43, 0,
];
const TITLE_LEAD = [
  57, 0, 60, 0, 64, 0, 67, 0, 64, 0, 60, 0, 57, 0, 0, 0, 55, 0, 59, 0, 62, 0, 67, 0, 62, 0, 59, 0, 55, 0, 0, 0,
  53, 0, 57, 0, 60, 0, 65, 0, 60, 0, 57, 0, 53, 0, 0, 0, 52, 0, 55, 0, 59, 0, 64, 0, 59, 0, 55, 0, 52, 0, 0, 0,
];
const TITLE_BASS = [
  33, 0, 0, 0, 0, 0, 0, 0, 33, 0, 0, 0, 0, 0, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0,
  29, 0, 0, 0, 0, 0, 0, 0, 29, 0, 0, 0, 0, 0, 0, 0, 28, 0, 0, 0, 0, 0, 0, 0, 28, 0, 0, 0, 0, 0, 0, 0,
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private bgmKind: 'title' | 'battle' | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  private tone(o: ToneOpts) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  private noise(dur: number, vol = 0.2, delay = 0, freq = 1200) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  sfx(name: SfxName) {
    if (!this.ctx) return;
    switch (name) {
      case 'clap':
        // 二拍のタイミングは技側で指定。短い手拍子と体育館の小さな反響。
        this.noise(0.045, 0.18, 0, 3800);
        this.noise(0.035, 0.055, 0.055, 2600);
        this.tone({ freq: 950, to: 600, dur: 0.025, vol: 0.06, type: 'triangle' });
        break;
      case 'squeak':
        this.tone({ freq: 1250, to: 1950, dur: 0.055, vol: 0.1, type: 'sine' });
        this.tone({ freq: 1900, to: 850, dur: 0.1, vol: 0.08, type: 'sine', delay: 0.04 });
        this.noise(0.045, 0.05, 0, 1800);
        break;
      case 'cheer':
        // 生声ではなく、既存のチップ音源に合わせた「わっ」という声援の音圧。
        this.tone({ freq: 330, to: 570, dur: 0.3, vol: 0.14, type: 'sawtooth', attack: 0.05 });
        this.tone({ freq: 660, to: 850, dur: 0.28, vol: 0.055, type: 'triangle', delay: 0.03 });
        this.noise(0.23, 0.07, 0.05, 2200);
        this.tone({ freq: 440, to: 600, dur: 0.22, vol: 0.035, type: 'sawtooth', delay: 0.16 });
        break;
      case 'hit':
        this.tone({ freq: 240, to: 90, dur: 0.09, vol: 0.25 });
        this.noise(0.06, 0.18);
        break;
      case 'heavy':
        this.tone({ freq: 150, to: 40, dur: 0.18, vol: 0.32 });
        this.noise(0.14, 0.3, 0, 800);
        break;
      case 'guard':
        this.tone({ freq: 700, to: 500, dur: 0.05, vol: 0.15, type: 'triangle' });
        this.noise(0.03, 0.1, 0, 3000);
        break;
      case 'swing':
        this.noise(0.06, 0.08, 0, 2500);
        break;
      case 'special':
        this.tone({ freq: 440, dur: 0.06, vol: 0.15 });
        this.tone({ freq: 660, dur: 0.06, vol: 0.15, delay: 0.05 });
        this.tone({ freq: 880, dur: 0.1, vol: 0.15, delay: 0.1 });
        break;
      case 'cross':
        this.tone({ freq: 1200, to: 900, dur: 0.12, vol: 0.14, type: 'triangle' });
        this.tone({ freq: 1800, to: 1300, dur: 0.12, vol: 0.08, type: 'triangle', delay: 0.03 });
        break;
      case 'super':
        this.tone({ freq: 200, to: 1400, dur: 0.6, vol: 0.2, type: 'sawtooth' });
        this.tone({ freq: 100, to: 700, dur: 0.6, vol: 0.15, type: 'square', delay: 0.05 });
        this.noise(0.4, 0.15, 0.1, 600);
        break;
      case 'ko':
        this.tone({ freq: 320, to: 40, dur: 0.7, vol: 0.3 });
        this.noise(0.5, 0.3, 0, 500);
        this.tone({ freq: 660, dur: 0.15, vol: 0.2, delay: 0.5 });
        this.tone({ freq: 880, dur: 0.3, vol: 0.2, delay: 0.65 });
        break;
      case 'jump':
        this.tone({ freq: 300, to: 620, dur: 0.11, vol: 0.12 });
        break;
      case 'land':
        this.noise(0.04, 0.1, 0, 600);
        break;
      case 'select':
      case 'move':
        this.tone({ freq: 880, dur: 0.04, vol: 0.12 });
        break;
      case 'confirm':
        this.tone({ freq: 660, dur: 0.07, vol: 0.14 });
        this.tone({ freq: 990, dur: 0.12, vol: 0.14, delay: 0.07 });
        break;
      case 'back':
        this.tone({ freq: 440, to: 220, dur: 0.12, vol: 0.12 });
        break;
      case 'ha':
        this.tone({ freq: 520, to: 760, dur: 0.16, vol: 0.22, type: 'square' });
        this.tone({ freq: 1040, to: 1520, dur: 0.16, vol: 0.08, type: 'triangle' });
        break;
      case 'item':
      case 'heal':
        this.tone({ freq: 880, dur: 0.08, vol: 0.14, type: 'triangle' });
        this.tone({ freq: 1320, dur: 0.12, vol: 0.14, type: 'triangle', delay: 0.08 });
        this.tone({ freq: 1760, dur: 0.16, vol: 0.12, type: 'triangle', delay: 0.16 });
        break;
      case 'event':
        this.tone({ freq: 200, dur: 0.08, vol: 0.18 });
        this.tone({ freq: 300, dur: 0.08, vol: 0.18, delay: 0.08 });
        this.tone({ freq: 400, dur: 0.16, vol: 0.18, delay: 0.16 });
        this.noise(0.2, 0.12, 0, 1500);
        break;
      case 'round':
        this.tone({ freq: 440, dur: 0.1, vol: 0.16 });
        this.tone({ freq: 554, dur: 0.1, vol: 0.16, delay: 0.1 });
        this.tone({ freq: 659, dur: 0.25, vol: 0.16, delay: 0.2 });
        break;
    }
  }

  playBgm(kind: 'title' | 'battle') {
    if (!this.ctx) return;
    if (this.bgmKind === kind && this.timer !== null) return;
    this.stopBgm();
    this.bgmKind = kind;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stopBgm() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.bgmKind = null;
  }

  private schedule() {
    if (!this.ctx || !this.bgmKind) return;
    const battle = this.bgmKind === 'battle';
    const stepDur = battle ? 60 / 152 / 4 : 60 / 96 / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      const i = this.step % 64;
      const delay = Math.max(0, this.nextTime - this.ctx.currentTime);
      const lead = battle ? BATTLE_LEAD[i] : TITLE_LEAD[i];
      const bass = battle ? BATTLE_BASS[i] : TITLE_BASS[i];
      if (lead) this.tone({ freq: midi(lead), dur: stepDur * (battle ? 1.6 : 2.4), vol: battle ? 0.07 : 0.05, type: battle ? 'square' : 'triangle', delay });
      if (bass) this.tone({ freq: midi(bass), dur: stepDur * (battle ? 1.2 : 6), vol: battle ? 0.09 : 0.08, type: 'triangle', delay });
      if (battle) {
        if (i % 4 === 0) this.tone({ freq: 120, to: 40, dur: 0.1, vol: 0.14, type: 'sine', delay });
        if (i % 4 === 2) this.noise(0.03, 0.05, delay, 5000);
        if (i % 8 === 4) this.noise(0.08, 0.08, delay, 1800);
      } else if (i % 8 === 0) {
        this.noise(0.02, 0.02, delay, 5000);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
