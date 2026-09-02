import fs from "node:fs";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { runBalanceSimulationWithTelemetry, type SimulationSummary } from "../src/lib/balance-simulator";

const targetId = "vanilla_forest_2";
const baseline = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === targetId);
if (!baseline) throw new Error("Florestia Ascendant baseline missing");
const unique = [...new Set(baseline.cards)];
if (unique.length !== 30) throw new Error(`Expected 30 unique regional cards, found ${unique.length}`);

const candidates: Record<string, string[]> = {
  baseline_1_7: ["u03","u05","u08","u08","u11","u11","u13","u13","u14","u18"],
  early_curve: ["u01","u01","u02","u02","u03","u03","u04","u04","u05","u05"],
  curve_midrange: ["u03","u03","u05","u05","u13","u13","u14","u14","u15","u15"],
  clean_finishers: ["u13","u13","u14","u14","u15","u15","u16","u16","u17","u17"],
  matriarch_hunt: ["u03","u03","u05","u05","u13","u13","u14","u14","u17","u17"],
  clean_interaction: ["u03","u03","u05","u05","u13","u13","u14","u14","s06","s07"],
  permanent_pressure: ["u03","u03","u05","u05","u13","u13","u14","u14","e01","a01"],
  broad_pressure: ["u01","u02","u03","u04","u05","u13","u14","u15","u16","u17"],
};

function id(short: string) { return `van_forest_${short}`; }
function build(extra: string[]) {
  const cards = [...unique, ...extra.map(id)];
  if (cards.length !== 40) throw new Error(`candidate has ${cards.length} cards`);
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  const over = [...counts.entries()].filter(([, n]) => n > 3);
  if (over.length) throw new Error(`copy cap exceeded: ${JSON.stringify(over)}`);
  return cards;
}
function pct(n: number, d: number) { return Math.round((1000*n/Math.max(1,d)))/10; }
function aggregate(parts: SimulationSummary[]) {
  const winsA=parts.reduce((s,r)=>s+r.winsA,0), winsB=parts.reduce((s,r)=>s+r.winsB,0), draws=parts.reduce((s,r)=>s+r.draws,0);
  return { winsA,winsB,draws,winRateA:pct(winsA,winsA+winsB), completedGames:parts.reduce((s,r)=>s+r.completedGames,0) };
}

const matchups = vanillaBalanceMatchups().filter((m) => m.leftId === targetId || m.rightId === targetId);
const strata = 5;
const gamesPerStratum = 20;
const rows=[];
for (const [name, extra] of Object.entries(candidates)) {
  const overrides = vanillaExperimentalOverrides();
  overrides[targetId] = { id: targetId, name: `${baseline.name} [${name}]`, cards: build(extra) };
  let wins=0, losses=0, draws=0;
  const opponents=[];
  for (const matchup of matchups) {
    const parts: SimulationSummary[]=[];
    for (let stratum=0; stratum<strata; stratum++) {
      parts.push(runBalanceSimulationWithTelemetry(matchup.leftId, matchup.rightId,gamesPerStratum,vanillaBalanceSeed(matchup,stratum),overrides).summary);
    }
    const agg=aggregate(parts);
    const targetLeft=matchup.leftId===targetId;
    const targetWins=targetLeft?agg.winsA:agg.winsB;
    const targetLosses=targetLeft?agg.winsB:agg.winsA;
    wins+=targetWins; losses+=targetLosses; draws+=agg.draws;
    opponents.push({ opponent: targetLeft?matchup.rightId:matchup.leftId, games:agg.completedGames, wins:targetWins, losses:targetLosses, winRate:pct(targetWins,targetWins+targetLosses) });
  }
  rows.push({ name, extra:extra.map(id), games:wins+losses+draws, wins, losses, draws, winRate:pct(wins,wins+losses), opponents });
}
rows.sort((a,b)=>b.winRate-a.winRate);
const report={methodology:"Florestia Ascendant recipe-only candidate screen; all 30 regional cards preserved; 10 duplicate slots; 11 opponents; 5 certified seed strata x 20 games = 100 games/opponent/candidate", strata, gamesPerStratum, candidates:rows};
fs.writeFileSync("VANILLA_1_8_FLORESTIA_CANDIDATES.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
