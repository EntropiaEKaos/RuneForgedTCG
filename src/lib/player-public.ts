import type { players } from "../db/schema";
import { levelFromXp } from "./achievements";

type PlayerRow = typeof players.$inferSelect;

/** Explicit allow-list for data returned to the account owner. Never spread DB player rows into HTTP responses. */
export function playerSelfDto(player: PlayerRow) {
  return {
    id: player.id,
    name: player.name,
    xp: player.xp,
    level: levelFromXp(player.xp),
    gold: player.gold,
    dust: player.dust,
    mmr: player.mmr,
    peakMmr: player.peakMmr,
    rankedWins: player.rankedWins,
    rankedLosses: player.rankedLosses,
    rankedGamesInPlacement: player.rankedGamesInPlacement,
    loginStreak: player.loginStreak,
    lastLogin: player.lastLogin,
    createdAt: player.createdAt,
    lastDaily: player.lastDaily,
    avatar: player.avatar,
    cardBack: player.cardBack,
    title: player.title,
    bio: player.bio,
    banner: player.banner,
    status: player.status,
    badges: player.badges,
  };
}

/** Ranked screen DTO excludes recovery, moderation and economy-only account fields. */
export function playerRankedDto(player: PlayerRow) {
  return {
    id: player.id,
    name: player.name,
    mmr: player.mmr,
    peakMmr: player.peakMmr,
    rankedWins: player.rankedWins,
    rankedLosses: player.rankedLosses,
    rankedGamesInPlacement: player.rankedGamesInPlacement,
    avatar: player.avatar,
    title: player.title,
    badges: player.badges,
  };
}
