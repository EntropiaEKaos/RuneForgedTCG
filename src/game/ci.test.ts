/**
 * CI Gate — roda N partidas bot-vs-bot automaticamente.
 *
 * Detecta:
 * - Partidas que travam (não terminam)
 * - Lado que nunca joga carta
 * - Sentinela com lealdade ≤ 0 ainda no board após combate
 * - Crash do motor
 *
 * Executa com: npx tsx src/game/ci.test.ts
 */
import {
  canDeclareAttack,
  canPlayCard,
  castSpell,
  createGame,
  declareAttack,
  endTurn,
  playUnit,
  resolveCombat,
  skipMulligan,
  spellNeedsTarget,
} from "./engine";
import { aiChooseAction, aiChooseBlocks, aiDefend, applyAiAction, aiResolveTurnEnd } from "./ai";
import { DECKS, validateDeck } from "./decks";
import { getCard } from "./cards";
import type { GameState } from "./types";

let totalIssues = 0;

// Todo deck pré-montado precisa passar nas próprias regras de deckbuilding do
// jogo (limite de cópias, limite de regiões). Sem isso um deck "quebrado" pode
// ser shippado sem ninguém notar — já aconteceu duas vezes.
console.log("🧱 Validando decks pré-montados...");
const deckIssues: string[] = [];
for (const d of DECKS) {
  const v = validateDeck(d.cards);
  if (!v.ok) {
    console.log(`  ❌ ${d.id}: ${v.errors.join(" | ")}`);
    deckIssues.push(`❌ [deck:${d.id}] ${v.errors.join(" | ")}`);
    totalIssues++;
  } else {
    console.log(`  ✅ ${d.id}`);
  }
}
console.log("");
let totalGames = 0;
let totalRounds = 0;
const issues: string[] = [...deckIssues];

function checkGameState(s: GameState, label: string) {
  // Sentinela com lealdade ≤ 0 ainda no board
  for (const pid of ["player", "ai"] as const) {
    for (const sen of s.players[pid].sentinelas) {
      if (sen.loyalty <= 0) {
        issues.push(`❌ [${label}] Sentinela ${sen.defId} com lealdade ${sen.loyalty} ainda no board de ${pid}`);
        totalIssues++;
      }
    }
  }
}

function simulateBotTurn(s: GameState, side: "player" | "ai"): GameState {
  if (s.phase === "blocking" && s.combat?.attackerId !== side) {
    return resolveCombat(s, aiChooseBlocks(s));
  }
  // Joga até 5 cartas
  let played = 0;
  for (let i = 0; i < 5; i++) {
    const card = s.players[side].hand.find((c) => canPlayCard(s, side, c.instanceId));
    if (!card) break;
    const def = getCard(card.defId);
    const needs = spellNeedsTarget(card.defId);
    if (def.type === "Equipment") {
      const t = [...s.players[side].bench].sort((a, b) => b.power - a.power)[0];
      if (!t) break;
      s = playUnit(s, side, card.instanceId, t.instanceId);
    } else if (def.type === "Spell") {
      if (needs === "spellOnStack") { s = castSpell(s, side, card.instanceId); break; }
      else if (!needs) s = castSpell(s, side, card.instanceId);
      else if (needs === "enemyUnit" || needs === "enemySentinela") {
        const enemy = side === "player" ? "ai" : "player";
        const t = s.players[enemy].bench[0] ?? s.players[enemy].sentinelas[0];
        if (!t) break;
        s = castSpell(s, side, card.instanceId, t.instanceId);
      } else if (needs === "allyUnit") {
        const t = s.players[side].bench[0];
        if (!t) break;
        s = castSpell(s, side, card.instanceId, t.instanceId);
      } else if (needs === "anyBoard") {
        const enemy = side === "player" ? "ai" : "player";
        const t = s.players[enemy].bench[0] ?? s.players[enemy].permanents[0] ?? s.players[side].bench[0];
        if (!t) break;
        s = castSpell(s, side, card.instanceId, t.instanceId);
      } else break;
    } else {
      s = playUnit(s, side, card.instanceId);
    }
    played++;
    if (s.phase === "gameover") return s;
  }
  // Ataca se possível
  if (canDeclareAttack(s, side)) {
    const ids = s.players[side].bench.filter((u) => !u.stunned && !u.summonedThisTurn).map((u) => u.instanceId);
    if (ids.length > 0) {
      s = declareAttack(s, side, ids);
      if (s.phase === "blocking" && s.combat?.attackerId === side) {
        s = aiDefend(s);
      }
    }
  }
  // Verifica sentinela órfã
  checkGameState(s, `${side}-play`);
  return endTurn(s, side);
}

console.log("🤖 CI Gate — Simulando partidas...\n");

for (let i = 0; i < 3; i++) {
  for (let deckIndex = 0; deckIndex < DECKS.length; deckIndex++) {
    const d = DECKS[deckIndex];
    const aiD = DECKS.find((x) => x.id !== d.id) ?? DECKS[0];
    const seed = (0x51f15e ^ Math.imul(i + 1, 0x9e3779) ^ Math.imul(deckIndex + 1, 0x85ebca)) >>> 0;
    let s = createGame("Bot", { id: d.id, name: d.name, cards: d.cards }, { id: aiD.id, name: aiD.name, cards: aiD.cards }, true, seed);
    s = skipMulligan(s, "player");
    let g = 0;
    let playerPlayed = 0;
    let aiPlayed = 0;
    while (s.phase !== "gameover" && g++ < 500) {
      if (s.phase === "main" && s.activePlayer === "player") {
        s = simulateBotTurn(s, "player");
        playerPlayed++;
      } else if (s.phase === "main" && s.activePlayer === "ai") {
        s = simulateBotTurn(s, "ai");
        aiPlayed++;
      } else if (s.phase === "blocking") {
        s = resolveCombat(s, aiChooseBlocks(s));
      }
      checkGameState(s, `${d.id}-r${g}`);
    }
    totalGames++;
    totalRounds += s.round;

    if (s.phase !== "gameover") {
      issues.push(`❌ [${d.id}] Partida não terminou em 500 rodadas (seed=${seed})`);
      totalIssues++;
    }
    if (playerPlayed === 0) {
      issues.push(`❌ [${d.id}] Player nunca jogou carta (seed=${seed})`);
      totalIssues++;
    }
    if (aiPlayed === 0) {
      issues.push(`❌ [${d.id}] IA nunca jogou carta (seed=${seed})`);
      totalIssues++;
    }
  }
}

console.log(`📊 Resultados CI:`);
console.log(`  Partidas: ${totalGames}`);
console.log(`  Rodadas médias: ${(totalRounds / totalGames).toFixed(1)}`);
console.log(`  Issues: ${totalIssues}`);

if (issues.length > 0) {
  console.log("\n🚨 Issues encontradas:");
  for (const i of issues.slice(0, 20)) console.log(`  ${i}`);
  if (issues.length > 20) console.log(`  ... e mais ${issues.length - 20} issues`);
  process.exit(1);
} else {
  console.log("\n✅ Nenhuma issue encontrada. Motor estável.");
}
