import crypto from "node:crypto";

const MAX_AGE = 60 * 60 * 24 * 30;

type PlayerSessionPayload = {
  sessionId: string;
  playerId: number;
  playerName: string;
  exp: number;
};

function secret(): string {
  const value = process.env.PLAYER_SESSION_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("PLAYER_SESSION_SECRET is required in production");
  return "runeforge-development-session-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPlayerSessionToken(playerId: number, playerName: string): string {
  const sessionId = crypto.randomBytes(24).toString("hex");
  const payload = Buffer.from(
    JSON.stringify({ sessionId, playerId, playerName, exp: Math.floor(Date.now() / 1000) + MAX_AGE }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parsePlayerSessionToken(value: string | null | undefined): PlayerSessionPayload | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PlayerSessionPayload>;
    if (
      typeof parsed.sessionId !== "string" ||
      !Number.isInteger(parsed.playerId) ||
      typeof parsed.playerName !== "string" ||
      !Number.isInteger(parsed.exp) ||
      parsed.exp! < Math.floor(Date.now() / 1000)
    ) return null;
    return parsed as PlayerSessionPayload;
  } catch {
    return null;
  }
}

export function verifyPlayerSessionToken(
  value: string | null | undefined,
): { playerId: number; playerName: string } | null {
  const parsed = parsePlayerSessionToken(value);
  return parsed ? { playerId: parsed.playerId, playerName: parsed.playerName } : null;
}

export const PLAYER_SESSION_MAX_AGE = MAX_AGE;
