import { getCard } from "../cards";
import { canAttachEquipment, unitsWithEquipmentCapacity } from "../equipment-link-contract";
import { grantDurableKeyword } from "../permanent-aura-contract";
import type { CardEffect, GameState, PermanentInstance, PlayerId, Race, SentinelaInstance, TriggerWhen, UnitInstance } from "../types";
import { engineRulesFor } from "../match-rules";
import { applyDamageToPermanent, applyDamageToSentinela, applyDamageToUnit, autoTarget, checkWin, clone, damageNexus, drawCards, findAnyBoardEntity, findPermanent, findSentinela, findUnit, hasClass, hasKw, hasRace, healNexus, makeUnit, other, poisonPlayer, recomputeContinuousAuras, recomputeHealth, recomputeStats, uid, unitClasses, unitRaces } from "./state";
import { cleanupSentinelas } from "./sentinela-state";

export function cleanupDeadUnit(state: GameState, pid: PlayerId, unit: UnitInstance): boolean {
  if (unit.health > 0) return false;
  const p = state.players[pid];
  const killer = other(pid);

  // Last Breath (onDeath) — fires before removal.
  if (unit.lastBreath || hasKw(unit, "LastBreath")) {
    fireTrigger(state, unit, "onDeath");
  }

  // Only the unit that dealt the killing blow triggers onKill.
  // Spell kills (killedBy === null) trigger no one's onKill.
  if (unit.killedBy) {
    const actualKiller = state.players[killer].bench.find((u) => u.instanceId === unit.killedBy);
    if (actualKiller) {
      fireTrigger(state, actualKiller, "onKill");
    }
  }

  for (const u of p.bench) {
    if (u.instanceId !== unit.instanceId && u.health > 0) {
      fireTrigger(state, u, "onAllyDeath");
    }
  }

  for (const eq of unit.equipment) {
    state.log.push(`${getCard(eq.defId).name} falls with ${getCard(unit.defId).name}.`);
  }
  p.bench = p.bench.filter((u) => u.instanceId !== unit.instanceId);
  return true;
}

export function cleanupDead(state: GameState): void {
  // A source-bound +Health Aura can make another unit die exactly when the
  // source leaves. Iterate cleanup + Aura derivation until the board is stable.
  for (let pass = 0; pass < 16; pass += 1) {
    for (const pid of ["player", "ai"] as PlayerId[]) {
      const p = state.players[pid];
      const dead = p.bench.filter((u) => u.health <= 0);
      for (const d of dead) {
        cleanupDeadUnit(state, pid, d);
        state.log.push(`${getCard(d.defId).name} is destroyed.`);
      }
      const permDead = p.permanents.filter((perm) => perm.health <= 0);
      for (const d of permDead) {
        state.log.push(`${getCard(d.defId).name} is destroyed.`);
      }
      p.permanents = p.permanents.filter((perm) => perm.health > 0);
    }

    recomputeContinuousAuras(state);
    const unstable = (["player", "ai"] as PlayerId[]).some((pid) =>
      state.players[pid].bench.some((unit) => unit.health <= 0) ||
      state.players[pid].permanents.some((perm) => perm.health <= 0),
    );
    if (!unstable) return;
  }
  state.log.push("Continuous-effect cleanup reached its safety boundary.");
}

export function applyCardEffectForSandbox(
  state: GameState,
  playerId: PlayerId,
  effect: CardEffect,
  explicitTargetId?: string,
  self?: UnitInstance,
): GameState {
  const next = clone(state);
  applyEffect(next, playerId, effect, explicitTargetId, self);
  return next;
}

