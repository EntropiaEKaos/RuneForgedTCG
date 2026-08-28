import { DECKS, type DeckDef, validateDeck } from "@/game/decks";
import { ARCHETYPES, type ArchetypeProfile } from "@/game/archetypes";
import { AI_DIFFICULTIES } from "@/game/ai-personality";
import { REGION_ORDER } from "@/game/region-identity";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { BRAWLS, BOSSES, ENCOUNTERS, PUZZLES, type Boss, type BrawlMode, type Encounter, type Puzzle } from "@/lib/game-modes";
import { LOGIN_REWARDS, PACK_DEFS, type LoginReward, type PackDef } from "@/lib/packs";
import { RANK_TIERS, type RankTier } from "@/lib/ranked";
import { VANILLA_EXPERIMENTAL_DECKS } from "@/game/vanilla-experimental-decks";
import { BUILTIN_FORMATS, type FormatDef } from "@/game/format-definitions";


async function controlPersistence() {
  const [{ db }, { adminGameDefinitions }, drizzle] = await Promise.all([
    import("@/db"), import("@/db/schema"), import("drizzle-orm"),
  ]);
  return { db, adminGameDefinitions, and: drizzle.and, asc: drizzle.asc, eq: drizzle.eq };
}

export const CONTROL_DOMAINS = [
  "official-decks", "doctrines", "puzzles", "bosses", "brawls", "expeditions",
  "packs", "login-rewards", "rank-tiers", "ranked-seasons", "ai-profiles",
  "engine-zones", "engine-phases", "engine-actions", "matchmaking-policies",
  "economy-products", "payment-products", "collection-rewards", "formats", "experimental-decks",
  "asset-library", "visual-themes", "audio-cues", "localizations", "moderation-rules",
] as const;

export type ControlDomain = (typeof CONTROL_DOMAINS)[number];
export type DangerLevel = "safe" | "elevated" | "critical";

export interface ControlDefinitionInput {
  domain: ControlDomain;
  key: string;
  name: string;
  description?: string;
  dangerLevel?: DangerLevel;
  schemaVersion?: number;
  payload: Record<string, unknown>;
}

export const CONTROL_DOMAIN_INFO: Record<ControlDomain, { label: string; icon: string; danger: DangerLevel; description: string }> = {
  "official-decks": { label: "Decks oficiais", icon: "🂠", danger: "elevated", description: "Decks padrão usados pelo cliente, IA, modos e simuladores." },
  doctrines: { label: "Doutrinas", icon: "◈", danger: "elevated", description: "Planos estratégicos, assinaturas e identidade dos decks." },
  puzzles: { label: "Puzzles", icon: "🧩", danger: "elevated", description: "Estados iniciais, objetivo, dica e recompensa." },
  bosses: { label: "Chefes", icon: "👹", danger: "elevated", description: "Deck, vida, campo inicial e recompensas de bosses." },
  brawls: { label: "Brawls", icon: "⚡", danger: "elevated", description: "Regras temporárias e condições especiais de partida." },
  expeditions: { label: "Expedições", icon: "🧭", danger: "elevated", description: "Capítulos, encontros, mutadores e recompensas." },
  packs: { label: "Pacotes", icon: "📦", danger: "critical", description: "Preço, quantidade, garantias e probabilidades." },
  "login-rewards": { label: "Login diário", icon: "🎁", danger: "critical", description: "Calendário e valores de recompensas recorrentes." },
  "rank-tiers": { label: "Ranks", icon: "🏆", danger: "critical", description: "Faixas de MMR, nomes, cores e progressão." },
  "ranked-seasons": { label: "Temporadas", icon: "♜", danger: "critical", description: "Janelas, regras e recompensas de temporada." },
  "ai-profiles": { label: "Perfis de IA", icon: "♟", danger: "critical", description: "Dificuldade, personalidade e pesos de decisão." },
  "engine-zones": { label: "Zonas do motor", icon: "⬡", danger: "critical", description: "Contratos de zonas, capacidade e visibilidade." },
  "engine-phases": { label: "Fases do motor", icon: "⟳", danger: "critical", description: "Sequência e regras de transição entre fases." },
  "engine-actions": { label: "Ações do motor", icon: "⚙", danger: "critical", description: "Ações permitidas, fases válidas e contratos." },
  "matchmaking-policies": { label: "Matchmaking", icon: "⚔", danger: "critical", description: "Faixas de MMR, expansão, fila e fallback de IA." },
  "economy-products": { label: "Economia e loja", icon: "¤", danger: "critical", description: "Produtos, moedas, preços, limites e recompensas." },
  "payment-products": { label: "Produtos pagos", icon: "💳", danger: "critical", description: "SKUs cobrados em moeda real e grants entregues após confirmação do gateway." },
  "collection-rewards": { label: "Recompensas de coleção", icon: "📚", danger: "elevated", description: "Marcos de álbum e recompensas por conclusão de coleção." },
  formats: { label: "Formatos", icon: "⚖", danger: "critical", description: "Legalidade por coleção para Vanilla, Standard e Eternal." },
  "experimental-decks": { label: "Decks experimentais", icon: "🧪", danger: "elevated", description: "Arquétipos de laboratório que não entram em Ranked sem certificação." },
  "asset-library": { label: "Biblioteca de mídia", icon: "▣", danger: "safe", description: "URLs, tipos, dimensões e usos de artes." },
  "visual-themes": { label: "Temas visuais", icon: "✦", danger: "elevated", description: "Tokens visuais, tabuleiro, FX e acessibilidade." },
  "audio-cues": { label: "Áudio", icon: "♫", danger: "elevated", description: "Cues, volumes, grupos e arquivos sonoros." },
  localizations: { label: "Localização", icon: "文", danger: "safe", description: "Idiomas e dicionários de textos do cliente." },
  "moderation-rules": { label: "Moderação", icon: "🛡", danger: "critical", description: "Sanções, filtros, retenção e limites operacionais." },
};

