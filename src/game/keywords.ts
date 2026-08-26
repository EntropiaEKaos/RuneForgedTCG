import type { Keyword } from "./types";

export const KEYWORD_INFO: Record<Keyword, { name: string; desc: string; icon: string }> = {
  Overwhelm: {
    name: "Overwhelm",
    desc: "Excess damage to a blocker spills onto the enemy Nexus.",
    icon: "💢",
  },
  QuickAttack: {
    name: "Quick Attack",
    desc: "Strikes first — kill the blocker before it hits back.",
    icon: "⚡",
  },
  DoubleStrike: {
    name: "Double Strike",
    desc: "Strikes twice: once fast, then again if both survive.",
    icon: "⚔️",
  },
  Elusive: {
    name: "Elusive",
    desc: "Can only be blocked by other Elusive units.",
    icon: "🌀",
  },
  Fearsome: {
    name: "Fearsome",
    desc: "Can only be blocked by units with 3+ power.",
    icon: "😱",
  },
  Lifesteal: {
    name: "Lifesteal",
    desc: "Heals your Nexus for the damage it deals.",
    icon: "🩸",
  },
  Barrier: {
    name: "Barrier",
    desc: "Negates the next damage it would take.",
    icon: "🛡️",
  },
  Tough: {
    name: "Tough",
    desc: "Takes 1 less damage from every source.",
    icon: "🪨",
  },
  Regeneration: {
    name: "Regeneration",
    desc: "Heals to full health at the end of each round.",
    icon: "🌱",
  },
  Challenger: {
    name: "Challenger",
    desc: "While attacking, you may force a chosen enemy to block it.",
    icon: "🎯",
  },
  Unblockable: {
    name: "Unblockable",
    desc: "Can only be blocked by units with Unblockable.",
    icon: "🚫",
  },
  Ephemeral: {
    name: "Ephemeral",
    desc: "Dies at the end of the round or after striking.",
    icon: "💨",
  },
  LastBreath: {
    name: "Last Breath",
    desc: "Triggers an effect when this unit dies.",
    icon: "💀",
  },
  Deathtouch: {
    name: "Deathtouch",
    desc: "Any damage this deals to a unit destroys it.",
    icon: "☠️",
  },
  Poisonous: {
    name: "Poisonous",
    desc: "When it damages a unit, that unit gains a poison counter (loses 1 HP each round).",
    icon: "🧪",
  },
  Haste: {
    name: "Haste",
    desc: "Can attack the same turn it is summoned.",
    icon: "⚡",
  },
  Wither: {
    name: "Wither",
    desc: "Damage it deals permanently reduces the target's max health.",
    icon: "🥀",
  },
  Hexproof: {
    name: "Hexproof",
    desc: "Can't be targeted by enemy spells or abilities.",
    icon: "🔮",
  },
  Reach: {
    name: "Alcance",
    desc: "Pode bloquear criaturas Evasivas.",
    icon: "🕸️",
  },
  Flying: {
    name: "Voo",
    desc: "Só pode ser bloqueado por criaturas com Voo ou Alcance.",
    icon: "🦅",
  },
};

export const RACE_INFO: Record<string, { name: string; icon: string }> = {
  Dragon: { name: "Dragon", icon: "🐉" },
  Sprite: { name: "Sprite", icon: "🌀" },
  Beast: { name: "Beast", icon: "🐾" },
  Voidling: { name: "Voidling", icon: "👁" },
  Warrior: { name: "Warrior", icon: "⚔️" },
  Elemental: { name: "Elemental", icon: "🔥" },
  Spirit: { name: "Spirit", icon: "👻" },
};

