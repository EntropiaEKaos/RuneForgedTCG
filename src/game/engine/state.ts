import { getCard } from "../cards";
import { nextRng, normalizeSeed, seededShuffle } from "../rng";
import { deckRegions, getDeck } from "../decks";
import { permanentAuraBonusForUnit } from "../permanent-aura-contract";
import { regionalUnitBonus } from "../region-identity";
import type { BoardEntity, CardInstance, DeckInput, EngineRulesSnapshot, GameState, Keyword, PermanentInstance, PlayerId, PlayerState, Race, SentinelaInstance, TargetKind, UnitInstance } from "../types";
import { getRuntimeAiRules, getRuntimeEngineRules } from "../runtime-config";
import { engineRulesFor } from "../match-rules";

const POISON_LETHAL = 10;

export function uid(state: GameState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}_${state.idCounter}`;
}

export function other(id: PlayerId): PlayerId {
  return id === "player" ? "ai" : "player";
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  return seededShuffle(arr, seed);
}

export function clone(state: GameState): GameState {
  return structuredClone(state);
}

export function hasKw(u: UnitInstance, k: Keyword): boolean {
  return u.keywords.includes(k);
}

export function unitRaces(defId: string): Race[] {
  const def = getCard(defId);
  const races: Race[] = [];
  if (def.race) races.push(def.race);
  for (const r of def.secondaryRaces ?? []) {
    if (!races.includes(r)) races.push(r);
  }
  return races;
}

export function hasRace(u: UnitInstance, race?: Race | Race[]): boolean {
  if (!race) return true;
  const wanted = Array.isArray(race) ? race : [race];
  return wanted.some((r) => u.races.includes(r) || u.race === r);
}

export function unitClasses(defId: string): string[] {
  return [...new Set(getCard(defId).classes ?? [])];
}

export function hasClass(u: UnitInstance, classKey?: string | string[]): boolean {
  if (!classKey) return true;
  const wanted = Array.isArray(classKey) ? classKey : [classKey];
  return wanted.some((c) => (u.classes ?? []).includes(c));
}

export function makeUnit(state: GameState, defId: string, owner: PlayerId): UnitInstance {
  const def = getCard(defId);
  const races = unitRaces(defId);
  const classes = unitClasses(defId);
  const bonus = regionalUnitBonus(state.players[owner], def);
  const p = (def.power ?? 0) + bonus.power;
  const health = (def.health ?? 1) + bonus.health;
  const unit: UnitInstance = {
    instanceId: uid(state, "u"),
    defId,
    race: def.race ?? races[0],
    races,
    classes,
    power: p,
    basePower: p,
    health,
    maxHealth: health,
    keywords: [...(def.keywords ?? [])],
    barrier: (def.keywords ?? []).includes("Barrier"),
    frostbitten: false,
    stunned: false,
    isAttacking: false,
    hasStruck: false,
    summonedThisTurn: true,
    owner,
    isChampion: Boolean(def.isChampion),
    leveled: Boolean(def.isChampion && def.collectible === false),
    strikes: 0,
    nexusStrikes: 0,
    equipment: [],
    lastBreath: Boolean(def.trigger?.when === "onDeath" || def.mechanics?.some((m) => m.trigger === "onDeath")),
    killedBy: null,
    powerBuffs: bonus.power,
    healthBuffs: bonus.health,
    permanentHealthModifier: 0,
    auraPowerBonus: 0,
    auraHealthBonus: 0,
    poisonCounters: 0,
    hasAttackedThisTurn: false,
  };
  const aura = permanentAuraBonusForUnit(state, unit);
  unit.auraPowerBonus = aura.power;
  unit.auraHealthBonus = aura.health;
  unit.power += aura.power;
  unit.maxHealth += aura.health;
  unit.health += aura.health;
  return unit;
}

/** Recompute effective power/health from base + durable + continuous buffs. */
export function recomputeStats(unit: UnitInstance): void {
  const baseFromDef = getCard(unit.defId).power ?? 0;
  let equipmentBonus = 0;
  for (const eq of unit.equipment) {
    const eqDef = getCard(eq.defId);
    if (eqDef.equipment) equipmentBonus += eqDef.equipment.buffPower;
  }
  unit.basePower = baseFromDef + equipmentBonus;
  if (!unit.frostbitten) {
    unit.power = unit.basePower + unit.powerBuffs + (unit.auraPowerBonus ?? 0);
  } else {
    unit.power = 0;
  }
}

export function recomputeHealth(unit: UnitInstance): void {
  const baseFromDef = getCard(unit.defId).health ?? 0;
  let equipmentBonus = 0;
  for (const eq of unit.equipment) {
    const eqDef = getCard(eq.defId);
    if (eqDef.equipment) equipmentBonus += eqDef.equipment.buffHealth;
  }
  unit.maxHealth = Math.max(0, baseFromDef + equipmentBonus + unit.permanentHealthModifier + unit.healthBuffs + (unit.auraHealthBonus ?? 0));
  if (unit.health > unit.maxHealth) unit.health = unit.maxHealth;
}

/**
 * Re-derive source-bound Aura modifiers from the battlefield.
 * Damage already marked on a living unit is preserved across max-health
 * changes; dead units never resurrect because an Aura entered play.
 */
export function recomputeContinuousAuras(state: GameState): void {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    for (const unit of state.players[pid].bench) {
      const wasAlive = unit.health > 0;
      const damageTaken = wasAlive ? Math.max(0, unit.maxHealth - unit.health) : 0;
      const aura = permanentAuraBonusForUnit(state, unit);
      unit.auraPowerBonus = aura.power;
      unit.auraHealthBonus = aura.health;
      recomputeStats(unit);
      recomputeHealth(unit);
      if (wasAlive) unit.health = Math.max(0, unit.maxHealth - damageTaken);
      else unit.health = Math.min(0, unit.health);
    }
  }
}

export function makePermanent(state: GameState, defId: string, owner: PlayerId): PermanentInstance {
  const def = getCard(defId);
  const type: PermanentInstance["permanentType"] =
    def.type === "Artifact" ? "Artifact" : "Enchantment";
  return {
    instanceId: uid(state, "p"),
    defId,
    power: 0,
    health: def.maxHealth ?? 3,
    maxHealth: def.maxHealth ?? 3,
    owner,
    permanentType: type,
  };
}

export function sanitizeCards(cards: string[]): string[] {
  return cards.filter((id) => {
    try {
      getCard(id);
      return true;
    } catch {
      return false;
    }
  });
}

export function makePlayer(id: PlayerId, name: string, deck: DeckInput, rules: EngineRulesSnapshot, shuffleSeed = 1): PlayerState {
  const cards = sanitizeCards(deck.cards);
  const fallback = getDeck("ember_aggro").cards;
  return {
    id,
    name,
    nexusHealth: rules.nexusStart,
    mana: 0,
    maxMana: 0,
    spellMana: 0,
    hand: [],
    deck: shuffle(cards.length >= 1 ? cards : fallback, shuffleSeed),
    bench: [],
    permanents: [],
    sentinelas: [],
    deckName: deck.name,
    deckId: deck.id,
    deckRegions: deckRegions(cards.length >= 1 ? cards : fallback),
    stats: { nexusDamageDealt: 0, spellsCast: 0, alliesSummoned: 0 },
    poisonCounters: 0,
  };
}

/** Dá contadores de veneno ao jogador-alvo (estilo Magic: cumulativo, nunca decai). */
export function poisonPlayer(state: GameState, targetId: PlayerId, amount: number): void {
  if (amount <= 0) return;
  const p = state.players[targetId];
  p.poisonCounters += amount;
  state.log.push(
    `${p.name} recebe ${amount} contador(es) de veneno (${p.poisonCounters}/${POISON_LETHAL}).`,
  );
}

export function drawCards(state: GameState, playerId: PlayerId, n: number): void {
  const p = state.players[playerId];
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) {
      const rules = engineRulesFor(state);
      const damage = rules.runtimeOverridesEnabled && rules.fatigueEnabled ? rules.fatigueStart : 1;
      p.nexusHealth = Math.max(0, p.nexusHealth - damage);
      state.log.push(`${p.name} has no cards left and takes ${damage} fatigue damage.`);
      continue;
    }
    const defId = p.deck.shift()!;
    if (p.hand.length >= engineRulesFor(state).handCap) {
      state.log.push(`${p.name}'s hand is full — ${getCard(defId).name} is discarded.`);
      continue;
    }
    const inst: CardInstance = { instanceId: uid(state, "c"), defId };
    p.hand.push(inst);
  }
}

