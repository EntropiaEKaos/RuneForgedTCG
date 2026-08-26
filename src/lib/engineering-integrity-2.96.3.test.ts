import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { recoveryCredentialUsable, recoveryExpiresAt, recoveryHash, RECOVERY_TTL_MS } from "./account-recovery";
import { playerRankedDto, playerSelfDto } from "./player-public";
import { requestOriginAllowed } from "./request-security";
import { deleteAdminAsset, storeAdminAsset } from "./asset-storage";
import { levelFromXp } from "./achievements";

async function main() {
  const code = "recovery-code-with-enough-entropy-123456";
  const now = 1_800_000_000_000;
  const credential = { recoveryKeyHash: recoveryHash(code), recoveryKeyExpiresAt: recoveryExpiresAt(now) };
  assert.equal(credential.recoveryKeyExpiresAt.getTime(), now + RECOVERY_TTL_MS);
  assert.equal(recoveryCredentialUsable(credential, code, now), true);
  assert.equal(recoveryCredentialUsable(credential, code, now + RECOVERY_TTL_MS), false);
  assert.equal(recoveryCredentialUsable(credential, `${code}-wrong`, now), false);

  const player = {
    id: 7, name: "Tester", xp: 1200, level: 99, gold: 100, dust: 50,
    mmr: 1200, peakMmr: 1300, rankedWins: 8, rankedLosses: 4, rankedGamesInPlacement: 2,
    loginStreak: 3, lastLogin: null, createdAt: new Date(0), lastDaily: null,
    avatar: "a", cardBack: "b", title: "t", bio: "bio", banner: "banner", status: "active", badges: [],
    recoveryKeyHash: "MUST_NOT_LEAK", recoveryKeyExpiresAt: new Date(now), moderatorNote: "MUST_NOT_LEAK",
  } as any;
  const self = playerSelfDto(player) as Record<string, unknown>;
  const ranked = playerRankedDto(player) as Record<string, unknown>;
  assert.equal("recoveryKeyHash" in self, false);
  assert.equal("recoveryKeyExpiresAt" in self, false);
  assert.equal("moderatorNote" in self, false);
  assert.equal("recoveryKeyHash" in ranked, false);
  assert.equal("moderatorNote" in ranked, false);
  assert.equal(self.level, levelFromXp(player.xp), "public level is derived from XP instead of trusting a stale persisted level");
  assert.notEqual(self.level, player.level);

  const previousTrustProxy = process.env.TRUST_PROXY;
  try {
    process.env.TRUST_PROXY = "false";
    const spoofed = new Request("https://game.example/api/test", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        host: "game.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(requestOriginAllowed(spoofed), false, "forwarded host must be ignored without TRUST_PROXY");

    process.env.TRUST_PROXY = "true";
    const proxied = new Request("http://internal:3000/api/test", {
      method: "POST",
      headers: {
        origin: "https://game.example",
        host: "internal:3000",
        "x-forwarded-host": "game.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(requestOriginAllowed(proxied), true, "trusted proxy origin should use forwarded host/proto");
  } finally {
    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  }

  const originalCwd = process.cwd();
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalMode = mutableEnv.ASSET_STORAGE_MODE;
  const originalNodeEnv = mutableEnv.NODE_ENV;
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "runeforge-asset-dedup-"));
  try {
    process.chdir(temp);
    mutableEnv.ASSET_STORAGE_MODE = "local";
    mutableEnv.NODE_ENV = "test";
    const bytes = Buffer.from("deduplicated-asset-payload");
    const first = await storeAdminAsset("same.bin", bytes, "application/octet-stream");
    const second = await storeAdminAsset("same.bin", bytes, "application/octet-stream");
    assert.equal(first.created, true);
    assert.equal(second.created, false, "second content-addressed/local upload must report pre-existing ownership");
    await deleteAdminAsset("same.bin");
  } finally {
    process.chdir(originalCwd);
    if (originalMode === undefined) delete mutableEnv.ASSET_STORAGE_MODE; else mutableEnv.ASSET_STORAGE_MODE = originalMode;
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = originalNodeEnv;
    await fs.rm(temp, { recursive: true, force: true });
  }

  console.log("ENGINEERING INTEGRITY 2.96.3 BEHAVIOR: PASS (recovery, DTO, proxy boundary, asset dedup ownership)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