const keyPattern = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const finiteNumber = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const finiteInteger = (value: unknown, min: number, max: number) => finiteNumber(value, min, max) && Number.isInteger(value);
const strings = (value: unknown, max = 500) => Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string" && item.length <= 120);

export const DEFAULT_STARTER_WALLET = { type: "grant", gold: 100, dust: 0, xp: 0, limit: 1 } as const;
export const DEFAULT_CRAFT_COSTS = { type: "craft-costs", Common: 50, Rare: 150, Epic: 300, Legend: 800 } as const;

export function validateControlDefinition(input: ControlDefinitionInput): { passed: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!CONTROL_DOMAINS.includes(input.domain)) errors.push("Domínio administrativo desconhecido.");
  if (!keyPattern.test(input.key)) errors.push("A chave deve usar apenas letras minúsculas, números, _ ou -.");
  if (!input.name.trim() || input.name.length > 120) errors.push("Nome obrigatório com até 120 caracteres.");
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) errors.push("Payload deve ser um objeto JSON.");
  let serialized = "";
  try { serialized = JSON.stringify(input.payload); } catch { errors.push("Payload não é serializável."); }
  if (serialized.length > 256_000) errors.push("Payload excede 256 KB.");
  const p = input.payload as Record<string, any>;

  if (input.domain === "official-decks") {
    let derivedRegions: string[] = [];
    if (!strings(p.cards, 80)) errors.push("Deck precisa de uma lista válida de cartas.");
    else {
      const check = validateDeck(p.cards);
      errors.push(...check.errors.map((item) => `Deck: ${item}`));
      derivedRegions = check.regions;
    }
    if (!strings(p.regions, 3) || !p.regions.length) errors.push("Deck precisa de uma, duas ou três regiões.");
    else {
      const declared = [...new Set<string>(p.regions as string[])].filter((region): region is (typeof REGION_ORDER)[number] => (REGION_ORDER as readonly string[]).includes(region));
      declared.sort((a, b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b));
      if (declared.length !== p.regions.length) errors.push("Deck contém regiões duplicadas ou não canônicas.");
      if (derivedRegions.length && JSON.stringify(declared) !== JSON.stringify(derivedRegions)) errors.push(`Regiões declaradas não correspondem às cartas (${derivedRegions.join(", ")}).`);
    }
    if (p.id !== input.key) errors.push("O id do deck precisa ser igual à chave administrativa.");
    if (typeof p.name !== "string" || !p.name.trim()) errors.push("O payload do deck precisa de um nome.");
  }
  if (input.domain === "doctrines") {
    if (!strings(p.plan, 3) || p.plan.length !== 3) errors.push("Doutrina precisa de exatamente três etapas de plano.");
    if (!strings(p.signatures, 40)) errors.push("Assinaturas da doutrina são inválidas.");
  }
  if (["puzzles", "bosses", "expeditions"].includes(input.domain)) {
    if (!finiteNumber(p.difficulty, 1, 5)) errors.push("Dificuldade deve estar entre 1 e 5.");
    const reward = p.reward;
    if (!reward || !finiteNumber(reward.gold, 0, 1_000_000) || !finiteNumber(reward.dust, 0, 1_000_000) || !finiteNumber(reward.xp, 0, 1_000_000)) errors.push("Recompensa precisa de gold, dust e xp não negativos.");
  }
  if (input.domain === "bosses" && !strings(p.aiDeck, 120)) errors.push("Chefe precisa de um deck de IA válido.");
  if (input.domain === "brawls") {
    if (p.id !== input.key) errors.push("O id do Brawl precisa ser igual à chave administrativa.");
    if (typeof p.name !== "string" || !p.name.trim()) errors.push("O payload do Brawl precisa de um nome.");
    if (!p.rules || typeof p.rules !== "object" || Array.isArray(p.rules)) {
      errors.push("Brawl precisa de um objeto rules válido.");
    } else {
      const rules = p.rules as Record<string, unknown>;
      const supported = new Set(["startingMana", "startingHand", "startingNexus"]);
      const unsupported = Object.keys(rules).filter((key) => !supported.has(key));
      if (unsupported.length) errors.push(`Brawl contém regra(s) não suportada(s) pelo runtime: ${unsupported.join(", ")}.`);
      if (rules.startingMana != null && !finiteInteger(rules.startingMana, 0, 10)) errors.push("Brawl startingMana deve ser um inteiro entre 0 e 10.");
      if (rules.startingHand != null && !finiteInteger(rules.startingHand, 0, 10)) errors.push("Brawl startingHand deve ser um inteiro entre 0 e 10.");
      if (rules.startingNexus != null && !finiteInteger(rules.startingNexus, 1, 100)) errors.push("Brawl startingNexus deve ser um inteiro entre 1 e 100.");
    }
  }
  if (input.domain === "packs") {
    if (!finiteNumber(p.price, 0, 10_000_000) || !finiteNumber(p.cardsCount, 1, 100)) errors.push("Preço ou quantidade de cartas inválido.");
    if (p.collectionKey != null && (typeof p.collectionKey !== "string" || !keyPattern.test(p.collectionKey))) errors.push("collectionKey do pacote é inválida.");
    const rates = p.dropRates;
    const total = rates && ["Common", "Rare", "Epic", "Legend"].reduce((sum, rarity) => sum + Number(rates[rarity] || 0), 0);
    if (!Number.isFinite(total) || Math.abs(total - 1) > 0.0001) errors.push("Probabilidades do pacote devem somar exatamente 1.");
  }
  if (input.domain === "login-rewards") {
    if (!finiteNumber(p.day, 1, 365) || !finiteNumber(p.gold, 0, 1_000_000) || !finiteNumber(p.dust, 0, 1_000_000)) errors.push("Dia ou valores da recompensa de login são inválidos.");
  }
  if (input.domain === "rank-tiers" && (!finiteNumber(p.minMmr, 0, 1_000_000) || !finiteNumber(p.maxMmr, 0, 1_000_000) || p.minMmr > p.maxMmr)) errors.push("Faixa de MMR inválida.");
  if (input.domain === "engine-phases" && (!finiteNumber(p.order, 0, 100) || !strings(p.allowedNext, 30))) errors.push("Fase precisa de ordem e allowedNext.");
  if (input.domain === "engine-actions" && (!strings(p.allowedPhases, 30) || typeof p.runtimeAction !== "string")) errors.push("Ação precisa de runtimeAction e allowedPhases.");
  if (input.domain === "matchmaking-policies") {
    const bounds: Record<string, [number, number]> = {
      baseRange: [0, 5000], maxRange: [0, 10000], rangeStep: [0, 1000],
      rangeStepSeconds: [1, 600], staleSeconds: [1, 600], queueTtlSeconds: [30, 86400], aiFallbackSeconds: [0, 600], rematchCooldownSeconds: [0, 86400],
    };
    for (const [field, [min, max]] of Object.entries(bounds)) if (!finiteNumber(p[field], min, max)) errors.push(`Matchmaking: ${field} inválido.`);
    if (Number(p.baseRange) > Number(p.maxRange)) errors.push("baseRange não pode superar maxRange.");
  }
  if (input.domain === "payment-products") {
    if (!finiteNumber(p.priceCents, 100, 10_000_000)) errors.push("Produto pago precisa de priceCents entre 100 e 10.000.000.");
    if (String(p.currency || "BRL") !== "BRL") errors.push("MVP Mercado Pago aceita BRL como moeda canônica.");
    if (!p.grants || typeof p.grants !== "object" || Array.isArray(p.grants)) errors.push("Produto pago precisa de grants.");
    const grants = (p.grants || {}) as Record<string, unknown>;
    for (const field of ["gold","dust","xp"] as const) if (grants[field] != null && !finiteNumber(grants[field], 0, 10_000_000)) errors.push(`Grant ${field} inválido.`);
    if (grants.packs != null && !Array.isArray(grants.packs)) errors.push("grants.packs deve ser uma lista.");
    if (Array.isArray(grants.packs)) for (const pack of grants.packs) {
      if (!pack || typeof pack !== "object" || typeof (pack as any).packId !== "string" || !keyPattern.test((pack as any).packId) || !finiteNumber((pack as any).count, 1, 1000)) errors.push("Grant de pacote inválido.");
    }
    if (grants.badges != null && !strings(grants.badges, 100)) errors.push("grants.badges deve ser uma lista válida.");
    if (grants.title != null && (typeof grants.title !== "string" || grants.title.length > 80)) errors.push("grants.title inválido.");
  }
  if (input.domain === "collection-rewards") {
    if (typeof p.collectionKey !== "string" || !p.collectionKey) errors.push("collectionKey obrigatório.");
    if (!Array.isArray(p.milestones) || !p.milestones.length) errors.push("Milestones obrigatórios.");
    else {
      const seen = new Set<number>();
      for (const milestone of p.milestones) {
        const percent = Number(milestone?.percent);
        if (!finiteNumber(percent, 1, 100) || !Number.isInteger(percent) || !milestone?.grants || typeof milestone.grants !== "object" || Array.isArray(milestone.grants)) errors.push("Milestone inválido; percent deve ser inteiro entre 1 e 100 e grants deve ser um objeto.");
        const grants = (milestone?.grants || {}) as Record<string, unknown>;
        for (const field of ["gold","dust","xp"] as const) if (grants[field] != null && !finiteNumber(grants[field], 0, 10_000_000)) errors.push(`Milestone ${percent}%: grant ${field} inválido.`);
        if (grants.packs != null && !Array.isArray(grants.packs)) errors.push(`Milestone ${percent}%: grants.packs deve ser uma lista.`);
        if (Array.isArray(grants.packs)) for (const pack of grants.packs) {
          if (!pack || typeof pack !== "object" || typeof (pack as any).packId !== "string" || !keyPattern.test((pack as any).packId) || !finiteNumber((pack as any).count, 1, 1000)) errors.push(`Milestone ${percent}%: grant de pacote inválido.`);
        }
        if (seen.has(percent)) errors.push(`Milestone duplicado: ${percent}%.`);
        seen.add(percent);
      }
    }
  }
  if (input.domain === "formats") {
    if (p.id !== input.key) errors.push("Formato precisa ter id igual à chave administrativa.");
    if (!strings(p.collectionKeys, 100) || !p.collectionKeys.length) errors.push("Formato precisa de collectionKeys.");
    else if ((p.collectionKeys as string[]).some((key) => key !== "*" && !keyPattern.test(key))) errors.push("Formato contém collectionKey inválida.");
    if (typeof p.active !== "boolean" || typeof p.rankedEligible !== "boolean") errors.push("Formato precisa de active/rankedEligible booleanos.");
  }
  if (input.domain === "experimental-decks") {
    if (p.id !== input.key) errors.push("Deck experimental precisa ter id igual à chave administrativa.");
    if (typeof p.name !== "string" || !p.name.trim()) errors.push("Deck experimental precisa de nome.");
    if (!strings(p.cards, 80)) errors.push("Deck experimental precisa de cartas.");
    else errors.push(...validateDeck(p.cards).errors.map((item) => `Experimental deck: ${item}`));
    if (!strings(p.regions, 3) || !p.regions.length) errors.push("Deck experimental precisa de regiões.");
    if (p.certified === true) warnings.push("Deck experimental marcado como certified: ainda requer o Ranked release gate global.");
  }
  if (input.domain === "economy-products") {
    if (input.key === "starter-wallet") {
      for (const field of ["gold", "dust", "xp"] as const) if (!finiteNumber(p[field], 0, 1_000_000)) errors.push(`Economia inicial: ${field} inválido.`);
      if (!finiteNumber(p.limit, 1, 100)) errors.push("Economia inicial: limit inválido.");
    } else if (input.key === "craft-costs") {
      for (const rarity of ["Common", "Rare", "Epic", "Legend"] as const) if (!finiteNumber(p[rarity], 0, 1_000_000)) errors.push(`Custo de craft ${rarity} inválido.`);
    }
  }
  if (["engine-zones", "engine-phases", "engine-actions"].includes(input.domain)) warnings.push("Mudança estrutural: replays e partidas em andamento preservam o snapshot anterior; execute certificação antes de publicar.");
  if (["packs", "login-rewards", "economy-products", "payment-products", "collection-rewards"].includes(input.domain)) warnings.push("Mudança econômica: valide inflação, ledger, pagamentos e limites antes da ativação.");
  return { passed: errors.length === 0, errors, warnings };
}