export function grantMana(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  p.spellMana = Math.min(engineRulesFor(state).maxSpellMana, p.spellMana + p.mana);
  p.maxMana = Math.min(engineRulesFor(state).maxMana, p.maxMana + 1);
  p.mana = p.maxMana;
}

export interface CustomGameOptions {
  aiName?: string;
  playerNexus?: number;
  aiNexus?: number;
  playerStartingMana?: number;
  playerStartingHand?: number;
  aiStartingMana?: number;
  aiStartingHand?: number;
  playerBench?: string[];
  aiBench?: string[];
  playerGoesFirst?: boolean;
  skipMulligan?: boolean;
  /** Deterministic seed for authoritative matches/replays. */
  seed?: number;
  logPrefix?: string;
  aiDifficulty?: import("../types").AiDifficulty;
  /** Immutable rules supplied by a server-issued token/replay. */
  rules?: import("../types").EngineRulesSnapshot;
  aiRules?: import("../types").AiRulesSnapshot;
}

export function createGame(
  playerName: string,
  playerDeck: DeckInput,
  aiDeck: DeckInput,
  playerGoesFirst: boolean,
  seed?: number,
  aiDifficulty: import("../types").AiDifficulty = "tactician",
  rules?: import("../types").EngineRulesSnapshot,
  aiRules?: import("../types").AiRulesSnapshot,
): GameState {
  return createCustomGame(playerName, playerDeck, aiDeck, { playerGoesFirst, seed, aiDifficulty, rules, aiRules });
}

