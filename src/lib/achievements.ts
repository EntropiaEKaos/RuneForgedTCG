/** Achievement definitions with requirements and rewards. */
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number; // e.g., win 10 matches
  type: "wins" | "games" | "level" | "cards" | "decks";
  rewardGold: number;
  rewardDust: number;
  rewardXp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_blood",
    name: "First Blood",
    description: "Win your first match",
    icon: "🩸",
    requirement: 1,
    type: "wins",
    rewardGold: 50,
    rewardDust: 20,
    rewardXp: 30,
  },
  {
    id: "novice",
    name: "Novice",
    description: "Win 10 matches",
    icon: "🎖️",
    requirement: 10,
    type: "wins",
    rewardGold: 100,
    rewardDust: 50,
    rewardXp: 50,
  },
  {
    id: "veteran",
    name: "Veteran",
    description: "Win 50 matches",
    icon: "🏅",
    requirement: 50,
    type: "wins",
    rewardGold: 250,
    rewardDust: 100,
    rewardXp: 100,
  },
  {
    id: "champion",
    name: "Champion",
    description: "Win 200 matches",
    icon: "🏆",
    requirement: 200,
    type: "wins",
    rewardGold: 500,
    rewardDust: 250,
    rewardXp: 200,
  },
  {
    id: "grinder",
    name: "Grinder",
    description: "Play 100 matches",
    icon: "⚙️",
    requirement: 100,
    type: "games",
    rewardGold: 150,
    rewardDust: 75,
    rewardXp: 75,
  },
  {
    id: "collector",
    name: "Collector",
    description: "Own 50 unique cards",
    icon: "📚",
    requirement: 50,
    type: "cards",
    rewardGold: 100,
    rewardDust: 100,
    rewardXp: 50,
  },
  {
    id: "decksmith",
    name: "Decksmith",
    description: "Create 10 custom decks",
    icon: "🔨",
    requirement: 10,
    type: "decks",
    rewardGold: 100,
    rewardDust: 50,
    rewardXp: 50,
  },
  {
    id: "level5",
    name: "Rising Star",
    description: "Reach level 5",
    icon: "⭐",
    requirement: 5,
    type: "level",
    rewardGold: 75,
    rewardDust: 50,
    rewardXp: 0,
  },
  {
    id: "level10",
    name: "Established",
    description: "Reach level 10",
    icon: "🌟",
    requirement: 10,
    type: "level",
    rewardGold: 150,
    rewardDust: 100,
    rewardXp: 0,
  },
  {
    id: "level20",
    name: "Master",
    description: "Reach level 20",
    icon: "✨",
    requirement: 20,
    type: "level",
    rewardGold: 300,
    rewardDust: 200,
    rewardXp: 0,
  },
];

export const DAILY_QUESTS = [
  {
    id: "daily_win1",
    name: "Daily Victory",
    description: "Win 1 match today",
    icon: "📅",
    requirement: 1,
    type: "wins" as const,
    rewardGold: 30,
    rewardDust: 10,
    rewardXp: 20,
  },
  {
    id: "daily_play3",
    name: "Active Player",
    description: "Play 3 matches today",
    icon: "🎮",
    requirement: 3,
    type: "games" as const,
    rewardGold: 40,
    rewardDust: 15,
    rewardXp: 30,
  },
  {
    id: "daily_damage",
    name: "Aggro",
    description: "Deal 50 damage to enemy Nexus today",
    icon: "💥",
    requirement: 50,
    type: "damage" as const,
    rewardGold: 35,
    rewardDust: 15,
    rewardXp: 25,
  },
];

export function xpForLevel(level: number): number {
  // Simple curve: 100 XP per level, scaling by 10% each level
  return Math.floor(100 * Math.pow(1.1, level - 1));
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  let required = xpForLevel(level);
  while (totalXp >= required) {
    totalXp -= required;
    level++;
    required = xpForLevel(level);
  }
  return level;
}
