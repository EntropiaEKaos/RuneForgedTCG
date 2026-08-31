import { getCard } from "../cards";
import { unitsWithEquipmentCapacity } from "../equipment-link-contract";
import { nextRng } from "../rng";
import { regionalCostDiscount } from "../region-identity";
import type { BoardEntity, CardDef, GameState, PermanentInstance, PlayerId, PlayerState, TargetKind, UnitInstance } from "../types";
import { engineRulesFor } from "../match-rules";
import { applyDamageToUnit, checkWin, clone, damageNexus, drawCards, findAnyBoardEntity, findPermanent, findSentinela, findUnit, grantMana, hasKw, healNexus, makePermanent, makeUnit, other, poisonPlayer, recomputeHealth, recomputeStats, shuffle, uid } from "./state";
import { applyEffect, checkLevelUps, cleanupDead, firePermanentRoundStart, fireTrigger } from "./effects";
import { cleanupSentinelas, resetSentinelasActivation } from "./sentinela-state";

export function canCastReaction(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  actionKind: "unit" | "spell" | "sentinela",
): boolean {
  if (state.phase !== "main") return false;
  const p = state.players[playerId];
  const inst = p.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return false;
  const def = getCard(inst.defId);
  if (def.type !== "Spell" || !def.speed) return false;
  if (actionKind === "spell" && def.speed !== "Burst") return false;
  return p.mana + p.spellMana >= effectiveCost(state, playerId, def);
}

// fireRallyOnSummon REMOVIDA — causava double-buff em todas as cartas Rally.
// O disparo de "onSummon" via fireTrigger já executa o efeito uma única vez.
// Bug ativo desde a segunda revisão; corrigido aqui definitivamente.

/** Calculate a card's real cost after Magic-style cost reductions (Affinity). */
export function effectiveCost(state: GameState, playerId: PlayerId, def: CardDef): number {
  let cost = def.cost;
  const cr = def.costReduction;
  const p = state.players[playerId];
  let reduction = 0;
  if (cr?.kind === "creatures") {
    reduction = p.bench.length * (cr.per ?? 1);
  } else if (cr?.kind === "power") {
    const threshold = cr.threshold ?? 4;
    reduction = p.bench.filter((u) => u.power >= threshold).length * (cr.per ?? 1);
  }
  if (cr?.max !== undefined) reduction = Math.min(reduction, cr.max);
  reduction += regionalCostDiscount(p, def);
  return Math.max(0, cost - reduction);
}

/** Can this card be played (units, spells, enchantments, artifacts, equipment)? */
export function canPlayCard(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  if (state.phase !== "main" || state.activePlayer !== playerId) return false;
  const p = state.players[playerId];
  const inst = p.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return false;
  const def = getCard(inst.defId);
  const cost = effectiveCost(state, playerId, def);
  const usesSpellMana = def.type !== "Unit" && def.type !== "Sentinela";
  const affordable = usesSpellMana ? p.mana + p.spellMana >= cost : p.mana >= cost;
  if (!affordable) return false;

  if (def.type === "Unit") return p.bench.length < engineRulesFor(state).benchCap;
  if (def.type === "Enchantment" || def.type === "Artifact") return p.permanents.length < engineRulesFor(state).permanentsCap;
  if (def.type === "Sentinela") return true;
  if (def.type === "Equipment") {
    // Must have a legal attach target with capacity under the canonical link contract.
    return unitsWithEquipmentCapacity(p.bench).length > 0;
  }
  // Spell
  return true;
}

// ─── fireRallyOnSummon foi REMOVIDO (era redundante com fireTrigger "onSummon") ───

/** Whether a spell / equipment needs a target and what kind. */
export function spellNeedsTarget(defId: string): TargetKind | null {
  const def = getCard(defId);
  if (def.type === "Equipment") {
    return "allyUnit";
  }
  if (def.type !== "Spell" || !def.spell) return null;
  const t = def.spell.target;
  if (
    t === "enemyUnit" ||
    t === "allyUnit" ||
    t === "anyUnit" ||
    t === "enemyPermanent" ||
    t === "allyPermanent" ||
    t === "anyPermanent" ||
    t === "anyBoard" ||
    t === "spellOnStack" ||
    t === "enemySentinela" ||
    t === "allySentinela" ||
    t === "anySentinela"
  ) {
    return t;
  }
  return null;
}