/** Create a game with custom rules for puzzles, boss battles and brawls. */
export function createCustomGame(
  playerName: string,
  playerDeck: DeckInput,
  aiDeck: DeckInput,
  opts: CustomGameOptions = {},
): GameState {
  const seed = normalizeSeed(opts.seed ?? Date.now());
  const playerFirstRng = nextRng(seed);
  const playerFirst = opts.playerGoesFirst ?? playerFirstRng.value < 0.5;
  const rules = opts.rules ? structuredClone(opts.rules) : getRuntimeEngineRules();
  const aiRules = opts.aiRules ? { ...opts.aiRules } : getRuntimeAiRules();
  const state: GameState = {
    players: {
      player: makePlayer("player", playerName || "Challenger", playerDeck, rules, seed ^ 0x9e3779b9),
      ai: makePlayer("ai", opts.aiName || "The Adversary", aiDeck, rules, seed ^ 0x243f6a88),
    },
    attackToken: playerFirst ? "player" : "ai",
    activePlayer: playerFirst ? "player" : "ai",
    round: 1,
    phase: "main",
    hasAttackedThisTurn: false,
    combat: null,
    winner: null,
    log: [],
    mulliganDone: { player: opts.skipMulligan ? true : false, ai: true },
    seed,
    rngState: playerFirstRng.state,
    idCounter: 0,
    aiDifficulty: opts.aiDifficulty ?? aiRules.defaultDifficulty,
    rules: structuredClone(rules),
    aiRules: { ...aiRules },
  };

  // Custom nexus HP
  if (opts.playerNexus !== undefined) state.players.player.nexusHealth = opts.playerNexus;
  if (opts.aiNexus !== undefined) state.players.ai.nexusHealth = opts.aiNexus;

  // Custom starting hand sizes
  const pHand = opts.playerStartingHand ?? rules.startHand;
  const aHand = opts.aiStartingHand ?? rules.startHand;
  drawCards(state, "player", pHand);
  drawCards(state, "ai", aHand);

  // Pre-fill benches
  if (opts.playerBench) {
    for (const defId of opts.playerBench) {
      if (state.players.player.bench.length >= engineRulesFor(state).benchCap) break;
      const u = makeUnit(state, defId, "player");
      u.summonedThisTurn = false;
      state.players.player.bench.push(u);
    }
  }
  if (opts.aiBench) {
    for (const defId of opts.aiBench) {
      if (state.players.ai.bench.length >= engineRulesFor(state).benchCap) break;
      const u = makeUnit(state, defId, "ai");
      u.summonedThisTurn = false;
      state.players.ai.bench.push(u);
    }
  }

  // Grant mana
  const grantManaTo = (p: PlayerState, amount: number) => {
    p.maxMana = Math.min(engineRulesFor(state).maxMana, amount);
    p.mana = amount;
  };
  grantManaTo(state.players.player, opts.playerStartingMana ?? 1);
  grantManaTo(state.players.ai, opts.aiStartingMana ?? 1);

  state.log.push(
    `${opts.logPrefix || ""}Round 1 begins. ${state.players[state.attackToken].name} holds the Attack Token.`,
  );
  return state;
}

