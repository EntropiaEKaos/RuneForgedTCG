import type { CardDef } from "../../types";
import { VANILLA_FLORESTIA_CARDS } from "./forest";

/**
 * Vanilla 1.11 production candidate overrides.
 *
 * Keep this layer intentionally explicit and minimal: the underlying Vanilla
 * regional catalog remains the historical source snapshot, while approved
 * balance iterations are applied as narrow, versioned CardDef replacements.
 */
const caçadoraDaAlcateia = VANILLA_FLORESTIA_CARDS.van_forest_u04;
if (!caçadoraDaAlcateia) throw new Error("Vanilla 1.11 requires van_forest_u04");

export const VANILLA_1_11_CARD_OVERRIDES: Record<string, CardDef> = {
  van_forest_u04: {
    ...caçadoraDaAlcateia,
    // 1.11 high-sample finalist: 2/3 -> 2/4. No cost, power, race or effect mutation.
    health: 4,
  },
};
