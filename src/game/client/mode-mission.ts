export type ModeMissionKind = "puzzle" | "boss" | "brawl";

export type ModeMission = {
  kind: ModeMissionKind;
  id: string;
  name: string;
  emoji: string;
  objective: string;
  description: string;
  difficulty?: number;
  region?: string;
  hint?: string;
  facts: string[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function difficulty(value: unknown): number | undefined {
  const parsed = positiveInt(value);
  return parsed && parsed <= 5 ? parsed : undefined;
}

function buildBrawlFacts(rules: UnknownRecord | null): string[] {
  if (!rules) return [];
  const facts: string[] = [];
  const mana = positiveInt(rules.startingMana);
  const hand = positiveInt(rules.startingHand);
  const nexus = positiveInt(rules.startingNexus);
  if (mana) facts.push(`Mana inicial ${mana}`);
  if (hand) facts.push(`Mão inicial ${hand}`);
  if (nexus) facts.push(`Nexus inicial ${nexus}`);
  return facts;
}

/**
 * Builds a presentation-only briefing from the exact mode definition returned
 * with an authoritative attempt. It intentionally does not interpret or enforce
 * game rules; the engine and settlement endpoints remain authoritative.
 */
export function buildModeMission(mode: string, definition: unknown): ModeMission | null {
  const source = record(definition);
  if (!source) return null;
  const id = text(source.id);
  const name = text(source.name);
  if (!id || !name) return null;

  if (mode === "puzzle") {
    return {
      kind: "puzzle",
      id,
      name,
      emoji: "🧩",
      objective: text(source.goal) || text(source.description) || "Resolva o desafio tático.",
      description: text(source.description),
      difficulty: difficulty(source.difficulty),
      hint: text(source.hint) || undefined,
      facts: [],
    };
  }

  if (mode === "boss") {
    const region = text(source.region);
    return {
      kind: "boss",
      id,
      name,
      emoji: text(source.emoji) || "👹",
      objective: `Derrote ${name} e preserve seu Nexus.`,
      description: text(source.description),
      difficulty: difficulty(source.difficulty),
      region: region || undefined,
      facts: [],
    };
  }

  if (mode === "brawl") {
    return {
      kind: "brawl",
      id,
      name,
      emoji: text(source.emoji) || "⚡",
      objective: "Vença a batalha sob as regras especiais desta arena.",
      description: text(source.description),
      facts: buildBrawlFacts(record(source.rules)),
    };
  }

  // Expeditions already keep their authoritative EncounterBanner visible for
  // the whole battle, including objective and mutator. Do not duplicate it.
  return null;
}

let activeMission: ModeMission | null = null;
const listeners = new Set<() => void>();

export function getActiveModeMission(): ModeMission | null {
  return activeMission;
}

export function setActiveModeMission(mission: ModeMission | null): void {
  if (activeMission === mission) return;
  activeMission = mission;
  for (const listener of listeners) listener();
}

export function subscribeActiveModeMission(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
