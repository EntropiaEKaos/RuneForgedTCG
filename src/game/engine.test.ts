/**
 * Suíte de testes do motor de jogo (engine.ts).
 *
 * Executa com: npx tsx src/game/engine.test.ts
 *
 * Cada teste cria um estado de jogo mínimo, executa uma ação e verifica o
 * resultado. Se qualquer asserção falhar, o processo termina com código 1.
 */
import {
  activateSentinelaAbility,
  applyCardEffectForSandbox,
  applyStackedActionWithAi,
  canBlock,
  canActivateSentinela,
  castSpell,
  championProgress,
  createCustomGame,
  createGame,
  declareAttack,
  resolveCombat,
  endTurn,
  effectiveCost,
  isValidTarget,
  playUnit,
  type CardAction,
} from "./engine";
import { aiChooseAction, aiChooseReaction, aiResolveTurnEnd, applyAiAction } from "./ai";
import { applyGameAction } from "./reducer";
import { getCard } from "./cards";
import type { DeckInput, GameState, UnitInstance, SentinelaInstance } from "./types";

const deck: DeckInput = { id: "t", name: "t", cards: Array(20).fill("ember_whelp") };

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, got: unknown, expected: unknown) {
  if (ok) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label} | got=${JSON.stringify(got)} expected=${JSON.stringify(expected)}`);
    fail++;
  }
}

function makeUnit(defId: string, owner: "player" | "ai", power: number, health: number, keywords: string[] = []): UnitInstance {
  return {
    instanceId: defId + "_" + Math.random().toString(36).slice(2),
    defId, race: "Dragon", races: ["Dragon"],
    power, basePower: power, health, maxHealth: health,
    keywords: keywords as any, barrier: false, frostbitten: false, stunned: false,
    isAttacking: false, hasStruck: false, summonedThisTurn: false,
    owner, isChampion: false, leveled: false, strikes: 0, nexusStrikes: 0,
    equipment: [], killedBy: null, powerBuffs: 0, healthBuffs: 0,
    permanentHealthModifier: 0, poisonCounters: 0, hasAttackedThisTurn: false,
  };
}

// =========================================================================
console.log("\n🧪 TESTE 1: Sentinela — invocação e lealdade");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerGoesFirst: true });
  s.players.player.hand = [{ instanceId: "sen", defId: "sent_vulkar" }];
  s.players.player.mana = 10; s.players.player.maxMana = 10;
  s = playUnit(s, "player", "sen");
  check("Sentinela invocada", s.players.player.sentinelas.length === 1, s.players.player.sentinelas.length, 1);
  const sen = s.players.player.sentinelas[0];
  check("Lealdade inicial = 4", sen.loyalty === 4, sen.loyalty, 4);
}

// =========================================================================
console.log("\n🧪 TESTE 2: Sentinela — habilidade +1 (ganha lealdade)");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerGoesFirst: true });
  s.players.player.hand = [{ instanceId: "sen", defId: "sent_vulkar" }];
  s.players.player.mana = 10; s.players.player.maxMana = 10;
  s = playUnit(s, "player", "sen");
  // Passar um turno para resetar activatedThisTurn
  s = endTurn(s, "player"); s = endTurn(s, "ai");
  // No round 2, com playerGoesFirst: true, o attack token vai para a AI, então a AI joga primeiro.
  // Forçamos a vez de volta para o player para testar a habilidade da sentinela.
  s.activePlayer = "player";
  const sen = s.players.player.sentinelas[0];
  check("Pode ativar habilidade +1", canActivateSentinela(s, "player", sen.instanceId, 0), true, true);
  s = activateSentinelaAbility(s, "player", sen.instanceId, 0);
  check("Lealdade após +1 = 5", s.players.player.sentinelas[0].loyalty === 5, s.players.player.sentinelas[0].loyalty, 5);
  check("Não pode ativar de novo no mesmo turno", !canActivateSentinela(s, "player", sen.instanceId, 0), true, true);
}

// =========================================================================
console.log("\n🧪 TESTE 3: Sentinela — dano por ataque inimigo");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  // IA tem sentinela
  s.players.ai.sentinelas = [{
    instanceId: "ai_sen", defId: "sent_vulkar", owner: "ai",
    loyalty: 4, activatedThisTurn: false,
  }];
  // Player tem atacante 3 power
  s.players.player.bench = [makeUnit("ember_raider", "player", 3, 2, ["QuickAttack"])];
  s.players.player.bench[0].summonedThisTurn = false;
  s.attackToken = "player"; s.activePlayer = "player";
  const atk = s.players.player.bench[0].instanceId;
  s = declareAttack(s, "player", [atk], {}, { [atk]: "ai_sen" });
  s = resolveCombat(s, {});
  // Sentinela deve ter lealdade 4 - 3 = 1
  const sen = s.players.ai.sentinelas.find((x) => x.instanceId === "ai_sen");
  check("Lealdade após ataque = 1", sen?.loyalty === 1, sen?.loyalty, 1);
}

// =========================================================================
console.log("\n🧪 TESTE 4: Sentinela — destruída quando lealdade chega a 0");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.ai.sentinelas = [{
    instanceId: "ai_sen", defId: "sent_vulkar", owner: "ai",
    loyalty: 2, activatedThisTurn: false,
  }];
  s.players.player.bench = [makeUnit("ember_raider", "player", 3, 2, ["QuickAttack"])];
  s.players.player.bench[0].summonedThisTurn = false;
  s.attackToken = "player"; s.activePlayer = "player";
  const atk = s.players.player.bench[0].instanceId;
  s = declareAttack(s, "player", [atk], {}, { [atk]: "ai_sen" });
  s = resolveCombat(s, {});
  check("Sentinela destruída (lealdade 0)", s.players.ai.sentinelas.length === 0, s.players.ai.sentinelas.length, 0);
}

// =========================================================================
console.log("\n🧪 TESTE 5: Sentinela bloqueada — atacante bloqueado não atinge sentinela");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.ai.sentinelas = [{
    instanceId: "ai_sen", defId: "sent_vulkar", owner: "ai",
    loyalty: 4, activatedThisTurn: false,
  }];
  s.players.ai.bench = [makeUnit("ember_whelp", "ai", 2, 1)]; // blocker
  s.players.player.bench = [makeUnit("ember_raider", "player", 3, 2, ["QuickAttack"])];
  s.players.player.bench[0].summonedThisTurn = false;
  s.attackToken = "player"; s.activePlayer = "player";
  const atk = s.players.player.bench[0].instanceId;
  const blk = s.players.ai.bench[0].instanceId;
  // Atacante mira sentinela, MAS é bloqueado por whelp
  s = declareAttack(s, "player", [atk], {}, { [atk]: "ai_sen" });
  s = resolveCombat(s, { [atk]: blk }); // IA bloqueia com whelp
  // Sentinela NÃO deve ser atingida (lealdade ainda 4)
  const sen = s.players.ai.sentinelas.find((x) => x.instanceId === "ai_sen");
  check("Sentinela não atingida (bloqueio tem prioridade)", sen?.loyalty === 4, sen?.loyalty, 4);
}

// =========================================================================
console.log("\n🧪 TESTE 6: Deathtouch mata criatura grande");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.player.bench = [makeUnit("void_assassin", "player", 2, 2, ["Deathtouch"])];
  s.players.ai.bench = [makeUnit("wood_ent", "ai", 6, 7)];
  s.players.player.bench[0].summonedThisTurn = false;
  s.attackToken = "player"; s.activePlayer = "player";
  const atk = s.players.player.bench[0].instanceId;
  const blk = s.players.ai.bench[0].instanceId;
  s = declareAttack(s, "player", [atk]);
  s = resolveCombat(s, { [atk]: blk });
  check("Criatura 6/7 morta por Deathtouch 2 power", !s.players.ai.bench.some((u) => u.instanceId === blk), false, false);
}

// =========================================================================
console.log("\n🧪 TESTE 7: Overwhelm + Deathtouch transborda");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.player.bench = [makeUnit("void_assassin", "player", 6, 6, ["Overwhelm", "Deathtouch"])];
  s.players.ai.bench = [makeUnit("ember_whelp", "ai", 2, 5)];
  s.players.player.bench[0].summonedThisTurn = false;
  s.attackToken = "player"; s.activePlayer = "player";
  const atk = s.players.player.bench[0].instanceId;
  const blk = s.players.ai.bench[0].instanceId;
  const nexusBefore = s.players.ai.nexusHealth;
  s = declareAttack(s, "player", [atk]);
  s = resolveCombat(s, { [atk]: blk });
  // power 6 - lethal 1 = 5 transbordo
  check("Overwhelm+Deathtouch transborda 5", s.players.ai.nexusHealth === nexusBefore - 5, s.players.ai.nexusHealth, nexusBefore - 5);
}

// =========================================================================
console.log("\n🧪 TESTE 8: Frostbite + equipamento + reset de rodada");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["ember_drake"], aiBench: ["ember_drake"] });
  s.players.ai.hand = [{ instanceId: "eq", defId: "ember_soulblade" }];
  s.players.ai.mana = 10; s.players.ai.maxMana = 10;
  const aiDrakeId = s.players.ai.bench[0].instanceId;
  s = playUnit(s, "ai", "eq", aiDrakeId);
  // Frostbite usa target enemyUnit
  s.players.player.hand = [{ instanceId: "frost", defId: "tide_frostbite" }];
  s.players.player.mana = 10; s.players.player.maxMana = 10;
  // castSpell em vez de playUnit (tide_frostbite é Spell)
  s = castSpell(s, "player", "frost", aiDrakeId);
  const d = s.players.ai.bench[0];
  check("Frostbite: power = 0", d.power === 0, d.power, 0);
  // Round reset
  s.activePlayer = "ai"; s = endTurn(s, "ai"); s = endTurn(s, "player");
  const d2 = s.players.ai.bench[0];
  check("Reset: power restaurado", d2.power > 0, d2.power, "> 0");
}

// =========================================================================
console.log("\n🧪 TESTE 9: Afinidade — custo reduzido por criaturas");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["ember_whelp", "ember_whelp", "ember_whelp"] });
  check("Swarmlord: 8 - 3 = 5", effectiveCost(s, "player", getCard("ember_swarmlord")) === 5, effectiveCost(s, "player", getCard("ember_swarmlord")), 5);
}

// =========================================================================
console.log("\n🧪 TESTE 10: isValidTarget — Sentinela");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.ai.sentinelas = [{
    instanceId: "ai_sen", defId: "sent_vulkar", owner: "ai",
    loyalty: 4, activatedThisTurn: false,
  }];
  const ent = { kind: "sentinela" as const, sen: s.players.ai.sentinelas[0], owner: "ai" as const };
  check("enemySentinela válido", isValidTarget(s, "player", "enemySentinela", ent), true, true);
  check("allySentinela inválido (é inimiga)", !isValidTarget(s, "player", "allySentinela", ent), true, true);
  check("anyBoard válido para sentinela", isValidTarget(s, "player", "anyBoard", ent), true, true);
}

// =========================================================================
console.log("\n🧪 TESTE 11: Buffs de feitiço são permanentes (não somem no fim da rodada)");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["ember_drake"] });
  s.players.player.hand = [{ instanceId: "buff", defId: "wood_growth" }];
  s.players.player.mana = 10; s.players.player.maxMana = 10;
  const drakeId = s.players.player.bench[0].instanceId;
  const before = { power: s.players.player.bench[0].power, health: s.players.player.bench[0].health };

  s = castSpell(s, "player", "buff", drakeId);
  const afterBuff = s.players.player.bench.find((u) => u.instanceId === drakeId)!;
  check(
    "Wild Growth (+1/+2) aumenta poder em 1",
    afterBuff.power === before.power + 1,
    afterBuff.power,
    before.power + 1,
  );
  check(
    "Wild Growth (+1/+2) também cura, não só levanta o teto",
    afterBuff.health === before.health + 2,
    afterBuff.health,
    before.health + 2,
  );

  s.attackToken = "player"; s.activePlayer = "player";
  s = endTurn(s, "player");
  s = endTurn(s, "ai");
  const afterRound = s.players.player.bench.find((u) => u.instanceId === drakeId)!;
  check(
    "Buff permanece após uma rodada completa (texto da carta não diz 'nesta rodada')",
    afterRound.power === afterBuff.power && afterRound.health === afterBuff.health,
    { power: afterRound.power, health: afterRound.health },
    { power: afterBuff.power, health: afterBuff.health },
  );
}

// =========================================================================
console.log("\n🧪 TESTE 12: Contra-mágica da IA nega ANTES da magia do jogador resolver");
// =========================================================================
{
  // Reproduz exatamente o fluxo do GameClient.tsx: aiChooseReaction() é
  // consultado sobre o estado ANTES da magia ser aplicada, e só então
  // applyStackedActionWithAi resolve o feitiço + a contra-mágica na ordem
  // certa (LIFO). Regressão para o bug em que handleHandClick resolvia a
  // magia primeiro e só depois perguntava para a IA se queria reagir —
  // nesse caso a contra-mágica da IA nunca conseguia negar nada de verdade.
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: [], aiBench: ["ember_drake"] });
  s.players.player.hand = [{ instanceId: "pbolt", defId: "ember_bolt" }];
  s.players.player.mana = 5; s.players.player.maxMana = 5;
  s.players.ai.hand = [{ instanceId: "deny", defId: "tide_deny" }];
  s.players.ai.mana = 10; s.players.ai.maxMana = 10;
  s.activePlayer = "player"; s.phase = "main";

  const aiDrakeId = s.players.ai.bench[0].instanceId;
  const action: CardAction = { kind: "spell", instanceId: "pbolt", defId: "ember_bolt", targetInstanceId: aiDrakeId };
  const aiReact = (st: GameState, act: CardAction) => aiChooseReaction(st, act);

  const reactionItem = aiChooseReaction(s, action);
  check("IA identifica Deny como uma reação válida antes da resolução", !!reactionItem, !!reactionItem, true);

  const r = applyStackedActionWithAi(s, action, "skip", null, aiReact);
  const aiDrake = r.next.players.ai.bench.find((u) => u.instanceId === aiDrakeId);
  const expectedHp = s.players.ai.bench[0].health; // pré-existente: Kindle Drake é 2/2
  check(
    "Criatura da IA sobrevive intacta — Deny negou a magia antes dela acontecer",
    !!aiDrake && aiDrake.health === expectedHp,
    aiDrake?.health ?? "morta/removida",
    expectedHp,
  );
}

// =========================================================================
console.log("\n🧪 TESTE 13: Veneno estilo Magic — cumulativo, mata o jogador com 10 contadores");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.player.hand = [
    { instanceId: "v1", defId: "void_venom" },
    { instanceId: "v2", defId: "void_venom" },
    { instanceId: "v3", defId: "void_venom" },
    { instanceId: "v4", defId: "void_venom" },
    { instanceId: "v5", defId: "void_venom" },
  ];
  s.players.player.mana = 20; s.players.player.maxMana = 20;

  s = castSpell(s, "player", "v1"); // +2
  check("Veneno é cumulativo (2 após 1 cast)", s.players.ai.poisonCounters === 2, s.players.ai.poisonCounters, 2);
  check("Ninguém morre com 2/10 veneno", s.winner === null, s.winner, null);

  s = castSpell(s, "player", "v2"); // +2 = 4
  s = castSpell(s, "player", "v3"); // +2 = 6
  s = castSpell(s, "player", "v4"); // +2 = 8
  check("8/10 veneno ainda não é derrota", s.winner === null, s.winner, null);

  s = castSpell(s, "player", "v5"); // +2 = 10 -> derrota
  check("10 contadores de veneno = derrota imediata", s.players.ai.poisonCounters >= 10, s.players.ai.poisonCounters, 10);
  check("Jogador vence ao envenenar o oponente até 10", s.winner === "player", s.winner, "player");
}

// =========================================================================
console.log("\n🧪 TESTE 14: DoubleStrike contra Sentinela desbloqueada bate duas vezes");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["storm_dashbolt"] });
  s.players.ai.sentinelas = [{
    instanceId: "ai_sen", defId: "sent_vulkar", owner: "ai",
    loyalty: 10, activatedThisTurn: false,
  }];
  const atk = s.players.player.bench[0];
  atk.keywords = [...atk.keywords, "DoubleStrike"];
  const startLoyalty = s.players.ai.sentinelas[0].loyalty;
  const power = atk.power;

  s.attackToken = "player"; s.activePlayer = "player";
  s = declareAttack(s, "player", [atk.instanceId], {}, { [atk.instanceId]: "ai_sen" });
  s = resolveCombat(s, {});

  const sen = s.players.ai.sentinelas.find((x) => x.instanceId === "ai_sen");
  check(
    "DoubleStrike desconta o poder do atacante duas vezes da Sentinela",
    !!sen && sen.loyalty === startLoyalty - power * 2,
    sen?.loyalty,
    startLoyalty - power * 2,
  );
}

// =========================================================================
// TESTE 15: A IA de produção consegue atacar e ativar Sentinelas
// Regressão para o bug em que applyAiAction/aiChooseAction eram hardcoded
// para "ai" e não sabiam resolver ações contra entidades já em campo
// (kind "sentinela"), fazendo a IA desperdiçar o turno inteiro sempre que
// havia uma Sentinela inimiga fraca ou uma Sentinela própria para ativar.
console.log("\n🧪 TESTE 15: IA interage com Sentinelas de verdade");
{
  // 15a — IA ativa a própria Sentinela via applyAiAction quando aiChooseAction escolhe kind:"sentinela".
  let s = createCustomGame("P", deck, deck, { skipMulligan: true });
  s.players.ai.sentinelas = [{
    instanceId: "ai_sen_own", defId: "sent_vulkar", owner: "ai",
    loyalty: 5, activatedThisTurn: false,
  }];
  s.activePlayer = "ai";
  s.phase = "main";
  const action = aiChooseAction(s, "ai");
  check(
    "aiChooseAction escolhe ativar a própria sentinela (kind: sentinela)",
    action?.kind === "sentinela" && action.instanceId === "ai_sen_own",
    action,
    "{ kind: 'sentinela', instanceId: 'ai_sen_own' }",
  );
  if (action) {
    const after = applyAiAction(s, action, "ai");
    const sen = after.players.ai.sentinelas.find((x) => x.instanceId === "ai_sen_own");
    check(
      "applyAiAction realmente ativa a habilidade (lealdade muda, não é no-op)",
      !!sen && sen.loyalty !== 5,
      sen?.loyalty,
      "!= 5",
    );
  }

  // 15b — IA ataca uma sentinela inimiga fraca via aiResolveTurnEnd (declareAttack + sentinelaTargets),
  // não via aiChooseAction (que não pode expressar "atacar com unidade do campo").
  let s2 = createCustomGame("P", deck, deck, { skipMulligan: true, aiBench: ["ember_whelp"] });
  s2.players.player.sentinelas = [{
    instanceId: "enemy_sen", defId: "sent_vulkar", owner: "player",
    loyalty: 2, activatedThisTurn: false,
  }];
  s2.attackToken = "ai";
  s2.activePlayer = "ai";
  s2.phase = "main";
  const beforeLoyalty = s2.players.player.sentinelas[0].loyalty;
  s2 = aiResolveTurnEnd(s2, "ai");
  check(
    "aiResolveTurnEnd declara o ataque mirando a sentinela (sentinelaTargets preenchido)",
    s2.phase === "blocking" && !!s2.combat && Object.keys(s2.combat.sentinelaTargets).length > 0,
    s2.combat?.sentinelaTargets,
    "{ <attackerId>: 'enemy_sen' }",
  );
  s2 = resolveCombat(s2, {});
  const sen2 = s2.players.player.sentinelas.find((x) => x.instanceId === "enemy_sen");
  check(
    "após resolver o combate, a sentinela inimiga perdeu lealdade (não ficou intocada)",
    !sen2 || sen2.loyalty < beforeLoyalty,
    sen2?.loyalty ?? "(destruída)",
    `< ${beforeLoyalty}`,
  );
}

// =========================================================================
// TESTE 16: reducer.applyGameAction rejeita "cast" com instanceId inexistente
// em vez de travar. Antes disso, um instanceId forjado/obsoleto (facilmente
// alcançável via PvP, já que validateGameAction só confere turno/fase, não
// se a carta está de fato na mão) caía num fallback defId:"unknown" e
// getCard() lançava uma exceção não tratada — virando 500 na rota PvP em
// vez de uma rejeição limpa (o endpoint já trata next===state como 422).
console.log("\n🧪 TESTE 16: reducer não crasha com instanceId de spell inválido");
{
  const s = createCustomGame("P", deck, deck, { skipMulligan: true, playerStartingMana: 10 });
  let threw = false;
  let result: GameState = s;
  try {
    result = applyGameAction(s, { type: "cast", player: "player", instanceId: "nao-existe-na-mao" }, false).next;
  } catch {
    threw = true;
  }
  check("cast com instanceId inexistente não lança exceção", !threw, threw, false);
  check("cast com instanceId inexistente devolve o estado inalterado (next === state)", result === s, result === s, true);
}

// =========================================================================
console.log("\n🧪 TESTE 17: Sentinela de Ironwood (Terrus) — aura de área");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["ember_drake", "ember_drake"] });
  s.players.player.sentinelas = [{ instanceId: "sen1", defId: "sent_terrus", owner: "player", loyalty: 6, activatedThisTurn: false }];
  s.activePlayer = "player"; s.phase = "main";
  const before = s.players.player.bench.map((u) => u.health);
  s = activateSentinelaAbility(s, "player", "sen1", 0);
  const after = s.players.player.bench.map((u) => u.health);
  check("Aura +0/+2 aplica em todas as criaturas aliadas", after.every((h, i) => h === before[i] + 2), after, before.map((h) => h + 2));
  check("Lealdade sobe (+1) ao ativar habilidade positiva", s.players.player.sentinelas[0].loyalty === 7, s.players.player.sentinelas[0].loyalty, 7);
}

// =========================================================================
console.log("\n🧪 TESTE 18: Campeão de 3 estágios (Pyra) evolui até o fim");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["ember_champion"], aiStartingMana: 0 });
  const attackAndCycle = (state: typeof s) => {
    const atk = state.players.player.bench.find((u) => u.isChampion)!;
    state.attackToken = "player";
    state.activePlayer = "player";
    let s2 = declareAttack(state, "player", [atk.instanceId], {});
    s2 = resolveCombat(s2, {});
    s2.players.ai.nexusHealth = 20;
    s2 = endTurn(s2, "player");
    s2 = endTurn(s2, "ai");
    return s2;
  };
  s = attackAndCycle(s);
  s = attackAndCycle(s);
  let unit = s.players.player.bench.find((u) => u.isChampion)!;
  check("Após 10 de dano acumulado, evolui pro estágio 2", unit.defId === "ember_champion_2", unit.defId, "ember_champion_2");
  const prog2 = championProgress(s, unit);
  check("Estágio 2 mostra progresso real (não trava em 'Leveled')", prog2?.goal === 16 && prog2.current === 10, prog2, { goal: 16, current: 10 });

  s = attackAndCycle(s);
  unit = s.players.player.bench.find((u) => u.isChampion)!;
  check("Após 16 de dano acumulado, evolui pro estágio 3 (forma final)", unit.defId === "ember_champion_3", unit.defId, "ember_champion_3");
  check("Forma final não tem mais progresso pra mostrar", championProgress(s, unit) === null, championProgress(s, unit), null);
  check("Forma final tem os stats certos (8/7)", unit.power === 8 && unit.health === 7, { power: unit.power, health: unit.health }, { power: 8, health: 7 });
}


// =========================================================================
console.log("\n🧪 TESTE 19: efeitos automáticos escolhem alvo e aura de Barreira funciona");
// =========================================================================
{
  let s = createCustomGame("P", deck, deck, { skipMulligan: true, playerBench: ["ember_whelp", "ember_raider"] });
  const strongest = [...s.players.player.bench].sort((a, b) => b.power - a.power)[0];
  strongest.health = Math.max(1, strongest.maxHealth - 1);
  const beforeHealth = strongest.health;
  s = applyCardEffectForSandbox(s, "player", { kind: "healUnit", amount: 2, target: "allyUnit" });
  const healed = s.players.player.bench.find((u) => u.instanceId === strongest.instanceId)!;
  check("healUnit sem explicitTarget auto-seleciona aliado", healed.health > beforeHealth, healed.health, `> ${beforeHealth}`);

  const beforePower = healed.power;
  s = applyCardEffectForSandbox(s, "player", { kind: "buffUnit", amount: 0, target: "allyUnit", buffPower: 1, buffHealth: 0 });
  const buffed = s.players.player.bench.find((u) => u.instanceId === strongest.instanceId)!;
  check("buffUnit sem explicitTarget auto-seleciona aliado", buffed.power === beforePower + 1, buffed.power, beforePower + 1);

  s = applyCardEffectForSandbox(s, "player", { kind: "grantBarrier", amount: 0, target: "none" });
  check("grantBarrier target none aplica aura em todos os aliados", s.players.player.bench.every((u) => u.barrier && u.keywords.includes("Barrier")), s.players.player.bench.map((u) => u.barrier), [true, true]);
}

// =========================================================================
console.log(`\n========================================`);
console.log(`  RESULTADO: ${pass} passaram, ${fail} falharam`);
console.log(`========================================`);
if (fail > 0) process.exit(1);
