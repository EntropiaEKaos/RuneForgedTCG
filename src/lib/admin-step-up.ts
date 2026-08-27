import type { NextRequest } from "next/server";
import type { AdminSessionContext } from "./admin-auth";
import { verifyAdminStepUp } from "./admin-auth";
import { consumeRateLimit, consumeRequestRateLimit } from "./rate-limit";

type StepUpBody = {
  currentPassword?: unknown;
  currentTotp?: unknown;
};

type StepUpOptions = {
  scope: string;
  actionLabel: string;
  requestLimit?: number;
  actorLimit?: number;
  windowMs?: number;
};

/**
 * Re-authentication boundary for high-impact administrative mutations.
 *
 * The gate deliberately combines a request-scoped limiter with an actor-scoped
 * limiter so a stolen authenticated session cannot be used to brute-force the
 * administrator's password/MFA indefinitely.
 */
export async function requireAdminStepUp(
  req: NextRequest,
  actor: Pick<AdminSessionContext, "userId">,
  body: StepUpBody,
  options: StepUpOptions,
): Promise<Response | null> {
  const windowMs = options.windowMs ?? 5 * 60_000;
  const requestLimit = await consumeRequestRateLimit(
    req,
    `${options.scope}:request`,
    options.requestLimit ?? 12,
    windowMs,
  );
  const actorLimit = await consumeRateLimit(
    `${options.scope}:user:${actor.userId}`,
    options.actorLimit ?? 10,
    windowMs,
  );
  const limit = !requestLimit.allowed ? requestLimit : actorLimit;
  if (!limit.allowed) {
    return Response.json(
      {
        ok: false,
        error: `Too many ${options.actionLabel} re-authentication attempts`,
        code: "ADMIN_STEP_UP_RATE_LIMITED",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const password = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const totp = typeof body.currentTotp === "string" ? body.currentTotp : undefined;
  const verified = await verifyAdminStepUp(actor.userId, password, totp);
  if (!verified) {
    return Response.json(
      {
        ok: false,
        error: `Current administrator credentials are required for ${options.actionLabel}`,
        code: "ADMIN_STEP_UP_REQUIRED",
      },
      { status: 403 },
    );
  }

  return null;
}
