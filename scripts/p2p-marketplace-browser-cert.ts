import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!baseUrl) throw new Error("E2E_BASE_URL is required");
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 5_000 });

class BrowserClient {
  private cookies = new Map<string, string>();
  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set("cookie", [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
    for (const raw of setCookies) {
      const first = raw.split(";", 1)[0];
      const equals = first.indexOf("=");
      if (equals < 1) continue;
      const key = first.slice(0, equals);
      const value = first.slice(equals + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }
  async post(path: string, body: Record<string, unknown>, prefix: string) {
    return this.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operation-id": `${prefix}:${randomUUID()}` },
      body: JSON.stringify(body),
    });
  }
}

async function createPlayer(label: string) {
  const client = new BrowserClient();
  const created = await client.request("/api/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: `${label}-${randomUUID()}`.slice(0, 40) }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  return { client, id: Number(created.body.player.id), name: String(created.body.player.name) };
}

async function seedAsset(playerId: number, defId: string) {
  await pool.query("insert into player_cards(player_id,def_id,count,shiny) values($1,$2,1,false)", [playerId, defId]);
  const result = await pool.query<{ id: number }>("insert into card_assets(owner_player_id,def_id,source) values($1,$2,'e2e-certification') returning id", [playerId, defId]);
  return Number(result.rows[0].id);
}

async function main() {
  const seller = await createPlayer("Market Seller");
  const buyerA = await createPlayer("Market Buyer A");
  const buyerB = await createPlayer("Market Buyer B");
  const traderA = await createPlayer("Trade A");
  const traderB = await createPlayer("Trade B");
  const ids = [seller.id, buyerA.id, buyerB.id, traderA.id, traderB.id];

  try {
    await pool.query("update players set gold=1000 where id = any($1::int[])", [ids]);
    const saleAssetId = await seedAsset(seller.id, "void_imp");
    const traderAAsset = await seedAsset(traderA.id, "void_hexer");
    const traderBAsset = await seedAsset(traderB.id, "void_stalker");

    const list = await seller.client.post("/api/market", { action: "list", assetId: saleAssetId, priceGold: 100 }, "market-list-cert");
    assert.equal(list.response.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.ok, true);
    assert.equal(Number(list.body.feeGold), 5, "default marketplace fee must be 5%");
    const listingId = Number(list.body.listingId);

    const [attemptA, attemptB] = await Promise.all([
      buyerA.client.post("/api/market", { action: "buy", listingId }, "market-buy-a-cert"),
      buyerB.client.post("/api/market", { action: "buy", listingId }, "market-buy-b-cert"),
    ]);
    const successes = [attemptA, attemptB].filter((result) => result.response.status === 200 && result.body.ok === true);
    const rejected = [attemptA, attemptB].filter((result) => result.response.status !== 200);
    assert.equal(successes.length, 1, `exactly one concurrent buyer must win: ${JSON.stringify([attemptA.body, attemptB.body])}`);
    assert.equal(rejected.length, 1, "the losing concurrent purchase must be rejected");

    const winnerId = attemptA.response.status === 200 ? buyerA.id : buyerB.id;
    const saleState = await pool.query<{ status: string; buyer_player_id: number; owner_player_id: number; seller_gold: number; buyer_ledger: number; seller_ledger: number }>(`
      select l.status,l.buyer_player_id,a.owner_player_id,
        (select gold from players where id=$2)::int seller_gold,
        (select count(*)::int from economy_transactions where player_id=l.buyer_player_id and reason='market_purchase' and reference_id=l.id::text) buyer_ledger,
        (select count(*)::int from economy_transactions where player_id=$2 and reason='market_sale' and reference_id=l.id::text) seller_ledger
      from market_listings l join card_assets a on a.id=l.asset_id where l.id=$1
    `, [listingId, seller.id]);
    assert.equal(saleState.rows[0].status, "sold");
    assert.equal(Number(saleState.rows[0].buyer_player_id), winnerId);
    assert.equal(Number(saleState.rows[0].owner_player_id), winnerId);
    assert.equal(Number(saleState.rows[0].seller_gold), 1095, "seller receives price minus 5% Gold sink");
    assert.equal(Number(saleState.rows[0].buyer_ledger), 1);
    assert.equal(Number(saleState.rows[0].seller_ledger), 1);

    const proposed = await traderA.client.post("/api/trades", {
      action: "create",
      recipientName: traderB.name,
      offeredAssetIds: [traderAAsset],
      requestedAssets: [{ defId: "void_stalker" }],
      note: "certification",
    }, "trade-create-cert");
    assert.equal(proposed.response.status, 200, JSON.stringify(proposed.body));
    const tradeId = Number(proposed.body.tradeId);
    const locked = await pool.query<{ n: number }>("select count(*)::int n from card_asset_locks where asset_id=$1 and kind='trade' and reference_id=$2", [traderAAsset, tradeId]);
    assert.equal(Number(locked.rows[0].n), 1, "offered asset must enter trade escrow");

    const accept = await traderB.client.post("/api/trades", { action: "accept", tradeId }, "trade-accept-cert");
    assert.equal(accept.response.status, 200, JSON.stringify(accept.body));
    assert.equal(accept.body.status, "accepted");
    const owners = await pool.query<{ id: number; owner_player_id: number }>("select id,owner_player_id from card_assets where id = any($1::int[]) order by id", [[traderAAsset, traderBAsset]]);
    const ownerMap = new Map(owners.rows.map((row) => [Number(row.id), Number(row.owner_player_id)]));
    assert.equal(ownerMap.get(traderAAsset), traderB.id, "offered card must transfer to recipient");
    assert.equal(ownerMap.get(traderBAsset), traderA.id, "requested card must transfer to proposer");
    const remainingLocks = await pool.query<{ n: number }>("select count(*)::int n from card_asset_locks where kind='trade' and reference_id=$1", [tradeId]);
    assert.equal(Number(remainingLocks.rows[0].n), 0, "accepted trade escrow must be released");

    console.log("P2P MARKETPLACE BROWSER CERTIFICATION: PASS");
  } finally {
    await pool.query("delete from trade_offers where proposer_player_id = any($1::int[]) or recipient_player_id = any($1::int[])", [ids]).catch(() => undefined);
    await pool.query("delete from market_listings where seller_player_id = any($1::int[]) or buyer_player_id = any($1::int[])", [ids]).catch(() => undefined);
    await pool.query("delete from players where id = any($1::int[])", [ids]).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("P2P MARKETPLACE BROWSER CERTIFICATION: FAIL", error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
