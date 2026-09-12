import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 5_000 });

async function count(query: string, values: unknown[] = []) {
  const result = await pool.query(query, values);
  return Number(result.rows[0]?.n ?? 0);
}

async function main() {
  const required = ["card_assets", "card_asset_locks", "market_listings", "marketplace_settings", "trade_offers"];
  const rows = await pool.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_name = any($1::text[])", [required]);
  assert.deepEqual(new Set(rows.rows.map((row) => row.table_name)), new Set(required), "marketplace tables must exist");
  assert.equal(await count("select count(*) n from runeforge_schema_meta where version='2.97-market-1.0'"), 1, "marketplace schema provenance must be recorded");
  assert.equal(await count("select count(*) n from marketplace_settings where id=1 and fee_bps between 0 and 5000 and min_price_gold>=1 and max_price_gold>=min_price_gold"), 1, "singleton marketplace settings must be valid");

  const ownershipDrift = await count(`
    with aggregate_cards as (
      select player_id,def_id,count::bigint copies from player_cards
    ), asset_cards as (
      select owner_player_id player_id,def_id,count(*)::bigint copies from card_assets group by owner_player_id,def_id
    )
    select count(*) n from (
      select coalesce(a.player_id,b.player_id) player_id,coalesce(a.def_id,b.def_id) def_id,coalesce(a.copies,0) aggregate_copies,coalesce(b.copies,0) asset_copies
      from aggregate_cards a full join asset_cards b on b.player_id=a.player_id and b.def_id=a.def_id
      where coalesce(a.copies,0) <> coalesce(b.copies,0)
    ) drift
  `);
  assert.equal(ownershipDrift, 0, "per-copy collectible assets must exactly match aggregate gameplay ownership");

  const badLocks = await count(`
    select count(*) n
    from card_asset_locks l
    left join card_assets a on a.id=l.asset_id
    where a.id is null or a.owner_player_id<>l.owner_player_id
  `);
  assert.equal(badLocks, 0, "escrow locks must belong to the current collectible owner");

  const activeListingWithoutEscrow = await count(`
    select count(*) n
    from market_listings m
    left join card_asset_locks l on l.asset_id=m.asset_id and l.kind='listing' and l.reference_id=m.id
    where m.status='active' and m.expires_at>now() and (l.asset_id is null or l.expires_at<=now())
  `);
  assert.equal(activeListingWithoutEscrow, 0, "every live listing must have matching live escrow");

  const activeTradeWithoutEscrow = await count(`
    select count(*) n
    from trade_offers t
    cross join lateral jsonb_array_elements(t.offered_assets) offered
    left join card_asset_locks l on l.asset_id=(offered->>'assetId')::int and l.kind='trade' and l.reference_id=t.id
    where t.status='active' and t.expires_at>now() and (l.asset_id is null or l.expires_at<=now())
  `);
  assert.equal(activeTradeWithoutEscrow, 0, "every offered card in a live direct trade must have matching escrow");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const nameA = `__market_cert_a_${randomUUID()}`;
    const player = await client.query<{ id: number }>("insert into players(name,gold) values($1,1000) returning id", [nameA]);
    const playerId = Number(player.rows[0].id);
    await client.query("insert into player_cards(player_id,def_id,count,shiny) values($1,'__market_cert_card',1,false)", [playerId]);
    const asset = await client.query<{ id: number }>("insert into card_assets(owner_player_id,def_id,source) values($1,'__market_cert_card','certification') returning id", [playerId]);
    const assetId = Number(asset.rows[0].id);
    const listing = await client.query<{ id: number }>("insert into market_listings(asset_id,seller_player_id,price_gold,fee_gold,expires_at) values($1,$2,100,5,now()+interval '1 hour') returning id", [assetId, playerId]);
    await client.query("insert into card_asset_locks(asset_id,owner_player_id,kind,reference_id,expires_at) values($1,$2,'listing',$3,now()+interval '1 hour')", [assetId, playerId, Number(listing.rows[0].id)]);
    let duplicateBlocked = false;
    try {
      await client.query("savepoint duplicate_listing");
      await client.query("insert into market_listings(asset_id,seller_player_id,price_gold,fee_gold,expires_at) values($1,$2,110,5,now()+interval '1 hour')", [assetId, playerId]);
    } catch (error) {
      duplicateBlocked = (error as { code?: string }).code === "23505";
      await client.query("rollback to savepoint duplicate_listing");
    }
    assert.equal(duplicateBlocked, true, "one collectible copy cannot have two active listings");
    await client.query("rollback");
  } finally {
    client.release();
  }

  console.log("P2P MARKETPLACE POSTGRES CERTIFICATION: PASS");
}

main().catch((error) => {
  console.error("P2P MARKETPLACE POSTGRES CERTIFICATION: FAIL", error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