export function applyEffect(
  state: GameState,
  playerId: PlayerId,
  effect: CardEffect,
  explicitTargetId?: string,
  self?: UnitInstance,
): void {
  let cursor: CardEffect | undefined = effect;
  while (cursor) {
    const eff: CardEffect = cursor;
    const ent = explicitTargetId ? findAnyBoardEntity(state, explicitTargetId) : null;

    switch (eff.kind) {
      case "damageUnit": {
        if (ent && ent.kind === "unit") {
          applyDamageToUnit(ent.unit, eff.amount);
        } else if (ent && ent.kind === "permanent") {
          applyDamageToPermanent(ent.perm, eff.amount);
        } else if (ent && ent.kind === "sentinela") {
          applyDamageToSentinela(state, ent.sen.instanceId, eff.amount);
          cleanupSentinelas(state);
        } else {
          const t = autoTarget(state, playerId, eff.target, self, eff.race);
          if (t) {
            if ("equipment" in t) applyDamageToUnit(t as UnitInstance, eff.amount);
            else if ("permanentType" in t) applyDamageToPermanent(t as PermanentInstance, eff.amount);
            else if ("loyalty" in t) { applyDamageToSentinela(state, (t as SentinelaInstance).instanceId, eff.amount); cleanupSentinelas(state); }
          }
        }
        break;
      }
      case "damageNexus": {
        damageNexus(state, other(playerId), eff.amount, playerId);
        break;
      }
      case "aoeEnemy": {
        for (const u of state.players[other(playerId)].bench) applyDamageToUnit(u, eff.amount);
        for (const p of state.players[other(playerId)].permanents) applyDamageToPermanent(p, eff.amount);
        break;
      }
      case "healUnit": {
        const target = ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self);
        if (target && "equipment" in target) {
          target.health = Math.min(target.maxHealth, target.health + eff.amount);
        }
        break;
      }
      case "healNexus": {
        healNexus(state, playerId, eff.amount);
        break;
      }
      case "buffUnit":
      case "buffSelf": {
        const t =
          eff.kind === "buffSelf"
            ? self
            : (ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self));
        if (t && "equipment" in t) {
          const unit = t as UnitInstance;
          const healthGain = eff.buffHealth ?? 0;
          unit.powerBuffs += eff.buffPower ?? 0;
          unit.healthBuffs += healthGain;
          recomputeStats(unit);
          recomputeHealth(unit);
          if (healthGain > 0) {
            unit.health += healthGain;
          }
        }
        break;
      }
      case "buffAllies": {
        const races = eff.races ?? (eff.race ? [eff.race] : undefined);
        for (const u of state.players[playerId].bench) {
          if (!hasRace(u, races)) continue;
          const healthGain = eff.buffHealth ?? 0;
          u.powerBuffs += eff.buffPower ?? 0;
          u.healthBuffs += healthGain;
          recomputeStats(u);
          recomputeHealth(u);
          if (healthGain > 0) {
            u.health += healthGain;
          }
        }
        break;
      }
      case "buffClass": {
        const classes = eff.classKeys ?? (eff.classKey ? [eff.classKey] : undefined);
        for (const u of state.players[playerId].bench) {
          if (!hasClass(u, classes)) continue;
          const healthGain = eff.buffHealth ?? 0;
          u.powerBuffs += eff.buffPower ?? 0;
          u.healthBuffs += healthGain;
          recomputeStats(u);
          recomputeHealth(u);
          if (healthGain > 0) u.health += healthGain;
        }
        break;
      }
      case "buffRace": {
        const races = eff.races ?? (eff.race ? [eff.race] : undefined);
        for (const u of state.players[playerId].bench) {
          if (!hasRace(u, races)) continue;
          const healthGain = eff.buffHealth ?? 0;
          u.powerBuffs += eff.buffPower ?? 0;
          u.healthBuffs += healthGain;
          recomputeStats(u);
          recomputeHealth(u);
          if (healthGain > 0) {
            u.health += healthGain;
          }
        }
        break;
      }
      case "grantBarrier": {
        if (eff.target === "none") {
          const races = eff.races ?? (eff.race ? [eff.race] : undefined);
          for (const unit of state.players[playerId].bench) {
            if (!hasRace(unit, races)) continue;
            unit.barrier = true;
            grantDurableKeyword(unit, "Barrier");
          }
        } else {
          const candidate = eff.target === "self" ? self : (ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self));
          if (candidate && "equipment" in candidate) {
            candidate.barrier = true;
            grantDurableKeyword(candidate, "Barrier");
          }
        }
        break;
      }
      case "grantKeyword": {
        if (eff.target === "none") {
          const races = eff.races ?? (eff.race ? [eff.race] : undefined);
          for (const u of state.players[playerId].bench) {
            if (!hasRace(u, races)) continue;
            if (eff.keyword) {
              grantDurableKeyword(u, eff.keyword);
              if (eff.keyword === "Barrier") u.barrier = true;
            }
          }
        } else {
          const candidate = eff.target === "self" ? self : (ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self));
          if (candidate && "equipment" in candidate && eff.keyword) {
            grantDurableKeyword(candidate, eff.keyword);
            if (eff.keyword === "Barrier") candidate.barrier = true;
          }
        }
        break;
      }
      case "draw": {
        // Optional race gate: require at least one matching ally (or self match).
        if (eff.race || eff.races) {
          const races = eff.races ?? (eff.race ? [eff.race] : undefined);
          const ok =
            (self && hasRace(self, races)) ||
            state.players[playerId].bench.some((u) => hasRace(u, races));
          if (!ok) break;
        }
        drawCards(state, playerId, eff.amount);
        break;
      }
      case "summonToken": {
        const p = state.players[playerId];
        if (eff.tokenDefId && p.bench.length < engineRulesFor(state).benchCap) {
          const token = makeUnit(state, eff.tokenDefId, playerId);
          p.bench.push(token);
          p.stats.alliesSummoned += 1;
          state.log.push(`${p.name} summons ${getCard(token.defId).name}.`);
          fireTrigger(state, token, "onSummon");
        }
        break;
      }
      case "attachEquipment": {
        const p = state.players[playerId];
        if (eff.equipmentDefId) {
          const eqDef = getCard(eff.equipmentDefId);
          if (!eqDef.equipment) break;
          let targetUnit: UnitInstance | undefined;
          if (ent) {
            if (ent.kind !== "unit" || ent.owner !== playerId || !canAttachEquipment(ent.unit)) break;
            targetUnit = ent.unit;
          } else {
            const races = eff.races ?? (eff.race ? [eff.race] : undefined);
            const allies = unitsWithEquipmentCapacity(p.bench.filter((u) => hasRace(u, races)));
            targetUnit = [...allies].sort((a, b) => b.power - a.power)[0];
          }
          if (targetUnit && eqDef.equipment) {
            const slot = { instanceId: uid(state, "eq"), defId: eqDef.defId };
            const healthGain = eqDef.equipment.buffHealth;
            targetUnit.equipment.push(slot);
            for (const k of eqDef.equipment.keywords ?? []) {
              grantDurableKeyword(targetUnit, k);
            }
            if (targetUnit.keywords.includes("Barrier")) targetUnit.barrier = true;
            // Recompute base from definition + equipment, then keep current buffs.
            recomputeStats(targetUnit);
            recomputeHealth(targetUnit);
            // Equipment's health bonus also raises current health (not just max).
            targetUnit.health += healthGain;
            if (targetUnit.health > targetUnit.maxHealth) targetUnit.health = targetUnit.maxHealth;
            state.log.push(`${p.name} equips ${eqDef.name} onto ${getCard(targetUnit.defId).name}.`);
          }
        }
        break;
      }
      case "manaRefund": {
        // If filtered by race and self is provided, only refund if self's race matches.
        if ((eff.race || eff.races) && self && !hasRace(self, eff.races ?? eff.race)) break;
        const p = state.players[playerId];
        p.mana = Math.min(p.maxMana, p.mana + eff.amount);
        break;
      }
      case "drawOnSummon": {
        const races = eff.races ?? (eff.race ? [eff.race] : undefined);
        if (races) {
          const count = state.players[playerId].bench.filter((u) => hasRace(u, races)).length;
          const cards = Math.min((eff.amount || 1) * Math.max(0, count), 4);
          if (cards > 0) drawCards(state, playerId, cards);
        } else {
          // Unique races among your units.
          const unique = new Set<string>();
          for (const u of state.players[playerId].bench) {
            for (const r of u.races) unique.add(r);
          }
          const cards = Math.min(unique.size * Math.max(1, eff.amount || 1), 3);
          if (cards > 0) drawCards(state, playerId, cards);
        }
        break;
      }
      case "destroyPermanent": {
        if (ent && ent.kind === "permanent") {
          ent.perm.health = 0;
        } else {
          const t = autoTarget(state, playerId, eff.target || "enemyPermanent", self);
          if (t && !("equipment" in t)) {
            (t as PermanentInstance).health = 0;
          }
        }
        break;
      }
      case "damagePermanent": {
        if (ent && ent.kind === "permanent") {
          applyDamageToPermanent(ent.perm, eff.amount);
        } else {
          const t = autoTarget(state, playerId, eff.target || "enemyPermanent", self);
          if (t && !("equipment" in t)) {
            applyDamageToPermanent(t as PermanentInstance, eff.amount);
          }
        }
        break;
      }
      case "frostbite": {
        if (eff.target === "none") {
          // AoE frostbite all enemies.
          for (const u of state.players[other(playerId)].bench) {
            u.frostbitten = true;
            u.power = 0;
            state.log.push(`${getCard(u.defId).name} is Frostbitten!`);
          }
        } else {
          const t = ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self);
          if (t && "equipment" in t) {
            const u = t as UnitInstance;
            u.frostbitten = true;
            u.power = 0;
            state.log.push(`${getCard(u.defId).name} is Frostbitten! Power set to 0.`);
          }
        }
        break;
      }
      case "stun": {
        const t = ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self);
        if (t && "equipment" in t) {
          const u = t as UnitInstance;
          u.stunned = true;
          u.isAttacking = false;
          state.log.push(`${getCard(u.defId).name} is Stunned!`);
        }
        break;
      }
      case "recall": {
        const t = ent?.kind === "unit" ? ent.unit : undefined;
        if (t) {
          const p = state.players[t.owner];
          p.bench = p.bench.filter((u) => u.instanceId !== t.instanceId);
          if (p.hand.length < engineRulesFor(state).handCap) {
            p.hand.push({ instanceId: uid(state, "c"), defId: t.defId });
            state.log.push(`${getCard(t.defId).name} is recalled to hand.`);
          } else {
            state.log.push(`${getCard(t.defId).name} is recalled but hand is full — lost.`);
          }
        }
        break;
      }
      case "killUnit": {
        const t = ent?.kind === "unit" ? ent.unit : autoTarget(state, playerId, eff.target, self);
        if (t && "equipment" in t) {
          const u = t as UnitInstance;
          u.health = 0;
          state.log.push(`${getCard(u.defId).name} is destroyed.`);
        }
        break;
      }
      case "poison": {
        // Estilo Magic: The Gathering — os contadores vão para o JOGADOR
        // inimigo (cumulativos, nunca decaem). 10 contadores = derrota.
        const count = Math.max(1, eff.amount);
        poisonPlayer(state, other(playerId), count);
        checkWin(state);
        break;
      }
      case "mill": {
        // Descarta N cartas do topo do baralho inimigo — ferramenta de
        // verdade pra um arquétipo de controle perseguir a vitória por
        // fadiga em vez de só se beneficiar dela passivamente quando o
        // jogo se arrasta. drawCards() já causa 1 de dano ao Nexus por
        // compra com baralho vazio; mill acelera chegar lá.
        const opp = state.players[other(playerId)];
        const count = Math.max(1, eff.amount);
        const milled: string[] = [];
        for (let i = 0; i < count && opp.deck.length > 0; i++) {
          milled.push(opp.deck.shift()!);
        }
        if (milled.length > 0) {
          const names = milled.map((id) => getCard(id).name).join(", ");
          state.log.push(`${opp.name} mills ${milled.length} card(s): ${names}.`);
        } else {
          state.log.push(`${opp.name} has no cards left to mill.`);
        }
        break;
      }
    }
    cursor = eff.also;
  }
}