/** Award a bonus deck/hand to a player for special modes (boss draws, etc). */
export function addCardsToHand(state: GameState, playerId: PlayerId, defIds: string[]): GameState {
  const s = clone(state);
  for (const defId of defIds) {
    if (s.players[playerId].hand.length >= engineRulesFor(s).handCap) break;
    s.players[playerId].hand.push({ instanceId: uid(s, "c"), defId });
  }
  return s;
}

export function checkWin(state: GameState): void {
  const runtime = engineRulesFor(state);
  if (runtime.runtimeOverridesEnabled && state.round >= runtime.maxRounds && state.phase !== "gameover") {
    const playerScore = state.players.player.nexusHealth + state.players.player.bench.reduce((sum, unit) => sum + Math.max(0, unit.health), 0);
    const aiScore = state.players.ai.nexusHealth + state.players.ai.bench.reduce((sum, unit) => sum + Math.max(0, unit.health), 0);
    state.winner = playerScore === aiScore ? other(state.attackToken) : playerScore > aiScore ? "player" : "ai";
    state.phase = "gameover";
    state.log.push(`Maximum round limit (${runtime.maxRounds}) reached.`);
    return;
  }
  const playerDead = state.players.player.nexusHealth <= 0 || state.players.player.poisonCounters >= POISON_LETHAL;
  const aiDead = state.players.ai.nexusHealth <= 0 || state.players.ai.poisonCounters >= POISON_LETHAL;
  if (playerDead && aiDead) {
    state.winner = other(state.attackToken);
    state.phase = "gameover";
  } else if (aiDead) {
    state.winner = "player";
    state.phase = "gameover";
  } else if (playerDead) {
    state.winner = "ai";
    state.phase = "gameover";
  }
}

export function damageNexus(state: GameState, targetId: PlayerId, amount: number, sourceOwner: PlayerId): void {
  if (amount <= 0) return;
  state.players[targetId].nexusHealth = Math.max(0, state.players[targetId].nexusHealth - amount);
  state.players[sourceOwner].stats.nexusDamageDealt += amount;
}

export function healNexus(state: GameState, playerId: PlayerId, amount: number): void {
  if (amount <= 0) return;
  const p = state.players[playerId];
  p.nexusHealth = Math.min(engineRulesFor(state).nexusStart, p.nexusHealth + amount);
}

export function applyDamageToUnit(unit: UnitInstance, amount: number, source?: UnitInstance | null): number {
  let dmg = amount;
  if (unit.barrier) {
    unit.barrier = false;
    return 0;
  }
  if (unit.keywords.includes("Tough")) dmg = Math.max(0, dmg - 1);
  // Deathtouch: any damage this source deals to a unit destroys it.
  if (source && source.keywords.includes("Deathtouch") && dmg > 0) {
    unit.health = 0;
    unit.killedBy = source.instanceId;
    return dmg;
  }
  unit.health -= dmg;
  // Wither: damage permanently reduces the target's max health too.
  // This must NOT use healthBuffs, because healthBuffs are temporary and
  // are cleared at end of round. Wither is a permanent max-health reduction.
  if (source && source.keywords.includes("Wither") && dmg > 0) {
    unit.permanentHealthModifier -= dmg;
    recomputeHealth(unit);
  }
  // Record who dealt the killing blow (for onKill triggers). Spell damage has no source.
  if (unit.health <= 0) {
    unit.killedBy = source ? source.instanceId : null;
  }
  return dmg;
}

