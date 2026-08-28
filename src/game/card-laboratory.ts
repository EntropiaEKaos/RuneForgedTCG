import { canPlayCard, castSpell, createCustomGame, playUnit, spellNeedsTarget } from "./engine";
import { validateAuthorableCard } from "./card-authoring";
import { withRegisteredCardSnapshot } from "./custom-registry";
import type { CardDef, DeckInput } from "./types";

export type CardLabCase = {
  seed: number;
  playable: boolean;
  resolved: boolean;
  logEntries: number;
  playerNexus: number;
  opponentNexus: number;
  error?: string;
};

export type CardLabReport = {
  defId: string;
  valid: boolean;
  cases: CardLabCase[];
  passed: number;
  failed: number;
  warnings: string[];
};

const FILLER = "ember_whelp";

export function runCardLaboratory(cardInput: CardDef, iterations = 12): CardLabReport {
  const validated = validateAuthorableCard(cardInput);
  if (!validated.ok) {
    return {
      defId: cardInput.defId,
      valid: false,
      cases: [],
      passed: 0,
      failed: 1,
      warnings: ["error" in validated ? validated.error : "Invalid card"],
    };
  }

  const card = validated.card;
  const deck: DeckInput = {
    id: "lab",
    name: "Lab",
    cards: [card.defId, ...Array(39).fill(FILLER)],
  };
  const opponent: DeckInput = {
    id: "lab-ai",
    name: "Lab AI",
    cards: Array(40).fill(FILLER),
  };

  // The laboratory must never mutate the process-wide custom-card registry.
  // A draft card is visible only for the duration of this synchronous lab run.
  return withRegisteredCardSnapshot([card], () => {
    const cases: CardLabCase[] = [];
    const count = Math.max(1, Math.min(100, iterations));

    for (let i = 0; i < count; i += 1) {
      const seed = 22_000 + i;
      try {
        let state = createCustomGame("Lab", deck, opponent, {
          seed,
          skipMulligan: true,
          playerGoesFirst: true,
          playerStartingHand: 40,
          playerStartingMana: 20,
          aiStartingMana: 0,
        });
        const inst = state.players.player.hand.find((candidate) => candidate.defId === card.defId);
        const playable = Boolean(inst && canPlayCard(state, "player", inst.instanceId));
        let resolved = false;

        if (inst && playable) {
          if (card.type === "Spell") {
            const targetKind = spellNeedsTarget(card.defId);
            const target = targetKind ? state.players.ai.bench[0]?.instanceId : undefined;
            const next = castSpell(state, "player", inst.instanceId, target);
            resolved = next !== state;
            state = next;
          } else {
            const target = card.type === "Equipment" ? state.players.player.bench[0]?.instanceId : undefined;
            const next = playUnit(state, "player", inst.instanceId, target);
            resolved = next !== state;
            state = next;
          }
        }

        cases.push({
          seed,
          playable,
          resolved,
          logEntries: state.log.length,
          playerNexus: state.players.player.nexusHealth,
          opponentNexus: state.players.ai.nexusHealth,
        });
      } catch (error) {
        cases.push({
          seed,
          playable: false,
          resolved: false,
          logEntries: 0,
          playerNexus: 0,
          opponentNexus: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const passed = cases.filter((testCase) => !testCase.error && (!testCase.playable || testCase.resolved)).length;
    return {
      defId: card.defId,
      valid: true,
      cases,
      passed,
      failed: cases.length - passed,
      warnings: cases.some((testCase) => !testCase.playable)
        ? ["Some scenarios were not directly playable; inspect targeting/board prerequisites."]
        : [],
    };
  });
}
