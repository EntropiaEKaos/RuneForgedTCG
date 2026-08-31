import { getCard } from "./cards";
import {
  activateSentinelaAbility,
  canActivateSentinela,
  canBlock,
  canCastReaction,
  canDeclareAttack,
  canPlayCard,
  castSpell,
  declareAttack,
  endTurn,
  isValidTarget,
  other,
  playUnit,
  resolveCombat,
  spellNeedsTarget,
} from "./engine";
import type { CardInstance, GameState, PlayerId, UnitInstance } from "./types";
import { seededFloat } from "./rng";
import { aiRulesFor } from "./match-rules";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";

/**
 * Every function in this file is parameterized by `playerId` (defaulting to
 * "ai" so every existing production call site — PvE opponent, /api/simulate,
 * the reducer, the authoritative replay engine — keeps working unchanged).
 *
 * This exists because these functions used to hardcode `state.players.ai`
 * and `"ai"` throughout. That was harmless as long as only the PvE opponent
 * ever called them — but it meant they could never be safely reused to drive
 * *either* side of a bot-vs-bot match (see fuzz.test.ts), and it was also the
 * root cause of a long-standing bug where the AI could never actually attack
 * or activate a Sentinela: applyAiAction only knew how to route "unit" and
 * "spell" actions to playUnit/castSpell, both of which look up instanceId in
 * the acting player's *hand* — so an action referencing a battlefield entity
 * (an existing unit attacking, or an existing Sentinela's ability) silently
 * no-opped, and because aiChooseAction returned early for those cases, the
 * AI would waste its entire turn doing nothing. Fixed here by parameterizing
 * every function by playerId and adding a real "sentinela" branch to
 * applyAiAction.
 */

// AiAction tipagem unificada com CardAction de engine.ts
export type AiAction = import("./engine").CardAction;

function effIncoming(source: UnitInstance, target: UnitInstance): number {
  let dmg = source.power;
  if (target.keywords.includes("Tough")) dmg = Math.max(0, dmg - 1);
  if (target.barrier) dmg = 0;
  return dmg;
}

export function aiChooseBlocks(state: GameState, playerId: PlayerId = "ai"): Record<string, string> {
  if (!state.combat) return {};
  const enemyId = other(playerId);
  const attackers = state.players[enemyId].bench.filter((u) => u.isAttacking);
  const blockers = [...state.players[playerId].bench];
  const used = new Set<string>();
  const blocks: Record<string, string> = { ...state.combat.blocks };

  for (const lockedId of state.combat.locked) {
    const bid = blocks[lockedId];
    if (bid) used.add(bid);
  }

  const unlocked = attackers.filter((a) => !state.combat!.locked.includes(a.instanceId));
  const sortedAttackers = [...unlocked].sort((a, b) => b.power - a.power);
  const myNexus = state.players[playerId].nexusHealth;
  const totalIncoming = attackers.reduce((sum, a) => sum + a.power, 0);
  const inDanger = myNexus - totalIncoming <= 0;
  const difficulty = state.aiDifficulty ?? "tactician";

  for (const atk of sortedAttackers) {
    const candidates = blockers.filter((b) => !used.has(b.instanceId) && canBlock(atk, b));
    if (candidates.length === 0) continue;

    if (difficulty === "apprentice") {
      const hesitation = seededFloat(state.seed, state.round * 97 + atk.power * 13 + candidates.length);
      if (!inDanger && hesitation < Math.max(0, Math.min(0.95, 0.38 / Math.max(0.1, aiRulesFor(state).aggressionScale)))) continue;
      const simple = candidates[0];
      blocks[atk.instanceId] = simple.instanceId;
      used.add(simple.instanceId);
      continue;
    }

    let choice =
      candidates.find(
        (b) => effIncoming(b, atk) >= atk.health && effIncoming(atk, b) < b.health,
      ) ?? candidates.find((b) => effIncoming(b, atk) >= atk.health);

    if (!choice && inDanger) {
      choice = [...candidates].sort((a, b) => b.health - a.health)[0];
    }

    if (choice) {
      blocks[atk.instanceId] = choice.instanceId;
      used.add(choice.instanceId);
    }
  }
  return blocks;
}

export function aiDefend(state: GameState, playerId: PlayerId = "ai"): GameState {
  const blocks = aiChooseBlocks(state, playerId);
  return resolveCombat(state, blocks);
}

