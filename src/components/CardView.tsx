import { memo } from "react";
import type { CardDef, Keyword, Region, UnitInstance } from "@/game/types";
import { getCard } from "@/game/cards";
import type { GameState } from "@/game/types";
import { championProgressView } from "@/game/champion-progress";
import { strategicRoleForCard } from "@/game/card-role";
import { getCardCollection, type CardCollectionIdentity } from "@/game/card-collections";
import { getCardArt } from "@/game/card-art";
import { getClientArtFallbackUrl } from "@/game/client-game-config";
import CollectionSymbolMark from "./CollectionSymbolMark";
import { useCatalogRevision } from "./CatalogContext";
import { cardRegions, identityForRegions, REGION_IDENTITY_STYLE, regionalRuleText } from "@/game/region-identity";

export const REGION_STYLE: Record<Region, { grad: string; border: string; text: string; ring: string; label: string; aura: string; sigil: string; art: string }> = {
  Emberhold: { grad: "from-orange-500 via-red-700 to-slate-950", border: "border-orange-300/80", text: "text-orange-100", ring: "ring-orange-300", label: "Emberhold", aura: "card-aura-ember", sigil: "🔥", art: "/art/regions/emberhold.svg" },
  Tidecall: { grad: "from-cyan-400 via-blue-700 to-slate-950", border: "border-cyan-200/80", text: "text-cyan-100", ring: "ring-cyan-200", label: "Tidecall", aura: "card-aura-tide", sigil: "🌊", art: "/art/regions/tidecall.svg" },
  // Ironwood era emerald e Florestia era lime — praticamente a mesma cor a
  // distância de mão de carta. Ironwood agora puxa pro teal (verde-azulado,
  // "metal frio") pra ficar distinto do verde-amarelado de Florestia.
  Ironwood: { grad: "from-teal-400 via-emerald-800 to-slate-950", border: "border-teal-200/80", text: "text-teal-100", ring: "ring-teal-200", label: "Ironwood", aura: "card-aura-iron", sigil: "🌿", art: "/art/regions/ironwood.svg" },
  Voidborn: { grad: "from-fuchsia-500 via-purple-800 to-slate-950", border: "border-fuchsia-300/80", text: "text-fuchsia-100", ring: "ring-fuchsia-300", label: "Vazio", aura: "card-aura-void", sigil: "☠", art: "/art/regions/voidborn.svg" },
  // Florestia (matilha/feras) agora em dourado — bem distante do teal de
  // Ironwood no círculo cromático, mantendo a identidade "selvagem".
  Florestia: { grad: "from-amber-400 via-yellow-700 to-slate-950", border: "border-amber-200/80", text: "text-amber-100", ring: "ring-amber-200", label: "Florestia", aura: "card-aura-forest", sigil: "🐺", art: "/art/regions/florestia.svg" },
  // Tempestade era violet — quase idêntico ao fuchsia/purple de Voidborn.
  // Agora um azul elétrico puro, bem separado do roxo de Voidborn e do
  // ciano-oceânico de Tidecall.
  Tempestade: { grad: "from-blue-400 via-indigo-800 to-slate-950", border: "border-blue-200/80", text: "text-blue-100", ring: "ring-blue-200", label: "Tempestade", aura: "card-aura-storm", sigil: "⚡", art: "/art/regions/tempestade.svg" },
};

const KEYWORD_ABBR: Record<Keyword, string> = {
  Overwhelm: "ATROPELAR", QuickAttack: "ATAQUE RÁPIDO", DoubleStrike: "ATAQUE DUPLO", Elusive: "EVASIVO", Lifesteal: "VAMPÍRICO", Barrier: "BARREIRA", Fearsome: "ASSUSTADOR", Tough: "RESISTENTE", Regeneration: "REGENERAÇÃO", Challenger: "DESAFIADOR", Unblockable: "IMPARÁVEL", Ephemeral: "EFÊMERO", LastBreath: "ÚLTIMO SUSPIRO", Deathtouch: "TOQUE MORTAL", Poisonous: "VENENOSO", Haste: "ÍMPETO", Wither: "MURCHAR", Hexproof: "HEXPROOF", Reach: "ALCANCE", Flying: "VOO",
};

const KEYWORD_ICON: Record<Keyword, string> = {
  Overwhelm: "⚔", QuickAttack: "⚡", DoubleStrike: "⚔⚔", Elusive: "◈", Lifesteal: "🩸", Barrier: "🛡", Fearsome: "☠", Tough: "◆", Regeneration: "✚", Challenger: "↯", Unblockable: "➤", Ephemeral: "💨", LastBreath: "☽", Deathtouch: "☠", Poisonous: "🧪", Haste: "»", Wither: "◌", Hexproof: "◇", Reach: "⌁", Flying: "✦",
};

