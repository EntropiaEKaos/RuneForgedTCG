// =============================================================================
//  Runeforge: Legends of the Nexus — Tipos do Motor de Jogo
//
//  NOTA DE ENGENHARIA: Os valores de string internos (Region, Race, Keyword)
//  permanecem em inglês para evitar quebrar centenas de arquivos e dados
//  existentes no banco de dados. A tradução é feita pela camada de UI via
//  os mapas em src/game/i18n.ts.
// =============================================================================

export type PlayerId = "player" | "ai";
export type AiDifficulty = "apprentice" | "tactician" | "overlord";

/**
 * Cor (alias de Region) — identidade de cada conjunto de cartas.
 *
 * | Valor interno | Nome PT | Estilo de jogo                     |
 * |---------------|---------|------------------------------------|
 * | Emberhold     | Chama   | Agressivo, fogo, dragões           |
 * | Tidecall      | Maré    | Controle, água, sprites            |
 * | Ironwood      | Floresta| Midrange, natureza, feras          |
 * | Voidborn      | Vazio   | Sombra, evasão, voidlings          |
 * | Florestia     | Florestia | Tribal Besta, crescimento mútuo  |
 * | Tempestade    | Tempestade| Velocidade, tempesteiros, anjos  |
 */
export type Region =
  | "Emberhold"
  | "Tidecall"
  | "Ironwood"
  | "Voidborn"
  | "Florestia"
  | "Tempestade";

/** Alias semântico — use Region em código, Cor em UI. */
export type Cor = Region;

/** Ordered card/deck identity. `region` remains the primary color for old content. */
export type CardRegionIdentity =
  | [Region]
  | [Region, Region]
  | [Region, Region, Region];

/**
 * Deterministic reward for committing a deck to the exact identity of a
 * multi-region card. No arbitrary scripts are involved.
 */
export type RegionalPerk = "convergence" | "assault" | "bulwark";

/** Presentation/analysis role. It never changes authoritative card execution. */
export type StrategicRole = "finisher" | "removal" | "defense" | "tempo" | "engine" | "utility";

/**
 * Raça de criatura — determina sinergias tribais.
 *
 * | Valor     | PT           | Cor principal        | Sinergia                        |
 * |-----------|--------------|----------------------|---------------------------------|
 * | Dragon    | Dragão       | Chama                | Rally buffs Dragões             |
 * | Sprite    | Sprite       | Maré                  | Rally buffs Sprites             |
 * | Beast     | Fera         | Floresta              | Pack alpha, crescimento         |
 * | Voidling  | Voidling     | Vazio                 | Medo, veneno, vampírico         |
 * | Warrior   | Guerreiro    | Chama/Floresta        | Bonus de poder                  |
 * | Elemental | Elemental    | Chama/Tempestade      | Frostbite, dano em área         |
 * | Spirit    | Espírito     | Maré/Floresta         | Hexproof, sobrevivência         |
 * | Besta     | Besta        | Florestia             | Crescimento mútuo, Alcance      |
 * | Tempesteiro| Tempesteiro | Tempestade            | Ímpeto, AtaqueDuplo             |
 * | Anjo      | Anjo         | Tempestade            | Vampírico, Voo                  |
 */
export type Race =
  | "Dragon"
  | "Sprite"
  | "Beast"
  | "Voidling"
  | "Warrior"
  | "Elemental"
  | "Spirit"
  | "Besta"
  | "Tempesteiro"
  | "Anjo";

/**
 * Palavras-chave de jogo.
 *
 * | Valor           | PT              | Efeito                                                   |
 * |-----------------|-----------------|----------------------------------------------------------|
 * | Overwhelm       | Atropelar       | Dano excedente vai para o Nexus                          |
 * | QuickAttack     | Ataque Rápido   | Ataca primeiro no combate                                |
 * | DoubleStrike    | Ataque Duplo    | Ataca duas vezes                                         |
 * | Elusive         | Evasivo         | Bloqueável só por Evasivo ou Alcance                     |
 * | Lifesteal       | Vampírico       | Cura o Nexus pelo dano causado                           |
 * | Barrier         | Barreira        | Nega o próximo dano recebido                             |
 * | Fearsome        | Assustador      | Bloqueável só por criaturas com poder ≥ 3                |
 * | Tough           | Resistente      | Recebe -1 de todo dano                                   |
 * | Regeneration    | Regeneração     | Cura ao fim de cada rodada                               |
 * | Challenger      | Desafiador      | Força uma criatura inimiga a bloqueá-lo                  |
 * | Unblockable     | Imparável       | Bloqueável só por Imparável                              |
 * | Ephemeral       | Efêmero         | Morre ao fim da rodada ou após atacar                    |
 * | LastBreath      | Último Suspiro  | Dispara efeito ao morrer                                 |
 * | Deathtouch      | Toque Mortal    | Qualquer dano que causa destrói a criatura               |
 * | Poisonous       | Venenoso        | Ao causar dano, adiciona contador de veneno              |
 * | Haste           | Ímpeto          | Pode atacar no turno em que é invocado                   |
 * | Wither          | Murchar         | Dano reduz permanentemente a vida máxima do alvo         |
 * | Hexproof        | Hexproof        | Não pode ser alvo de feitiços inimigos                   |
 * | Reach           | Alcance         | Pode bloquear criaturas Evasivas                         |
 * | Flying          | Voo             | Como Evasivo, bloqueável por Alcance e por Voo           |
 */