function bestEnemyTarget(state: GameState, playerId: PlayerId): UnitInstance | undefined {
  const enemyId = other(playerId);
  return [...state.players[enemyId].bench]
    .filter((unit) => isValidTarget(state, playerId, "enemyUnit", { kind: "unit", owner: enemyId, unit }))
    .sort((a, b) => b.power - a.power)[0];
}

function bestAllyTarget(state: GameState, playerId: PlayerId): UnitInstance | undefined {
  const bench = [...state.players[playerId].bench];
  const damaged = bench.filter((u) => u.health < u.maxHealth).sort((a, b) => b.power - a.power);
  if (damaged.length) return damaged[0];
  return bench.sort((a, b) => b.power - a.power)[0];
}

function sentinelaAbilityTarget(state: GameState, playerId: PlayerId, target: import("./types").TargetKind): string | undefined {
  const enemyId = other(playerId);
  if (target === "none" || target === "self" || target === "spellOnStack") return undefined;
  if (target === "enemyUnit") return bestEnemyTarget(state, playerId)?.instanceId;
  if (target === "allyUnit") return bestAllyTarget(state, playerId)?.instanceId;
  if (target === "anyUnit") return bestEnemyTarget(state, playerId)?.instanceId ?? bestAllyTarget(state, playerId)?.instanceId;
  if (target === "enemyPermanent") return state.players[enemyId].permanents[0]?.instanceId;
  if (target === "allyPermanent") return state.players[playerId].permanents[0]?.instanceId;
  if (target === "anyPermanent") return state.players[enemyId].permanents[0]?.instanceId ?? state.players[playerId].permanents[0]?.instanceId;
  if (target === "enemySentinela") return [...state.players[enemyId].sentinelas].sort((a,b)=>a.loyalty-b.loyalty)[0]?.instanceId;
  if (target === "allySentinela") return [...state.players[playerId].sentinelas].sort((a,b)=>a.loyalty-b.loyalty)[0]?.instanceId;
  if (target === "anySentinela") return [...state.players[enemyId].sentinelas].sort((a,b)=>a.loyalty-b.loyalty)[0]?.instanceId ?? [...state.players[playerId].sentinelas].sort((a,b)=>a.loyalty-b.loyalty)[0]?.instanceId;
  if (target === "anyBoard") return bestEnemyTarget(state, playerId)?.instanceId ?? state.players[enemyId].permanents[0]?.instanceId ?? state.players[enemyId].sentinelas[0]?.instanceId ?? bestAllyTarget(state, playerId)?.instanceId;
  return undefined;
}

function sentinelaAbilityUseful(state: GameState, playerId: PlayerId, effect: import("./types").CardEffect, targetId?: string): boolean {
  const me = state.players[playerId], enemy = state.players[other(playerId)];
  const needsTarget = effect.target !== "none" && effect.target !== "self" && effect.target !== "spellOnStack";
  if (needsTarget && !targetId) return false;
  if (effect.kind === "healNexus") return me.nexusHealth < 20;
  if (effect.kind === "healUnit") return me.bench.some((u)=>u.health<u.maxHealth);
  if (effect.kind === "buffAllies" || (effect.kind === "grantBarrier" && effect.target === "none") || (effect.kind === "grantKeyword" && effect.target === "none")) return me.bench.length > 0;
  if (effect.kind === "aoeEnemy") return enemy.bench.length + enemy.permanents.length > 0;
  if (effect.kind === "summonToken") return me.bench.length < 6;
  if (effect.kind === "draw") return me.hand.length < 9;
  return true;
}

/** Chooses a meaningful Sentinela activation for either side. Exported so the
 * balance simulator can use the exact same loyalty policy symmetrically. */