/** Returns true iff the given board entity is a valid target for a spell/equipment with this target kind. */
export function isValidTarget(
  state: GameState,
  playerId: PlayerId,
  targetKind: TargetKind,
  ent: BoardEntity,
): boolean {
  // Hexproof: cannot be targeted by enemy (opposing player) spells/abilities.
  const isEnemySide = ent.owner !== playerId;
  if (isEnemySide && ent.kind === "unit" && ent.unit.keywords.includes("Hexproof")) {
    // Only board wipes / non-targeted (none/self) still work.
    if (targetKind !== "none" && targetKind !== "self") return false;
  }
  switch (targetKind) {
    case "enemyUnit":
      return ent.kind === "unit" && isEnemySide;
    case "allyUnit":
      return ent.kind === "unit" && ent.owner === playerId;
    case "anyUnit":
      return ent.kind === "unit";
    case "enemyPermanent":
      return ent.kind === "permanent" && isEnemySide;
    case "allyPermanent":
      return ent.kind === "permanent" && ent.owner === playerId;
    case "anyPermanent":
      return ent.kind === "permanent";
    case "enemySentinela":
      return ent.kind === "sentinela" && isEnemySide;
    case "allySentinela":
      return ent.kind === "sentinela" && ent.owner === playerId;
    case "anySentinela":
      return ent.kind === "sentinela";
    case "anyBoard":
      return true; // units, permanents, and sentinelas all qualify
    default:
      return false;
  }
}

function payCost(p: PlayerState, cost: number, isSpell: boolean): void {
  if (isSpell) {
    const fromMana = Math.min(p.mana, cost);
    p.mana -= fromMana;
    p.spellMana -= cost - fromMana;
  } else {
    p.mana -= cost;
  }
}

/** Play a unit, enchantment, artifact or equipment card from hand. */
export function playUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
): GameState {
  const s = clone(state);
  const p = s.players[playerId];
  const inst = p.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return state;
  const def = getCard(inst.defId);
  const cost = effectiveCost(s, playerId, def);
  const usesSpellMana = def.type !== "Unit" && def.type !== "Sentinela";
  const affordable = usesSpellMana ? p.mana + p.spellMana >= cost : p.mana >= cost;
  if (!affordable) return state;

  if (def.type === "Unit") {
    if (p.bench.length >= engineRulesFor(state).benchCap) return state;
    payCost(p, cost, false);
    p.hand = p.hand.filter((c) => c.instanceId !== instanceId);
    const unit = makeUnit(s, def.defId, playerId);
    p.bench.push(unit);
    p.stats.alliesSummoned += 1;
    s.log.push(`${p.name} summons ${def.name}.`);
    // onSummon already covers Rally-style cards such as Kindle Drake,
    // Cinderscale Sire, Coral Caller, Grove Alpha and Grove Chorus.
    fireTrigger(s, unit, "onSummon");
    // Fire on-summon triggers for permanents (e.g. "when you summon a unit").
    for (const perm of p.permanents) {
      const pdef = getCard(perm.defId);
      if (pdef.trigger?.when === "onPermanentSummon") {
        applyEffect(s, playerId, pdef.trigger.effect, undefined, unit);
      }
    }
    cleanupDead(s);
    checkLevelUps(s);
    checkWin(s);
    return s;
  }

  if (def.type === "Enchantment" || def.type === "Artifact") {
    if (p.permanents.length >= engineRulesFor(state).permanentsCap) return state;
    payCost(p, cost, true);
    p.hand = p.hand.filter((c) => c.instanceId !== instanceId);
    p.stats.spellsCast += 1;
    const perm = makePermanent(s, def.defId, playerId);
    p.permanents.push(perm);
    s.log.push(`${p.name} plays ${def.name} (${def.type}).`);
    cleanupDead(s);
    checkWin(s);
    return s;
  }

  if (def.type === "Equipment") {
    const allies = unitsWithEquipmentCapacity(p.bench);
    if (allies.length === 0) return state;
    let target: UnitInstance | undefined;
    if (targetInstanceId) {
      target = allies.find((u) => u.instanceId === targetInstanceId);
      if (!target) return state;
    } else {
      target = [...allies].sort((a, b) => b.power - a.power)[0];
    }
    if (!target) return state;

    payCost(p, cost, true);
    p.hand = p.hand.filter((c) => c.instanceId !== instanceId);
    p.stats.spellsCast += 1;
    const slot = { instanceId: uid(s, "eq"), defId: def.defId };
    const healthGain = def.equipment!.buffHealth;
    target.equipment.push(slot);
    for (const k of def.equipment!.keywords ?? []) {
      if (!target.keywords.includes(k)) target.keywords.push(k);
    }
    if (target.keywords.includes("Barrier")) target.barrier = true;
    // Refresh power/health from new def + equipment + existing buffs.
    recomputeStats(target);
    recomputeHealth(target);
    // Equipment's health bonus also raises current health (not just max).
    target.health += healthGain;
    if (target.health > target.maxHealth) target.health = target.maxHealth;
    s.log.push(`${p.name} equips ${def.name} onto ${getCard(target.defId).name}.`);
    cleanupDead(s);
    checkWin(s);
    return s;
  }

  if (def.type === "Sentinela") {
    if (!def.sentinela) return state;
    // Sentinelas are battlefield permanents, not spells: they require regular mana
    // and must not advance spell-cast counters/level-up conditions.
    payCost(p, cost, false);
    p.hand = p.hand.filter((c) => c.instanceId !== instanceId);
    p.sentinelas.push({
      instanceId: uid(s, "sen"),
      defId: def.defId,
      owner: playerId,
      loyalty: def.sentinela.startingLoyalty,
      activatedThisTurn: false,
    });
    s.log.push(`${p.name} conjura a Sentinela ${def.name} (Lealdade ${def.sentinela.startingLoyalty}).`);
    checkWin(s);
    return s;
  }

  return state;
}