export type Keyword =
  | "Overwhelm"
  | "QuickAttack"
  | "DoubleStrike"
  | "Elusive"
  | "Lifesteal"
  | "Barrier"
  | "Fearsome"
  | "Tough"
  | "Regeneration"
  | "Challenger"
  | "Unblockable"
  | "Ephemeral"
  | "LastBreath"
  | "Deathtouch"
  | "Poisonous"
  | "Haste"
  | "Wither"
  | "Hexproof"
  | "Reach"
  | "Flying";

export type CardType = "Unit" | "Spell" | "Enchantment" | "Artifact" | "Equipment" | "Sentinela";

export type Rarity = "Common" | "Rare" | "Epic" | "Legend";

export type TargetKind =
  | "enemyUnit"
  | "allyUnit"
  | "anyUnit"
  | "enemyPermanent"
  | "allyPermanent"
  | "anyPermanent"
  | "self"
  | "none"
  | "spellOnStack"
  | "anyBoard"
  | "enemySentinela"
  | "allySentinela"
  | "anySentinela"
  | "allyGraveyardCard"
  | "enemyGraveyardCard"
  | "anyGraveyardCard"
  | "allyGraveyardUnit";

export type EffectKind =
  | "damageUnit"
  | "damageNexus"
  | "healUnit"
  | "healNexus"
  | "buffUnit"
  | "buffSelf"
  | "buffAllies"
  | "buffRace"
  | "buffClass"
  | "aoeEnemy"
  | "draw"
  | "grantBarrier"
  | "grantKeyword"
  | "summonToken"
  | "attachEquipment"
  | "manaRefund"
  | "drawOnSummon"
  | "destroyPermanent"
  | "damagePermanent"
  | "negateSpell"
  | "frostbite"
  | "stun"
  | "recall"
  | "killUnit"
  | "poison"
  | "mill"
  | "selfMill"
  | "returnGraveyardToHand"
  | "reanimateUnit"
  | "banishGraveyardCard";

export type TriggerWhen =
  | "onSummon"
  | "onStrike"
  | "onNexusStrike"
  | "onRoundStart"
  | "onLevelUp"
  | "onKill"
  | "onPermanentSummon"
  | "onAttack"
  | "onBlock"
  | "onAllyDeath"
  | "onDeath";

/**
 * Habilidade de Sentinela (estilo Planeswalker do Magic).
 *
 * Uma habilidade tem custo de lealdade:
 *   - cost > 0 : ganha lealdade ao ativar
 *   - cost < 0 : gasta lealdade
 *   - cost = 0 : não altera lealdade
 *
 * Só pode ser ativada se a sentinela tiver lealdade suficiente
 * para pagar um custo negativo (|cost|).
 */
export interface SentinelaAbility {
  /** Custo de lealdade (positivo = ganha, negativo = gasta). */
  cost: number;
  description: string;
  effect: CardEffect;
}

/** Definição de Sentinela anexada a uma carta. */
export interface SentinelaDef {
  /** Lealdade inicial ao entrar em jogo. */
  startingLoyalty: number;
  abilities: SentinelaAbility[];
}

export interface CardEffect {
  kind: EffectKind;
  amount: number;
  buffPower?: number;
  buffHealth?: number;
  target: TargetKind;
  keyword?: Keyword;
  tokenDefId?: string;
  equipmentDefId?: string;
  race?: Race;
  races?: Race[];
  classKey?: string;
  classKeys?: string[];
  also?: CardEffect;
}

export type LevelUpType = "nexusDamage" | "spellsCast" | "alliesSummoned" | "nexusStrikes";

export interface LevelUpDef {
  type: LevelUpType;
  amount: number;
  toDefId: string;
  hint: string;
}

export interface EquipmentEffect {
  buffPower: number;
  buffHealth: number;
  keywords?: Keyword[];
}