export function aiChooseSentinelaAction(state: GameState, playerId: PlayerId = "ai"): AiAction | null {
  if (state.phase !== "main" || state.activePlayer !== playerId) return null;
  const me = state.players[playerId];
  const enemy = state.players[other(playerId)];
  for (const sen of me.sentinelas) {
    if (sen.activatedThisTurn) continue;
    const def = getCard(sen.defId);
    const abilities = def.sentinela?.abilities ?? [];

    // Lethal loyalty abilities take precedence.
    for (let i=0;i<abilities.length;i++) {
      const ab=abilities[i];
      if (ab.cost >= 0 || ab.effect.kind !== "damageNexus" || ab.effect.amount < enemy.nexusHealth) continue;
      if (canActivateSentinela(state, playerId, sen.instanceId, i)) return { kind:"sentinela", instanceId:sen.instanceId, defId:sen.defId, abilityIndex:i };
    }

    // Spend loyalty on the strongest useful minus ability when available.
    const minus = abilities.map((ab,i)=>({ab,i})).filter(({ab})=>ab.cost<0).sort((a,b)=>a.ab.cost-b.ab.cost);
    for (const {ab,i} of minus) {
      if (!canActivateSentinela(state, playerId, sen.instanceId, i)) continue;
      const targetInstanceId = sentinelaAbilityTarget(state, playerId, ab.effect.target);
      if (!sentinelaAbilityUseful(state, playerId, ab.effect, targetInstanceId)) continue;
      return { kind:"sentinela", instanceId:sen.instanceId, defId:sen.defId, abilityIndex:i, targetInstanceId };
    }

    // Otherwise build loyalty with the first usable plus ability.
    for (let i=0;i<abilities.length;i++) {
      const ab=abilities[i]; if (ab.cost<=0 || !canActivateSentinela(state, playerId, sen.instanceId, i)) continue;
      const targetInstanceId = sentinelaAbilityTarget(state, playerId, ab.effect.target);
      if (!sentinelaAbilityUseful(state, playerId, ab.effect, targetInstanceId)) continue;
      return { kind:"sentinela", instanceId:sen.instanceId, defId:sen.defId, abilityIndex:i, targetInstanceId };
    }
  }
  return null;
}

function pickChallenges(state: GameState, playerId: PlayerId, attackerIds: string[]): Record<string, string> {
  const challenges: Record<string, string> = {};
  const used = new Set<string>();
  const enemies = [...state.players[other(playerId)].bench].sort((a, b) => b.power - a.power);
  for (const id of attackerIds) {
    const atk = state.players[playerId].bench.find((u) => u.instanceId === id);
    if (!atk || !atk.keywords.includes("Challenger")) continue;
    const prey = enemies.find((e) => !used.has(e.instanceId) && canBlock(atk, e));
    if (prey) {
      challenges[atk.instanceId] = prey.instanceId;
      used.add(prey.instanceId);
    }
  }
  return challenges;
}