export function castSpell(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
): GameState {
  const s = clone(state);
  const p = s.players[playerId];
  const inst = p.hand.find((c) => c.instanceId === instanceId);
  if (!inst) return state;
  const def = getCard(inst.defId);
  if (def.type !== "Spell" || !def.spell) return state;
  const cost = effectiveCost(s, playerId, def);
  if (p.mana + p.spellMana < cost) return state;

  const needsTarget = spellNeedsTarget(def.defId);
  const isCounter = def.spell.kind === "negateSpell" || needsTarget === "spellOnStack";
  let ent: BoardEntity | undefined;
  if (needsTarget && needsTarget !== "none" && needsTarget !== "self" && !isCounter) {
    if (!targetInstanceId) return state;
    const found = findAnyBoardEntity(s, targetInstanceId);
    if (!found) return state;
    if (!isValidTarget(s, playerId, needsTarget, found)) return state;
    ent = found;
  }

  payCost(p, cost, true);
  p.hand = p.hand.filter((c) => c.instanceId !== instanceId);
  p.stats.spellsCast += 1;
  s.log.push(`${p.name} casts ${def.name}.`);
  if (isCounter) {
    // Counterspells resolve through the stack layer (LIFO); here we only
    // apply their secondary effects (e.g. "then draw 1") and skip the negate
    // itself, which is handled by the client stack resolver.
    if (def.spell.also) {
      applyEffect(s, playerId, def.spell.also, targetInstanceId);
    }
  } else {
    applyEffect(s, playerId, def.spell, targetInstanceId);
  }
  cleanupDead(s);
  checkLevelUps(s);
  checkWin(s);
  return s;
}

/** Whether a unit may currently be declared as an attacker (summoning sickness + stun). */
export function isReadyToAttack(unit: UnitInstance): boolean {
  if (unit.stunned) return false;
  if (unit.hasAttackedThisTurn) return false;
  if (unit.summonedThisTurn && !unit.keywords.includes("Haste")) return false;
  return true;
}

export function canDeclareAttack(state: GameState, playerId: PlayerId): boolean {
  return (
    state.phase === "main" &&
    state.activePlayer === playerId &&
    state.attackToken === playerId &&
    !state.hasAttackedThisTurn &&
    state.players[playerId].bench.some((u) => isReadyToAttack(u))
  );
}