/**
 * Concrete continuous Aura sub-contract for battlefield Permanents.
 * Filters are optional. Within each list matching is OR; when both race and
 * class filters are present the unit must satisfy both groups.
 */
export interface PermanentStatAura {
  buffPower: number;
  buffHealth: number;
  races?: Race[];
  classes?: string[];
}

export interface CostReduction {
  kind: "creatures" | "power";
  per?: number;
  threshold?: number;
  max?: number;
}


export type MechanicCondition =
  | { kind: "always" }
  | { kind: "selfDamaged" }
  | { kind: "allyRace"; race: Race; min: number }
  | { kind: "allyClass"; classKey: string; min: number }
  | { kind: "enemyRace"; race: Race; min: number }
  | { kind: "enemyClass"; classKey: string; min: number }
  | { kind: "allyUnitsAtLeast"; min: number }
  | { kind: "enemyUnitsAtLeast"; min: number }
  | { kind: "allyPermanentsAtLeast"; min: number }
  | { kind: "enemyPermanentsAtLeast"; min: number }
  | { kind: "allySentinelasAtLeast"; min: number }
  | { kind: "enemySentinelasAtLeast"; min: number }
  | { kind: "nexusBelow"; amount: number }
  | { kind: "opponentNexusBelow"; amount: number }
  | { kind: "manaAtLeast"; amount: number }
  | { kind: "opponentManaAtLeast"; amount: number }
  | { kind: "spellManaAtLeast"; amount: number }
  | { kind: "opponentSpellManaAtLeast"; amount: number }
  | { kind: "spellsCastAtLeast"; amount: number }
  | { kind: "opponentSpellsCastAtLeast"; amount: number }
  | { kind: "alliesSummonedAtLeast"; amount: number }
  | { kind: "opponentAlliesSummonedAtLeast"; amount: number }
  | { kind: "nexusDamageDealtAtLeast"; amount: number }
  | { kind: "opponentNexusDamageDealtAtLeast"; amount: number }
  | { kind: "handAtLeast"; amount: number }
  | { kind: "opponentHandAtLeast"; amount: number }
  | { kind: "roundAtLeast"; amount: number }
  | { kind: "and"; children: MechanicCondition[] }
  | { kind: "or"; children: MechanicCondition[] }
  | { kind: "not"; child: MechanicCondition };

export interface CardMechanic {
  key: string;
  name?: string;
  trigger: TriggerWhen;
  condition?: MechanicCondition;
  effect: CardEffect;
}

export interface CardDef {
  defId: string;
  name: string;
  region: Region;
  /** One to three regions. When omitted, the legacy primary `region` is used. */
  regions?: CardRegionIdentity;
  /** Gameplay reward activated only when the deck has this exact identity. */
  regionalPerk?: RegionalPerk;
  type: CardType;
  cost: number;
  power?: number;
  health?: number;
  keywords?: Keyword[];
  description: string;
  /** Optional non-rules lore line shown separately from mechanical text. */
  flavor?: string;
  rarity: Rarity;
  race?: Race;
  secondaryRaces?: Race[];
  classes?: string[];
  isLegend?: boolean;
  isChampion?: boolean;
  collectible?: boolean;
  spell?: CardEffect;
  speed?: "Fast" | "Burst";
  trigger?: { when: TriggerWhen; effect: CardEffect };
  levelUp?: LevelUpDef;
  equipment?: EquipmentEffect;
  /** Continuous allied-unit stat modifier while this Enchantment/Artifact remains in play. */
  aura?: PermanentStatAura;
  maxHealth?: number;
  costReduction?: CostReduction;
  /** Sentinela (planeswalker) definition. Presente quando type === "Sentinela". */
  sentinela?: SentinelaDef;
  art?: string;
  emoji: string;
  /** Safe, data-driven mechanics compiled by the Mechanics Studio. */
  mechanics?: CardMechanic[];
  /** Designer-facing labels for custom keyword mechanics. */
  customKeywords?: string[];
  /** Semantic subtype built on one of the six engine structural card types. */
  archetypeKey?: string;
  archetypeName?: string;
  /** Optional designer override for the role otherwise inferred from the card contract. */
  strategicRole?: StrategicRole;
  /** Preset deck doctrines this card was authored to support. */
  doctrineAffinities?: string[];
}

export interface CardInstance {
  instanceId: string;
  defId: string;
}

export interface EquipmentSlot {
  instanceId: string;
  defId: string;
}

