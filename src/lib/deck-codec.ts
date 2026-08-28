/**
 * Encodes/decodes deck lists into short URL-safe strings.
 * Format: base64url(JSON({ n: name, c: [cardIds] }))
 */

export function encodeDeck(name: string, cards: string[]): string {
  const payload = { n: name, c: cards };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  // Make URL-safe
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDeck(code: string): { name: string; cards: string[] } | null {
  try {
    // Restore padding
    let base64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (base64.length % 4)) % 4;
    base64 += "=".repeat(pad);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as { n?: string; c?: string[] };
    if (!data.n || !Array.isArray(data.c)) return null;
    return { name: data.n, cards: data.c.filter((x) => typeof x === "string") };
  } catch {
    return null;
  }
}

export function isValidDeckCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{8,}$/.test(code);
}
