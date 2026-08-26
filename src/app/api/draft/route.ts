import { runtimeGate } from "@/lib/runtime-gates";
import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { players, customDecks, draftSessions } from "@/db/schema";
import { cleanupExpiredRuntimeSessions, DRAFT_TTL_MS } from "@/lib/session-cleanup";
import { eq } from "drizzle-orm";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { DECK_MAX, MAX_COPIES, MAX_REGIONS, validateDeck, type DeckRules } from "@/game/decks";
import { ensureConfigLoaded, getGameConfigSync } from "@/game/settings";
import type { Region } from "@/game/types";
import { cardRegions } from "@/game/region-identity";

export const dynamic = "force-dynamic";

type DraftRulesSnapshot = Pick<DeckRules, "deckMax" | "maxCopies" | "maxRegions"> & { deckMin: number };

function currentDraftRules(): DraftRulesSnapshot {
  const config = getGameConfigSync();
  return {
    deckMin: config.deckMin,
    deckMax: config.deckMax || DECK_MAX,
    maxCopies: config.maxCopies || MAX_COPIES,
    maxRegions: Math.min(3, config.maxRegions || MAX_REGIONS),
  };
}

function copyCounts(deck: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

function eligibleCards(deck: string[], regions: Region[], rules: DraftRulesSnapshot) {
  const counts = copyCounts(deck);
  const { maxCopies, maxRegions } = rules;
  return allCards().filter((c) => {
    if (c.collectible === false) return false;
    if ((counts.get(c.defId) ?? 0) >= maxCopies) return false;
    const required = cardRegions(c);
    const newRegions = required.filter((region) => !regions.includes(region));
    if (regions.length + newRegions.length > maxRegions) return false;
    return true;
  });
}

function generateDraftChoice(deck: string[], regions: Region[], step: number, rules: DraftRulesSnapshot): string[] {
  const cards = eligibleCards(deck, regions, rules);
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // "Bomb slot": a cada 5 escolhas, garante pelo menos 1 carta Rara+ no
  // pacote de 3, igual um "rare slot" de booster de TCG físico — sem isso,
  // um draft inteiro podia sair só de Comuns por puro azar de RNG.
  const isBombPick = step > 0 && (step + 1) % 5 === 0;
  if (isBombPick) {
    const rareTier = new Set(["Rare", "Epic", "Legend"]);
    const bombIndex = shuffled.findIndex((c) => rareTier.has(c.rarity));
    if (bombIndex > 2) {
      const [bomb] = shuffled.splice(bombIndex, 1);
      shuffled[2] = bomb;
    }
  }

  return shuffled.slice(0, 3).map((c) => c.defId);
}

function normalizeSession(row: typeof draftSessions.$inferSelect) {
  return {
    deck: Array.isArray(row.deck) ? row.deck.map(String) : [],
    currentPool: Array.isArray(row.currentPool) ? row.currentPool.map(String) : [],
    step: row.step,
    regions: Array.isArray(row.regions) ? row.regions as Region[] : [],
    rules: row.rulesSnapshot && typeof row.rulesSnapshot === "object" ? row.rulesSnapshot as DraftRulesSnapshot : null,
  };
}

export async function GET(req: NextRequest) {
  await Promise.all([ensureConfigLoaded(), ensureCustomCardsLoaded()]);
  const freshRules = currentDraftRules();
  await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const [player] = await db.select().from(players).where(eq(players.id, identity.playerId)).limit(1);
    if (!player) return Response.json({ ok: false, error: "Player not found" }, { status: 404 });

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(draftSessions).where(eq(draftSessions.playerId, player.id)).limit(1).for("update");
      if (existing) {
        const normalized = normalizeSession(existing);
        if (normalized.rules && existing.step < normalized.rules.deckMax) return normalized;
        await tx.delete(draftSessions).where(eq(draftSessions.id, existing.id));
      }
      const pool = generateDraftChoice([], [], 0, freshRules);
      const [created] = await tx.insert(draftSessions).values({ playerId: player.id, playerName: player.name, deck: [], currentPool: pool, step: 0, regions: [], rulesSnapshot: freshRules, expiresAt: new Date(Date.now() + DRAFT_TTL_MS), updatedAt: new Date() }).returning();
      return normalizeSession(created);
    });

    return Response.json({
      ok: true,
      step: result.step,
      total: result.rules?.deckMax ?? freshRules.deckMax,
      regions: result.regions,
      deck: result.deck,
      pool: result.currentPool.map((id) => allCards().find((c) => c.defId === id)),
      isBombPick: result.step > 0 && (result.step + 1) % 5 === 0,
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await ensureCustomCardsLoaded();
  const runtimeBlocked = await runtimeGate("general");
  if (runtimeBlocked) return runtimeBlocked;
  await ensureConfigLoaded();
  const freshRules = currentDraftRules();
  await cleanupExpiredRuntimeSessions().catch(() => ({ pvpExpired: 0, pvpDeleted: 0, drafts: 0 }));
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const body = await req.json();
    const chosenCardId = String(body.cardId || "");

    const result = await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, identity.playerId!)).limit(1);
      if (!player) return { error: "Player not found", status: 404 as const };
      const [draftRow] = await tx.select().from(draftSessions).where(eq(draftSessions.playerId, player.id)).limit(1).for("update");
      if (!draftRow) return { error: "No active draft session", status: 400 as const };
      const draft = normalizeSession(draftRow);
      const rules = draft.rules;
      if (!rules) return { error: "Draft session predates immutable rule snapshots; start a new draft", status: 409 as const };
      const { deckMax, maxRegions } = rules;
      if (draft.step >= deckMax) return { error: "Draft already complete", status: 409 as const };
      if (!draft.currentPool.includes(chosenCardId)) return { error: "Invalid choice", status: 400 as const };
      const chosenDef = allCards().find((c) => c.defId === chosenCardId);
      if (!chosenDef || chosenDef.collectible === false) return { error: "Unknown or non-collectible card", status: 400 as const };

      const nextDeck = [...draft.deck, chosenCardId];
      const nextRegions = [...draft.regions];
      for (const region of cardRegions(chosenDef)) {
        if (!nextRegions.includes(region) && nextRegions.length < maxRegions) nextRegions.push(region);
      }
      const nextStep = draft.step + 1;

      if (nextStep >= deckMax) {
        const check = validateDeck(nextDeck, rules);
        if (!check.ok) return { error: `Drafted deck failed validation: ${check.errors.join(" | ")}`, status: 500 as const };
        await tx.insert(customDecks).values({ ownerName: player.name, ownerPlayerId: player.id, name: `Arena Draft — ${new Date().toLocaleDateString("pt-BR")}`, emoji: "⚔️", cards: JSON.stringify(nextDeck) });
        await tx.delete(draftSessions).where(eq(draftSessions.id, draftRow.id));
        return { complete: true, step: nextStep, deck: nextDeck, regions: nextRegions, total: deckMax };
      }

      const pool = generateDraftChoice(nextDeck, nextRegions, nextStep, rules);
      if (pool.length < 3) return { error: "Draft pool exhausted; session was not advanced", status: 409 as const };
      await tx.update(draftSessions).set({ deck: nextDeck, currentPool: pool, step: nextStep, regions: nextRegions, expiresAt: new Date(Date.now() + DRAFT_TTL_MS), updatedAt: new Date() }).where(eq(draftSessions.id, draftRow.id));
      return { complete: false, step: nextStep, deck: nextDeck, regions: nextRegions, pool, total: deckMax };
    });

    if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
    if (result.complete) return Response.json({ ok: true, complete: true, deck: result.deck, regions: result.regions, step: result.step, total: result.total });
    return Response.json({ ok: true, complete: false, step: result.step, total: result.total ?? freshRules.deckMax, regions: result.regions, deck: result.deck, pool: (result.pool ?? []).map((id) => allCards().find((c) => c.defId === id)), isBombPick: result.step > 0 && (result.step + 1) % 5 === 0 });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
