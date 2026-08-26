const ARENAS: Record<string, { sigil: string; name: string; title: string; motes: string[]; art?: string }> = {
  emberhold: { sigil: "🔥", name: "EMBERHOLD", title: "Forja das Cinzas", motes: ["✦", "·", "▲"], art: "/art/regions/emberhold.svg" },
  tidecall: { sigil: "🌊", name: "TIDECALL", title: "Santuário das Marés", motes: ["◌", "·", "≈"], art: "/art/regions/tidecall.svg" },
  ironwood: { sigil: "🌿", name: "IRONWOOD", title: "Bastião Ancestral", motes: ["⌁", "◆", "·"], art: "/art/regions/ironwood.svg" },
  voidborn: { sigil: "☠", name: "VAZIO", title: "Abismo Sem Nome", motes: ["◇", "·", "☽"], art: "/art/regions/voidborn.svg" },
  florestia: { sigil: "🐺", name: "FLORESTIA", title: "Domínio da Matilha", motes: ["✣", "·", "⌁"], art: "/art/regions/florestia.svg" },
  tempestade: { sigil: "⚡", name: "TEMPESTADE", title: "Olho do Trovão", motes: ["ϟ", "·", "✦"], art: "/art/regions/tempestade.svg" },
  neutral: { sigil: "◆", name: "NEXUS", title: "Arena de Convergência", motes: ["✦", "·", "◇"] },
};

export function ArenaIdentity({ region, regions }: { region: string; regions?: Region[] }) {
  const arena = ARENAS[region] ?? ARENAS.neutral;
  const identity = regions?.length ? identityForRegions(regions) : null;
  const convergence = identity && identity.regions.length > 1
    ? "linear-gradient(115deg, " + identity.regions.map((item) => REGION_IDENTITY_STYLE[item].color + "33").join(", ") + ")"
    : null;
  return (
    <div className="arena-identity" aria-hidden="true">
      {arena.art && <div className="arena-backdrop" style={{ backgroundImage: `url(${arena.art})` }} />}
      {convergence && <div className="arena-convergence" style={{ background: convergence }} />}
      <div className="arena-crest"><span>{identity?.sigils || arena.sigil}</span><div><b>{identity?.name.toUpperCase() || arena.name}</b><small>{identity ? identity.description : arena.title}</small></div></div>
      <div className="arena-motes">{Array.from({ length: 12 }, (_, index) => <i key={index}>{arena.motes[index % arena.motes.length]}</i>)}</div>
    </div>
  );
}
import type { Region } from "@/game/types";
import { identityForRegions, REGION_IDENTITY_STYLE } from "@/game/region-identity";
