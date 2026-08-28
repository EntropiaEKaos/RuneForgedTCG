import Image from "next/image";
import Link from "next/link";
import DailyLogin from "@/components/DailyLogin";
import SiteNav from "@/components/SiteNav";
import { REGION_STYLE } from "@/components/CardView";
import { DECKS } from "@/game/decks";
import type { Region } from "@/game/types";

export const dynamic = "force-dynamic";

const CHAMPIONS: Array<{ name: string; title: string; region: Region; condition: string; stage: string }> = [
  { name: "Pyra", title: "A Chama Eterna", region: "Emberhold", condition: "Cause 8 de dano ao Nexus", stage: "TRÊS ESTÁGIOS" },
  { name: "Nerida", title: "Imperatriz das Marés", region: "Tidecall", condition: "Conjure 4 feitiços", stage: "CONTROLE" },
  { name: "Bramblehart", title: "Guardião do Bosque", region: "Ironwood", condition: "Invoque 5 aliados", stage: "RESILIÊNCIA" },
  { name: "Malakar", title: "O Rei Oco", region: "Voidborn", condition: "Golpeie o Nexus duas vezes", stage: "PREDADOR" },
  { name: "Kaara", title: "Regente das Feras", region: "Florestia", condition: "Fortaleça sua matilha", stage: "MATILHA" },
  { name: "Zael", title: "Senhor dos Raios", region: "Tempestade", condition: "Domine os céus", stage: "TEMPESTADE" },
];

const REGION_COPY: Record<Region, { title: string; copy: string; code: string }> = {
  Emberhold: { title: "Fogo sem recuo", copy: "Pressão, dano direto e criaturas que atravessam a defesa.", code: "EMB" },
  Tidecall: { title: "O ritmo das marés", copy: "Controle, compra de cartas, cura e ameaças evasivas.", code: "TID" },
  Ironwood: { title: "Raízes de ferro", copy: "Resistência, regeneração e crescimento inevitável.", code: "IRN" },
  Voidborn: { title: "Fome do Vazio", copy: "Medo, remoção, sacrifício e roubo de vida.", code: "VOI" },
  Florestia: { title: "Juramento da matilha", copy: "Bestas, enxame e força coletiva em campo.", code: "FLO" },
  Tempestade: { title: "Céu em ruptura", copy: "Ímpeto, voo e ataques que chegam antes da resposta.", code: "TMP" },
};

const PRIMARY_LINKS = [
  { href: "/modes", icon: "◇", title: "Campanhas do Nexus", copy: "Expedições, puzzles, chefes e brawls especiais." },
  { href: "/draft", icon: "✦", title: "Arena Draft", copy: "Forje um deck carta por carta e domine três regiões." },
  { href: "/pvp", icon: "⚔", title: "Duelo PvP", copy: "Crie uma sala, convide um rival e dispute em tempo real." },
  { href: "/collection", icon: "◈", title: "Coleção Vanilla", copy: "Descubra, crie e complete o primeiro grande conjunto." },
  { href: "/forge", icon: "◆", title: "Forja de Decks", copy: "Construa estratégias e compartilhe suas criações." },
  { href: "/codex", icon: "◎", title: "Codex", copy: "Consulte cartas, palavras-chave, regiões e evoluções." },
];

