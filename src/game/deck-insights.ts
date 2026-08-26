import { getCard } from "./cards";
import { profileDeck } from "./gameplay-profile";
import { archetypeForCards, archetypeForDeck, ARCHETYPES } from "./archetypes";
import type { Region } from "./types";
import { strategicRoleForCard } from "./card-role";
import { cardRegions, identityForRegions } from "./region-identity";

export interface DeckInsight {
  score: number;
  grade: "S" | "A" | "B" | "C";
  title: string;
  archetype: string;
  strengths: string[];
  warnings: string[];
  recommendations: string[];
  roleCounts: { early: number; interaction: number; defense: number; finishers: number; engines: number };
}

export function analyzeDeck(cards: string[]): DeckInsight {
  const definitions = cards.map((id) => { try { return getCard(id); } catch { return null; } }).filter((card): card is ReturnType<typeof getCard> => Boolean(card));
  const profile = profileDeck(cards);
  const regionCount = new Map<Region, number>();
  for (const card of definitions) for (const region of cardRegions(card)) regionCount.set(region, (regionCount.get(region) ?? 0) + 1);
  const primary = [...regionCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const presetProfile = archetypeForCards(cards) ?? Object.values(ARCHETYPES).find((item) => item.region === primary && (
    (profile.identity === "Aggro" && item.deckId === "ember_aggro") ||
    (profile.identity === "Control" && item.deckId === "tide_control") ||
    item.region === primary
  ));
  const roles = definitions.map(strategicRoleForCard);
  const roleCounts = {
    early: definitions.filter((card) => card.cost <= 2).length,
    interaction: roles.filter((role) => role.id === "removal").length,
    defense: roles.filter((role) => role.id === "defense").length,
    finishers: roles.filter((role) => role.id === "finisher").length,
    engines: roles.filter((role) => role.id === "engine").length,
  };
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const strengths: string[] = [];
  if (cards.length !== 40) warnings.push(`Contrato competitivo incompleto: ${cards.length}/40 cartas.`);
  if (roleCounts.early < 8) { warnings.push("Poucas jogadas de custo 0–2."); recommendations.push("Adicione 2–4 cartas iniciais para reduzir mãos lentas."); }
  else strengths.push(`Abertura consistente com ${roleCounts.early} cartas iniciais.`);
  if (roleCounts.interaction < 6) { warnings.push("Baixa capacidade de responder à mesa rival."); recommendations.push("Inclua remoção, stun, recall ou combate favorável."); }
  else strengths.push(`${roleCounts.interaction} interações sustentam o plano.`);
  if (roleCounts.finishers < 2) { warnings.push("O deck pode estabilizar sem conseguir encerrar."); recommendations.push("Inclua ao menos dois finalizadores ou Campeões."); }
  else if (roleCounts.finishers > 7) { warnings.push("Topo da curva congestionado."); recommendations.push("Troque 1–3 finalizadores por desenvolvimento de custo baixo."); }
  else strengths.push(`${roleCounts.finishers} finalizadores dão inevitabilidade.`);
  if (profile.units < 15) recommendations.push("Revise a densidade de unidades para não perder presença de campo.");
  if (profile.averageCost > 4) warnings.push(`Custo médio elevado (${profile.averageCost}).`);
  if (roleCounts.engines >= 3) strengths.push(`${roleCounts.engines} motores criam valor recorrente.`);
  const identity = identityForRegions(profile.regions);
  const masteryCards = definitions.filter((card) => cardRegions(card).length > 1 && identityForRegions(cardRegions(card)).key === identity.key).length;
  if (identity.tier !== "single") strengths.push(`${identity.sigils} ${identity.name}: ${masteryCards} carta(s) com Maestria ativa.`);
  if (profile.regions.length === 3 && masteryCards === 0) warnings.push("Identidade tríplice sem recompensa de Maestria exata.");
  const penalty = Math.abs(40 - cards.length) * 2 + warnings.length * 8 + Math.max(0, 6 - roleCounts.interaction) * 2;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade = score >= 96 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : "C";
  return {
    score, grade,
    title: grade === "S" ? "Lista pronta para batalha" : grade === "A" ? "Estrutura sólida" : grade === "B" ? "Plano funcional com lacunas" : "Fundação em construção",
    archetype: presetProfile?.name ?? archetypeForDeck("")?.name ?? `${profile.identity} ${primary ?? "Híbrido"}`,
    strengths: strengths.slice(0, 3), warnings: warnings.slice(0, 4), recommendations: recommendations.slice(0, 4), roleCounts,
  };
}
