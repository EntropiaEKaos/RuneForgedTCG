"use client";

import { useMemo, useState } from "react";
import CardTip from "@/components/CardTip";
import { REGION_STYLE } from "@/components/CardView";
import type { CardCollectionIdentity } from "@/game/card-collections";
import { cardRegions, identityForRegions } from "@/game/region-identity";
import {
  CERTIFIED_SEMANTIC_CARD_TYPES,
  certifiedSemanticCardType,
  semanticCardTypeLabel,
  type CertifiedSemanticCardTypeKey,
} from "@/game/semantic-card-types";
import type { CardDef, CardType, Rarity, Region } from "@/game/types";

export type CodexEntry = {
  card: CardDef;
  collection: CardCollectionIdentity | null;
};

type AvailabilityFilter = "all" | "collectible" | "generated";
type RegionFilter = "all" | Region;
type TypeFilter = "all" | CardType | CertifiedSemanticCardTypeKey;
type RarityFilter = "all" | Rarity;

const REGIONS = Object.keys(REGION_STYLE) as Region[];
const TYPES: CardType[] = ["Unit", "Spell", "Enchantment", "Artifact", "Equipment", "Sentinela"];
const RARITIES: Rarity[] = ["Common", "Rare", "Epic", "Legend"];

const TYPE_LABEL: Record<CardType, string> = {
  Unit: "Unidade",
  Spell: "Feitiço",
  Enchantment: "Encantamento",
  Artifact: "Artefato",
  Equipment: "Equipamento",
  Sentinela: "Sentinela",
};

const TYPE_OPTIONS: { value: Exclude<TypeFilter, "all">; label: string }[] = [
  ...TYPES.map((value) => ({ value, label: TYPE_LABEL[value] })),
  ...CERTIFIED_SEMANTIC_CARD_TYPES.map((contract) => ({
    value: contract.key,
    label: `${contract.icon} ${contract.name}`,
  })),
];

const RARITY_LABEL: Record<Rarity, string> = {
  Common: "Comum",
  Rare: "Rara",
  Epic: "Épica",
  Legend: "Lendária",
};

const TIMING_LABEL = {
  battlefield: "Permanente de campo",
  "main-only": "Somente fase principal",
  "reaction-only": "Somente reação",
} as const;

const MANA_LABEL = {
  regular: "Mana regular",
  spell: "Mana de feitiço",
} as const;

function visibleTypeKey(card: CardDef): Exclude<TypeFilter, "all"> {
  return certifiedSemanticCardType(card)?.key ?? card.type;
}

function visibleTypeLabel(card: CardDef): string {
  const semantic = certifiedSemanticCardType(card);
  return semantic ? `${semantic.icon} ${semanticCardTypeLabel(card)}` : TYPE_LABEL[card.type];
}

