import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db, pool } from "@/db";
import { adminSandboxSessions, adminSessions, adminUsers, customCards } from "@/db/schema";
import { createAdminSession } from "@/lib/admin-auth";
import { hashAdminPassword } from "@/lib/admin-credentials";
import { GET as getCards, POST as createCard } from "@/app/api/admin/cards/route";
import { GET as getSandbox, POST as createSandbox } from "@/app/api/admin/studio/sandbox/route";
import { activateAbility, createCustomGame, makePermanent } from "@/game/engine";
import { clearRegisteredCustomCards, registerCustomCards } from "@/game/custom-registry";
import type { CardDef, DeckInput } from "@/game/types";

const ORIGIN = "http://localhost:3000";

function req(path: string, method: string, token: string, body?: unknown): NextRequest {
  const headers = new Headers({
    host: "localhost:3000",
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    cookie: `rf_admin_session=${token}`,
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function jsonOk(response: Response, label: string): Promise<Record<string, any>> {
  const body = await response.json() as Record<string, any>;
  assert.equal(response.ok, true, `${label}: HTTP ${response.status} ${JSON.stringify(body)}`);
  assert.notEqual(body.ok, false, `${label}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  assert.ok(process.env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET is required");

  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const username = `modal_studio_cert_${suffix}`.slice(0, 48);
  const defId = `modal_studio_cert_${suffix}`.slice(0, 58);
  let actorId: number | null = null;

  const modalCard: CardDef = {
    defId,
    name: "Modal Studio Certification Prism",
    region: "Tidecall",
    type: "Artifact",
    cost: 2,
    rarity: "Rare",
    emoji: "◇",
    description: "Transient modal card proving Studio persistence, sandbox and engine execution.",
    maxHealth: 4,
    activatedAbilities: [{
      description: "Prismatic Choice",
      cost: { mana: 1 },
      maxUsesPerRound: 2,
      modes: [
        { id: "spark", description: "Deal 2 to the enemy Nexus.", effect: { kind: "damageNexus", amount: 2, target: "none" } },
        { id: "study", description: "Draw one card.", effect: { kind: "draw", amount: 1, target: "none" } },
      ],
    }],
  };

  try {
    const credentials = hashAdminPassword(`CI-${suffix}-modal-studio-password-42!`);
    const [actor] = await db.insert(adminUsers).values({
      username,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      role: "admin",
      enabled: true,
    }).returning();
    actorId = actor.id;
    const token = await createAdminSession({ id: actor.id, username: actor.username, role: "admin" });

    const created = await jsonOk(await createCard(req("/api/admin/cards", "POST", token, { card: modalCard })), "create modal Studio card");
    assert.deepEqual(created.card.activatedAbilities, modalCard.activatedAbilities, "save API preserves modal authoring payload after server sanitization");

    const listed = await jsonOk(await getCards(req("/api/admin/cards", "GET", token)), "reload Card Studio catalog");
    const reloaded = listed.custom.find((candidate: CardDef & { defId: string }) => candidate.defId === defId);
    assert.ok(reloaded, "saved modal card must reload through the Card Studio catalog API");
    assert.deepEqual(reloaded.activatedAbilities, modalCard.activatedAbilities, "reload preserves stable mode ids, descriptions, effects and shared base budget");
    assert.equal(reloaded.activatedAbilities?.[0]?.effect, undefined, "reloaded modal ability does not gain an ambiguous base effect");

    const sandboxCreated = await jsonOk(await createSandbox(req("/api/admin/studio/sandbox", "POST", token, {
      card: reloaded,
      metadata: { certification: "modal-authoring" },
    })), "create modal Studio sandbox");
    assert.equal(typeof sandboxCreated.token, "string", "sandbox returns an opaque token");

    const sandboxRead = await jsonOk(await getSandbox(req(`/api/admin/studio/sandbox?token=${encodeURIComponent(sandboxCreated.token)}`, "GET", token)), "reload modal sandbox snapshot");
    const sandboxCard = sandboxRead.card as CardDef;
    assert.deepEqual(sandboxCard.activatedAbilities, modalCard.activatedAbilities, "sandbox round-trip preserves the certified modal contract");

    clearRegisteredCustomCards();
    registerCustomCards([sandboxCard]);
    const deck: DeckInput = {
      id: "modal-studio-cert-deck",
      name: "Modal Studio Certification Deck",
      cards: Array(20).fill("ember_whelp"),
    };
    let state = createCustomGame("Modal Studio Certification", deck, deck, {
      seed: 674201,
      playerGoesFirst: true,
      skipMulligan: true,
    });
    const prism = makePermanent(state, defId, "player");
    state.players.player.permanents.push(prism);
    state.players.player.mana = 2;
    state.players.player.maxMana = 2;
    const enemyNexusBefore = state.players.ai.nexusHealth;

    state = activateAbility(state, "player", prism.instanceId, 0, undefined, "spark");
    assert.equal(state.players.player.mana, 1, "sandbox-authored modal ability pays the shared base mana cost");
    assert.equal(state.players.ai.nexusHealth, enemyNexusBefore - 2, "sandbox-authored modal mode executes in the authoritative engine");
    assert.equal(state.players.player.permanents[0]?.activatedAbilityUses?.["0"]?.count, 1, "runtime records usage at the base ability level, shared across modes");

    console.log("STUDIO MODAL ABILITY FUNCTIONAL CERTIFICATION: PASS");
    console.log("  lifecycle: save → reload → sandbox → reload snapshot → authoritative modal activation");
    console.log("  contract: stable mode ids + shared cost/usage budget preserved end-to-end");
  } finally {
    clearRegisteredCustomCards();
    await db.delete(adminSandboxSessions).where(inArray(adminSandboxSessions.actorId, actorId === null ? ["__none__"] : [String(actorId), `admin:${actorId}`]));
    await db.delete(customCards).where(eq(customCards.defId, defId));
    if (actorId !== null) {
      await db.delete(adminSessions).where(eq(adminSessions.actorId, String(actorId)));
      await db.delete(adminUsers).where(eq(adminUsers.id, actorId));
    }
  }
}

main()
  .then(async () => { await pool.end(); })
  .catch(async (error) => {
    console.error("STUDIO MODAL ABILITY FUNCTIONAL CERTIFICATION: FAIL", error);
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  });
