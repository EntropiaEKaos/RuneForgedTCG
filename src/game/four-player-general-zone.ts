import { GENERAL_RECAST_TAX, type FourPlayerSeat } from "./four-player-general";

export type GeneralZoneLocation = "general_zone" | "stack" | "battlefield" | "graveyard" | "exile";

export interface FourPlayerGeneralZoneState {
  owner: FourPlayerSeat;
  defId: string;
  location: GeneralZoneLocation;
  castsFromGeneralZone: number;
}

export function createGeneralZoneState(owner: FourPlayerSeat, defId: string): FourPlayerGeneralZoneState {
  if (!defId) throw new Error("General defId is required.");
  return { owner, defId, location: "general_zone", castsFromGeneralZone: 0 };
}

export function currentGeneralRecastTax(state: FourPlayerGeneralZoneState): number {
  return state.castsFromGeneralZone * GENERAL_RECAST_TAX;
}

export function generalCastCost(state: FourPlayerGeneralZoneState, printedCost: number): number {
  if (printedCost < 0) throw new Error("General printed cost cannot be negative.");
  return printedCost + currentGeneralRecastTax(state);
}

export function assertGeneralCastTiming(activeSeat: FourPlayerSeat, phase: string, stackSize: number, actor: FourPlayerSeat): void {\n  if (activeSeat !== actor) throw new Error("General may only be cast by the active player.");\n  if (phase !== "main_1" && phase !== "main_2") throw new Error("General may only be cast during a main phase.");\n  if (stackSize !== 0) throw new Error("General may only be cast while the stack is empty.");\n}\n\n/** Records an authoritative cast from the public General Zone. */
export function castGeneralFromZone(state: FourPlayerGeneralZoneState): FourPlayerGeneralZoneState {
  if (state.location !== "general_zone") throw new Error("General can only be cast from the General Zone.");
  return { ...state, location: "stack", castsFromGeneralZone: state.castsFromGeneralZone + 1 };
}

export function resolveGeneralToBattlefield(state: FourPlayerGeneralZoneState): FourPlayerGeneralZoneState {
  if (state.location !== "stack") throw new Error("Only a General on the stack can resolve to the battlefield.");
  return { ...state, location: "battlefield" };
}

/**
 * Replacement choice used when the General would leave the battlefield for a public zone.
 * V0 supports graveyard/exile; future zone adapters can extend this without changing 1v1.
 */
export function moveGeneralFromBattlefield(
  state: FourPlayerGeneralZoneState,
  destination: "graveyard" | "exile",
  returnToGeneralZone: boolean,
): FourPlayerGeneralZoneState {
  if (state.location !== "battlefield") throw new Error("General is not on the battlefield.");
  return { ...state, location: returnToGeneralZone ? "general_zone" : destination };
}

export function returnGeneralToZone(state: FourPlayerGeneralZoneState): FourPlayerGeneralZoneState {
  return { ...state, location: "general_zone" };
}