export function declareAttack(
  state: GameState,
  playerId: PlayerId,
  attackerIds: string[],
  challenges?: Record<string, string>,
  sentinelaTargets?: Record<string, string>,
): GameState {
  if (!canDeclareAttack(state, playerId) || attackerIds.length === 0) return state;
  const s = clone(state);
  const p = s.players[playerId];
  const enemy = s.players[other(playerId)];
  const blocks: Record<string, string> = {};
  const locked: string[] = [];
  const senTargets: Record<string, string> = {};

  for (const u of p.bench) {
    if (attackerIds.includes(u.instanceId) && isReadyToAttack(u)) u.isAttacking = true;
  }

  // Fire onAttack triggers for each declared attacker (before blockers are chosen).
  for (const u of p.bench) {
    if (u.isAttacking) {
      u.hasAttackedThisTurn = true;
      fireTrigger(s, u, "onAttack");
    }
  }

  if (challenges) {
    for (const [atkId, defId] of Object.entries(challenges)) {
      const atk = p.bench.find((u) => u.instanceId === atkId && u.isAttacking);
      const blocker = enemy.bench.find((u) => u.instanceId === defId);
      if (!atk || !blocker) continue;
      if (!hasKw(atk, "Challenger")) continue;
      if (!canBlock(atk, blocker)) continue;
      blocks[atkId] = defId;
      locked.push(atkId);
      s.log.push(`${getCard(atk.defId).name} challenges ${getCard(blocker.defId).name}!`);
    }
  }

  // Alvos de Sentinela: atacante mirado em uma sentinela inimiga.
  if (sentinelaTargets) {
    for (const [atkId, senId] of Object.entries(sentinelaTargets)) {
      const atk = p.bench.find((u) => u.instanceId === atkId && u.isAttacking);
      const sen = enemy.sentinelas.find((x) => x.instanceId === senId);
      if (!atk || !sen) continue;
      senTargets[atkId] = senId;
      s.log.push(`${getCard(atk.defId).name} ataca a Sentinela ${getCard(sen.defId).name}!`);
    }
  }

  s.combat = { attackerId: playerId, blocks, locked, sentinelaTargets: senTargets };
  s.phase = "blocking";
  s.log.push(`${p.name} declares an attack with ${attackerIds.length} unit(s).`);
  return s;
}

export function canBlock(attacker: UnitInstance, blocker: UnitInstance): boolean {
  // Imparável: só pode ser bloqueado por outro Imparável.
  if (hasKw(attacker, "Unblockable") && !hasKw(blocker, "Unblockable")) return false;
  // Evasivo: bloqueável por Evasivo ou Alcance.
  if (hasKw(attacker, "Elusive") && !hasKw(blocker, "Elusive") && !hasKw(blocker, "Reach")) return false;
  // Voo: bloqueável por Voo ou Alcance.
  if (hasKw(attacker, "Flying") && !hasKw(blocker, "Flying") && !hasKw(blocker, "Reach")) return false;
  // Assustador: bloqueável só por criaturas com poder ≥ 3.
  if (hasKw(attacker, "Fearsome") && blocker.power < 3) return false;
  return true;
}

function strikeUnit(
  state: GameState,
  source: UnitInstance,
  target: UnitInstance,
): void {
  const targetHealthBefore = target.health;
  const dealt = applyDamageToUnit(target, source.power, source);
  let overflow = 0;
  if (hasKw(source, "Overwhelm")) {
    if (target.health < 0) {
      overflow = -target.health;
    } else if (hasKw(source, "Deathtouch") && dealt > 0) {
      // Deathtouch sets health exactly to 0, so traditional target.health < 0
      // never triggers. For Overwhelm+Deathtouch, lethal assignment is 1 damage;
      // the rest tramples through.
      overflow = Math.max(0, source.power - Math.min(1, targetHealthBefore));
    }
  }
  if (overflow > 0) {
    damageNexus(state, other(source.owner), overflow, source.owner);
    // Poisonous + Overwhelm: o dano que transborda para o Nexus também envenena.
    if (hasKw(source, "Poisonous")) {
      poisonPlayer(state, other(source.owner), overflow);
    }
  }
  if (hasKw(source, "Lifesteal")) {
    healNexus(state, source.owner, dealt + overflow);
  }
  source.strikes += 1;
  source.hasStruck = true;
  fireTrigger(state, source, "onStrike");
  // Ephemeral units die after striking.
  if (hasKw(source, "Ephemeral") && source.health > 0) {
    source.health = 0;
    state.log.push(`${getCard(source.defId).name} fades away (Ephemeral).`);
  }
}

