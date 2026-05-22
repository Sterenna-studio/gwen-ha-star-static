export const ArcadeSFX = {
  _ctx: null,
  _g() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },
  tone(freq = 440, type = 'sine', vol = 0.06, dur = 0.1) {
    const ctx = this._g();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  },
  click() { this.tone(800, 'sine', 0.05, 0.06); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.08, 0.12), i * 80)); },
  lose() { [330, 260, 180].forEach((f, i) => setTimeout(() => this.tone(f, 'sawtooth', 0.06, 0.14), i * 90)); },
  tick() { this.tone(1300, 'square', 0.025, 0.025); },
  jackpot() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this.tone(f, i % 2 ? 'triangle' : 'square', 0.08, 0.14), i * 65)); },
  crash() { this.tone(100, 'sawtooth', 0.12, 0.35); },
};
