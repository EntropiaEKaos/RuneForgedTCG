import { CONTENT_RESOURCES, validateContent } from "./content-validation";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";

if (!CONTENT_RESOURCES.includes("cards")) throw new Error("Content pipeline lost cards resource");
if (!ENGINE_VERSION || !RULESET_VERSION) throw new Error("Engine/ruleset version missing");
const good = validateContent("cards", {
  data: {
    defId: "custom_regression",
    name: "Regression Card",
    type: "Unit",
    region: "Emberhold",
    rarity: "Common",
    cost: 1,
    description: "Valid minimal card used to certify the content pipeline.",
    emoji: "🛡️",
  },
});
if (!good.passed) throw new Error(`Card content validation regression: ${good.errors.join(", ")}`);
console.log("content-regression: ok");
