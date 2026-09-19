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


export type BattlefieldLabPoint = { x: number; y: number; angle: number };

export function layoutBattlefieldEntities(
  scenario: BattlefieldLabScenario,
  width: number,
  height: number,
): Record<string, BattlefieldLabPoint> {
  const result: Record<string, BattlefieldLabPoint> = {};
  const fourPlayer = scenario.players.length === 4;
  const cols = fourPlayer ? 2 : 1;
  const rows = Math.ceil(scenario.players.length / cols);
  const zoneW = width / cols;
  const zoneH = height / rows;

  scenario.players.forEach((player, playerIndex) => {
    const entities = scenario.entities.filter((entity) => entity.controllerId === player.id);
    const col = playerIndex % cols;
    const row = Math.floor(playerIndex / cols);
    const x0 = col * zoneW;
    const y0 = row * zoneH;
    const unitCols = Math.max(4, Math.min(10, Math.ceil(Math.sqrt(entities.length * 1.6))));
    const availableW = zoneW - 30;
    const availableH = zoneH - 55;
    const gapX = availableW / unitCols;
    const unitRows = Math.max(1, Math.ceil(entities.length / unitCols));
    const gapY = availableH / unitRows;

    entities.forEach((entity, index) => {
      result[entity.id] = {
        x: x0 + 16 + (index % unitCols) * gapX + gapX / 2,
        y: y0 + 48 + Math.floor(index / unitCols) * gapY + gapY / 2,
        angle: entity.tapped ? 18 : 0,
      };
    });
  });

  return result;
}


export type BattlefieldInteractionIntent =
  | { type: "select"; sourceId: string }
  | { type: "target"; sourceId: string; targetId: string }
  | { type: "cancel"; sourceId?: string };

export type BattlefieldTargetPreview = {
  sourceId: string;
  targetId: string;
  relation: "friendly" | "opponent";
};

export function previewBattlefieldTarget(
  scenario: BattlefieldLabScenario,
  sourceId: string,
  targetId: string,
): BattlefieldTargetPreview | null {
  if (sourceId === targetId) return null;
  const source = scenario.entities.find((entity) => entity.id === sourceId);
  const target = scenario.entities.find((entity) => entity.id === targetId);
  if (!source || !target) return null;
  return {
    sourceId,
    targetId,
    relation: source.controllerId === target.controllerId ? "friendly" : "opponent",
  };
}


export type BattlefieldCombatIntent =
  | { type: "declare-attacker"; attackerId: string; defendingPlayerId: string }
  | { type: "declare-blocker"; blockerId: string; attackerId: string }
  | { type: "clear-combat" };

export type BattlefieldCombatPreview = {
  attackerId: string;
  blockerId?: string;
  defendingPlayerId: string;
};

export function previewBattlefieldCombat(
  scenario: BattlefieldLabScenario,
  intent: BattlefieldCombatIntent,
): BattlefieldCombatPreview | null {
  if (intent.type === "clear-combat") return null;
  if (intent.type === "declare-attacker") {
    const attacker = scenario.entities.find((entity) => entity.id === intent.attackerId);
    const defender = scenario.players.find((player) => player.id === intent.defendingPlayerId);
    if (!attacker || !defender || attacker.controllerId === defender.id) return null;
    return { attackerId: attacker.id, defendingPlayerId: defender.id };
  }
  const blocker = scenario.entities.find((entity) => entity.id === intent.blockerId);
  const attacker = scenario.entities.find((entity) => entity.id === intent.attackerId);
  if (!blocker || !attacker || blocker.controllerId === attacker.controllerId) return null;
  return { attackerId: attacker.id, blockerId: blocker.id, defendingPlayerId: blocker.controllerId };
}
