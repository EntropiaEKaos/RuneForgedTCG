import type { AdminRole } from "./admin-auth";

export const STUDIO_AUTHORING_ROLES = ["admin", "designer"] as const satisfies readonly AdminRole[];

export function canAccessStudioAuthoring(role: AdminRole | string | null | undefined): role is AdminRole {
  return role === "admin" || role === "designer";
}

export function studioLandingForRole(role: AdminRole | string | null | undefined): string {
  if (role === "qa" || role === "publisher") return "/admin/studio/production";
  if (role === "liveops") return "/admin/studio/ops";
  return "/admin/studio";
}
