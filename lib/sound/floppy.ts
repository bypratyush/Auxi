// Floppy disk sounds synthesized via Web Audio.
// AudioContext must be created/resumed inside a user gesture.

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let muted = readMutePref();

function readMutePref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('auxi-sound-muted') === 'true';
  } catch {
    return false;
  }
}

function getCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('auxi-sound-muted', m ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }
}
export function isMuted() {
  return muted;
}

/** Sharp high "tic" — floppy ejecting. ~50ms. */
export function playEject() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.pow(1 - i / len, 3);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 4500;
  bp.Q.value = 3;
  const g = c.createGain();
  g.gain.value = 0.35;
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
}

/** Low motor hum — disk reading. ~250ms. */
export function playWhirr() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 62;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  lp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.03);
  g.gain.setValueAtTime(0.12, now + 0.18);
  g.gain.linearRampToValueAtTime(0, now + 0.25);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.26);
}

/** Low "thock" — floppy locking into slot. ~100ms. */
export function playInsert() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 78;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 350;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.11);
}

/** Tiny electronic chirp — LED confirm. ~30ms. */
export function playLed() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(820, now);
  osc.frequency.exponentialRampToValueAtTime(1240, now + 0.03);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.18, now + 0.005);
  g.gain.linearRampToValueAtTime(0, now + 0.03);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

/** Longer drive whirr — "loading details from disk". ~450ms. */
export function playLoad() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  // primary motor whirr (sawtooth ramping up then down)
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(54, now);
  osc.frequency.linearRampToValueAtTime(72, now + 0.18);
  osc.frequency.linearRampToValueAtTime(58, now + 0.42);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 280;
  lp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.04);
  g.gain.setValueAtTime(0.16, now + 0.38);
  g.gain.linearRampToValueAtTime(0, now + 0.45);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.46);

  // tiny initial "engage" click
  const len = Math.floor(c.sampleRate * 0.04);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3800;
  bp.Q.value = 2;
  const cg = c.createGain();
  cg.gain.value = 0.32;
  src.connect(bp).connect(cg).connect(c.destination);
  src.start(now);
}

/** Quick descending whirr + click — closing the disk. ~180ms. */
export function playClose() {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 240;
  const g = c.createGain();
  g.gain.setValueAtTime(0.14, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  osc.connect(lp).connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.17);
}

/** Init AudioContext inside a user gesture. Safe to call repeatedly. */
export function unlockAudio() {
  getCtx();
}
