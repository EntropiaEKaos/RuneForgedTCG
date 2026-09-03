import { getCustomCardArtCached } from "./catalog";
import { flagshipChampionArtUrl } from "./flagship-champion-art";
import { flagshipStructureArtUrl } from "./flagship-structure-art";
import { flagshipRitualArtUrl } from "./flagship-ritual-art";

export interface CardArtAssignment { defId: string; url: string; crop?: { x?: number; y?: number; scale?: number } | null; }
const browserArt: Record<string, Omit<CardArtAssignment, "defId">> = {};

export function replaceRegisteredCardArt(rows: CardArtAssignment[]) {
  for (const key of Object.keys(browserArt)) delete browserArt[key];
  for (const row of rows) if (row?.defId && (/^\//.test(row.url) || /^https:\/\//i.test(row.url))) browserArt[row.defId] = { url: row.url, crop: row.crop || undefined };
}

export function getCardArt(defId: string) {
  const editorial = browserArt[defId] ?? getCustomCardArtCached(defId);
  if (editorial) return editorial;
  const flagshipUrl = flagshipChampionArtUrl(defId) ?? flagshipStructureArtUrl(defId) ?? flagshipRitualArtUrl(defId);
  return flagshipUrl ? { url: flagshipUrl } : undefined;
}