function strikeNexus(state: GameState, source: UnitInstance): void {
  damageNexus(state, other(source.owner), source.power, source.owner);
  if (hasKw(source, "Lifesteal")) {
    healNexus(state, source.owner, source.power);
  }
  // Poisonous (estilo Infect de Magic): dano direto ao Nexus inimigo também
  // dá contadores de veneno ao jogador, 1 por 1 com o dano causado.
  if (hasKw(source, "Poisonous") && source.power > 0) {
    poisonPlayer(state, other(source.owner), source.power);
  }
  source.strikes += 1;
  source.nexusStrikes += 1;
  source.hasStruck = true;
  state.log.push(`${getCard(source.defId).name} strikes the Nexus for ${source.power}.`);
  fireTrigger(state, source, "onStrike");
  fireTrigger(state, source, "onNexusStrike");
  if (hasKw(source, "Ephemeral") && source.health > 0) {
    source.health = 0;
    state.log.push(`${getCard(source.defId).name} fades away (Ephemeral).`);
  }
}

export function resolveCombat(
  state: GameState,
  blocks: Record<string, string>,
): GameState {
  const s = clone(state);
  if (!s.combat) return state;
  const attackerId = s.combat.attackerId;
  const defenderId = other(attackerId);
  const atkPlayer = s.players[attackerId];
  const defPlayer = s.players[defenderId];

  const merged: Record<string, string> = { ...s.combat.blocks, ...blocks };
  for (const lockedId of s.combat.locked) {
    if (s.combat.blocks[lockedId]) merged[lockedId] = s.combat.blocks[lockedId];
  }

  const attackers = atkPlayer.bench.filter((u) => u.isAttacking);
  const attackerIds = new Set(attackers.map((u) => u.instanceId));
  const validatedBlocks: Record<string, string> = {};
  const usedBlockersForTriggers = new Set<string>();

  // Validate the block map before firing any triggers. A hostile client must
  // never be able to invent an attacker key or reuse one blocker to fire
  // onBlock multiple times without an actual legal combat assignment.
  for (const [atkId, defId] of Object.entries(merged)) {
    if (!defId || !attackerIds.has(atkId) || usedBlockersForTriggers.has(defId)) continue;
    const atk = attackers.find((u) => u.instanceId === atkId);
    const blocker = defPlayer.bench.find((u) => u.instanceId === defId && u.health > 0);
    if (!atk || !blocker || !canBlock(atk, blocker)) continue;
    validatedBlocks[atkId] = defId;
    usedBlockersForTriggers.add(defId);
    fireTrigger(s, blocker, "onBlock");
  }

  const usedBlockers = new Set<string>();
  const senTargets = s.combat.sentinelaTargets ?? {};

  for (const atk of attackers) {
    if (atk.health <= 0) continue;

    // ORDEM CORRETA: primeiro checar blockers, depois sentinelaTargets.
    // Um atacante bloqueado NUNCA atinge a sentinela.
    const blockerId = validatedBlocks[atk.instanceId];
    let blocker =
      blockerId && !usedBlockers.has(blockerId)
        ? defPlayer.bench.find((u) => u.instanceId === blockerId && u.health > 0)
        : undefined;
    if (blocker && !canBlock(atk, blocker)) blocker = undefined;
    if (blocker) usedBlockers.add(blocker.instanceId);

    if (blocker) {
      s.log.push(`${getCard(atk.defId).name} is blocked by ${getCard(blocker.defId).name}.`);
      const fast = hasKw(atk, "QuickAttack") || hasKw(atk, "DoubleStrike");
      if (fast) {
        strikeUnit(s, atk, blocker);
        if (blocker.health > 0 && atk.health > 0) strikeUnit(s, blocker, atk);
      } else {
        strikeUnit(s, atk, blocker);
        strikeUnit(s, blocker, atk);
      }
      if (hasKw(atk, "DoubleStrike") && atk.health > 0 && blocker.health > 0) {
        strikeUnit(s, atk, blocker);
      } else if (hasKw(atk, "DoubleStrike") && atk.health > 0 && blocker.health <= 0 && hasKw(atk, "Overwhelm")) {
        strikeNexus(s, atk);
      }
    } else {
      // Sem blocker: checar se mira sentinela, senão vai pro nexus.
      const senId = senTargets[atk.instanceId];
      if (senId) {
        const sen = defPlayer.sentinelas.find((x) => x.instanceId === senId);
        if (sen) {
          const strikeSentinela = () => {
            sen.loyalty -= atk.power;
            s.log.push(`${getCard(atk.defId).name} atinge a Sentinela ${getCard(sen.defId).name} (${atk.power} de Lealdade).`);
            if (hasKw(atk, "Lifesteal")) healNexus(s, attackerId, atk.power);
            atk.strikes += 1;
            atk.hasStruck = true;
            fireTrigger(s, atk, "onStrike");
          };
          strikeSentinela();
          // Duplo Golpe: uma Sentinela sem bloqueador também recebe o segundo
          // golpe, igual já acontecia contra o Nexus.
          if (hasKw(atk, "DoubleStrike") && atk.health > 0) {
            strikeSentinela();
          }
        } else {
          strikeNexus(s, atk);
          if (hasKw(atk, "DoubleStrike") && atk.health > 0) {
            strikeNexus(s, atk);
          }
        }
      } else {
        // Sem blocker e sem sentinela alvo: dano ao nexus.
        strikeNexus(s, atk);
        if (hasKw(atk, "DoubleStrike") && atk.health > 0) {
          strikeNexus(s, atk);
        }
      }
    }
  }

  for (const u of atkPlayer.bench) {
    u.isAttacking = false;
    u.hasStruck = false;
  }
  for (const u of defPlayer.bench) u.hasStruck = false;

  cleanupDead(s);
  cleanupSentinelas(s);
  checkLevelUps(s);
  s.combat = null;
  s.phase = "main";
  s.hasAttackedThisTurn = true;
  checkWin(s);
  return s;
}

