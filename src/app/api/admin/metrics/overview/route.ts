import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { commandCenterIntelligence, type CommandCenterJourney, type CommandCenterWindow } from "@/lib/command-center-intelligence";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) return (result as { rows: Row[] }).rows;
  return [];
}

function num(row: Row | undefined, key: string) {
  const value = row?.[key];
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return Response.json({ ok: false, error: "Admin role required" }, { status: 403 });

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [playersResult, activityResult, gameplayResult, economyResult, commerceResult, contentResult, journeyResult, tradingResult, topEventsResult, topRoutesResult, recentResult, pulseResult] = await Promise.all([
    db.execute(sql`select count(*)::int as total, count(*) filter (where created_at >= ${dayAgo})::int as new_24h, count(*) filter (where created_at >= ${weekAgo})::int as new_7d, count(*) filter (where created_at >= ${monthAgo})::int as new_30d, count(*) filter (where status = 'active')::int as active_accounts, coalesce(avg(level), 0)::numeric(10,2) as avg_level, coalesce(avg(mmr), 0)::numeric(10,2) as avg_mmr, coalesce(sum(gold), 0)::bigint as gold_held, coalesce(sum(dust), 0)::bigint as dust_held from players`),
    db.execute(sql`select count(*) filter (where created_at >= ${dayAgo})::int as events_24h, count(*) filter (where created_at >= ${weekAgo})::int as events_7d, count(distinct player_id) filter (where created_at >= ${dayAgo} and player_id is not null)::int as dau, count(distinct player_id) filter (where created_at >= ${weekAgo} and player_id is not null)::int as wau, count(distinct player_id) filter (where created_at >= ${monthAgo} and player_id is not null)::int as mau, count(distinct session_id) filter (where created_at >= ${dayAgo} and session_id is not null)::int as sessions_24h, count(*) filter (where event_name = 'lore.hub_viewed' and created_at >= ${weekAgo})::int as lore_hub_7d, count(*) filter (where event_name = 'lore.entry_viewed' and created_at >= ${weekAgo})::int as lore_entries_7d from telemetry_events`),
    db.execute(sql`select (select count(*)::int from pvp_rooms where created_at >= ${dayAgo}) as pvp_created_24h, (select count(*)::int from pvp_rooms where created_at >= ${dayAgo} and state = 'finished') as pvp_finished_24h, (select count(*)::int from ranked_matches where created_at >= ${dayAgo}) as ranked_results_24h, (select count(*)::int from pack_openings where created_at >= ${dayAgo}) as packs_opened_24h, (select count(*)::int from shared_decks where created_at >= ${weekAgo}) as shared_decks_7d, (select count(*)::int from matchmaking_queue) as queue_now, (select count(*)::int from friendships where status = 'accepted') as friendships`),
    db.execute(sql`select coalesce(sum(case when amount > 0 then amount else 0 end), 0)::bigint as generated_24h, coalesce(abs(sum(case when amount < 0 then amount else 0 end)), 0)::bigint as spent_24h, count(*)::int as transactions_24h from economy_transactions where created_at >= ${dayAgo}`),
    db.execute(sql`select count(*) filter (where created_at >= ${dayAgo})::int as orders_24h, count(*) filter (where created_at >= ${dayAgo} and status in ('approved','fulfilled'))::int as approved_24h, coalesce(sum(amount_cents) filter (where created_at >= ${dayAgo} and status in ('approved','fulfilled')), 0)::bigint as revenue_cents_24h, count(*) filter (where created_at >= ${weekAgo})::int as orders_7d, coalesce(sum(amount_cents) filter (where created_at >= ${weekAgo} and status in ('approved','fulfilled')), 0)::bigint as revenue_cents_7d from payment_orders`),
    db.execute(sql`select count(*) filter (where resource = 'lore')::int as lore_total, count(*) filter (where resource = 'lore' and status = 'published')::int as lore_published, count(*) filter (where resource = 'lore' and status in ('draft','review'))::int as lore_drafts, count(*) filter (where resource = 'events' and status = 'published')::int as events_published, count(*) filter (where resource = 'news' and status = 'published')::int as news_published from site_content`),
    db.execute(sql`select (select count(*)::int from players) as account_created, (select count(distinct player_id)::int from pack_openings where player_id is not null) as pack_opened, (select count(distinct owner_player_id)::int from custom_decks where owner_player_id is not null) as deck_created, (select count(distinct player_id)::int from matches where player_id is not null) as match_played, (select count(distinct player_id)::int from matches where player_id is not null and won = true) as match_won, (select count(*)::int from players where ranked_wins + ranked_losses > 0) as ranked_started`),
    db.execute(sql`select
      count(*) filter (where created_at >= ${dayAgo})::int as created_24h,
      count(*) filter (where created_at >= ${dayAgo} and status = 'accepted')::int as accepted_24h,
      count(*) filter (where created_at >= ${dayAgo} and status = 'declined')::int as declined_24h,
      count(*) filter (where created_at >= ${dayAgo} and status = 'cancelled')::int as cancelled_24h,
      count(*) filter (where created_at >= ${dayAgo} and status = 'expired')::int as expired_24h,
      count(*) filter (where status = 'active' and expires_at > now())::int as active_now,
      coalesce(avg(extract(epoch from (completed_at - created_at)) / 60.0) filter (where created_at >= ${dayAgo} and completed_at is not null), 0)::numeric(12,2) as avg_resolution_minutes_24h
      from trade_offers`),
    db.execute(sql`select event_name as name, count(*)::int as total from telemetry_events where created_at >= ${weekAgo} group by event_name order by total desc, event_name asc limit 14`),
    db.execute(sql`select properties->>'path' as path, count(*)::int as total, count(distinct session_id)::int as sessions from telemetry_events where event_name = 'client.route_viewed' and created_at >= ${weekAgo} and properties->>'path' is not null group by properties->>'path' order by total desc, path asc limit 14`),
    db.execute(sql`select event_name, player_id, session_id, properties, created_at from telemetry_events order by created_at desc limit 24`),
    db.execute(sql`select
      (select count(*)::int from telemetry_events where created_at >= ${dayAgo}) as current_events,
      (select count(distinct session_id)::int from telemetry_events where created_at >= ${dayAgo} and session_id is not null) as current_sessions,
      (select count(*)::int from pvp_rooms where created_at >= ${dayAgo}) as current_pvp_created,
      (select count(*)::int from pvp_rooms where created_at >= ${dayAgo} and state = 'finished') as current_pvp_finished,
      (select count(*)::int from payment_orders where created_at >= ${dayAgo}) as current_orders,
      (select count(*)::int from payment_orders where created_at >= ${dayAgo} and status in ('approved','fulfilled')) as current_approved,
      (select coalesce(sum(amount_cents),0)::bigint from payment_orders where created_at >= ${dayAgo} and status in ('approved','fulfilled')) as current_revenue,
      (select count(*)::int from trade_offers where created_at >= ${dayAgo}) as current_trades_created,
      (select count(*)::int from trade_offers where created_at >= ${dayAgo} and status = 'accepted') as current_trades_accepted,
      (select count(*)::int from telemetry_events where created_at >= ${twoDaysAgo} and created_at < ${dayAgo}) as previous_events,
      (select count(distinct session_id)::int from telemetry_events where created_at >= ${twoDaysAgo} and created_at < ${dayAgo} and session_id is not null) as previous_sessions,
      (select count(*)::int from pvp_rooms where created_at >= ${twoDaysAgo} and created_at < ${dayAgo}) as previous_pvp_created,
      (select count(*)::int from pvp_rooms where created_at >= ${twoDaysAgo} and created_at < ${dayAgo} and state = 'finished') as previous_pvp_finished,
      (select count(*)::int from payment_orders where created_at >= ${twoDaysAgo} and created_at < ${dayAgo}) as previous_orders,
      (select count(*)::int from payment_orders where created_at >= ${twoDaysAgo} and created_at < ${dayAgo} and status in ('approved','fulfilled')) as previous_approved,
      (select coalesce(sum(amount_cents),0)::bigint from payment_orders where created_at >= ${twoDaysAgo} and created_at < ${dayAgo} and status in ('approved','fulfilled')) as previous_revenue,
      (select count(*)::int from trade_offers where created_at >= ${twoDaysAgo} and created_at < ${dayAgo}) as previous_trades_created,
      (select count(*)::int from trade_offers where created_at >= ${twoDaysAgo} and created_at < ${dayAgo} and status = 'accepted') as previous_trades_accepted`),
  ]);

  const players = rowsOf(playersResult)[0], activity = rowsOf(activityResult)[0], gameplay = rowsOf(gameplayResult)[0], economy = rowsOf(economyResult)[0], commerce = rowsOf(commerceResult)[0], content = rowsOf(contentResult)[0], journeyRow = rowsOf(journeyResult)[0], trading = rowsOf(tradingResult)[0], pulse = rowsOf(pulseResult)[0];
  const journey: CommandCenterJourney = { accountCreated: num(journeyRow,"account_created"), packOpened: num(journeyRow,"pack_opened"), deckCreated: num(journeyRow,"deck_created"), matchPlayed: num(journeyRow,"match_played"), matchWon: num(journeyRow,"match_won"), rankedStarted: num(journeyRow,"ranked_started") };
  const current24h: CommandCenterWindow = { events:num(pulse,"current_events"), sessions:num(pulse,"current_sessions"), pvpCreated:num(pulse,"current_pvp_created"), pvpFinished:num(pulse,"current_pvp_finished"), orders:num(pulse,"current_orders"), approved:num(pulse,"current_approved"), revenueCents:num(pulse,"current_revenue"), tradesCreated:num(pulse,"current_trades_created"), tradesAccepted:num(pulse,"current_trades_accepted") };
  const previous24h: CommandCenterWindow = { events:num(pulse,"previous_events"), sessions:num(pulse,"previous_sessions"), pvpCreated:num(pulse,"previous_pvp_created"), pvpFinished:num(pulse,"previous_pvp_finished"), orders:num(pulse,"previous_orders"), approved:num(pulse,"previous_approved"), revenueCents:num(pulse,"previous_revenue"), tradesCreated:num(pulse,"previous_trades_created"), tradesAccepted:num(pulse,"previous_trades_accepted") };
  const intelligence = commandCenterIntelligence({ journey, dau:num(activity,"dau"), wau:num(activity,"wau"), mau:num(activity,"mau"), pvpCreated24h:num(gameplay,"pvp_created_24h"), pvpFinished24h:num(gameplay,"pvp_finished_24h"), orders24h:num(commerce,"orders_24h"), approved24h:num(commerce,"approved_24h"), tradesCreated24h:num(trading,"created_24h"), tradesAccepted24h:num(trading,"accepted_24h"), current24h, previous24h });

  return Response.json({ ok:true, generatedAt:new Date().toISOString(), windows:{ dayAgo:dayAgo.toISOString(), twoDaysAgo:twoDaysAgo.toISOString(), weekAgo:weekAgo.toISOString(), monthAgo:monthAgo.toISOString() },
    players:{ total:num(players,"total"), new24h:num(players,"new_24h"), new7d:num(players,"new_7d"), new30d:num(players,"new_30d"), activeAccounts:num(players,"active_accounts"), avgLevel:num(players,"avg_level"), avgMmr:num(players,"avg_mmr"), goldHeld:num(players,"gold_held"), dustHeld:num(players,"dust_held") },
    activity:{ events24h:num(activity,"events_24h"), events7d:num(activity,"events_7d"), dau:num(activity,"dau"), wau:num(activity,"wau"), mau:num(activity,"mau"), sessions24h:num(activity,"sessions_24h"), loreHub7d:num(activity,"lore_hub_7d"), loreEntries7d:num(activity,"lore_entries_7d") },
    gameplay:{ pvpCreated24h:num(gameplay,"pvp_created_24h"), pvpFinished24h:num(gameplay,"pvp_finished_24h"), rankedResults24h:num(gameplay,"ranked_results_24h"), packsOpened24h:num(gameplay,"packs_opened_24h"), sharedDecks7d:num(gameplay,"shared_decks_7d"), queueNow:num(gameplay,"queue_now"), friendships:num(gameplay,"friendships") },
    economy:{ generated24h:num(economy,"generated_24h"), spent24h:num(economy,"spent_24h"), transactions24h:num(economy,"transactions_24h") },
    commerce:{ orders24h:num(commerce,"orders_24h"), approved24h:num(commerce,"approved_24h"), revenueCents24h:num(commerce,"revenue_cents_24h"), orders7d:num(commerce,"orders_7d"), revenueCents7d:num(commerce,"revenue_cents_7d") },
    trading:{ created24h:num(trading,"created_24h"), accepted24h:num(trading,"accepted_24h"), declined24h:num(trading,"declined_24h"), cancelled24h:num(trading,"cancelled_24h"), expired24h:num(trading,"expired_24h"), activeNow:num(trading,"active_now"), averageResolutionMinutes24h:num(trading,"avg_resolution_minutes_24h") },
    content:{ loreTotal:num(content,"lore_total"), lorePublished:num(content,"lore_published"), loreDrafts:num(content,"lore_drafts"), eventsPublished:num(content,"events_published"), newsPublished:num(content,"news_published") }, journey, intelligence,
    topEvents:rowsOf(topEventsResult).map(row=>({name:String(row.name??"unknown"),total:num(row,"total")})), topRoutes:rowsOf(topRoutesResult).map(row=>({path:String(row.path??"/"),total:num(row,"total"),sessions:num(row,"sessions")})), recentEvents:rowsOf(recentResult).map(row=>({eventName:String(row.event_name??"unknown"),playerId:row.player_id==null?null:Number(row.player_id),sessionId:row.session_id==null?null:String(row.session_id),properties:row.properties&&typeof row.properties==="object"?row.properties:{},createdAt:row.created_at instanceof Date?row.created_at.toISOString():String(row.created_at??"")}))
  }, { headers:{"cache-control":"private, no-store"} });
}
