import { createHash } from "node:crypto";
import { getCard } from "./cards";
import type { CardDef, DeckInput } from "./types";

export type ReplayDeckSnapshot = {
  player: DeckInput;
  opponent: DeckInput;
  cardDefs: CardDef[];
  contentHash: string;
};

function deckCopy(deck: DeckInput): DeckInput {
  return {
    id: deck.id,
    name: deck.name,
    cards: [...deck.cards],
    ...(deck.formatId ? { formatId: deck.formatId } : {}),
  };
}

/**
 * Produce the JSON value that is hashed for immutable match content.
 *
 * PostgreSQL JSONB does not preserve object-key insertion order. Hashing a
 * plain JSON.stringify(cardDefs) therefore makes a valid snapshot depend on
 * whether it has already made a database round-trip. Canonicalizing every
 * object key keeps the digest stable while preserving array order (which is
 * semantically meaningful for several card-definition fields).
 *
 * Undefined object properties are omitted to match JSON.stringify semantics;
 * undefined array slots become null, also matching JSON.stringify.
 */
function canonicalJsonValue(value: unknown, inArray = false): unknown {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return inArray ? null : undefined;
  }
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => canonicalJsonValue(item, true));

  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = canonicalJsonValue((value as Record<string, unknown>)[key], false);
    if (child !== undefined) canonical[key] = child;
  }
  return canonical;
}

export function cardDefinitionsHash(cardDefs: readonly CardDef[]): string {
  const canonical = [...cardDefs]
    .map((card) => structuredClone(card))
    .sort((a, b) => a.defId.localeCompare(b.defId));
  return createHash("sha256").update(JSON.stringify(canonicalJsonValue(canonical))).digest("hex");
}

function referencedCardIds(card: CardDef): string[] {
  const refs = new Set<string>();
  const visit = (value: unknown, key = "") => {
    if (typeof value === "string" && ["tokenDefId", "equipmentDefId", "toDefId"].includes(key)) {
      refs.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) visit(child, childKey);
    }
  };
  visit(card);
  refs.delete(card.defId);
  return [...refs];
}

/**
 * Capture the complete card-definition closure needed by both decks.
 * Token/equipment/level-up definitions are included recursively so a deploy
 * cannot change the behavior of an already-running match halfway through.
 */
export function snapshotReplayBundle(player: DeckInput, opponent: DeckInput): ReplayDeckSnapshot {
  const pending = [...new Set([...player.cards, ...opponent.cards])].sort();
  const captured = new Map<string, CardDef>();

  while (pending.length) {
    const id = pending.shift()!;
    if (captured.has(id)) continue;
    const card = structuredClone(getCard(id));
    captured.set(id, card);
    for (const referencedId of referencedCardIds(card)) {
      if (!captured.has(referencedId)) pending.push(referencedId);
    }
  }

  const cardDefs = [...captured.values()].sort((a, b) => a.defId.localeCompare(b.defId));
  return {
    player: deckCopy(player),
    opponent: deckCopy(opponent),
    cardDefs,
    contentHash: cardDefinitionsHash(cardDefs),
  };
}

export function verifyReplayBundle(snapshot: ReplayDeckSnapshot | null | undefined): snapshot is ReplayDeckSnapshot {
  if (!snapshot || !Array.isArray(snapshot.cardDefs) || !snapshot.contentHash) return false;
  const ids = new Set(snapshot.cardDefs.map((card) => card?.defId).filter((id): id is string => typeof id === "string" && id.length > 0));
  if (ids.size !== snapshot.cardDefs.length) return false;
  const required = [...snapshot.player.cards, ...snapshot.opponent.cards];
  if (required.some((id) => !ids.has(id))) return false;
  return cardDefinitionsHash(snapshot.cardDefs) === snapshot.contentHash;
}

export function orientReplayBundle(
  snapshot: ReplayDeckSnapshot,
  player: DeckInput,
  opponent: DeckInput,
): ReplayDeckSnapshot {
  return {
    player: deckCopy(player),
    opponent: deckCopy(opponent),
    cardDefs: snapshot.cardDefs.map((card) => structuredClone(card)),
    contentHash: snapshot.contentHash,
  };
}
