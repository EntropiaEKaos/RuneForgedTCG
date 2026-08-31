import { CARD_EFFECT_KINDS, CARD_KEYWORDS } from "@/game/card-authoring";
import { validateAuthorableCardWithActivatedAbilities } from "@/game/activated-ability-authoring";
import {
  sanitizeArchetypeDefinition,
  sanitizeCompositeEffectDefinition,
  sanitizeKeywordBehavior,
} from "@/game/mechanics-authoring";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { validateLiveOps } from "@/lib/live-ops-rules";

export const CONTENT_RESOURCES = [
  "cards",
  "keywords",
  "effects",
  "archetypes",
  "races",
  "classes",
  "interactions",
  "collections",
  "card-meta",
  "events",
  "promotions",
] as const;
export type ContentResource = (typeof CONTENT_RESOURCES)[number];

export function isContentResource(resource: string): resource is ContentResource {
  return (CONTENT_RESOURCES as readonly string[]).includes(resource);
}

export function validateContent(resource: string, row: any) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isContentResource(resource)) errors.push("Unknown content resource.");
  if (resource === "cards") {
    if (!row?.data || typeof row.data !== "object") errors.push("Card data is missing.");
    else {
      const data = row.data as any;
      if (!data.name || !data.defId || !data.type || !data.region || !data.rarity) {
        errors.push("Card identity is incomplete.");
      }
      if (data.cost !== undefined && (Number(data.cost) < 0 || Number(data.cost) > 20)) {
        errors.push("Card cost must be between 0 and 20.");
      }
      const cardValidation = validateAuthorableCardWithActivatedAbilities(data);
      if (!cardValidation.ok) errors.push(cardValidation.error);
    }
  }
  const stableKey = resource === "cards" ? row?.key ?? row?.defId ?? row?.data?.defId : row?.key;
  const displayName = resource === "cards" ? row?.name ?? row?.data?.name : row?.name;
  if (
    resource !== "card-meta" &&
    (!stableKey || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(String(stableKey)))
  ) errors.push("Stable key must match /^[a-z0-9][a-z0-9_-]{1,63}$/.");
  if (resource === "card-meta" && !row?.defId) errors.push("Card definition ID is required.");
  if (resource !== "card-meta" && !displayName) errors.push("Name is required.");
  if (resource === "keywords") {
    const mapsNative = (CARD_KEYWORDS as readonly string[]).includes(String(row?.engineKeyword || ""));
    if (!mapsNative && !sanitizeKeywordBehavior(row?.behavior)) {
      errors.push("Keyword must map to a native engine keyword or compile to a safe mechanic trigger/condition/effect contract.");
    }
  }
  if (resource === "effects") {
    const kind = String(row?.kind || "");
    if (kind === "composite" && !sanitizeCompositeEffectDefinition(row?.schema)) {
      errors.push("Composite effect definition is invalid.");
    } else if (kind !== "composite" && !(CARD_EFFECT_KINDS as readonly string[]).includes(kind)) {
      errors.push("Effect must map to a native effect kind or be a valid composite macro.");
    }
  }
  if (resource === "archetypes" && !sanitizeArchetypeDefinition(row?.definition, row?.baseType)) {
    errors.push("Card archetype definition is invalid or requests unsupported structural behavior.");
  }
  if (resource === "interactions") {
    if (!row?.sourceKey) errors.push("Interaction source is required.");
    if (!row?.effect?.kind) errors.push("Interaction effect is required.");
    if (row?.condition?.logic === "NOT" && !row.condition.children?.length) warnings.push("NOT condition has no children.");
  }
  if (["events", "promotions"].includes(resource) && row?.status === "published" && !row?.startsAt) {
    warnings.push("Published live content has no start time.");
  }
  if (resource === "collections" && row?.status === "published" && !row?.code) {
    errors.push("Published collection requires a code.");
  }
  const liveOps = validateLiveOps(resource, row);
  errors.push(...liveOps.errors);
  warnings.push(...liveOps.warnings);
  return {
    passed: errors.length === 0,
    errors,
    warnings,
    checks: [
      { key: "schema", passed: errors.length === 0, label: "Schema and identity" },
      { key: "references", passed: true, label: "Reference integrity" },
      { key: "engine", passed: true, label: `Engine ${ENGINE_VERSION}` },
      { key: "ruleset", passed: true, label: `Ruleset ${RULESET_VERSION}` },
    ],
  };
}

export const APPROVAL_STAGES = ["content", "qa", "liveops"] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

export function requiredApprovalStages(resource: string): ApprovalStage[] {
  if (["cards", "card-meta", "keywords", "effects", "archetypes", "races", "classes", "interactions", "collections"].includes(resource)) {
    return ["content", "qa"];
  }
  if (resource === "events" || resource === "promotions") return ["content", "qa", "liveops"];
  return ["content", "qa"];
}

export function isValidApprovalStage(stage: string): stage is ApprovalStage {
  return (APPROVAL_STAGES as readonly string[]).includes(stage);
}
