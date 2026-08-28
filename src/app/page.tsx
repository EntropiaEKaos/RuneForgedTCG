import Link from "next/link";
import Image from "next/image";
import { DECKS } from "@/game/decks";
import { REGION_STYLE } from "@/components/CardView";
import DailyLogin from "@/components/DailyLogin";

export const dynamic = "force-dynamic";

const KEYWORDS: { name: string; desc: string; icon: string }[] = [
  { name: "Overwhelm", desc: "Excess damage to a blocker spills onto the enemy Nexus.", icon: "💢" },
  { name: "Quick Attack", desc: "Strikes first — kill the blocker before it hits back.", icon: "⚡" },
  { name: "Elusive", desc: "Can only be blocked by other Elusive units.", icon: "🌀" },
  { name: "Fearsome", desc: "Can only be blocked by units with 3+ power.", icon: "😱" },
  { name: "Lifesteal", desc: "Heals your Nexus for the damage it deals.", icon: "🩸" },
  { name: "Barrier", desc: "Negates the next instance of damage it takes.", icon: "🛡️" },
  { name: "Tough", desc: "Takes 1 less damage from every source.", icon: "🪨" },
  { name: "Regeneration", desc: "Heals to full health at the end of each round.", icon: "🌱" },
  { name: "Challenger", desc: "Force a chosen enemy to block this attacker.", icon: "🎯" },
  { name: "Double Strike", desc: "Strikes twice — once fast, then again if it survives.", icon: "⚔️" },
  { name: "Level Up", desc: "Champions transform mid-match when their condition is met.", icon: "✨" },
  { name: "Play effects", desc: "On-summon abilities draw, ping, or spawn tokens.", icon: "🪄" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen text-slate-100">
      {/* Hero */}
      <section className="home-hero mx-auto max-w-none px-6 pt-20 pb-14 text-center">
        <p className="home-kicker text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
          A Collectible Card Battler
        </p>
        <h1 className="home-title mt-4 bg-gradient-to-br from-amber-100 via-amber-400 to-orange-500 bg-clip-text text-5xl font-black leading-tight text-transparent drop-shadow sm:text-7xl">
          RUNEFORGE
        </h1>
        <p className="text-lg font-bold tracking-widest text-slate-300 sm:text-2xl">
          LEGENDS OF THE NEXUS
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-sm text-slate-400 sm:text-base">
          Ramp your mana, seize the Attack Token, and outplay The Adversary in fast,
          tactical duels. Summon units, weave spells, and shatter the enemy Nexus
          from 20 down to 0. A tribute to the round-based, priority-driven combat that
          made lane duels legendary.
        </p>
        <div className="mx-auto mt-6 max-w-2xl">
          <DailyLogin />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/play" className="btn-primary text-base">
            ⚔️ Play Now
          </Link>
          <Link href="/ranked" className="btn-primary text-base">
            🏆 Ranked
          </Link>
          <Link href="/pvp" className="btn-primary text-base">
            👥 PvP
          </Link>
          <Link href="/modes" className="btn-ghost text-base">
            🎯 Modos
          </Link>
          <Link href="/store" className="btn-ghost text-base">
            🎁 Loja
          </Link>
          <Link href="/draft" className="btn-ghost text-base">
            ⚔️ Arena Draft
          </Link>
          <Link href="/collection" className="btn-ghost text-base">
            📚 Coleção
          </Link>
          <Link href="/profile" className="btn-ghost text-base">
            👤 Perfil
          </Link>
          <Link href="/friends" className="btn-ghost text-base">
            🤝 Amigos
          </Link>
          <Link href="/community" className="btn-ghost text-base">
            🌐 Comunidade
          </Link>
          <Link href="/forge" className="btn-ghost text-base">
            🔨 Forge
          </Link>
          <Link href="/codex" className="btn-ghost text-base">
            📖 Codex
          </Link>
          <Link href="/leaderboard" className="btn-ghost text-base">
            📊 Leaderboard
          </Link>
          <Link href="/simulate" className="btn-ghost text-sm">
            🧪 Simulate
          </Link>
          <Link href="/admin" className="btn-ghost text-sm">
            🔐 Admin
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="home-section-title mb-6 text-center text-2xl font-black text-slate-100">Four Champions. One Destiny.</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { src: "/images/champs/pyra.jpg", name: "Pyra", title: "the Everflame", cond: "Deal 8 Nexus damage" },
            { src: "/images/champs/nerida.jpg", name: "Nerida", title: "Tide Empress", cond: "Cast 4 spells" },
            { src: "/images/champs/bramblehart.jpg", name: "Bramblehart", title: "Grovekeeper", cond: "Summon 5 allies" },
            { src: "/images/champs/malakar.jpg", name: "Malakar", title: "the Hollow King", cond: "Strike the Nexus twice" },
          ].map((c) => (
            <figure key={c.name} className="home-champion overflow-hidden rounded-2xl">
              <Image src={c.src} alt={c.name} width={420} height={192} className="h-48 w-full object-cover object-top" />
              <figcaption className="p-3">
                <div className="font-black text-amber-200">{c.name}</div>
                <div className="text-xs text-slate-400">{c.title}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">Level Up: {c.cond}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Decks */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="home-section-title mb-6 text-center text-2xl font-black text-slate-100">
          Four Regions. Four Playstyles.
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DECKS.map((d) => {
            const style = REGION_STYLE[d.regions[0]];
            return (
              <div
                key={d.id}
                className={`home-region flex flex-col rounded-2xl border-2 bg-gradient-to-br p-5 ${style.grad} ${style.border}`}
              >
                <div className="text-4xl drop-shadow">{d.emoji}</div>
                <h3 className="mt-2 text-lg font-black text-white drop-shadow">{d.name}</h3>
                <p className="mt-1 text-xs text-white/85">{d.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Magic-style mechanics */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="home-section-title mb-6 text-center text-2xl font-black text-slate-100">Beyond Keywords</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "🐉", name: "Tribal Synergy", desc: "Each unit has a Race (Dragon, Sprite, Beast…). Hybrid units buff multiple tribes at once." },
            { icon: "📜", name: "Enchantments", desc: "Persistent board presence with HP — triggers each round or buffs allies as long as they survive." },
            { icon: "⚙️", name: "Artifacts", desc: "Powerful non-creature permanents that refund mana, draw cards, or otherwise change the rules." },
            { icon: "⚔️", name: "Equipment", desc: "Attach gear for stats/keywords. Special blades draw on kill or heal on strike. Falls with the unit." },
            { icon: "🔨", name: "Disenchant", desc: "Shatterforge, Disenchant Tide, Withering Vines and Unmake destroy or damage enemy permanents." },
            { icon: "🧬", name: "Hybrid Races", desc: "Steamscale Wyrm, Twilight Packlord and Grove Chorus bridge two tribes with shared buffs." },
            { icon: "⚡", name: "Spell Stack", desc: "Fast/Burst answers form a stack. Responses resolve last-in-first-out, letting you answer the answer." },
          ].map((c) => (
            <div
              key={c.name}
              className="home-feature rounded-xl border p-4"
            >
              <div className="text-2xl">{c.icon}</div>
              <h3 className="mt-1 font-bold text-amber-200">{c.name}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <h2 className="home-section-title mb-6 text-center text-2xl font-black text-slate-100">Master the Keywords</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KEYWORDS.map((k) => (
            <div
              key={k.name}
              className="home-feature rounded-xl border p-4"
            >
              <div className="text-2xl">{k.icon}</div>
              <h3 className="mt-1 font-bold text-amber-200">{k.name}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{k.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to play */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="home-section-title mb-6 text-center text-2xl font-black text-slate-100">How a Round Works</h2>
        <ol className="space-y-3 text-sm text-slate-300">
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <b className="text-amber-200">1. Gain Mana.</b> Both players gain +1 max mana each round
            (up to 10) and refill. Unspent mana banks as ✦ spell mana (up to 3).
          </li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <b className="text-amber-200">2. Take the Attack Token.</b> It alternates every round.
            Only the holder ⚔️ may declare an attack that round.
          </li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <b className="text-amber-200">3. Fight.</b> The attacker sends units; the defender assigns
            blockers. Keywords decide who lives and who feeds the Nexus.
          </li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <b className="text-amber-200">4. Level your Champion.</b> Meet their condition mid-match
            and they transform into a stronger form with a new ability.
          </li>
          <li className="rounded-xl border border-white/10 bg-white/5 p-4">
            <b className="text-amber-200">5. Win.</b> Reduce the enemy Nexus from 20 to 0.
          </li>
        </ol>
        <div className="mt-8 text-center">
          <Link href="/play" className="btn-primary text-base">
            ⚔️ Enter the Nexus
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        Runeforge: Legends of the Nexus — an original card-battler prototype.
      </footer>
    </main>
  );
}
