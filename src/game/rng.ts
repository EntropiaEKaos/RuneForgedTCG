/** Deterministic RNG primitives used by the authoritative game engine. */
export function normalizeSeed(seed: number): number {
  const n = Number.isFinite(seed) ? Math.trunc(seed) : 1;
  return (n >>> 0) || 1;
}

export function nextRng(state: number): { state: number; value: number } {
  let x = (state >>> 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return { state: x || 1, value: (x >>> 0) / 4294967296 };
}

export function seededFloat(seed: number, salt: number): number {
  let x = normalizeSeed(seed) ^ (salt >>> 0);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let rng = normalizeSeed(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const next = nextRng(rng);
    rng = next.state;
    const j = Math.floor(next.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