function seed(domain: ControlDomain, key: string, name: string, payload: Record<string, unknown>, description = ""): ControlDefinitionInput {
  return { domain, key, name, description, dangerLevel: CONTROL_DOMAIN_INFO[domain].danger, schemaVersion: 1, payload };
}

export function builtInControlDefinitions(): ControlDefinitionInput[] {
  const rows: ControlDefinitionInput[] = [];
  for (const deck of DECKS) rows.push(seed("official-decks", deck.id, deck.name, { ...deck }, deck.description));
  for (const doctrine of Object.values(ARCHETYPES)) rows.push(seed("doctrines", doctrine.deckId, doctrine.name, { ...doctrine }, doctrine.fantasy));
  for (const item of PUZZLES) rows.push(seed("puzzles", item.id, item.name, { ...item }, item.description));
  for (const item of BOSSES) rows.push(seed("bosses", item.id, item.name, { ...item }, item.description));
  for (const item of BRAWLS) rows.push(seed("brawls", item.id, item.name, { ...item }, item.description));
  for (const item of ENCOUNTERS) rows.push(seed("expeditions", item.id, item.name, { ...item }, item.description));
  for (const item of PACK_DEFS) rows.push(seed("packs", item.id, item.name, { ...item }, item.description));
  for (const item of LOGIN_REWARDS) rows.push(seed("login-rewards", `day-${item.day}`, `Dia ${item.day}`, { ...item }));
  for (const item of RANK_TIERS) rows.push(seed("rank-tiers", item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), item.name, { ...item }));
  for (const [key, item] of Object.entries(AI_DIFFICULTIES)) rows.push(seed("ai-profiles", key, item.label, { id: key, ...item, aggression: key === "overlord" ? 1.35 : key === "apprentice" ? 0.7 : 1, valueWeight: key === "overlord" ? 1.25 : 1, reactionDepth: key === "overlord" ? 3 : key === "apprentice" ? 1 : 2, randomness: key === "apprentice" ? 0.3 : key === "tactician" ? 0.08 : 0 }));
  rows.push(
    seed("engine-zones", "deck", "Deck", { id: "deck", capacity: 60, visibility: "owner", runtimeAdapter: "deck" }),
    seed("engine-zones", "hand", "Hand", { id: "hand", capacity: 10, visibility: "owner", runtimeAdapter: "hand" }),
    seed("engine-zones", "bench", "Bench", { id: "bench", capacity: 6, visibility: "public", runtimeAdapter: "bench" }),
    seed("engine-zones", "permanents", "Permanents", { id: "permanents", capacity: 4, visibility: "public", runtimeAdapter: "permanents" }),
    seed("engine-zones", "graveyard", "Graveyard", { id: "graveyard", capacity: 500, visibility: "public", runtimeAdapter: "metadata" }),
    seed("engine-phases", "main", "Main", { id: "main", order: 10, allowedNext: ["blocking", "gameover"], runtimeAdapter: "main" }),
    seed("engine-phases", "blocking", "Blocking", { id: "blocking", order: 20, allowedNext: ["main", "gameover"], runtimeAdapter: "blocking" }),
    seed("engine-phases", "gameover", "Game Over", { id: "gameover", order: 99, allowedNext: [], terminal: true, runtimeAdapter: "gameover" }),
  );
  for (const action of ["play", "cast", "attack", "block", "pass", "react", "resolve", "sentinela", "mulligan", "skipMulligan"]) rows.push(seed("engine-actions", action.toLowerCase(), action, { runtimeAction: action, allowedPhases: action === "block" ? ["blocking"] : action === "mulligan" || action === "skipMulligan" ? ["mulligan"] : ["main"], enabled: true }));
  rows.push(
    seed("matchmaking-policies", "ranked-default", "Ranked padrão", { mode: "ranked", baseRange: 150, maxRange: 600, rangeStep: 75, rangeStepSeconds: 10, staleSeconds: 20, queueTtlSeconds: 600, aiFallbackSeconds: 8, rematchCooldownSeconds: 120, allowAiFallback: false }),
    seed("matchmaking-policies", "casual-default", "Casual padrão", { mode: "casual", baseRange: 150, maxRange: 600, rangeStep: 75, rangeStepSeconds: 10, staleSeconds: 20, queueTtlSeconds: 600, aiFallbackSeconds: 8, rematchCooldownSeconds: 0, allowAiFallback: true }),
    seed("economy-products", "starter-wallet", "Carteira inicial", { ...DEFAULT_STARTER_WALLET }),
    seed("economy-products", "craft-costs", "Custos de criação", { ...DEFAULT_CRAFT_COSTS }),
    seed("payment-products", "vanilla-starter", "Vanilla Starter", { priceCents: 990, currency: "BRL", grants: { gold: 500, dust: 150, packs: [{ packId: "basic", count: 3 }] }, active: true }),
    seed("payment-products", "vanilla-collector", "Vanilla Collector", { priceCents: 2490, currency: "BRL", grants: { gold: 1500, dust: 500, packs: [{ packId: "epic", count: 5 }, { packId: "legendary", count: 1 }] }, active: true }),
    seed("collection-rewards", "vanilla", "Álbum Vanilla", { collectionKey: "vanilla", milestones: [
      { percent: 25, grants: { gold: 150 } }, { percent: 50, grants: { dust: 150, packs: [{ packId: "basic", count: 1 }] } },
      { percent: 75, grants: { gold: 300, dust: 250, packs: [{ packId: "epic", count: 1 }] } },
      { percent: 100, grants: { gold: 750, dust: 500, packs: [{ packId: "legendary", count: 1 }], badges: ["vanilla-complete"], title: "Mestre de Vanilla" } },
    ] }),
    seed("visual-themes", "runeforge-default", "Runeforge Default", { id: "runeforge-default", board: "default", cardBack: "default", fxIntensity: 1, reduceMotion: false, tokens: { accent: "#f6c453", danger: "#fb7185", success: "#34d399" } }),
    seed("audio-cues", "master", "Mixagem principal", { group: "master", volume: 1, muted: false, ducking: 0.35 }),
    seed("localizations", "pt-br", "Português do Brasil", { locale: "pt-BR", fallback: "en", strings: {} }),
    seed("moderation-rules", "default", "Política padrão", { chatMaxLength: 280, floodWindowSeconds: 10, floodMaxMessages: 6, sanctions: ["warn", "mute", "suspend", "ban"], replayRetentionDays: 90, allowDeckModeration: true }),
    seed("ranked-seasons", "preseason", "Pré-temporada", { startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", active: true, placementGames: 10, rewards: [] }),
  );
  for (const format of BUILTIN_FORMATS) rows.push(seed("formats", format.id, format.name, { ...format }, format.description));
  for (const deck of VANILLA_EXPERIMENTAL_DECKS) rows.push(seed("experimental-decks", deck.id, deck.name, { ...deck, certified: false, promoted: false }, deck.description));
  rows.push(seed("ranked-seasons", "season-zero", "Season Zero", { startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-10-01T00:00:00.000Z", active: false, beta: true, placementGames: 10, rewards: [{ type: "cosmetic", key: "season-zero-founder" }], requiresBalanceCertification: true }, "Temporada beta preparada, mas inativa até o balance gate ficar verde."));
  return rows;
}

export async function seedControlPlaneDefaults(): Promise<number> {
  const { db, adminGameDefinitions } = await controlPersistence();
  let inserted = 0;
  for (const item of builtInControlDefinitions()) {
    const result = await db.insert(adminGameDefinitions).values({
      domain: item.domain, key: item.key, name: item.name, description: item.description || "",
      dangerLevel: item.dangerLevel || CONTROL_DOMAIN_INFO[item.domain].danger,
      schemaVersion: item.schemaVersion || 1, payload: item.payload, status: "draft", enabled: false,
    }).onConflictDoNothing({ target: [adminGameDefinitions.domain, adminGameDefinitions.key] }).returning({ id: adminGameDefinitions.id });
    inserted += result.length;
  }
  return inserted;
}

async function runtimeDomain<T>(domain: ControlDomain, defaults: readonly T[], keyOf: (value: T) => string): Promise<T[]> {
  try {
    const { db, adminGameDefinitions, and, asc, eq } = await controlPersistence();
    const rows = await db.select().from(adminGameDefinitions).where(and(eq(adminGameDefinitions.domain, domain), eq(adminGameDefinitions.status, "published"), eq(adminGameDefinitions.enabled, true))).orderBy(asc(adminGameDefinitions.id));
    if (!rows.length) return defaults.map((value) => structuredClone(value));
    const merged = new Map(defaults.map((value) => [keyOf(value), structuredClone(value)]));
    for (const row of rows) {
      const validation = validateControlDefinition({ domain, key: row.key, name: row.name, description: row.description, dangerLevel: row.dangerLevel as DangerLevel, schemaVersion: row.schemaVersion, payload: row.payload as Record<string, unknown> });
      if (!validation.passed) continue;
      const payload = structuredClone(row.payload) as T & { disabled?: boolean };
      if (payload.disabled) merged.delete(row.key);
      else merged.set(row.key, payload);
    }
    return [...merged.values()];
  } catch {
    return defaults.map((value) => structuredClone(value));
  }
}

export const getRuntimeDecks = async () => {
  await ensureCustomCardsLoaded();
  return runtimeDomain<DeckDef>("official-decks", DECKS, (item) => item.id);
};
export const getRuntimeDoctrines = () => runtimeDomain<ArchetypeProfile>("doctrines", Object.values(ARCHETYPES), (item) => item.deckId);
export const getRuntimePuzzles = () => runtimeDomain<Puzzle>("puzzles", PUZZLES, (item) => item.id);
export const getRuntimeBosses = () => runtimeDomain<Boss>("bosses", BOSSES, (item) => item.id);
export const getRuntimeBrawls = () => runtimeDomain<BrawlMode>("brawls", BRAWLS, (item) => item.id);
export const getRuntimeExpeditions = () => runtimeDomain<Encounter>("expeditions", ENCOUNTERS, (item) => item.id);
export const getRuntimePacks = () => runtimeDomain<PackDef>("packs", PACK_DEFS, (item) => item.id);
export const getRuntimeExperimentalDecks = () => runtimeDomain<DeckDef>("experimental-decks", VANILLA_EXPERIMENTAL_DECKS, (item) => item.id);
export async function getRuntimeFormats(): Promise<FormatDef[]> {
  const formats = await runtimeDomain<FormatDef>("formats", BUILTIN_FORMATS, (item) => item.id);
  try {
    const [{ db }, { adminCollections }, drizzle] = await Promise.all([import("@/db"), import("@/db/schema"), import("drizzle-orm")]);
    const rows = await db.select().from(adminCollections).where(drizzle.eq(adminCollections.status, "published")).orderBy(drizzle.asc(adminCollections.releaseDate));
    if (!rows.length) return formats;
    const now = Date.now();
    const activeKeys = rows.filter((row) => {
      const release = row.releaseDate?.getTime() ?? Number.NEGATIVE_INFINITY;
      const rotation = row.rotationDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return release <= now && now < rotation;
    }).map((row) => row.key);
    const nextRotation = rows.map((row) => row.rotationDate?.getTime()).filter((value): value is number => typeof value === "number" && value > now).sort((a, b) => a - b)[0];
    return formats.map((format) => format.id === "standard" ? {
      ...format,
      collectionKeys: activeKeys,
      rotationAt: nextRotation ? new Date(nextRotation).toISOString() : null,
      description: activeKeys.length
        ? `Formato rotativo principal · ${activeKeys.length} coleção(ões) publicada(s) atualmente legal(is).`
        : "Formato rotativo principal · nenhuma coleção publicada está dentro da janela legal.",
    } : format);
  } catch {
    return formats;
  }
}
export const getRuntimeLoginRewards = () => runtimeDomain<LoginReward>("login-rewards", LOGIN_REWARDS, (item) => `day-${item.day}`);
export const getRuntimeRankTiers = () => runtimeDomain<RankTier>("rank-tiers", RANK_TIERS, (item) => item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));

export async function getRuntimeStarterWallet() {
  const value = await getRuntimeDefinition("economy-products", "starter-wallet");
  return {
    gold: Number.isFinite(Number(value?.gold)) ? Math.max(0, Math.trunc(Number(value?.gold))) : DEFAULT_STARTER_WALLET.gold,
    dust: Number.isFinite(Number(value?.dust)) ? Math.max(0, Math.trunc(Number(value?.dust))) : DEFAULT_STARTER_WALLET.dust,
    xp: Number.isFinite(Number(value?.xp)) ? Math.max(0, Math.trunc(Number(value?.xp))) : DEFAULT_STARTER_WALLET.xp,
  };
}

export async function getRuntimeCraftCosts(): Promise<Record<"Common" | "Rare" | "Epic" | "Legend", number>> {
  const value = await getRuntimeDefinition("economy-products", "craft-costs");
  const fallback = DEFAULT_CRAFT_COSTS;
  return {
    Common: Number.isFinite(Number(value?.Common)) ? Math.max(0, Math.trunc(Number(value?.Common))) : fallback.Common,
    Rare: Number.isFinite(Number(value?.Rare)) ? Math.max(0, Math.trunc(Number(value?.Rare))) : fallback.Rare,
    Epic: Number.isFinite(Number(value?.Epic)) ? Math.max(0, Math.trunc(Number(value?.Epic))) : fallback.Epic,
    Legend: Number.isFinite(Number(value?.Legend)) ? Math.max(0, Math.trunc(Number(value?.Legend))) : fallback.Legend,
  };
}

export async function getRuntimeModes() {
  const [puzzles, bosses, brawls, encounters] = await Promise.all([getRuntimePuzzles(), getRuntimeBosses(), getRuntimeBrawls(), getRuntimeExpeditions()]);
  return { puzzles, bosses, brawls, encounters };
}

export async function getRuntimeDefinition(domain: ControlDomain, key: string): Promise<Record<string, any> | null> {
  try {
    const { db, adminGameDefinitions, and, eq } = await controlPersistence();
    const [row] = await db.select().from(adminGameDefinitions).where(and(eq(adminGameDefinitions.domain, domain), eq(adminGameDefinitions.key, key), eq(adminGameDefinitions.status, "published"), eq(adminGameDefinitions.enabled, true))).limit(1);
    if (!row) return null;
    const payload = row.payload as Record<string, any>;
    const validation = validateControlDefinition({ domain, key, name: row.name, description: row.description, dangerLevel: row.dangerLevel as DangerLevel, schemaVersion: row.schemaVersion, payload });
    return validation.passed ? structuredClone(payload) : null;
  } catch { return null; }
}

export async function getRuntimeEngineContract() {
  const { db, adminGameDefinitions, and, asc, eq } = await controlPersistence();
  const domains = ["engine-zones", "engine-phases", "engine-actions"] as const;
  const result: Record<string, Array<{ key: string; payload: Record<string, any> }>> = {};
  for (const domain of domains) {
    const defaults = builtInControlDefinitions().filter((item) => item.domain === domain).map((item) => ({ key: item.key, payload: structuredClone(item.payload) }));
    try {
      const rows = await db.select().from(adminGameDefinitions).where(and(eq(adminGameDefinitions.domain, domain), eq(adminGameDefinitions.status, "published"), eq(adminGameDefinitions.enabled, true))).orderBy(asc(adminGameDefinitions.id));
      const merged = new Map(defaults.map((item) => [item.key, item.payload]));
      for (const row of rows) {
        const payload = structuredClone(row.payload) as Record<string, any>;
        if (payload.disabled) merged.delete(row.key); else merged.set(row.key, payload);
      }
      result[domain] = [...merged.entries()].map(([key, payload]) => ({ key, payload }));
    } catch { result[domain] = defaults; }
  }
  return { zones: result["engine-zones"], phases: result["engine-phases"], actions: result["engine-actions"] };
}

export interface PaymentProduct { priceCents:number; currency:"BRL"; grants: Record<string, any>; active?:boolean; }
export async function getRuntimePaymentProducts(): Promise<Array<PaymentProduct & { key:string; name:string }>> {
  try {
    const { db, adminGameDefinitions, and, asc, eq } = await controlPersistence();
    const rows = await db.select().from(adminGameDefinitions).where(and(eq(adminGameDefinitions.domain, "payment-products"), eq(adminGameDefinitions.status, "published"), eq(adminGameDefinitions.enabled, true))).orderBy(asc(adminGameDefinitions.id));
    const seeded = builtInControlDefinitions().filter(x=>x.domain==="payment-products").map(x=>({ key:x.key, name:x.name, ...(x.payload as any) }));
    if (!rows.length) return seeded as any;
    return rows.map(row=>({ key:row.key, name:row.name, ...(row.payload as any) })).filter(item=>item.active!==false) as any;
  } catch { return builtInControlDefinitions().filter(x=>x.domain==="payment-products").map(x=>({key:x.key,name:x.name,...(x.payload as any)})) as any; }
}
export async function getCollectionRewardDefinition(collectionKey:string) { return getRuntimeDefinition("collection-rewards", collectionKey); }