function endRound(state: GameState): void {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    firePermanentRoundStart(state, pid);
    for (const u of state.players[pid].bench) {
      // Ephemeral units die at end of round.
      if (hasKw(u, "Ephemeral") && u.health > 0) {
        u.health = 0;
        state.log.push(`${getCard(u.defId).name} fades away (Ephemeral).`);
      }
      if (hasKw(u, "Regeneration") && u.health > 0) u.health = u.maxHealth;
      // Reset Frostbite (and the temporary buff tracker it ignored).
      if (u.frostbitten) {
        u.frostbitten = false;
        recomputeStats(u);
      }
      // Reset Stun + summoning sickness + attack flags.
      u.stunned = false;
      u.summonedThisTurn = false;
      u.hasAttackedThisTurn = false;
      // NOTE: powerBuffs/healthBuffs from buffUnit/buffSelf/buffAllies/buffRace
      // are PERMANENT — card text never says "this round" for them (only
      // Frostbite/Stun are round-scoped, and those use dedicated fields).
      // Do NOT wipe them here; see engine.test.ts for a regression test.
      fireTrigger(state, u, "onRoundStart");
    }
  }
  cleanupDead(state);
  resetSentinelasActivation(state);
  checkLevelUps(state);

  state.round += 1;
  state.attackToken = other(state.attackToken);
  grantMana(state, "player");
  grantMana(state, "ai");
  drawCards(state, "player", 1);
  drawCards(state, "ai", 1);
  state.activePlayer = state.attackToken;
  state.phase = "main";
  state.hasAttackedThisTurn = false;
  state.log.push(
    `Round ${state.round} begins. ${state.players[state.attackToken].name} holds the Attack Token.`,
  );
  checkWin(state);
}

/** Mulligan: swap selected cards from hand back into deck, draw replacements. */
export function mulligan(state: GameState, playerId: PlayerId, cardIds: string[]): GameState {
  if (state.mulliganDone[playerId]) return state;
  const s = clone(state);
  const p = s.players[playerId];
  const toSwap = p.hand.filter((c) => cardIds.includes(c.instanceId));
  // Put them back into the deck.
  for (const c of toSwap) {
    p.deck.push(c.defId);
    p.hand = p.hand.filter((h) => h.instanceId !== c.instanceId);
  }
  // Shuffle deck.
  const next = nextRng(s.rngState);
  s.rngState = next.state;
  p.deck = shuffle(p.deck, Math.floor(next.value * 0xffffffff));
  // Draw replacements.
  drawCards(s, playerId, toSwap.length);
  s.mulliganDone[playerId] = true;
  s.log.push(`${p.name} mulligans ${toSwap.length} card(s).`);
  return s;
}

export function skipMulligan(state: GameState, playerId: PlayerId): GameState {
  if (state.mulliganDone[playerId]) return state;
  const s = clone(state);
  s.mulliganDone[playerId] = true;
  s.log.push(`${s.players[playerId].name} keeps their hand.`);
  return s;
}


export function endTurn(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "main" || state.activePlayer !== playerId) return state;
  const s = clone(state);
  if (s.activePlayer === s.attackToken) {
    s.activePlayer = other(s.attackToken);
    s.hasAttackedThisTurn = false;
    s.log.push(`${s.players[s.activePlayer].name}'s turn.`);
  } else {
    endRound(s);
  }
  return s;
}
