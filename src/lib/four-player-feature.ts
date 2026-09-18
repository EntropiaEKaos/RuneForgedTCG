export function fourPlayerGeneralEnabled(): boolean {
  return process.env.FOUR_PLAYER_GENERAL_ENABLED === "true";
}

export function fourPlayerFeatureGate(): Response | null {
  if (fourPlayerGeneralEnabled()) return null;
  return Response.json(
    { ok: false, error: "Four Player + General is not enabled on this environment", code: "FOUR_PLAYER_DISABLED" },
    { status: 503 },
  );
}