/** Chooses ONE main-phase action for `playerId` (defaults to "ai"), without applying it. */
export function aiChooseAction(state: GameState, playerId: PlayerId = "ai"): AiAction | null {
  const me = state.players[playerId];
  const enemyId = other(playerId);
  const activatedAction = aiChooseActivatedAbilityAction(state, playerId);
  if (activatedAction) return activatedAction;
  const playable = me.hand.filter((c) => canPlayCard(state, playerId, c.instanceId));
  if (playable.length === 0) return null;
  const difficulty = state.aiDifficulty ?? "tactician";

  if (difficulty === "apprentice") {
    const simpleUnit = playable
      .map((card) => ({ card, def: getCard(card.defId) }))
      .filter(({ def }) => def.type === "Unit")
      .sort((a, b) => a.def.cost - b.def.cost)[0];
    if (simpleUnit) return { kind: "unit", instanceId: simpleUnit.card.instanceId, defId: simpleUnit.def.defId };
    const simpleSpell = playable.find((card) => getCard(card.defId).type === "Spell" && !spellNeedsTarget(card.defId));
    if (simpleSpell) return { kind: "spell", instanceId: simpleSpell.instanceId, defId: simpleSpell.defId };
  }

  const enemyNexus = state.players[enemyId].nexusHealth;

  for (const c of playable) {
    const def = getCard(c.defId);
    if (def.spell?.kind === "damageNexus" && enemyNexus <= def.spell.amount) {
      return { kind: "spell", instanceId: c.instanceId, defId: def.defId };
    }
  }

  const enemyThreat = state.players[enemyId].bench
    .filter((u) => u.power >= 3)
    .sort((a, b) => b.power - a.power)[0];
  if (enemyThreat) {
    for (const c of playable) {
      const def = getCard(c.defId);
      const targetKind = spellNeedsTarget(def.defId);
      const canTargetThreat = targetKind
        ? isValidTarget(state, playerId, targetKind, { kind: "unit", owner: enemyId, unit: enemyThreat })
        : false;
      if (def.spell?.kind === "damageUnit" && canTargetThreat && def.spell.amount >= enemyThreat.health) {
        return {
          kind: "spell",
          instanceId: c.instanceId,
          defId: def.defId,
          targetInstanceId: enemyThreat.instanceId,
        };
      }
    }
  }

  // Destroy enemy permanents when they exist.
  const enemyPerm = state.players[enemyId].permanents[0];
  if (enemyPerm) {
    for (const c of playable) {
      const def = getCard(c.defId);
      const targetKind = spellNeedsTarget(def.defId);
      const canTargetPermanent = targetKind
        ? isValidTarget(state, playerId, targetKind, { kind: "permanent", owner: enemyId, perm: enemyPerm })
        : false;
      if ((def.spell?.kind === "destroyPermanent" || def.spell?.kind === "damagePermanent") && canTargetPermanent) {
        return {
          kind: "spell",
          instanceId: c.instanceId,
          defId: def.defId,
          targetInstanceId: enemyPerm.instanceId,
        };
      }
    }
  }

  // ── SENTINELAS ──
  // 1. Jogar sentinela da própria mão se tiver mana e slot vazio.
  const senCards = playable.map((c) => ({ c, def: getCard(c.defId) })).filter((x) => x.def.type === "Sentinela");
  if (senCards.length > 0 && me.sentinelas.length < 2) {
    const best = senCards.sort((a, b) => b.def.cost - a.def.cost)[0];
    return { kind: "unit", instanceId: best.c.instanceId, defId: best.def.defId };
  }

  // 2. Atacar sentinela inimiga quando lealdade é baixa. This is an ATTACK
  // decision, not a card play — it cannot be expressed as a playUnit/
  // castSpell action (the attacker is already on the battlefield, not in
  // hand). aiChooseAction only *chooses* the action; the actual attack
  // declaration happens in aiResolveTurnEnd via declareAttack's
  // sentinelaTargets parameter, which reads enemy sentinela loyalty itself.
  // Returning null here (falling through) lets that logic run instead of
  // returning a bogus "unit" action that would silently no-op.
  const enemySen = state.players[enemyId].sentinelas.find((s) => s.loyalty <= 3);

  // 4. Damage spells em sentinelas inimigas, but only when the card's target
  // contract actually permits a Sentinela. `damageUnit` is an effect kind,
  // not permission to bypass the card's TargetKind.
  if (enemySen) {
    for (const c of playable) {
      const def = getCard(c.defId);
      const targetKind = spellNeedsTarget(def.defId);
      const canTargetSentinela = targetKind
        ? isValidTarget(state, playerId, targetKind, { kind: "sentinela", owner: enemyId, sen: enemySen })
        : false;
      if (def.spell?.kind === "damageUnit" && canTargetSentinela && def.spell.amount >= enemySen.loyalty) {
        return {
          kind: "spell",
          instanceId: c.instanceId,
          defId: def.defId,
          targetInstanceId: enemySen.instanceId,
        };
      }
    }
  }

  const smallEnemies = state.players[enemyId].bench.filter((u) => u.health <= 2).length;
  if (smallEnemies >= 2) {
    for (const c of playable) {
      const def = getCard(c.defId);
      if (def.spell?.kind === "aoeEnemy") {
        return { kind: "spell", instanceId: c.instanceId, defId: def.defId };
      }
    }
  }

  // 3b. Play enchantments/artifacts if we have room.
  const perms = playable
    .map((c) => ({ c, def: getCard(c.defId) }))
    .filter((x) => x.def.type === "Enchantment" || x.def.type === "Artifact")
    .sort((a, b) => b.def.cost - a.def.cost);
  if (perms.length > 0 && me.permanents.length < 4) {
    return { kind: "unit", instanceId: perms[0].c.instanceId, defId: perms[0].def.defId };
  }

  // 4. Develop the board — play the most expensive affordable unit.
  const units = playable
    .map((c) => ({ c, def: getCard(c.defId) }))
    .filter((x) => x.def.type === "Unit")
    .sort((a, b) => {
      const champBonus = a.def.isChampion === b.def.isChampion ? 0 : a.def.isChampion ? -1 : 1;
      if (champBonus !== 0) return champBonus;
      return b.def.cost - a.def.cost;
    });
  if (units.length > 0) {
    return { kind: "unit", instanceId: units[0].c.instanceId, defId: units[0].def.defId };
  }

  // 4b. Equip our best unit if it has no equipment.
  const equips = playable
    .map((c) => ({ c, def: getCard(c.defId) }))
    .filter((x) => x.def.type === "Equipment")
    .sort((a, b) => b.def.cost - a.def.cost);
  if (equips.length > 0) {
    const target = me.bench
      .filter((u) => u.equipment.length < 2)
      .sort((a, b) => b.power - a.power)[0];
    if (target) {
      return {
        kind: "unit",
        instanceId: equips[0].c.instanceId,
        defId: equips[0].def.defId,
        targetInstanceId: target.instanceId,
      };
    }
  }

  const myLow = me.nexusHealth <= Math.round(8 * Math.max(0.5, aiRulesFor(state).valueScale));
  for (const c of playable) {
    const def = getCard(c.defId);
    if (!def.spell) continue;
    if (def.spell.kind === "healNexus" && myLow) {
      return { kind: "spell", instanceId: c.instanceId, defId: def.defId };
    }
    if (def.spell.kind === "draw" && me.hand.length <= 5) {
      return { kind: "spell", instanceId: c.instanceId, defId: def.defId };
    }
    const target = bestAllyTarget(state, playerId);
    if ((def.spell.kind === "buffUnit" || def.spell.kind === "grantBarrier") && target) {
      const targetKind = spellNeedsTarget(def.defId);
      const canTargetAlly = targetKind
        ? isValidTarget(state, playerId, targetKind, { kind: "unit", owner: playerId, unit: target })
        : false;
      if (target.power >= 2 && canTargetAlly) {
        return { kind: "spell", instanceId: c.instanceId, defId: def.defId, targetInstanceId: target.instanceId };
      }
    }
    if (def.spell.kind === "healUnit") {
      const dmgAlly = me.bench.find((u) => u.health < u.maxHealth);
      const targetKind = spellNeedsTarget(def.defId);
      const canTargetAlly = dmgAlly && targetKind
        ? isValidTarget(state, playerId, targetKind, { kind: "unit", owner: playerId, unit: dmgAlly })
        : false;
      if (dmgAlly && canTargetAlly) {
        return { kind: "spell", instanceId: c.instanceId, defId: def.defId, targetInstanceId: dmgAlly.instanceId };
      }
    }
    if (def.spell.kind === "damageUnit") {
      const t = bestEnemyTarget(state, playerId);
      const targetKind = spellNeedsTarget(def.defId);
      const canTargetEnemy = t && targetKind
        ? isValidTarget(state, playerId, targetKind, { kind: "unit", owner: enemyId, unit: t })
        : false;
      if (t && t.power >= 3 && canTargetEnemy) {
        return { kind: "spell", instanceId: c.instanceId, defId: def.defId, targetInstanceId: t.instanceId };
      }
    }
  }

  return null;
}