export function applyDamageToPermanent(perm: PermanentInstance, amount: number): void {
  perm.health -= amount;
}

export function applyDamageToSentinela(state: GameState, targetId: string, amount: number): void {
  const found = findSentinela(state, targetId);
  if (found) {
    found.sen.loyalty -= amount;
    state.log.push(`${getCard(found.sen.defId).name} perde ${amount} de Lealdade.`);
    if (found.sen.loyalty <= 0) {
      state.log.push(`A Sentinela ${getCard(found.sen.defId).name} foi destruída (Lealdade 0).`);
    }
  }
}

export function findUnit(state: GameState, instanceId: string): { unit: UnitInstance; owner: PlayerId } | null {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const u = state.players[pid].bench.find((x) => x.instanceId === instanceId);
    if (u) return { unit: u, owner: pid };
  }
  return null;
}

export function findSentinela(
  state: GameState,
  instanceId: string,
): { sen: SentinelaInstance; owner: PlayerId } | null {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const s = state.players[pid].sentinelas.find((x) => x.instanceId === instanceId);
    if (s) return { sen: s, owner: pid };
  }
  return null;
}

export function findAnyBoardEntity(
  state: GameState,
  instanceId: string,
): BoardEntity | null {
  const unit = findUnit(state, instanceId);
  if (unit) return { kind: "unit", ...unit };
  const perm = findPermanent(state, instanceId);
  if (perm) return { kind: "permanent", ...perm };
  const sen = findSentinela(state, instanceId);
  if (sen) return { kind: "sentinela", ...sen };
  return null;
}

export function findPermanent(
  state: GameState,
  instanceId: string,
): { perm: PermanentInstance; owner: PlayerId } | null {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const p = state.players[pid].permanents.find((x) => x.instanceId === instanceId);
    if (p) return { perm: p, owner: pid };
  }
  return null;
}



export function autoTarget(
  state: GameState,
  playerId: PlayerId,
  target: TargetKind,
  self?: UnitInstance,
  raceFilter?: Race | Race[],
): UnitInstance | PermanentInstance | SentinelaInstance | undefined {
  if (target === "self") return self;
  if (target === "none") return undefined;

  const allyUnits = state.players[playerId].bench.filter((u) => hasRace(u, raceFilter));
  const enemyUnits = state.players[other(playerId)].bench.filter((u) => hasRace(u, raceFilter));
  const allyPerms = state.players[playerId].permanents;
  const enemyPerms = state.players[other(playerId)].permanents;
  const allySen = state.players[playerId].sentinelas;
  const enemySen = state.players[other(playerId)].sentinelas;

  if (target === "allyUnit") {
    return [...allyUnits].sort((a, b) => b.power - a.power)[0];
  }
  if (target === "enemyUnit") {
    return [...enemyUnits].sort((a, b) => b.power - a.power)[0];
  }
  if (target === "anyUnit") {
    return [...enemyUnits, ...allyUnits].sort((a, b) => b.power - a.power)[0];
  }
  if (target === "allyPermanent") {
    return [...allyPerms].sort((a, b) => b.health - a.health)[0];
  }
  if (target === "enemyPermanent") {
    return [...enemyPerms].sort((a, b) => b.health - a.health)[0];
  }
  if (target === "anyPermanent") {
    return [...enemyPerms, ...allyPerms].sort((a, b) => b.health - a.health)[0];
  }
  if (target === "enemySentinela") {
    return [...enemySen].sort((a, b) => a.loyalty - b.loyalty)[0];
  }
  if (target === "allySentinela") {
    return [...allySen].sort((a, b) => a.loyalty - b.loyalty)[0];
  }
  if (target === "anySentinela") {
    return [...enemySen, ...allySen].sort((a, b) => a.loyalty - b.loyalty)[0];
  }
  if (target === "anyBoard") {
    const allUnits = [...enemyUnits, ...allyUnits].sort((a, b) => b.power - a.power)[0];
    const allPerms = [...enemyPerms, ...allyPerms].sort((a, b) => b.health - a.health)[0];
    return allUnits ?? allPerms;
  }
  return undefined;
}

/** Returns true if the unit died from the damage. */