export function mechanicConditionMatches(state: GameState, unit: UnitInstance, condition: import("../types").MechanicCondition | undefined): boolean {
  if (!condition || condition.kind === "always") return true;
  if (condition.kind === "selfDamaged") return unit.health < unit.maxHealth;
  if (condition.kind === "and") return condition.children.every((child) => mechanicConditionMatches(state, unit, child));
  if (condition.kind === "or") return condition.children.some((child) => mechanicConditionMatches(state, unit, child));
  if (condition.kind === "not") return !mechanicConditionMatches(state, unit, condition.child);
  const p = state.players[unit.owner];
  const opponent = state.players[other(unit.owner)];
  if (condition.kind === "allyRace") return p.bench.filter((u) => hasRace(u, condition.race)).length >= condition.min;
  if (condition.kind === "allyClass") return p.bench.filter((u) => hasClass(u, condition.classKey)).length >= condition.min;
  if (condition.kind === "enemyRace") return opponent.bench.filter((u) => u.health > 0 && hasRace(u, condition.race)).length >= condition.min;
  if (condition.kind === "enemyClass") return opponent.bench.filter((u) => u.health > 0 && hasClass(u, condition.classKey)).length >= condition.min;
  if (condition.kind === "allyUnitsAtLeast") return p.bench.filter((u) => u.health > 0).length >= condition.min;
  if (condition.kind === "enemyUnitsAtLeast") return opponent.bench.filter((u) => u.health > 0).length >= condition.min;
  if (condition.kind === "allyPermanentsAtLeast") return p.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;
  if (condition.kind === "enemyPermanentsAtLeast") return opponent.permanents.filter((permanent) => permanent.health > 0).length >= condition.min;
  if (condition.kind === "nexusBelow") return p.nexusHealth <= condition.amount;
  if (condition.kind === "opponentNexusBelow") return opponent.nexusHealth <= condition.amount;
  if (condition.kind === "manaAtLeast") return p.mana >= condition.amount;
  if (condition.kind === "handAtLeast") return p.hand.length >= condition.amount;
  if (condition.kind === "opponentHandAtLeast") return opponent.hand.length >= condition.amount;
  if (condition.kind === "roundAtLeast") return state.round >= condition.amount;
  return false;
}