export function applyAiAction(state: GameState, a: AiAction, playerId: PlayerId = "ai"): GameState {
  if (a.kind === "unit") return playUnit(state, playerId, a.instanceId, a.targetInstanceId);
  if (a.kind === "sentinela") {
    return activateSentinelaAbility(state, playerId, a.instanceId, a.abilityIndex ?? 0, a.targetInstanceId);
  }
  return castSpell(state, playerId, a.instanceId, a.targetInstanceId);
}

/**
 * Stack-aware AI action: lets the AI brain decide whether to counter an
 * opposing player action and resolves the full LIFO stack in one call.
 * Used by the server reducer and /api/simulate so counterspells actually
 * negate their target off the same code path as the live client.
 */
export { applyStackedAction, applyStackedActionWithAi } from "./engine";

/** Decides whether (and how) `playerId` (defaults to "ai") reacts to `action`, using reaction spells. */
import type { CardAction } from "./engine";
export function aiChooseReaction(state: GameState, action: CardAction, playerId: PlayerId = "ai"): AiAction | null {
  const enemyId = other(playerId);
  const me = state.players[playerId];
  const candidates: CardInstance[] = me.hand.filter((c) => {
    const d = getCard(c.defId);
    if (d.type !== "Spell" || !d.speed) return false;
    if (action.kind === "spell" && d.speed !== "Burst") return false;
    // Use canCastReaction so the AI can counter even on the opponent's turn
    // (canPlayCard rejects when state.activePlayer !== playerId).
    return canCastReaction(state, playerId, c.instanceId, action.kind);
  });
  if (candidates.length === 0) return null;

  const pick = (c: CardInstance, target?: string): AiAction => ({
    kind: "spell",
    instanceId: c.instanceId,
    defId: c.defId,
    targetInstanceId: target,
  });

  if (action.kind === "unit" && action.playedInstanceId) {
    const played = state.players[enemyId].bench.find((u) => u.instanceId === action.playedInstanceId);
    if (played) {
      for (const c of candidates) {
        const d = getCard(c.defId);
        if (d.spell?.kind === "damageUnit" && spellNeedsTarget(d.defId) && d.spell.amount >= played.health) {
          return pick(c, played.instanceId);
        }
      }
      if (played.power >= 4) {
        const veil = candidates.find(
          (c) => getCard(c.defId).spell?.kind === "buffUnit" && (getCard(c.defId).spell?.buffPower ?? 0) < 0,
        );
        if (veil) return pick(veil, played.instanceId);
        const shield = candidates.find((c) => getCard(c.defId).spell?.kind === "grantBarrier");
        const ally = bestAllyTarget(state, playerId);
        if (shield && ally && seededFloat(state.seed, state.round * 131 + me.hand.length * 17 + state.players[enemyId].bench.length) < Math.max(0, Math.min(1, 0.65 * aiRulesFor(state).valueScale))) return pick(shield, ally.instanceId);
      }
    }
  }

  if (action.kind === "spell" && action.targetInstanceId) {
    const acted = getCard(action.defId);
    const t = me.bench.find((u) => u.instanceId === action.targetInstanceId);
    if (t && acted.spell?.kind === "damageUnit" && acted.spell.amount >= t.health) {
      const shield = candidates.find((c) => getCard(c.defId).spell?.kind === "grantBarrier");
      if (shield) return pick(shield, t.instanceId);
      const ward = candidates.find((c) => getCard(c.defId).spell?.kind === "grantKeyword");
      if (ward) return pick(ward, t.instanceId);
    }
  }

  // AI Counterspell Logic: Negate dangerous player spells.
  if (action.kind === "spell") {
    const card = getCard(action.defId);
    const isDangerous =
      card.spell?.kind === "damageUnit" ||
      card.spell?.kind === "damageNexus" ||
      card.spell?.kind === "aoeEnemy" ||
      card.spell?.kind === "buffUnit" ||
      card.spell?.kind === "destroyPermanent" ||
      card.spell?.kind === "negateSpell"; // Countering a Counterspell!

    if (isDangerous) {
      const counter = candidates.find((c) => getCard(c.defId).spell?.kind === "negateSpell");
      if (counter) {
        return pick(counter, action.instanceId);
      }
    }
  }

  return null;
}

