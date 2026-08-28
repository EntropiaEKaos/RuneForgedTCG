import { NextRequest } from "next/server";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { compileRuleDsl } from "@/lib/rule-dsl";
import { createCustomGame, applyCardEffectForSandbox } from "@/game/engine";
import { getDeck } from "@/game/decks";
import { getCard, allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { deriveGameEvents } from "@/game/events";
import type { GameState } from "@/game/types";

export const dynamic = "force-dynamic";

function fixtureSummary(state: GameState) {
  const summarize = (player: "player" | "ai") => ({ nexus: state.players[player].nexusHealth, mana: state.players[player].mana, board: state.players[player].bench.map((u) => ({ instanceId: u.instanceId, defId: u.defId, name: getCard(u.defId).name, power: u.power, health: u.health, maxHealth: u.maxHealth, races: u.races, classes: u.classes, keywords: u.keywords })) });
  return { player: summarize("player"), enemy: summarize("ai") };
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["designer", "qa"])) return Response.json({ ok: false, error: `Role ${actor.role} cannot run rule tests` }, { status: 403 });
  try {
    await ensureCustomCardsLoaded();
    const body = await req.json();
    const compiled = compileRuleDsl(body);
    if (!compiled.ok) return Response.json(compiled, { status: 400 });
    const unitCards = allCards().filter((card) => card.type === "Unit");
    const fallback = getDeck("ember_aggro");
    const sourceDefId = String(body.fixture?.sourceDefId || "ember_whelp");
    const targetDefId = String(body.fixture?.targetDefId || sourceDefId);
    const enemyDefId = String(body.fixture?.enemyDefId || "ember_drake");
    if (!unitCards.some((card) => card.defId === sourceDefId) || !unitCards.some((card) => card.defId === targetDefId) || !unitCards.some((card) => card.defId === enemyDefId)) return Response.json({ ok: false, error: "One or more fixture cards are invalid or are not Unit cards." }, { status: 400 });
    const before = createCustomGame("Rule Tester", { id: fallback.id, name: fallback.name, cards: fallback.cards }, { id: fallback.id, name: fallback.name, cards: fallback.cards }, { seed: Number(body.fixture?.seed) || 424242, playerGoesFirst: true, skipMulligan: true, playerStartingHand: 0, aiStartingHand: 0, playerStartingMana: Number(body.fixture?.mana) || 5, aiStartingMana: Number(body.fixture?.mana) || 5, playerBench: [sourceDefId, targetDefId], aiBench: [enemyDefId] });
    const target = before.players.player.bench.find((u) => u.defId === targetDefId) ?? before.players.player.bench[0];
    const self = before.players.player.bench.find((u) => u.defId === sourceDefId) ?? before.players.player.bench[0];
    if (!target || !self) return Response.json({ ok: false, error: "Fixture could not create source/target units." }, { status: 400 });
    const after = applyCardEffectForSandbox(before, "player", compiled.effect, target.instanceId, self);
    const events = deriveGameEvents(before, after);
    return Response.json({ ok: true, rule: compiled.normalized, effect: compiled.effect, context: { trigger: compiled.normalized.event, source: { defId: self.defId, name: getCard(self.defId).name }, target: { instanceId: target.instanceId, defId: target.defId, name: getCard(target.defId).name }, note: "The sandbox executes the compiled effect against the selected fixture. Trigger dispatch remains authoritative in the live engine." }, before: fixtureSummary(before), after: fixtureSummary(after), events });
  } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Rule test failed" }, { status: 400 }); }
}
