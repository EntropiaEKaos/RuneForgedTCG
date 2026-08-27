import { NextRequest } from "next/server";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { requireAdminStepUp } from "@/lib/admin-step-up";
import { DEFAULT_CONFIG, GameConfigConflictError, GameConfigValidationError, getGameConfigRevision, loadGameConfig, saveGameConfig, validateGameConfig, type AdvancedGameConfig, type GameConfig } from "@/game/settings";
import { adminAuditLogs } from "@/db/schema";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "liveops")) return Response.json({ ok: false, error: `Role ${actor.role} cannot view game settings` }, { status: 403 });
  try {
    const config = await loadGameConfig();
    return Response.json({ ok: true, config, defaults: DEFAULT_CONFIG, revision: getGameConfigRevision() });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "liveops")) return Response.json({ ok: false, error: `Role ${actor.role} cannot modify game settings` }, { status: 403 });
  try {
    const body = await req.json();
    const stepUp = await requireAdminStepUp(req, actor, body, {
      scope: "admin-game-settings",
      actionLabel: "global game settings changes",
    });
    if (stepUp) return stepUp;

    const partial: Partial<GameConfig> = {};

    const num = (k: keyof GameConfig, min: number, max: number) => {
      if (body[k] !== undefined) {
        const v = Number(body[k]);
        if (Number.isFinite(v)) (partial as Record<string, number>)[k] = Math.max(min, Math.min(max, Math.floor(v)));
      }
    };

    num("nexusStart", 5, 50);
    num("maxMana", 5, 15);
    num("maxSpellMana", 0, 10);
    num("handCap", 5, 15);
    num("startHand", 1, 10);
    num("benchCap", 3, 10);
    num("permanentsCap", 1, 8);
    num("deckMin", 10, 40);
    num("deckMax", 20, 60);
    num("maxCopies", 1, 10);
    num("maxRegions", 1, 3);
    num("reactionMs", 3000, 60000);

    if (typeof body.aiEnabled === "boolean") partial.aiEnabled = body.aiEnabled;
    if (typeof body.rankedEnabled === "boolean") partial.rankedEnabled = body.rankedEnabled;
    if (typeof body.maintenanceMode === "boolean") partial.maintenanceMode = body.maintenanceMode;
    if (typeof body.announcement === "string") partial.announcement = body.announcement.slice(0, 500);

    if (body.advanced !== undefined) {
      if (!body.advanced || typeof body.advanced !== "object" || Array.isArray(body.advanced)) return Response.json({ ok: false, error: "advanced must be an object" }, { status: 400 });
      const raw = body.advanced as Record<string, any>;
      const current = (await loadGameConfig()).advanced;
      const advanced: AdvancedGameConfig = structuredClone(current);
      const bounded = (value: unknown, min: number, max: number, fallback: number) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
      if (raw.engine) {
        advanced.engine.runtimeOverridesEnabled = Boolean(raw.engine.runtimeOverridesEnabled);
        advanced.engine.maxRounds = Math.floor(bounded(raw.engine.maxRounds, 10, 2000, current.engine.maxRounds));
        advanced.engine.fatigueEnabled = Boolean(raw.engine.fatigueEnabled);
        advanced.engine.fatigueStart = Math.floor(bounded(raw.engine.fatigueStart, 0, 100, current.engine.fatigueStart));
        advanced.engine.fatigueStep = Math.floor(bounded(raw.engine.fatigueStep, 0, 100, current.engine.fatigueStep));
        if (Array.isArray(raw.engine.actionAllowlist)) advanced.engine.actionAllowlist = raw.engine.actionAllowlist.map(String).filter((x: string) => x.length <= 40).slice(0, 100);
        if (Array.isArray(raw.engine.phaseSequence)) advanced.engine.phaseSequence = raw.engine.phaseSequence.map(String).filter((x: string) => x.length <= 40).slice(0, 30);
      }
      if (raw.ai) {
        if (["apprentice", "tactician", "overlord"].includes(String(raw.ai.defaultDifficulty))) advanced.ai.defaultDifficulty = raw.ai.defaultDifficulty;
        advanced.ai.aggressionScale = bounded(raw.ai.aggressionScale, 0, 5, current.ai.aggressionScale);
        advanced.ai.valueScale = bounded(raw.ai.valueScale, 0, 5, current.ai.valueScale);
        advanced.ai.reactionDepth = Math.floor(bounded(raw.ai.reactionDepth, 0, 10, current.ai.reactionDepth));
        advanced.ai.randomness = bounded(raw.ai.randomness, 0, 1, current.ai.randomness);
      }
      if (raw.matchmaking) for (const [key, min, max] of [["baseRange",0,5000],["maxRange",0,10000],["rangeStep",0,1000],["rangeStepSeconds",1,600],["staleSeconds",5,600],["queueTtlSeconds",30,86400],["aiFallbackSeconds",0,600],["rematchCooldownSeconds",0,86400]] as const) (advanced.matchmaking as any)[key] = Math.floor(bounded(raw.matchmaking[key], min, max, (current.matchmaking as any)[key]));
      if (advanced.matchmaking.baseRange > advanced.matchmaking.maxRange) return Response.json({ ok: false, error: "matchmaking.baseRange cannot exceed maxRange" }, { status: 400 });
      if (raw.ranked) for (const [key, min, max] of [["eloDivisor",50,5000],["placementK",1,500],["normalK",1,500],["minimumMmr",0,100000],["leaderboardSize",1,500]] as const) (advanced.ranked as any)[key] = Math.floor(bounded(raw.ranked[key], min, max, (current.ranked as any)[key]));
      if (raw.economy) {
        advanced.economy.loginClaimHours = bounded(raw.economy.loginClaimHours, 1, 168, current.economy.loginClaimHours);
        advanced.economy.loginResetHours = bounded(raw.economy.loginResetHours, 1, 720, current.economy.loginResetHours);
        advanced.economy.duplicateCap = Math.floor(bounded(raw.economy.duplicateCap, 1, 10, current.economy.duplicateCap));
        for (const rarity of ["Common", "Rare", "Epic", "Legend"] as const) advanced.economy.dustValues[rarity] = Math.floor(bounded(raw.economy.dustValues?.[rarity], 0, 1_000_000, current.economy.dustValues[rarity]));
      }
      if (raw.presentation) {
        advanced.presentation.defaultTheme = String(raw.presentation.defaultTheme || current.presentation.defaultTheme).slice(0, 80);
        advanced.presentation.defaultBoard = String(raw.presentation.defaultBoard || current.presentation.defaultBoard).slice(0, 80);
        advanced.presentation.fxIntensity = bounded(raw.presentation.fxIntensity, 0, 2, current.presentation.fxIntensity);
        advanced.presentation.masterVolume = bounded(raw.presentation.masterVolume, 0, 1, current.presentation.masterVolume);
        advanced.presentation.reduceMotionDefault = Boolean(raw.presentation.reduceMotionDefault);
        advanced.presentation.artFallbackUrl = String(raw.presentation.artFallbackUrl || "").slice(0, 500);
      }
      if (raw.localization) {
        advanced.localization.defaultLocale = String(raw.localization.defaultLocale || current.localization.defaultLocale).slice(0, 20);
        advanced.localization.fallbackLocale = String(raw.localization.fallbackLocale || current.localization.fallbackLocale).slice(0, 20);
      }
      if (raw.moderation) {
        advanced.moderation.chatMaxLength = Math.floor(bounded(raw.moderation.chatMaxLength, 20, 2000, current.moderation.chatMaxLength));
        advanced.moderation.floodWindowSeconds = Math.floor(bounded(raw.moderation.floodWindowSeconds, 1, 600, current.moderation.floodWindowSeconds));
        advanced.moderation.floodMaxMessages = Math.floor(bounded(raw.moderation.floodMaxMessages, 1, 100, current.moderation.floodMaxMessages));
        advanced.moderation.replayRetentionDays = Math.floor(bounded(raw.moderation.replayRetentionDays, 1, 3650, current.moderation.replayRetentionDays));
        advanced.moderation.allowDeckModeration = raw.moderation.allowDeckModeration === undefined ? current.moderation.allowDeckModeration : Boolean(raw.moderation.allowDeckModeration);
      }
      partial.advanced = advanced;
    }

    const currentForValidation = await loadGameConfig();
    const candidate: GameConfig = { ...currentForValidation, ...partial, advanced: partial.advanced ?? currentForValidation.advanced };
    const invariantErrors = validateGameConfig(candidate);
    if (invariantErrors.length) return Response.json({ ok: false, error: "Invalid game settings", errors: invariantErrors }, { status: 400 });
    const expectedRevision = body.expectedRevision === undefined ? undefined : Number(body.expectedRevision);
    if (expectedRevision !== undefined && !Number.isInteger(expectedRevision)) return Response.json({ ok: false, error: "expectedRevision must be an integer" }, { status: 400 });
    const config = await saveGameConfig(partial, expectedRevision);
    await db.insert(adminAuditLogs).values({ action: "settings.update", resource: "game-settings", actor: actor.actorId, details: { role: actor.role, fields: Object.keys(partial), advancedRuntimeOverrides: config.advanced.engine.runtimeOverridesEnabled, stepUp: true } });
    return Response.json({ ok: true, config, revision: getGameConfigRevision() });
  } catch (error) {
    if (error instanceof GameConfigConflictError) return Response.json({ ok: false, error: error.message, currentRevision: error.currentRevision }, { status: 409 });
    if (error instanceof GameConfigValidationError) return Response.json({ ok: false, error: "Invalid game settings", errors: error.errors }, { status: 400 });
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
