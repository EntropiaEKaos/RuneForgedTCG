import type { CardDef, Keyword, TriggerWhen } from "./types";

/**
 * Runtime domains identify the authoritative engine surface that gives a
 * keyword meaning today. This is semantic metadata only: actions/state remain
 * the execution engine and this contract must not duplicate their behavior.
 */
export type KeywordRuntimeDomain =
  | "attack"
  | "blocking"
  | "strike"
  | "damage"
  | "round"
  | "targeting"
  | "death";

export interface KeywordContract {
  name: string;
  desc: string;
  icon: string;
  support: "supported";
  runtimeDomains: readonly KeywordRuntimeDomain[];
  /** Whether grantKeyword / Equipment can add this keyword meaningfully at runtime. */
  grantable: boolean;
  /** Structural trigger required when the keyword is printed on a card. */
  requiresTrigger?: TriggerWhen;
}

/** Canonical closed vocabulary shared with Card Studio / authoring. */
export const CANONICAL_KEYWORDS = [
  "Overwhelm",
  "QuickAttack",
  "DoubleStrike",
  "Elusive",
  "Lifesteal",
  "Barrier",
  "Fearsome",
  "Tough",
  "Regeneration",
  "Challenger",
  "Unblockable",
  "Ephemeral",
  "LastBreath",
  "Deathtouch",
  "Poisonous",
  "Haste",
  "Wither",
  "Hexproof",
  "Reach",
  "Flying",
] as const satisfies readonly Keyword[];

export const KEYWORD_INFO: Record<Keyword, KeywordContract> = {
  Overwhelm: {
    name: "Overwhelm",
    desc: "Excess damage to a blocker spills onto the enemy Nexus.",
    icon: "💢",
    support: "supported",
    runtimeDomains: ["strike", "damage"],
    grantable: true,
  },
  QuickAttack: {
    name: "Quick Attack",
    desc: "Strikes first — kill the blocker before it hits back.",
    icon: "⚡",
    support: "supported",
    runtimeDomains: ["strike"],
    grantable: true,
  },
  DoubleStrike: {
    name: "Double Strike",
    desc: "Strikes twice: once fast, then again if both survive.",
    icon: "⚔️",
    support: "supported",
    runtimeDomains: ["strike"],
    grantable: true,
  },
  Elusive: {
    name: "Elusive",
    desc: "Can only be blocked by units with Elusive or Reach.",
    icon: "🌀",
    support: "supported",
    runtimeDomains: ["blocking"],
    grantable: true,
  },
  Fearsome: {
    name: "Fearsome",
    desc: "Can only be blocked by units with 3+ power.",
    icon: "😱",
    support: "supported",
    runtimeDomains: ["blocking"],
    grantable: true,
  },
  Lifesteal: {
    name: "Lifesteal",
    desc: "Heals your Nexus for the damage it deals.",
    icon: "🩸",
    support: "supported",
    runtimeDomains: ["damage"],
    grantable: true,
  },
  Barrier: {
    name: "Barrier",
    desc: "Negates the next damage it would take.",
    icon: "🛡️",
    support: "supported",
    runtimeDomains: ["damage"],
    grantable: true,
  },
  Tough: {
    name: "Tough",
    desc: "Takes 1 less damage from every source.",
    icon: "🪨",
    support: "supported",
    runtimeDomains: ["damage"],
    grantable: true,
  },
  Regeneration: {
    name: "Regeneration",
    desc: "Heals to full health at the end of each round.",
    icon: "🌱",
    support: "supported",
    runtimeDomains: ["round"],
    grantable: true,
  },
  Challenger: {
    name: "Challenger",
    desc: "While attacking, you may force a chosen enemy to block it.",
    icon: "🎯",
    support: "supported",
    runtimeDomains: ["attack", "blocking"],
    grantable: true,
  },
  Unblockable: {
    name: "Unblockable",
    desc: "Can only be blocked by units with Unblockable.",
    icon: "🚫",
    support: "supported",
    runtimeDomains: ["blocking"],
    grantable: true,
  },
  Ephemeral: {
    name: "Ephemeral",
    desc: "Dies at the end of the round or after striking.",
    icon: "💨",
    support: "supported",
    runtimeDomains: ["strike", "round"],
    grantable: true,
  },
  LastBreath: {
    name: "Last Breath",
    desc: "Triggers the card's death effect when this unit dies.",
    icon: "💀",
    support: "supported",
    runtimeDomains: ["death"],
    grantable: false,
    requiresTrigger: "onDeath",
  },
  Deathtouch: {
    name: "Deathtouch",
    desc: "Any damage this deals to a unit destroys it.",
    icon: "☠️",
    support: "supported",
    runtimeDomains: ["damage"],
    grantable: true,
  },
  Poisonous: {
    name: "Poisonous",
    desc: "Damage this unit deals to the enemy Nexus also gives that player poison counters. 10 poison counters cause defeat.",
    icon: "🧪",
    support: "supported",
    runtimeDomains: ["damage"],
    grantable: true,
  },
  Haste: {
    name: "Haste",
    desc: "Can attack the same turn it is summoned.",
    icon: "⚡",
    support: "supported",
    runtimeDomains: ["attack"],
    grantable: true,
  },
  Wither: {
    name: "Wither",
    desc: "Damage it deals permanently reduces the target's max health.",
    icon: "🥀",
    support: "supported",
    runtimeDomains: ["damage"],
    grantable: true,
  },
  Hexproof: {
    name: "Hexproof",
    desc: "Can't be targeted by enemy spells or abilities.",
    icon: "🔮",
    support: "supported",
    runtimeDomains: ["targeting"],
    grantable: true,
  },
  Reach: {
    name: "Reach",
    desc: "Can block units with Elusive and units with Flying.",
    icon: "🕸️",
    support: "supported",
    runtimeDomains: ["blocking"],
    grantable: true,
  },
  Flying: {
    name: "Flying",
    desc: "Can only be blocked by units with Flying or Reach.",
    icon: "🦅",
    support: "supported",
    runtimeDomains: ["blocking"],
    grantable: true,
  },
};

