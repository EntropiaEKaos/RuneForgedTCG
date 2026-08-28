/**
 * Simple sound effects using Web Audio API - no external files needed.
 * Generates procedural sounds on-the-fly.
 */

let audioCtx: AudioContext | null = null;
let enabled = true;
let musicEnabled = false;
let masterVolume = 0.7;
let ambientOscillator: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;
let ambientLevel = 0.018;

export type AmbiencePhase = "opponent" | "main" | "combat" | "response" | "gameover";
type AudioRegion = "Emberhold" | "Tidecall" | "Ironwood" | "Voidborn" | "Florestia" | "Tempestade";

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function setSoundEnabled(v: boolean): void {
  enabled = v;
  if (typeof window !== "undefined") {
    localStorage.setItem("runeforge_sound", v ? "1" : "0");
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem("runeforge_sound");
  if (saved !== null) enabled = saved === "1";
  return enabled;
}

export function setMusicEnabled(value: boolean): void {
  musicEnabled = value;
  if (typeof window !== "undefined") localStorage.setItem("runeforge_music", value ? "1" : "0");
  if (!value) stopAmbience();
}

export function isMusicEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("runeforge_music");
  if (saved !== null) musicEnabled = saved === "1";
  return musicEnabled;
}

export function setMasterVolume(value: number): void {
  masterVolume = Math.max(0, Math.min(1, value));
  if (typeof window !== "undefined") localStorage.setItem("runeforge_volume", String(masterVolume));
  if (ambientGain && audioCtx) ambientGain.gain.setTargetAtTime(ambientLevel * masterVolume, audioCtx.currentTime, 0.08);
}

export function getMasterVolume(): number {
  if (typeof window === "undefined") return masterVolume;
  const raw = localStorage.getItem("runeforge_volume");
  if (raw !== null) {
    const saved = Number(raw);
    if (Number.isFinite(saved) && saved >= 0 && saved <= 1) masterVolume = saved;
  }
  return masterVolume;
}

export function stopAmbience(): void {
  try { ambientOscillator?.stop(); } catch {}
  ambientOscillator = null;
  ambientGain = null;
}

export function syncAmbience(phase: AmbiencePhase, regions: AudioRegion[] = []): void {
  if (!isMusicEnabled() || phase === "gameover") { stopAmbience(); return; }
  const ctx = getCtx();
  if (!ctx) return;
  const frequencies: Record<Exclude<AmbiencePhase, "gameover">, number> = { opponent: 82, main: 98, combat: 73, response: 110 };
  const regionalOffset: Record<AudioRegion, number> = { Emberhold: 18, Tidecall: -4, Ironwood: -10, Voidborn: -18, Florestia: 7, Tempestade: 26 };
  const identityOffset = regions.length ? regions.reduce((sum, region) => sum + regionalOffset[region], 0) / regions.length : 0;
  if (!ambientOscillator || !ambientGain) {
    ambientOscillator = ctx.createOscillator();
    ambientGain = ctx.createGain();
    ambientOscillator.type = regions.includes("Voidborn") ? "triangle" : regions.includes("Emberhold") || regions.includes("Tempestade") ? "sawtooth" : "sine";
    ambientGain.gain.value = 0.0001;
    ambientOscillator.connect(ambientGain);
    ambientGain.connect(ctx.destination);
    ambientOscillator.start();
  }
  ambientOscillator.frequency.setTargetAtTime(Math.max(45, frequencies[phase] + identityOffset), ctx.currentTime, 0.35);
  ambientLevel = 0.014 + Math.min(3, regions.length) * 0.002;
  ambientGain.gain.setTargetAtTime(ambientLevel * getMasterVolume(), ctx.currentTime, 0.2);
}

function beep(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const outputGain = gain * getMasterVolume();
    g.gain.value = outputGain;
    osc.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(outputGain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

export const sfx = {
  click: () => beep(500, 0.05, "square", 0.05),
  hover: () => beep(700, 0.03, "sine", 0.03),
  cardPlay: () => {
    beep(400, 0.1, "triangle", 0.08);
    setTimeout(() => beep(600, 0.1, "triangle", 0.08), 50);
  },
  attack: () => {
    beep(200, 0.15, "sawtooth", 0.1);
    setTimeout(() => beep(150, 0.1, "sawtooth", 0.08), 80);
  },
  damage: () => beep(120, 0.2, "square", 0.1),
  heal: () => {
    beep(600, 0.1, "sine", 0.08);
    setTimeout(() => beep(800, 0.15, "sine", 0.08), 60);
  },
  levelUp: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12, "triangle", 0.1), i * 60));
  },
  victory: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.15, "triangle", 0.12), i * 80));
  },
  defeat: () => {
    [400, 350, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.2, "sawtooth", 0.1), i * 150));
  },
  packOpen: () => {
    [400, 600, 800, 1000, 1200].forEach((f, i) => setTimeout(() => beep(f, 0.1, "triangle", 0.1), i * 40));
  },
  coin: () => {
    beep(1000, 0.05, "square", 0.08);
    setTimeout(() => beep(1500, 0.08, "square", 0.06), 40);
  },
  error: () => beep(150, 0.2, "square", 0.1),
  status: (status: "barrier" | "frostbitten" | "stunned") => {
    if (status === "barrier") { beep(780, 0.16, "sine", 0.07); setTimeout(() => beep(1040, 0.18, "sine", 0.05), 70); }
    else if (status === "frostbitten") { beep(620, 0.18, "triangle", 0.05); setTimeout(() => beep(380, 0.22, "sine", 0.05), 70); }
    else { beep(260, 0.1, "square", 0.05); setTimeout(() => beep(190, 0.2, "square", 0.05), 60); }
  },
  barrierBreak: () => { beep(920, 0.08, "triangle", 0.07); setTimeout(() => beep(410, 0.18, "sawtooth", 0.05), 45); },
  poison: () => { beep(170, 0.2, "sine", 0.06); setTimeout(() => beep(245, 0.22, "triangle", 0.04), 80); },
  combo: (count: number) => {
    const notes = [220, 330, 440, 660, 880].slice(0, Math.max(2, Math.min(5, count)));
    notes.forEach((frequency, index) => setTimeout(() => beep(frequency, 0.12, "sawtooth", 0.055), index * 38));
  },
  block: () => { beep(180, 0.08, "square", 0.07); setTimeout(() => beep(310, 0.12, "triangle", 0.055), 45); },
  priority: () => { beep(520, 0.06, "sine", 0.035); setTimeout(() => beep(720, 0.08, "sine", 0.03), 45); },
  mulligan: () => { beep(340, 0.08, "triangle", 0.05); setTimeout(() => beep(510, 0.11, "triangle", 0.045), 60); },
};
