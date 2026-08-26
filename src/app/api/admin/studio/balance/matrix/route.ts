import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminBalanceExperiments, adminBalanceMatchups } from "@/db/schema";
import { getRuntimeDecks, getRuntimeExperimentalDecks } from "@/lib/control-plane";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { runBalanceSimulation } from "@/lib/balance-simulator";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { ensureConfigLoaded } from "@/game/settings";
import { summarizeBalance } from "@/game/balance-health";

export const dynamic = "force-dynamic";
const MAX_MATRIX_GAMES = 2_000;

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role,"qa")) return Response.json({ ok:false, error:`Role ${actor.role} cannot run simulations` }, { status:403 });
  let experimentId: number | null = null;
  try {
    await ensureConfigLoaded();
    const DECKS = [...await getRuntimeDecks(), ...await getRuntimeExperimentalDecks()];
    const overrides = Object.fromEntries(DECKS.map((deck) => [deck.id, { id: deck.id, name: deck.name, cards: deck.cards }]));
    const body = await req.json();
    const requestedDecks: string[] = Array.isArray(body.deckIds) ? body.deckIds.map(String) : DECKS.map(d => d.id);
    const deckIds = [...new Set(requestedDecks)].filter(id => DECKS.some(d => d.id === id)).slice(0, 8);
    const gamesPerMatchup = Math.min(Math.max(Math.floor(Number(body.gamesPerMatchup) || 100), 10), 250);
    const seed = Math.max(1, Math.floor(Number(body.seed) || Date.now() % 0x7fffffff));
    if (deckIds.length < 2) return Response.json({ ok: false, error: "Choose at least two valid decks." }, { status: 400 });
    const pairs: Array<[string,string]> = [];
    for (let i = 0; i < deckIds.length; i++) for (let j = i + 1; j < deckIds.length; j++) pairs.push([deckIds[i], deckIds[j]]);
    const totalGames = pairs.length * gamesPerMatchup;
    if (totalGames > MAX_MATRIX_GAMES) return Response.json({ ok: false, error: `Matrix is limited to ${MAX_MATRIX_GAMES} synchronous games. Reduce decks or games per matchup.` }, { status: 400 });
    const name = String(body.name || `Balance Matrix ${new Date().toISOString().slice(0, 10)}`).slice(0, 120);
    const [experiment] = await db.insert(adminBalanceExperiments).values({ name, mode: "matrix", gamesPerMatchup, seed, deckIds, totalGames, completedGames: 0, status: "running", engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION }).returning();
    experimentId = experiment.id;
    const rows = [];
    let completedGames = 0;
    for (let i = 0; i < pairs.length; i++) {
      const [deckA, deckB] = pairs[i];
      const summary = runBalanceSimulation(deckA, deckB, gamesPerMatchup, (seed + i * 104729) & 0x7fffffff, overrides);
      completedGames += summary.completedGames;
      const [row] = await db.insert(adminBalanceMatchups).values({ experimentId: experiment.id, deckA, deckB, requestedGames: summary.requestedGames, completedGames: summary.completedGames, winsA: summary.winsA, winsB: summary.winsB, draws: summary.draws, avgRounds: summary.avgRounds, winRateA: Math.round(summary.winRateA * 10), winRateB: Math.round(summary.winRateB * 10), seed: summary.seed, details: summary }).returning();
      rows.push({ ...summary, id: row.id });
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const health = summarizeBalance(rows);
    await db.update(adminBalanceExperiments).set({ completedGames, status: "completed", completedAt: new Date(), details: { matchupCount: rows.length, health } }).where(eq(adminBalanceExperiments.id, experiment.id));
    return Response.json({ ok: true, experiment: { ...experiment, completedGames, status: "completed" }, rows, health });
  } catch (error) {
    if (experimentId !== null) {
      const message = error instanceof Error ? error.message : "Matrix simulation failed";
      await db.update(adminBalanceExperiments).set({ status: "failed", completedAt: new Date(), details: { error: message } }).where(eq(adminBalanceExperiments.id, experimentId)).catch(() => undefined);
    }
    console.error("[admin/studio/balance/matrix] POST failed", error);
    return Response.json({ ok: false, error: "Matrix simulation failed" }, { status: 500 });
  }
}
