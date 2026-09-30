import type { BattlefieldInteractionPresentation } from "./BattlefieldInteractionPresentation";
import type { BattlefieldCombatPresentationFrame } from "./BattlefieldCombatPresentation";

export function describeCombatFrame(frame: BattlefieldCombatPresentationFrame): BattlefieldInteractionPresentation {
  if (frame.phase === "attackers") {
    return { phase: "combat", headline: frame.headline, detail: frame.detail, accent: "orange", sourceId: frame.attackerIds[0], targetIds: frame.blockerPairs.map((pair) => pair.blockerId) };
  }
  if (frame.phase === "blockers") {
    return { phase: "combat", headline: frame.headline, detail: frame.detail, accent: "cyan", sourceId: frame.attackerIds[0], targetIds: frame.blockerPairs.map((pair) => pair.blockerId) };
  }
  if (frame.phase === "damage") {
    return { phase: "combat", headline: frame.headline, detail: frame.detail, accent: "rose", sourceId: frame.attackerIds[0], targetIds: frame.blockerPairs.map((pair) => pair.blockerId) };
  }
  return { phase: "combat", headline: frame.headline, detail: frame.detail, accent: "slate", sourceId: frame.attackerIds[0], targetIds: frame.blockerPairs.map((pair) => pair.blockerId) };
}
