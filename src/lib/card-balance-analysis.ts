import { validateAuthorableCard } from "@/game/card-authoring";
import { estimateCardPower } from "@/game/balance-health";
import { getRuntimeDecks, getRuntimeExperimentalDecks } from "@/lib/control-plane";
import { cardRegions } from "@/game/region-identity";
import { runBalanceSimulation } from "@/lib/balance-simulator";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";
import type { CardDef, DeckInput } from "@/game/types";

export async function analyzeCandidateCard(raw: unknown, gamesPerMatchup = 40, seed = 293000) {
  if (!raw || typeof raw !== "object") throw new Error("Card payload must be an object");
  const validation = validateAuthorableCard(raw as Partial<CardDef>);
  if (!validation.ok) throw new Error(validation.error);
  const card = validation.card;
  const regionSet = new Set(cardRegions(card));
  const [experimental, official] = await Promise.all([getRuntimeExperimentalDecks(), getRuntimeDecks()]);
  const hosts = experimental.filter((d: any) => Array.isArray(d.regions) && d.regions.some((r: any) => regionSet.has(r))).slice(0, 2);
  if (!hosts.length) throw new Error("No experimental Vanilla deck matches this card identity");
  const opponents = official.slice(0, 4);
  const power = estimateCardPower(card);
  const rows: any[] = [];
  withRegisteredCardSnapshot([card], () => {
    for (const host of hosts) {
      const candidateCards = [...host.cards]; candidateCards[0] = card.defId; candidateCards[1] = card.defId;
      const base: DeckInput = { id: `${host.id}:baseline`, name: `${host.name} Baseline`, cards: host.cards };
      const candidate: DeckInput = { id: `${host.id}:candidate`, name: `${host.name} + ${card.name}`, cards: candidateCards };
      for (let i=0;i<opponents.length;i++) {
        const opp=opponents[i]; const overrides: Record<string, DeckInput> = { [base.id]: base, [candidate.id]: candidate, [opp.id]: {id:opp.id,name:opp.name,cards:opp.cards} };
        const baseline=runBalanceSimulation(base.id,opp.id,gamesPerMatchup,seed+rows.length*7919,overrides);
        const changed=runBalanceSimulation(candidate.id,opp.id,gamesPerMatchup,seed+rows.length*7919,overrides);
        rows.push({host:host.name,opponent:opp.name,baselineWinRate:baseline.winRateA,candidateWinRate:changed.winRateA,delta:Math.round((changed.winRateA-baseline.winRateA)*10)/10,games:gamesPerMatchup*2});
      }
    }
  });
  const avgDelta=Math.round(rows.reduce((s,r)=>s+r.delta,0)/Math.max(rows.length,1)*10)/10;
  const severity=Math.abs(avgDelta)>=7?"critical":Math.abs(avgDelta)>=4?"watch":"healthy";
  return {card:{defId:card.defId,name:card.name,region:card.region,rarity:card.rarity,cost:card.cost},powerEstimate:power,avgDelta,severity,rows,totalSimulatedGames:rows.reduce((s,r)=>s+r.games,0),recommendation:avgDelta>7?"Likely overpowered: reduce efficiency before QA.":avgDelta<-7?"Likely underpowered: consider a targeted buff before QA.":"Candidate is inside the initial simulation envelope."};
}