export function fireTriggerFor(state: GameState, unit: UnitInstance, when: TriggerWhen): void {
  const def = getCard(unit.defId);
  if (def.trigger?.when === when) applyEffect(state, unit.owner, def.trigger.effect, undefined, unit);
  for (const mechanic of def.mechanics ?? []) {
    if (mechanic.trigger !== when || !mechanicConditionMatches(state, unit, mechanic.condition)) continue;
    applyEffect(state, unit.owner, mechanic.effect, undefined, unit);
  }
}

export function fireTrigger(state: GameState, unit: UnitInstance, when: TriggerWhen): void {
  fireTriggerFor(state, unit, when);
  // Equipment can also fire combat-related triggers.
  if (when === "onStrike" || when === "onKill" || when === "onNexusStrike" || when === "onAllyDeath") {
    for (const eq of unit.equipment) {
      const eqDef = getCard(eq.defId);
      if (eqDef.trigger?.when === when) {
        applyEffect(state, unit.owner, eqDef.trigger.effect, undefined, unit);
      }
    }
  }
}

export function championProgress(
  state: GameState,
  unit: UnitInstance,
): { current: number; goal: number; hint: string; leveled: boolean } | null {
  const def = getCard(unit.defId);
  // NOTE: this used to short-circuit on `unit.leveled` (set true after the
  // FIRST evolution) and return a permanent "fully leveled" result — which
  // silently blocked any champion with a second levelUp stage from ever
  // showing progress toward it. `def` above already reflects the CURRENT
  // stage's card def (unit.defId changes on evolve), so the natural stop
  // condition is just "this stage's def has no levelUp field left."
  if (!def.levelUp) return null;
  const p = state.players[unit.owner];
  let current = 0;
  switch (def.levelUp.type) {
    case "nexusDamage":
      current = p.stats.nexusDamageDealt;
      break;
    case "spellsCast":
      current = p.stats.spellsCast;
      break;
    case "alliesSummoned":
      current = p.stats.alliesSummoned;
      break;
    case "nexusStrikes":
      current = unit.nexusStrikes;
      break;
  }
  return {
    current: Math.min(current, def.levelUp.amount),
    goal: def.levelUp.amount,
    hint: def.levelUp.hint,
    leveled: false,
  };
}

