import type { ContentDependency, DependencyGraphResult } from "./content-dependency-graph";

export type ImpactTargetKind = "keyword" | "effect" | "archetype";
export type ImpactCoverage = "tracked" | "untracked";

export type DependencyImpactAnalysis = {
  target: { kind: ImpactTargetKind; key: string };
  coverage: ImpactCoverage;
  reason: string | null;
  directCardIds: string[];
  indirectCardIds: string[];
  allCardIds: string[];
  directEdges: ContentDependency[];
  indirectLinks: Array<{ cardId: string; viaCardId: string; kind: ContentDependency["kind"]; path: string }>;
  affectedCycles: string[][];
};

const CARD_REFERENCE_KINDS = new Set<ContentDependency["kind"]>(["card", "token", "equipment"]);

/**
 * Computes reverse blast radius from the same graph used by QA/Publish diagnostics.
 *
 * Keyword and archetype references are explicit in CardDef and therefore trackable.
 * Effect macros are currently embedded/expanded rather than referenced by effect key,
 * so reporting card-level impact for an effect key would be misleading.
 */
export function analyzeDependencyImpact(
  graph: DependencyGraphResult,
  target: { kind: ImpactTargetKind; key: string },
): DependencyImpactAnalysis {
  const key = target.key.trim();
  if (target.kind === "effect") {
    return {
      target: { ...target, key },
      coverage: "untracked",
      reason: "Effect macros are not referenced by effect key in CardDef dependency edges, so card-level blast radius cannot be inferred safely.",
      directCardIds: [],
      indirectCardIds: [],
      allCardIds: [],
      directEdges: [],
      indirectLinks: [],
      affectedCycles: [],
    };
  }

  const directEdges = graph.edges.filter((edge) => edge.kind === target.kind && edge.to === key);
  const direct = new Set(directEdges.map((edge) => edge.from));
  const cardIds = new Set(graph.nodes);
  const reverse = new Map<string, ContentDependency[]>();

  for (const edge of graph.edges) {
    if (!CARD_REFERENCE_KINDS.has(edge.kind) || !cardIds.has(edge.from) || !cardIds.has(edge.to)) continue;
    const existing = reverse.get(edge.to) ?? [];
    existing.push(edge);
    reverse.set(edge.to, existing);
  }

  const seen = new Set(direct);
  const indirect = new Set<string>();
  const indirectLinks: DependencyImpactAnalysis["indirectLinks"] = [];
  const queue = [...direct];

  while (queue.length) {
    const viaCardId = queue.shift()!;
    for (const edge of reverse.get(viaCardId) ?? []) {
      if (seen.has(edge.from)) continue;
      seen.add(edge.from);
      indirect.add(edge.from);
      indirectLinks.push({ cardId: edge.from, viaCardId, kind: edge.kind, path: edge.path });
      queue.push(edge.from);
    }
  }

  const allCardIds = [...seen].sort();
  const affected = new Set(allCardIds);
  const affectedCycles = graph.cycles.filter((cycle) => cycle.some((cardId) => affected.has(cardId)));

  return {
    target: { ...target, key },
    coverage: "tracked",
    reason: null,
    directCardIds: [...direct].sort(),
    indirectCardIds: [...indirect].sort(),
    allCardIds,
    directEdges,
    indirectLinks,
    affectedCycles,
  };
}