function searchableText(entry: CodexEntry) {
  const card = entry.card;
  const semantic = certifiedSemanticCardType(card);
  return [
    card.name,
    card.defId,
    card.description,
    card.flavor,
    card.type,
    card.archetypeName,
    semantic?.name,
    semantic?.description,
    semantic?.timing,
    semantic?.mana,
    card.rarity,
    card.race,
    ...(card.secondaryRaces ?? []),
    ...(card.classes ?? []),
    ...(card.keywords ?? []),
    ...(card.customKeywords ?? []),
    ...cardRegions(card),
    entry.collection?.name,
    entry.collection?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function CodexExplorer({ entries }: { entries: CodexEntry[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [collection, setCollection] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [selectedDefId, setSelectedDefId] = useState(entries[0]?.card.defId ?? "");

  const collections = useMemo(() => {
    const values = new Map<string, CardCollectionIdentity>();
    for (const entry of entries) {
      if (entry.collection) values.set(entry.collection.code, entry.collection);
    }
    return [...values.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const card = entry.card;
      if (needle && !searchableText(entry).includes(needle)) return false;
      if (region !== "all" && !cardRegions(card).includes(region)) return false;
      if (type !== "all" && visibleTypeKey(card) !== type) return false;
      if (rarity !== "all" && card.rarity !== rarity) return false;
      if (collection !== "all" && entry.collection?.code !== collection) return false;
      if (availability === "collectible" && card.collectible === false) return false;
      if (availability === "generated" && card.collectible !== false) return false;
      return true;
    });
  }, [availability, collection, entries, query, rarity, region, type]);

  const selected = useMemo(
    () => filtered.find((entry) => entry.card.defId === selectedDefId) ?? filtered[0] ?? null,
    [filtered, selectedDefId],
  );

  const stats = useMemo(() => ({
    total: entries.length,
    collectible: entries.filter((entry) => entry.card.collectible !== false).length,
    generated: entries.filter((entry) => entry.card.collectible === false).length,
    multiRegion: entries.filter((entry) => cardRegions(entry.card).length > 1).length,
    collections: collections.length,
  }), [collections.length, entries]);

  const hasFilters = Boolean(query.trim()) || region !== "all" || type !== "all" || rarity !== "all" || collection !== "all" || availability !== "all";

  function clearFilters() {
    setQuery("");
    setRegion("all");
    setType("all");
    setRarity("all");
    setCollection("all");
    setAvailability("all");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Resumo do Codex">
        <Metric label="Definições" value={stats.total} detail="catálogo carregado" />
        <Metric label="Colecionáveis" value={stats.collectible} detail="disponíveis para coleção" />
        <Metric label="Geradas" value={stats.generated} detail="tokens e formas" />
        <Metric label="Multi-região" value={stats.multiRegion} detail="duplas ou triplas" />
        <Metric label="Coleções" value={stats.collections} detail="identidades publicadas" />
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="rf-eyebrow"><span /> EXPLORADOR</p>
            <h2 className="mt-1 text-xl font-black text-white">Encontre qualquer carta publicada</h2>
            <p className="mt-1 text-xs text-slate-500">Passe o mouse em uma carta — ou toque e segure — para abrir a inteligência completa.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{filtered.length} resultado(s)</span>
            {hasFilters && <button type="button" className="rf-button rf-button-secondary !px-3 !py-1.5" onClick={clearFilters}>LIMPAR</button>}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(145px,0.75fr))]">
          <label className="block">
            <span className="sr-only">Buscar no Codex</span>
            <input
              className="input w-full"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, habilidade, raça, classe ou coleção…"
            />
          </label>
          <FilterSelect label="Tipo" value={type} onChange={(value) => setType(value as TypeFilter)} options={TYPE_OPTIONS} />
          <FilterSelect label="Raridade" value={rarity} onChange={(value) => setRarity(value as RarityFilter)} options={RARITIES.map((value) => ({ value, label: RARITY_LABEL[value] }))} />
          <FilterSelect label="Coleção" value={collection} onChange={setCollection} options={collections.map((item) => ({ value: item.code, label: `${item.code} · ${item.name}` }))} />
          <FilterSelect label="Disponibilidade" value={availability} onChange={(value) => setAvailability(value as AvailabilityFilter)} options={[{ value: "collectible", label: "Colecionáveis" }, { value: "generated", label: "Tokens / formas" }]} />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filtro por região">
          <RegionButton selected={region === "all"} label="Todas" onClick={() => setRegion("all")} />
          {REGIONS.map((value) => (
            <RegionButton
              key={value}
              selected={region === value}
              label={`${REGION_STYLE[value].sigil} ${REGION_STYLE[value].label}`}
              onClick={() => setRegion(value)}
            />
          ))}
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center">
          <div className="max-w-md">
            <div className="text-4xl">◇</div>
            <h3 className="mt-3 text-xl font-black text-white">Nenhuma definição encontrada</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Os filtros atuais não correspondem ao catálogo publicado. Limpe os filtros ou amplie a busca.</p>
            <button type="button" className="rf-button rf-button-secondary mt-4" onClick={clearFilters}>LIMPAR FILTROS</button>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {filtered.map((entry) => {
                const card = entry.card;
                const identity = identityForRegions(cardRegions(card));
                const isSelected = selected?.card.defId === card.defId;
                return (
                  <article key={card.defId} className={`rounded-2xl border p-3 transition ${isSelected ? "border-cyan-300/45 bg-cyan-300/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
                    <div className="flex justify-center">
                      <CardTip
                        defId={card.defId}
                        definition={card}
                        collection={entry.collection}
                        size="lg"
                        selected={isSelected}
                        onClick={() => setSelectedDefId(card.defId)}
                      />
                    </div>
                    <button type="button" className="mt-3 w-full text-left" onClick={() => setSelectedDefId(card.defId)}>
                      <p className="truncate text-xs font-black text-white">{card.name}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{visibleTypeLabel(card)} · {entry.collection?.code || "—"} · {identity.name}</p>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {selected && <CardInspector entry={selected} />}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select className="input w-full" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        <option value="all">{label}: Todos</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function RegionButton({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition ${selected ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-white"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CardInspector({ entry }: { entry: CodexEntry }) {
  const card = entry.card;
  const regions = cardRegions(card);
  const identity = identityForRegions(regions);
  const semanticType = certifiedSemanticCardType(card);
  return (
    <aside className="h-fit rounded-3xl border border-white/10 bg-slate-950/70 p-5 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Dossiê da carta</p>
          <h2 className="mt-1 text-xl font-black text-white">{card.name}</h2>
        </div>
        <span className="rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-lg font-black text-sky-100">{card.cost}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{visibleTypeLabel(card)}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{RARITY_LABEL[card.rarity]}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{card.collectible === false ? "Gerada" : "Colecionável"}</span>
      </div>

      {semanticType && (
        <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300/70">Contrato de gameplay</p>
          <p className="mt-2 font-black text-white">{semanticType.icon} {semanticType.name}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{semanticType.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-slate-300">
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{TIMING_LABEL[semanticType.timing]}</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{MANA_LABEL[semanticType.mana]}</span>
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">Base técnica: {TYPE_LABEL[semanticType.baseType]}</span>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Identidade regional</p>
        <p className="mt-2 font-black text-white">{identity.sigils} {identity.name}</p>
        <p className="mt-1 text-xs text-slate-500">{regions.join(" + ")}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Coleção</p>
        <p className="mt-2 font-black text-white">{entry.collection?.name || "Sem coleção atribuída"}</p>
        <p className="mt-1 text-xs text-slate-500">{entry.collection?.code || "—"}</p>
      </div>

      <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Texto de regras</p>
          <p className="mt-1">{card.description || "Sem texto de regras."}</p>
        </div>
        {card.flavor && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lore</p><p className="mt-1 italic text-slate-400">“{card.flavor}”</p></div>}
      </div>

      {(card.power !== undefined || card.health !== undefined) && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3"><p className="text-[10px] uppercase text-amber-200/60">Poder</p><p className="mt-1 text-2xl font-black text-amber-200">{card.power ?? "—"}</p></div>
          <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-3"><p className="text-[10px] uppercase text-rose-200/60">Vida</p><p className="mt-1 text-2xl font-black text-rose-200">{card.health ?? "—"}</p></div>
        </div>
      )}

      {(card.keywords?.length || card.customKeywords?.length) ? (
        <div className="mt-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Habilidades</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...(card.keywords ?? []), ...(card.customKeywords ?? [])].map((keyword) => (
              <span key={keyword} className="rounded-full border border-fuchsia-300/15 bg-fuchsia-300/[0.06] px-2.5 py-1 text-[10px] font-bold text-fuchsia-100">{keyword}</span>
            ))}
          </div>
        </div>
      ) : null}

      {(card.race || card.secondaryRaces?.length || card.classes?.length) ? (
        <div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-400">
          {card.race && <p><span className="font-bold text-slate-300">Raças:</span> {[card.race, ...(card.secondaryRaces ?? [])].join(" / ")}</p>}
          {card.classes?.length ? <p className="mt-1"><span className="font-bold text-slate-300">Classes:</span> {card.classes.join(" / ")}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}