export function KeywordChips({ keywords, compact = false }: { keywords: Keyword[]; compact?: boolean }) {
  if (!keywords.length) return null;
  const visible = compact ? keywords.slice(0, 2) : keywords;
  const remaining = keywords.length - visible.length;
  return (
    <div className="card-keywords" aria-label={keywords.map((keyword) => KEYWORD_ABBR[keyword]).join(", ")}>
      {visible.map((k) => (
        <span key={k} data-keyword={k} title={KEYWORD_ABBR[k]} className="card-keyword">
          <b>{KEYWORD_ICON[k]}</b>{compact ? "" : KEYWORD_ABBR[k]}
        </span>
      ))}
      {remaining > 0 && <span className="card-keyword-more" title={`${remaining} palavra(s)-chave adicional(is)`}>+{remaining}</span>}
    </div>
  );
}

export interface CardViewProps {
  defId: string; definition?: CardDef; collection?: CardCollectionIdentity | null; unit?: UnitInstance; state?: GameState; size?: "sm" | "md" | "lg"; selected?: boolean; dimmed?: boolean; targetable?: boolean; attacking?: boolean; count?: number; costOverride?: number; className?: string; onClick?: () => void;
}

function CardView({ defId, definition, collection: collectionOverride, unit, state, size = "md", selected, dimmed, targetable, attacking, count, costOverride, className, onClick }: CardViewProps) {
  useCatalogRevision();
  const def: CardDef = definition ?? getCard(defId);
  const collection = collectionOverride === undefined ? getCardCollection(def.defId) : collectionOverride;
  const style = REGION_STYLE[def.region];
  const configuredFallbackArt = getClientArtFallbackUrl();
  const artAssignment = getCardArt(def.defId);
  const artUrl = artAssignment?.url || def.art || configuredFallbackArt || style.art;
  const artCrop = artAssignment?.crop;
  const regions = cardRegions(def);
  const identity = identityForRegions(regions);
  const masteryText = regionalRuleText(def);
  const spectrum = "linear-gradient(90deg, " + regions.map((region) => REGION_IDENTITY_STYLE[region].color).join(", ") + ")";
  const dims = size === "sm" ? "w-20 h-28 text-[9px]" : size === "lg" ? "w-40 h-60 text-xs" : "w-28 h-40 text-[10px]";
  const power = unit ? unit.power : def.power;
  const health = unit ? unit.health : def.health;
  const maxHealth = unit ? unit.maxHealth : def.health;
  const keywords = unit ? unit.keywords : def.keywords ?? [];
  const damaged = unit && health !== undefined && maxHealth !== undefined && health < maxHealth;
  const isChamp = Boolean(def.isChampion || unit?.isChampion);
  const leveled = Boolean(unit?.leveled);
  const prog = state && unit ? championProgressView(state, unit) : null;
  const rarity = isChamp ? "card-rarity-champion" : def.type === "Equipment" ? "card-rarity-equipment" : def.type === "Enchantment" || def.type === "Artifact" ? "card-rarity-relic" : "";
  // Antes deste ponto: só Campeão/Equipamento/Relíquia tinham QUALQUER
  // acabamento visual de raridade — uma Unidade ou Feitiço Épico/Lendário
  // ficava visualmente idêntico a um Comum do mesmo tipo. Preenche essa
  // lacuna sem duplicar o brilho de quem já tem tratamento por tipo.
  const rarityTier = rarity ? "" : `card-tier-${(def.rarity || "Common").toLowerCase()}`;
  const rarityLabel = isChamp ? "CAMPEÃO" : def.rarity === "Legend" ? "LENDÁRIA" : def.rarity === "Epic" ? "ÉPICA" : def.rarity === "Rare" ? "RARA" : "COMUM";
  const role = strategicRoleForCard(def);
  const cardState = targetable ? "targetable" : selected ? "selected" : attacking ? "attacking" : dimmed ? "dimmed" : onClick ? "playable" : "idle";

  return (
    <button type="button" onClick={onClick} disabled={!onClick} aria-label={def.name}
      aria-pressed={selected || undefined}
      data-card-region={def.region.toLowerCase()}
      data-card-region-count={regions.length}
      data-card-identity={identity.key}
      data-card-rarity={(def.rarity || "Common").toLowerCase()}
      data-card-type={def.type.toLowerCase()}
      data-card-role={role.id}
      data-card-collection={collection?.code.toLowerCase() || "unassigned"}
      data-card-state={cardState}
      className={["card-shell relative flex flex-col overflow-hidden rounded-xl border-2 text-left", dims, style.border, style.aura, rarity, rarityTier, className ?? "", onClick ? "cursor-pointer card-interactive" : "cursor-default", selected ? `ring-4 ${style.ring} -translate-y-2` : "", targetable ? "ring-4 ring-yellow-300 card-targetable" : "", attacking ? "ring-4 ring-red-400 card-attacking" : "", dimmed ? "opacity-40 grayscale-[0.5]" : "", leveled ? "card-leveled" : ""].join(" ")}
    >
      <div className="card-art absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${artUrl})`, backgroundPosition: artCrop ? `${Math.max(0, Math.min(1, Number(artCrop.x ?? .5))) * 100}% ${Math.max(0, Math.min(1, Number(artCrop.y ?? .5))) * 100}%` : undefined, backgroundSize: artCrop && Number(artCrop.scale) > 1 ? `${Math.min(250, Math.max(100, Number(artCrop.scale) * 100))}%` : undefined }}>
        {!def.art && !artAssignment?.url && <div className="card-art-fallback"><i /><span>{def.emoji}</span><b>{style.sigil}</b></div>}
      </div>
      {regions.length > 1 && <div className="card-region-spectrum" style={{ background: spectrum }} aria-hidden="true" />}
      <div className="card-vignette absolute inset-0" />
      <div className="card-sheen absolute inset-0" />
      <div className="card-frame-ornament" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="card-inner relative z-10 flex h-full flex-col p-1.5">
        <div className="card-topline">
          <div className={["card-cost", costOverride !== undefined && costOverride < def.cost ? "card-cost-reduced" : ""].join(" ")}>{costOverride ?? def.cost}</div>
          {collection && <div className="card-collection" title={`Coleção: ${collection.name}`}><CollectionSymbolMark symbol={collection.symbol} name={collection.name} className="h-3 w-3 rounded-full object-cover" />{size !== "sm" && collection.code}</div>}
          <div className="card-region" title={identity.name}><span className="card-region-sigil">{identity.sigils}</span>{size !== "sm" && identity.name}</div>
          {isChamp && <div className="card-champion" title={leveled ? "Campeão evoluído" : "Campeão"}>{leveled ? "✦" : "★"}</div>}
        </div>

        <div className="card-nameplate">
          <div className="card-name-line"><span className="card-name-gem">◆</span><p className="truncate font-black leading-tight text-white drop-shadow-lg">{def.name}</p></div>
          {size !== "sm" && <p className="card-type">{def.archetypeName || def.type}{def.race ? ` · ${def.race}` : ""}<span>{rarityLabel}</span></p>}
          {size !== "sm" && <span className={`card-role card-role-${role.id}`} title="Função estratégica da carta"><i>{role.icon}</i>{role.label}</span>}
        </div>

        <div className="min-h-0 flex-1" />

        {prog && !prog.leveled && size !== "sm" && (
          <div className="card-progress-wrap"><span>{prog.current}/{prog.goal}</span><div className="card-progress"><div style={{ width: `${Math.min(100, Math.round((prog.current / prog.goal) * 100))}%` }} /></div></div>
        )}

        {size !== "sm" && <div className="card-textbox"><p className="line-clamp-4 text-[8px] leading-[1.15] text-white/95">{def.description}</p>{size === "lg" && def.flavor && <p className="mt-1 line-clamp-2 border-t border-white/10 pt-1 text-[7px] italic leading-tight text-white/55">“{def.flavor}”</p>}{masteryText && <p className="card-mastery">{masteryText}</p>}</div>}

        <div className="card-bottom">
          <KeywordChips keywords={keywords} compact={size === "sm"} />
          {def.type === "Unit" && <div className="card-stats"><span className="stat-power">{power}</span><span className={damaged ? "stat-health damaged" : "stat-health"}>{health}</span></div>}
          {def.type === "Spell" && <span className="card-speed"><b>✦</b>{def.speed === "Fast" ? "RÁPIDO" : def.speed === "Burst" ? "EXPLOSÃO" : "FEITIÇO"}</span>}
        </div>
      </div>

      {unit && unit.equipment.length > 0 && <div className="absolute left-1 top-8 z-20 flex gap-0.5">{unit.equipment.map((eq, i) => <span key={`${eq.instanceId}_${i}`} className="card-equip" title={getCard(eq.defId).name}>{getCard(eq.defId).emoji}</span>)}</div>}
      {(def.type === "Enchantment" || def.type === "Artifact") && <span className="card-badge card-badge-relic">✦</span>}
      {def.type === "Equipment" && <span className="card-badge card-badge-equip">⚙</span>}
      {unit?.barrier && <div className="card-state card-state-barrier" title="Barreira"><span>🛡</span></div>}
      {unit?.frostbitten && <div className="card-state card-state-frost" title="Congelado"><span>❄</span></div>}
      {unit?.stunned && <div className="card-state card-state-stun" title="Atordoado"><span>✦</span></div>}
      {unit?.keywords.includes("Ephemeral") && <div className="card-state card-state-ephemeral" title="Efêmero">💨</div>}
      {typeof count === "number" && count > 1 && <span className="card-count">×{count}</span>}
    </button>
  );
}

export default memo(CardView);