export function tryLevelUnit(state: GameState, unit: UnitInstance): void {
  if (unit.health <= 0) return;
  const def = getCard(unit.defId);
  if (!def.levelUp) return;
  const prog = championProgress(state, unit);
  if (!prog || prog.current < prog.goal) return;

  const next = getCard(def.levelUp.toDefId);
  const oldMax = unit.maxHealth;
  // Preserve current HP and effective buffs across transformation.
  const preservedHealth = unit.health;
  const preservedPowerBuffs = unit.powerBuffs;
  const preservedHealthBuffs = unit.healthBuffs;
  unit.defId = next.defId;
  unit.race = next.race ?? unit.race;
  unit.races = unitRaces(next.defId);
  unit.classes = unitClasses(next.defId);
  unit.durableKeywords = [...(next.keywords ?? [])];
  unit.auraKeywords = [];
  unit.keywords = [...unit.durableKeywords];
  // Re-merge durable Equipment keywords from the new definition baseline.
  for (const eq of unit.equipment) {
    const eqDef = getCard(eq.defId);
    if (!eqDef.equipment) continue;
    for (const k of eqDef.equipment.keywords ?? []) {
      grantDurableKeyword(unit, k);
    }
  }
  unit.barrier = unit.keywords.includes("Barrier");
  // Keep the same durable buff deltas, but recompute effective power/health
  // based on the new base definition + equipment + currently cached Aura.
  unit.powerBuffs = preservedPowerBuffs;
  unit.healthBuffs = preservedHealthBuffs;
  recomputeStats(unit);
  recomputeHealth(unit);
  unit.health = preservedHealth + (unit.maxHealth - oldMax);
  if (unit.health > unit.maxHealth) unit.health = unit.maxHealth;
  if (unit.health < 0) unit.health = 0;
  unit.leveled = true;
  unit.isChampion = true;
  state.log.push(`✨ ${def.name} LEVELS UP into ${next.name}!`);
  fireTrigger(state, unit, "onLevelUp");
}

export function checkLevelUps(state: GameState): void {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    for (const u of state.players[pid].bench) tryLevelUnit(state, u);
  }
  // Transformation can change race/class eligibility for a continuous Aura.
  recomputeContinuousAuras(state);
  if ((["player", "ai"] as PlayerId[]).some((pid) => state.players[pid].bench.some((unit) => unit.health <= 0))) {
    cleanupDead(state);
  }
}

export function firePermanentRoundStart(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  for (const perm of p.permanents) {
    const def = getCard(perm.defId);
    if (def.trigger?.when === "onRoundStart") {
      applyEffect(state, playerId, def.trigger.effect);
    }
  }
}

/** Whether a player may cast this reaction spell in response to the given action. */