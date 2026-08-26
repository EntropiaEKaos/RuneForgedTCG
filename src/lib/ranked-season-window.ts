export interface RankedSeasonWindow {
  id: number;
  name: string;
  startAt: Date;
  endAt: Date;
  active: boolean;
}

export function isRankedSeasonOpen(
  season: Pick<RankedSeasonWindow, "active" | "startAt" | "endAt">,
  now = new Date(),
): boolean {
  return season.active && season.startAt.getTime() <= now.getTime() && season.endAt.getTime() > now.getTime();
}