/** After `playerId` (defaults to "ai") is done playing cards: attack enemy
 *  units/sentinelas (if it has the token) or end its turn. */
export function aiResolveTurnEnd(state: GameState, playerId: PlayerId = "ai"): GameState {
  let s = state;
  const enemyId = other(playerId);
  if (canDeclareAttack(s, playerId)) {
    const difficulty = s.aiDifficulty ?? "tactician";
    const attackers = s.players[playerId].bench;
    const enemyBoard = s.players[enemyId].bench;
    const behind = difficulty !== "overlord" && attackers.length < enemyBoard.length && s.players[playerId].nexusHealth < Math.round(10 / Math.max(0.25, aiRulesFor(state).aggressionScale));
    const chosen = attackers.filter((u) => {
      if (difficulty === "apprentice" && seededFloat(s.seed, s.round * 83 + u.power * 17 + u.health) < Math.max(0, Math.min(0.95, 0.3 + aiRulesFor(state).randomness - aiRulesFor(state).aggressionScale * 0.05))) return false;
      if (u.keywords.includes("Elusive") || u.keywords.includes("Fearsome") || u.isChampion) {
        return true;
      }
      if (!behind) return true;
      const worst = [...enemyBoard].sort((a, b) => b.power - a.power)[0];
      return !worst || effIncoming(worst, u) < u.health;
    });
    if (chosen.length > 0) {
      const ids = chosen.map((u) => u.instanceId);
      // Point any attacker strong enough to kill a low-loyalty enemy
      // Sentinela at it instead of the nexus/blockers — this is the real
      // fix for "AI never attacks Sentinelas": it belongs in the attack
      // declaration, not in aiChooseAction (which only picks card plays).
      const sentinelaTargets: Record<string, string> = {};
      const lowSentinela = s.players[enemyId].sentinelas.find((sen) => sen.loyalty <= 3);
      if (lowSentinela) {
        const killer = chosen.find((u) => u.power >= lowSentinela.loyalty);
        if (killer) sentinelaTargets[killer.instanceId] = lowSentinela.instanceId;
      }
      const attacked = declareAttack(s, playerId, ids, pickChallenges(s, playerId, ids), sentinelaTargets);
      if (attacked.phase === "blocking") return attacked;
      s = attacked;
    }
  }
  return endTurn(s, playerId);
}
