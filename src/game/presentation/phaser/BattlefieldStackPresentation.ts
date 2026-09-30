import type { BattlefieldLabScenario } from "../battlefield-lab-scenario";

export type BattlefieldStackItemPresentation = {
  id: string;
  label: string;
  controllerId: string;
  kind: "spell" | "reaction";
  status: "pending" | "resolving" | "negated" | "resolved";
};

export type BattlefieldReactionPresentation = {
  priorityPlayerId: string;
  passedPlayerIds: string[];
  stack: BattlefieldStackItemPresentation[];
  headline: string;
  detail: string;
};

export function buildDeterministicReactionTimeline(scenario: BattlefieldLabScenario): BattlefieldReactionPresentation[] {
  const players = scenario.players.slice(0, 4);
  const caster = players[0];
  const reactor = players[1] ?? caster;
  if (!caster || !reactor) return [];

  const fireball: BattlefieldStackItemPresentation = { id: "demo-fireball", label: "Fireball", controllerId: caster.id, kind: "spell", status: "pending" };
  const deny: BattlefieldStackItemPresentation = { id: "demo-deny", label: "Deny", controllerId: reactor.id, kind: "reaction", status: "pending" };
  const timeline: BattlefieldReactionPresentation[] = [
    { priorityPlayerId: reactor.id, passedPlayerIds: [], stack: [fireball], headline: "REACTION WINDOW", detail: `${reactor.label} may respond` },
    { priorityPlayerId: players[2]?.id ?? caster.id, passedPlayerIds: [], stack: [fireball, deny], headline: "REACTION ADDED", detail: `${reactor.label} added Deny to the stack` },
  ];

  const passOrder = players.slice(2).concat(players.slice(0, 2));
  const passed: string[] = [];
  passOrder.forEach((player, index) => {
    passed.push(player.id);
    timeline.push({ priorityPlayerId: passOrder[index + 1]?.id ?? reactor.id, passedPlayerIds: [...passed], stack: [fireball, deny], headline: "PRIORITY PASSED", detail: `${player.label} passed` });
  });
  timeline.push({ priorityPlayerId: reactor.id, passedPlayerIds: [...passed], stack: [{ ...fireball, status: "negated" }, { ...deny, status: "resolved" }], headline: "STACK RESOLVED", detail: "Deny resolves first · Fireball negated" });
  return timeline;
}
