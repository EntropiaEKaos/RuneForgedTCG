import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "src/app/api/modes/route.ts"), "utf8");
const client = ["GameClient.tsx", "hooks/useMatchLauncher.ts", "hooks/useMatchLifecycle.ts"].map((f) => fs.readFileSync(path.join(root, "src/app/play", f), "utf8")).join("\n");
const ui = fs.readFileSync(path.join(root, "src/app/modes/ModesClient.tsx"), "utf8");

if (!route.includes("replayAuthoritativeMatch")) throw new Error("Mode rewards must be verified by the authoritative engine.");
if (!route.includes('replay.state.winner !== "player"')) throw new Error("Mode settlement must reject unverified wins.");
if (!route.includes("modeRewards")) throw new Error("Mode rewards must be idempotent.");
if (!route.includes("modeAttempts")) throw new Error("Mode settlement must be bound to a server-issued attempt.");
if (!route.includes("attemptToken")) throw new Error("Mode settlement must require an attempt token.");
if (!client.includes("/api/modes/attempt")) throw new Error("Special modes must request an authoritative attempt before starting.");
if (!client.includes("modeAttemptTokenRef.current")) throw new Error("Special mode attempt token must be retained for settlement.");
if (!client.includes('fetch("/api/modes"')) throw new Error("Game client must submit mode completion for server verification.");
// Modes deliberately do NOT have the client submit its own seed: /api/modes
// reads `seed = attempt.seed` from the server-issued attempt record tied to
// attemptToken (created by crypto.randomInt in /api/modes/attempt), so the
// client can never influence the replay seed at all. That's stricter than
// /api/matches (which does take a client-supplied seed alongside a
// server-verified token). Assert the server-side sourcing instead of a
// client-side field that was never meant to exist.
if (!route.includes("const seed = attempt.seed")) throw new Error("Mode settlement must source its replay seed from the server-issued attempt, never from the client.");
if (ui.includes('body: JSON.stringify({ name: playerName, modeType, modeId, completed: true })')) throw new Error("UI must not claim mode rewards using a client-only completed flag.");
console.log("modes authority regression: OK");