export interface UnitInstance {
  instanceId: string;
  defId: string;
  race?: Race;
  races: Race[];
  classes?: string[];
  power: number;
  basePower: number;
  health: number;
  maxHealth: number;
  keywords: Keyword[];
  barrier: boolean;
  frostbitten: boolean;
  stunned: boolean;
  isAttacking: boolean;
  hasStruck: boolean;
  summonedThisTurn: boolean;
  owner: PlayerId;
  isChampion: boolean;
  leveled: boolean;
  strikes: number;
  nexusStrikes: number;
  equipment: EquipmentSlot[];
  lastBreath?: boolean;
  killedBy?: string | null;
  powerBuffs: number;
  healthBuffs: number;
  permanentHealthModifier: number;
  /** Derived continuous modifiers; optional for backwards-compatible replays. */
  auraPowerBonus?: number;
  auraHealthBonus?: number;
  poisonCounters: number;
  hasAttackedThisTurn: boolean;
}

export interface PermanentInstance {
  instanceId: string;
  defId: string;
  power: number;
  health: number;
  maxHealth: number;
  owner: PlayerId;
  permanentType: "Enchantment" | "Artifact";
}

/**
 * Instância de Sentinela em jogo (estilo Planeswalker).
 *
 * Pode ser atacada por criaturas inimigas; dano sofrido reduz a lealdade.
 * Habilidades são ativadas no máximo uma vez por turno.
 */
export interface SentinelaInstance {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  /** Lealdade atual. Ao chegar a 0, a sentinela morre. */
  loyalty: number;
  /** A habilidade já foi ativada neste turno? */
  activatedThisTurn: boolean;
}

export interface PlayerStats {
  nexusDamageDealt: number;
  spellsCast: number;
  alliesSummoned: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  nexusHealth: number;
  mana: number;
  maxMana: number;
  spellMana: number;
  hand: CardInstance[];
  deck: string[];
  bench: UnitInstance[];
  permanents: PermanentInstance[];
  sentinelas: SentinelaInstance[];
  deckName: string;
  deckId: string;
  /** Immutable deck-building identity, captured when the match is created. */
  deckRegions?: Region[];
  stats: PlayerStats;
  /** Contadores de veneno (estilo Magic: The Gathering — cumulativo, nunca decai). 10+ = derrota. */
  poisonCounters: number;
}

/** Helper para encontrar qualquer entidade no board (unit/permanent/sentinela). */
export type BoardEntity =
  | { kind: "unit"; unit: UnitInstance; owner: PlayerId }
  | { kind: "permanent"; perm: PermanentInstance; owner: PlayerId }
  | { kind: "sentinela"; sen: SentinelaInstance; owner: PlayerId };

export type Phase = "main" | "blocking" | "gameover";

export interface CombatState {
  attackerId: PlayerId;
  blocks: Record<string, string>;
  locked: string[];
  /** Atacantes que miram Sentinelas inimigas: attackerId -> sentinelaId. */
  sentinelaTargets: Record<string, string>;
  /**
   * Ordem de resolução: primeiro resolve blockers (dano entre unidades),
   * depois resolve sentinelaTargets (dano à lealdade). Isso impede que
   * atacante ignore um blocker para atingir a sentinela.
   */
}

export interface EngineRulesSnapshot {
  nexusStart: number;
  maxMana: number;
  maxSpellMana: number;
  handCap: number;
  startHand: number;
  benchCap: number;
  permanentsCap: number;
  runtimeOverridesEnabled: boolean;
  maxRounds: number;
  fatigueEnabled: boolean;
  fatigueStart: number;
  fatigueStep: number;
  actionAllowlist: string[];
  phaseSequence: string[];
}

export interface AiRulesSnapshot {
  defaultDifficulty: AiDifficulty;
  aggressionScale: number;
  valueScale: number;
  reactionDepth: number;
  randomness: number;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  attackToken: PlayerId;
  activePlayer: PlayerId;
  round: number;
  phase: Phase;
  hasAttackedThisTurn: boolean;
  combat: CombatState | null;
  winner: PlayerId | null;
  log: string[];
  mulliganDone: Record<PlayerId, boolean>;
  /** Seeded RNG state. Required for deterministic authoritative replays. */
  seed: number;
  rngState: number;
  /** Monotonic per-game instance id counter; makes replays independent of process globals. */
  idCounter: number;
  /** Server-issued PvE AI policy. Optional for backwards-compatible replays. */
  aiDifficulty?: AiDifficulty;
  /** Immutable rules captured when this match was created. */
  rules: EngineRulesSnapshot;
  /** Immutable AI tuning captured with the match. */
  aiRules: AiRulesSnapshot;
}

export interface DeckInput {
  id: string;
  name: string;
  cards: string[];
  /** Deck-construction format captured with the deck snapshot. */
  formatId?: string;
}