export function keywordIsGrantable(keyword: Keyword): boolean {
  return KEYWORD_INFO[keyword].grantable;
}

/**
 * Continuous Aura grants intentionally exclude Barrier: Barrier owns consumable
 * instance state, so source re-derivation must never recreate a spent shield.
 * LastBreath is already excluded because its executable death trigger cannot be
 * transferred safely as a plain keyword grant.
 */
export const AURA_GRANTABLE_KEYWORDS = CANONICAL_KEYWORDS.filter(
  (keyword): keyword is Keyword => keyword !== "Barrier" && keywordIsGrantable(keyword),
);

export function keywordIsAuraGrantable(keyword: Keyword): boolean {
  return AURA_GRANTABLE_KEYWORDS.includes(keyword);
}

/**
 * Continuous hostile suppression uses the same plain-runtime keyword boundary,
 * but is modeled separately so future grant/suppression capabilities can evolve
 * independently. Barrier is excluded because its shield is consumable instance
 * state; LastBreath is excluded because its executable onDeath contract lives
 * outside the effective keyword array.
 */
export const AURA_SUPPRESSIBLE_KEYWORDS = CANONICAL_KEYWORDS.filter(
  (keyword): keyword is Keyword => keyword !== "Barrier" && keyword !== "LastBreath",
);

export function keywordIsAuraSuppressible(keyword: Keyword): boolean {
  return AURA_SUPPRESSIBLE_KEYWORDS.includes(keyword);
}

/**
 * Printed Last Breath is a marker for an executable death ability, not an
 * effect by itself. Reject authored cards that would publish that marker inert.
 */
export function keywordCardContractError(
  card: Pick<CardDef, "keywords" | "trigger" | "mechanics">,
): string | null {
  for (const keyword of card.keywords ?? []) {
    const required = KEYWORD_INFO[keyword].requiresTrigger;
    if (!required) continue;
    const hasRequiredTrigger =
      card.trigger?.when === required || card.mechanics?.some((mechanic) => mechanic.trigger === required);
    if (!hasRequiredTrigger) {
      return `${KEYWORD_INFO[keyword].name} requires an executable ${required} trigger on the card.`;
    }
  }
  return null;
}

export const RACE_INFO: Record<string, { name: string; icon: string }> = {
  Dragon: { name: "Dragon", icon: "🐉" },
  Sprite: { name: "Sprite", icon: "🌀" },
  Beast: { name: "Beast", icon: "🐾" },
  Voidling: { name: "Voidling", icon: "👁" },
  Warrior: { name: "Warrior", icon: "⚔️" },
  Elemental: { name: "Elemental", icon: "🔥" },
  Spirit: { name: "Spirit", icon: "👻" },
};
