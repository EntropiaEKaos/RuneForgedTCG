import { runCardLaboratory } from "./card-laboratory";
import { clearRegisteredCustomCards, getRegisteredCustomCard, registerCustomCards } from "./custom-registry";
import type { CardDef } from "./types";

const card: CardDef = {
  defId: "lab_unit",
  name: "Lab Unit",
  region: "Emberhold",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 2,
  description: "Lab",
  rarity: "Common",
  emoji: "L",
};

clearRegisteredCustomCards();
const previous: CardDef = {
  ...card,
  defId: "preexisting_registry_card",
  name: "Preexisting Registry Card",
};
registerCustomCards([previous]);

const report = runCardLaboratory(card, 4);
if (!report.valid || report.failed) throw new Error(JSON.stringify(report));
if (getRegisteredCustomCard(card.defId)) throw new Error("Card Laboratory leaked its draft card into the global registry");
if (getRegisteredCustomCard(previous.defId)?.name !== previous.name) throw new Error("Card Laboratory did not restore the previous registry snapshot");

clearRegisteredCustomCards();
console.log("CARD LABORATORY: 4/4 PASS + registry isolation PASS");
