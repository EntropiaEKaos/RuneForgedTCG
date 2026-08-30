import type { AdminRole } from "./admin-auth";

export const STUDIO_AUTHORING_ROLES = ["admin", "designer"] as const satisfies readonly AdminRole[];

export type StudioUiCapability =
  | "authoring"
  | "delete"
  | "production"
  | "liveops"
  | "players"
  | "operations"
  | "operators"
  | "control"
  | "payments"
  | "runtime"
  | "balance"
  | "qa-tools"
  | "brawl";

const ALL_STUDIO_UI_CAPABILITIES: readonly StudioUiCapability[] = [
  "authoring",
  "delete",
  "production",
  "liveops",
  "players",
  "operations",
  "operators",
  "control",
  "payments",
  "runtime",
  "balance",
  "qa-tools",
  "brawl",
];

const STUDIO_UI_CAPABILITIES_BY_ROLE: Record<AdminRole, readonly StudioUiCapability[]> = {
  admin: ALL_STUDIO_UI_CAPABILITIES,
  designer: ["authoring"],
  qa: ["production", "balance", "qa-tools", "brawl"],
  publisher: ["production"],
  liveops: ["liveops"],
};

export function canAccessStudioAuthoring(role: AdminRole | string | null | undefined): role is AdminRole {
  return role === "admin" || role === "designer";
}

export function hasStudioUiCapability(
  role: AdminRole | string | null | undefined,
  capability: StudioUiCapability,
): boolean {
  if (!role || !(role in STUDIO_UI_CAPABILITIES_BY_ROLE)) return false;
  return STUDIO_UI_CAPABILITIES_BY_ROLE[role as AdminRole].includes(capability);
}

export function studioLandingForRole(role: AdminRole | string | null | undefined): string {
  if (role === "qa" || role === "publisher") return "/admin/studio/production";
  if (role === "liveops") return "/admin/studio/ops";
  return "/admin/studio";
}
