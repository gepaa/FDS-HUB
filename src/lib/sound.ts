/**
 * FDS Hub sound engine — synthesized UI sounds via WebAudio.
 * No audio assets; every sound is generated. Volumes are deliberately
 * low: this should feel like glass and water, not a casino.
 *
 * Mute state persists in localStorage and is exposed through a
 * subscribe/snapshot pair for useSyncExternalStore.
 */

export type SoundName =
  | "tap" // soft glass tap — buttons, nav
  | "toggle" // two-step tick — switches
  | "success" // gentle two-note chime — saves, imports
  | "error" // low descending buzz
  | "whoosh" // filtered air — drawers, modals
  | "drop" // water plop — kanban card dropped
  | "pop"; // small rising blip — card picked up

const STORAGE_KEY = "fds-sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let initialized = false;
const listeners = new Set<() => void>();

function initState() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  muted = window.localStorage.getItem(STORAGE_KEY) === "off";
}

export function isMuted(): boolean {
  initState();
  return muted;
}

export function setMuted(next: boolean) {
  initState();
  muted = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "off" : "on");
  } catch {
    // storage unavailable (private mode) — keep in-memory state
  }
  listeners.forEach((l) => l());
}

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

/** Play a short oscillator sweep with an exponential-ish envelope. */
function tone(opts: {
  type: OscillatorType;
  from: number;
  to?: number;
  duration: number;
  gain: number;
  delay?: number;
  curve?: "exp" | "lin";
}) {
  const c = ensureContext();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to && opts.to !== opts.from) {
    if (opts.curve === "lin") {
      osc.frequency.linearRampToValueAtTime(opts.to, t0 + opts.duration);
    } else {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.to),
        t0 + opts.duration,
      );
    }
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.02);
}

/** Play a filtered noise burst (whoosh / splash textures). */
function noise(opts: {
  duration: number;
  gain: number;
  filterFrom: number;
  filterTo: number;
  typeFilter?: BiquadFilterType;
  delay?: number;
}) {
  const c = ensureContext();
  if (!c || !master) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const length = Math.max(1, Math.floor(c.sampleRate * opts.duration));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = opts.typeFilter ?? "lowpass";
  filter.frequency.setValueAtTime(opts.filterFrom, t0);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(1, opts.filterTo),
    t0 + opts.duration,
  );
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(opts.gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export function play(name: SoundName) {
  initState();
  if (muted) return;
  try {
    switch (name) {
      case "tap":
        tone({ type: "sine", from: 940, to: 620, duration: 0.05, gain: 0.07 });
        noise({
          duration: 0.03,
          gain: 0.02,
          filterFrom: 4200,
          filterTo: 1500,
          typeFilter: "highpass",
        });
        break;
      case "toggle":
        tone({ type: "sine", from: 480, duration: 0.04, gain: 0.06 });
        tone({ type: "sine", from: 700, duration: 0.05, gain: 0.06, delay: 0.06 });
        break;
      case "success":
        tone({ type: "triangle", from: 659, duration: 0.12, gain: 0.08 });
        tone({
          type: "triangle",
          from: 880,
          duration: 0.18,
          gain: 0.07,
          delay: 0.09,
        });
        break;
      case "error":
        tone({
          type: "sawtooth",
          from: 220,
          to: 170,
          duration: 0.18,
          gain: 0.05,
          curve: "lin",
        });
        break;
      case "whoosh":
        noise({ duration: 0.28, gain: 0.05, filterFrom: 300, filterTo: 1800 });
        break;
      case "drop":
        // water plop: quick downward sine + soft splash
        tone({ type: "sine", from: 520, to: 160, duration: 0.13, gain: 0.11 });
        noise({
          duration: 0.09,
          gain: 0.035,
          filterFrom: 900,
          filterTo: 300,
          delay: 0.04,
        });
        break;
      case "pop":
        tone({ type: "sine", from: 300, to: 520, duration: 0.07, gain: 0.07 });
        break;
    }
  } catch {
    // Audio is a garnish — never let it break the app.
  }
}