export default function HomePage() {
  return (
    <main className="rf-home">
      <SiteNav />

      <section className="rf-hero">
        <Image
          src="/art/brand/runeforge-nexus-hero.webp"
          alt="Nexus rúnico em uma arena forjada em obsidiana"
          fill
          priority
          sizes="100vw"
          className="rf-hero-image"
        />
        <div className="rf-hero-shade" aria-hidden="true" />
        <div className="rf-hero-content">
          <div className="rf-hero-copy">
            <p className="rf-eyebrow"><span /> ALPHA JOGÁVEL · COLEÇÃO VANILLA</p>
            <h1>Forje sua lenda.<br /><em>Domine o Nexus.</em></h1>
            <p className="rf-hero-lead">
              Um card battler tático onde cada ponto de mana, janela de resposta e escolha de região pode mudar o destino da batalha.
            </p>
            <div className="rf-hero-actions">
              <Link href="/play" className="rf-button rf-button-primary"><span>⚔</span> ENTRAR NO NEXUS <b>→</b></Link>
              <Link href="/modes" className="rf-button rf-button-secondary"><span>◇</span> EXPLORAR MODOS</Link>
            </div>
            <div className="rf-hero-proof" aria-label="Conteúdo da alpha">
              <span><b>418</b> cartas colecionáveis</span>
              <span><b>8</b> decks oficiais</span>
              <span><b>6</b> regiões</span>
              <span><b>20</b> keywords</span>
            </div>
          </div>

          <aside className="rf-hero-panel">
            <div className="rf-panel-top"><span>STATUS DO NEXUS</span><b><i /> ALPHA ONLINE</b></div>
            <div className="rf-nexus-orb" aria-hidden="true"><i /><span>◆</span></div>
            <h2>Sua jornada começa aqui</h2>
            <p>Escolha uma doutrina, domine o Token de Ataque e reduza o Nexus rival de 20 a 0.</p>
            <div className="rf-panel-features">
              <span><i>01</i> PvE tático contra três níveis de IA</span>
              <span><i>02</i> PvP casual com salas autoritativas</span>
              <span><i>03</i> Draft, progressão e coleção persistente</span>
            </div>
            <DailyLogin />
          </aside>
        </div>
      </section>

      <section className="rf-command-section rf-section">
        <div className="rf-section-heading">
          <div><p className="rf-eyebrow"><span /> CENTRO DE COMANDO</p><h2>Escolha seu próximo desafio</h2></div>
          <p>Todos os caminhos para jogar e evoluir, organizados em uma única frente de batalha.</p>
        </div>
        <div className="rf-command-grid">
          {PRIMARY_LINKS.map((item, index) => (
            <Link key={item.href} href={item.href} className="rf-command-card">
              <small>0{index + 1}</small><i>{item.icon}</i><h3>{item.title}</h3><p>{item.copy}</p><b>ACESSAR <span>→</span></b>
            </Link>
          ))}
        </div>
      </section>

      <section className="rf-champion-section rf-section">
        <div className="rf-section-heading">
          <div><p className="rf-eyebrow"><span /> CAMPEÕES DO NEXUS</p><h2>Seis destinos. Uma guerra.</h2></div>
          <p>Campeões evoluem durante a partida e transformam a estratégia de cada região.</p>
        </div>
        <div className="rf-champion-grid">
          {CHAMPIONS.map((champion, index) => {
            const style = REGION_STYLE[champion.region];
            return (
              <article key={champion.name} className="rf-champion-card" data-region={champion.region.toLowerCase()}>
                <Image src={style.art} alt="" width={128} height={128} className="rf-champion-sigil" />
                <div className="rf-champion-index">0{index + 1}</div>
                <div className="rf-champion-body">
                  <p>{champion.stage}</p><h3>{champion.name}</h3><h4>{champion.title}</h4>
                  <span><b>EVOLUI QUANDO</b>{champion.condition}</span>
                </div>
                <footer><i>{style.sigil}</i>{champion.region}<b>→</b></footer>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rf-region-section rf-section">
        <div className="rf-section-heading">
          <div><p className="rf-eyebrow"><span /> IDENTIDADES REGIONAIS</p><h2>Forje uma doutrina</h2></div>
          <p>Combine até três regiões. Cada aliança abre sinergias, custos e condições de vitória diferentes.</p>
        </div>
        <div className="rf-region-grid">
          {(Object.keys(REGION_COPY) as Region[]).map((region) => {
            const style = REGION_STYLE[region];
            const item = REGION_COPY[region];
            return (
              <article key={region} className="rf-region-card" data-region={region.toLowerCase()}>
                <Image src={style.art} alt="" width={88} height={88} />
                <span>{item.code}</span><h3>{region}</h3><h4>{item.title}</h4><p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rf-deck-section rf-section">
        <div className="rf-section-heading">
          <div><p className="rf-eyebrow"><span /> ARSENAL OFICIAL</p><h2>Oito decks prontos para a guerra</h2></div>
          <Link href="/play">VER TODOS OS DECKS →</Link>
        </div>
        <div className="rf-deck-strip">
          {DECKS.map((deck) => (
            <article key={deck.id} data-region={deck.regions[0].toLowerCase()}>
              <span>{deck.emoji}</span><div><small>{deck.regions.join(" · ")}</small><h3>{deck.name}</h3><p>{deck.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="rf-final-cta">
        <div><p className="rf-eyebrow"><span /> O NEXUS AGUARDA</p><h2>Uma carta pode mudar tudo.</h2><p>Entre na alpha, escolha sua região e comece a forjar sua história.</p></div>
        <Link href="/play" className="rf-button rf-button-primary">JOGAR AGORA <b>→</b></Link>
      </section>

      <footer className="rf-footer"><b>RUNE<span>FORGE</span></b><p>Legends of the Nexus · Alpha 2.97</p><nav><Link href="/codex">Codex</Link><Link href="/community">Comunidade</Link><Link href="/admin">Studio</Link></nav></footer>
    </main>
  );
}
