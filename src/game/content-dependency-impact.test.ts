import { buildCardDependencyGraph } from "./content-dependency-graph";
import { analyzeDependencyImpact } from "./content-dependency-impact";
import type { CardDef } from "./types";

const base = (id: string): CardDef => ({
  defId: id,
  name: id,
  region: "Emberhold",
  type: "Unit",
  cost: 1,
  power: 1,
  health: 1,
  description: "x",
  rarity: "Common",
  emoji: "x",
});

const mechanicCard: CardDef = { ...base("mechanic-card"), customKeywords: ["blood"] };
const tokenConsumer: CardDef = {
  ...base("token-consumer"),
  spell: { kind: "summon", target: "none", amount: 1, tokenDefId: "mechanic-card" },
};
const chainedConsumer: CardDef = {
  ...base("chained-consumer"),
  levelUp: { type: "spellsCast", amount: 1, toDefId: "token-consumer", hint: "" },
};
const unrelated: CardDef = { ...base("unrelated"), archetypeKey: "location" };

const graph = buildCardDependencyGraph([mechanicCard, tokenConsumer, chainedConsumer, unrelated]);
const keywordImpact = analyzeDependencyImpact(graph, { kind: "keyword", key: "blood" });
if (keywordImpact.coverage !== "tracked") throw new Error("keyword impact should be tracked");
if (keywordImpact.directCardIds.join(",") !== "mechanic-card") throw new Error("direct keyword impact mismatch");
if (keywordImpact.indirectCardIds.join(",") !== "chained-consumer,token-consumer") throw new Error("transitive keyword impact mismatch");
if (keywordImpact.allCardIds.includes("unrelated")) throw new Error("unrelated card leaked into impact");

const archetypeImpact = analyzeDependencyImpact(graph, { kind: "archetype", key: "location" });
if (archetypeImpact.directCardIds.join(",") !== "unrelated") throw new Error("archetype impact mismatch");

const effectImpact = analyzeDependencyImpact(graph, { kind: "effect", key: "storm-burst" });
if (effectImpact.coverage !== "untracked" || effectImpact.allCardIds.length) throw new Error("effect impact must not fabricate references");

console.log("CONTENT DEPENDENCY IMPACT: PASS");
