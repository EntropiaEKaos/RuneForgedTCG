export type BattlefieldLabMode = "duel-1v1" | "commander-4p";

export type BattlefieldPresentationPlayer = {
  id: string;
  label: string;
  life: number;
  seat: number;
};

export type BattlefieldPresentationEntity = {
  id: string;
  controllerId: string;
  kind: "unit" | "token";
  tapped: boolean;
  power: number;
  toughness: number;
};

export type BattlefieldLabScenario = {
  schemaVersion: 1;
  seed: number;
  mode: BattlefieldLabMode;
  players: BattlefieldPresentationPlayer[];
  entities: BattlefieldPresentationEntity[];
};

export function buildBattlefieldLabScenario(mode: BattlefieldLabMode, requestedUnits = 48): BattlefieldLabScenario {
  const playerCount = mode === "commander-4p" ? 4 : 2;
  const units = Math.max(playerCount, Math.min(160, Math.floor(requestedUnits / playerCount) * playerCount));
  const players = Array.from({ length: playerCount }, (_, seat) => ({
    id: `p${seat + 1}`,
    label: mode === "commander-4p" ? `Commander ${seat + 1}` : `Player ${seat + 1}`,
    life: mode === "commander-4p" ? 40 : 20,
    seat,
  }));
  const entities = Array.from({ length: units }, (_, index) => {
    const controller = players[index % playerCount];
    return {
      id: `lab-${mode}-${String(index + 1).padStart(3, "0")}`,
      controllerId: controller.id,
      kind: index % 5 === 0 ? "token" as const : "unit" as const,
      tapped: index % 7 === 0,
      power: 1 + (index % 6),
      toughness: 1 + ((index * 3) % 7),
    };
  });
  return { schemaVersion: 1, seed: mode === "commander-4p" ? 404240 : 101240, mode, players, entities };
}
