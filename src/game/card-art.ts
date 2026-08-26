import { getCustomCardArtCached } from "./catalog";

export interface CardArtAssignment { defId: string; url: string; crop?: { x?: number; y?: number; scale?: number } | null; }
const browserArt: Record<string, Omit<CardArtAssignment, "defId">> = {};

export function replaceRegisteredCardArt(rows: CardArtAssignment[]) {
  for (const key of Object.keys(browserArt)) delete browserArt[key];
  for (const row of rows) if (row?.defId && (/^\//.test(row.url) || /^https:\/\//i.test(row.url))) browserArt[row.defId] = { url: row.url, crop: row.crop || undefined };
}
export function getCardArt(defId: string) { return browserArt[defId] ?? getCustomCardArtCached(defId); }
