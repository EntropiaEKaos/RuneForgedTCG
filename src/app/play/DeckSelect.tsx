"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import CardTip from "@/components/CardTip";
import SiteNav from "@/components/SiteNav";
import { REGION_STYLE } from "@/components/CardView";
import { getCard } from "@/game/cards";
import { DECKS, type DeckDef } from "@/game/decks";
import { profileDeck, type DeckGameplayProfile } from "@/game/gameplay-profile";
import { AI_DIFFICULTIES } from "@/game/ai-personality";
import { archetypeForCards, archetypeForDeck, type ArchetypeProfile } from "@/game/archetypes";
import type { AiDifficulty } from "@/game/types";
import { ensurePlayerSession } from "@/lib/client-player-session";

export interface SavedDeck {
  id: number;
  ownerName: string;
  name: string;
  emoji: string;
  cards: string[];
}

/**
 * Tela de seleção de deck. Extraída do GameClient para reduzir o
 * tamanho do componente principal (arquitetura de sub-componentes).
 */
export default function DeckSelect({
  playerName,
  setPlayerName,
  deckKey,
  setDeckKey,
  customDecks,
  presetDecks,
  doctrines,
  aiDifficulty,
  onAiDifficulty,
  onStart,
}: {
  playerName: string;
  setPlayerName: (v: string) => void;
  deckKey: string;
  setDeckKey: (v: string) => void;
  customDecks: SavedDeck[];
  presetDecks: DeckDef[];
  doctrines: ArchetypeProfile[];
  aiDifficulty: AiDifficulty;
  onAiDifficulty: (value: AiDifficulty) => void;
  onStart: () => void;
}) {
  const previewCards = useMemo(() => {
    if (deckKey.startsWith("custom:")) {
      const id = Number(deckKey.slice(7));
      return customDecks.find((d) => d.id === id)?.cards ?? [];
    }
    const presetId = deckKey.startsWith("preset:") ? deckKey.slice(7) : deckKey;
    return (presetDecks.find((deck) => deck.id === presetId) ?? presetDecks[0] ?? DECKS[0]).cards;
  }, [deckKey, customDecks, presetDecks]);

  const unique = useMemo(() => {
    const seen = new Map<string, number>();
    for (const id of previewCards) seen.set(id, (seen.get(id) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => getCard(a[0]).cost - getCard(b[0]).cost);
  }, [previewCards]);

  const profile = useMemo(() => profileDeck(previewCards), [previewCards]);
  const selectedPresetId = deckKey.startsWith("preset:") ? deckKey.slice(7) : deckKey;
  const doctrine = useMemo(() => {
    if (!deckKey.startsWith("custom:")) return doctrines.find((item) => item.deckId === selectedPresetId) ?? archetypeForDeck(selectedPresetId);
    const scores = new Map<string, number>();
    for (const defId of previewCards) for (const id of getCard(defId).doctrineAffinities ?? []) scores.set(id, (scores.get(id) ?? 0) + 1);
    const winner = [...scores.entries()].sort((a,b) => b[1] - a[1])[0]?.[0];
    return doctrines.find((item) => item.deckId === winner) ?? archetypeForCards(previewCards);
  }, [deckKey, doctrines, previewCards, selectedPresetId]);

  const syncIdentity = () => {
    void ensurePlayerSession(playerName).then((profile) => {
      if (profile.player?.name) setPlayerName(String(profile.player.name));
    });
  };

  const sessionReady = Boolean(playerName.trim());

  return (
    <div className="rf-app-page deck-select-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div><p className="rf-eyebrow"><span /> PREPARAÇÃO DE BATALHA</p><h1>Escolha seu deck</h1><p>Selecione uma doutrina oficial ou leve uma criação própria para enfrentar o Adversário.</p></div>
          <Link href="/forge" className="rf-button rf-button-secondary">◆ FORJAR DECK</Link>
        </header>

        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4" aria-label="Identidade da sessão">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Identidade do desafiante</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={sessionReady ? "text-emerald-300" : "text-amber-300"}>{sessionReady ? "●" : "○"}</span>
              <strong className="truncate text-lg text-white">{sessionReady ? playerName : "Sincronizando sessão…"}</strong>
            </div>
            <p className="mt-1 text-xs text-slate-400">A identidade vem da sessão estável. Alterações de nome são feitas no Perfil, não no lobby de batalha.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={syncIdentity} className="btn-ghost">Ressincronizar</button>
            <Link href="/profile" className="btn-ghost">Gerenciar perfil</Link>
          </div>
        </section>

        <div className="deck-choice-grid">
          {presetDecks.map((d) => {
            const style = REGION_STYLE[d.regions[0]];
            const selected = deckKey === `preset:${d.id}`;
            const deckProfile = profileDeck(d.cards);
            return (
              <button
                key={d.id}
                data-region={d.regions[0].toLowerCase()}
                onClick={() => setDeckKey(`preset:${d.id}`)}
                className={[
                  "deck-choice flex flex-col text-left",
                  selected ? "is-selected" : "",
                ].join(" ")}
                aria-pressed={selected}
              >
                <div className="deck-choice-mark"><Image src={style.art} alt="" width={64} height={64} /></div>
                <h3>{d.name}</h3>
                <p className="mt-1 flex-1">{d.description}</p>
                <span className="mt-3 inline-block px-2 py-1 font-bold">
                  {deckProfile.identity} · {d.regions.join(" · ")}
                </span>
              </button>
            );
          })}
        </div>

        {customDecks.length > 0 && (
          <section className="mt-8" aria-label="Decks forjados">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Seu arsenal</p>
                <h2 className="mt-1 text-lg font-black text-white">Decks forjados</h2>
              </div>
              <Link href="/forge" className="text-xs font-bold text-amber-300 hover:text-amber-200">Editar na Forja →</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {customDecks.map((d) => {
                const selected = deckKey === `custom:${d.id}`;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDeckKey(`custom:${d.id}`)}
                    className={[
                      "rounded-2xl border bg-white/[.035] px-4 py-3 text-left transition hover:bg-white/[.07]",
                      selected ? "border-amber-300/50 ring-1 ring-amber-300/40" : "border-white/10",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-2xl">{d.emoji}</div>
                        <div className="mt-1 font-bold text-white">{d.name}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{d.cards.length} cartas</div>
                      </div>
                      {selected && <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200">Selecionado</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {doctrine && (
          <section className="archetype-doctrine" data-region={doctrine.region.toLowerCase()}>
            <header><span>{doctrine.icon}</span><div><small>DOUTRINA DO ARQUÉTIPO</small><h2>{doctrine.name}</h2><p>{doctrine.fantasy}</p></div></header>
            <div className="archetype-plan">{doctrine.plan.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div>
            <footer><p><small>CONDIÇÃO DE VITÓRIA</small>{doctrine.victory}</p><p><small>VULNERABILIDADE</small>{doctrine.weakness}</p></footer>
          </section>
        )}

        <DeckProfilePanel profile={profile} />

        <section className="ai-difficulty-panel" aria-label="Dificuldade do adversário">
          <div><small>ADVERSÁRIO PVE</small><h2>Escolha o nível da inteligência</h2><p>A política selecionada é emitida pelo servidor e preservada no replay autoritativo.</p></div>
          <div>{(Object.entries(AI_DIFFICULTIES) as Array<[AiDifficulty, (typeof AI_DIFFICULTIES)[AiDifficulty]]>).map(([id, item]) => <button key={id} type="button" className={aiDifficulty === id ? "active" : ""} aria-pressed={aiDifficulty === id} onClick={() => onAiDifficulty(id)}><i>{item.icon}</i><span><b>{item.label}</b><small>{item.description}</small></span></button>)}</div>
        </section>

        <div className="mt-8">
          <h4 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            Cartas neste deck
          </h4>
          <div className="flex flex-wrap justify-center gap-2">
            {unique.map(([id, count]) => (
              <CardTip key={id} defId={id} size="sm" count={count} />
            ))}
          </div>
        </div>

        <div className="deck-start-actions flex flex-wrap justify-center gap-3">
          <button onClick={onStart} className="btn-primary text-base" disabled={!sessionReady}>
            {sessionReady ? "⚔ ENTRAR NO NEXUS" : "SINCRONIZANDO SESSÃO…"}
          </button>
          <Link href="/forge" className="btn-ghost">
            ◆ FORJAR UM DECK
          </Link>
        </div>
        {!sessionReady && <p className="mt-2 text-center text-xs text-amber-300/80" role="status">A partida só pode ser preparada depois que a sessão estável do jogador estiver disponível.</p>}
      </div>
    </div>
  );
}

function DeckProfilePanel({ profile }: { profile: DeckGameplayProfile }) {
  const max = Math.max(1, ...profile.curve);
  return (
    <section className="deck-profile" aria-label="Perfil estratégico do deck selecionado">
      <div className="deck-profile-copy">
        <p>IDENTIDADE DO DECK</p>
        <h2>{profile.identity}</h2>
        <div>
          <span><b>{profile.averageCost}</b>Custo médio</span>
          <span><b>{profile.units}</b>Unidades</span>
          <span><b>{profile.interaction}</b>Interações</span>
          <span><b>{profile.champions}</b>Campeões</span>
        </div>
      </div>
      <div className="deck-curve" aria-label="Curva de mana">
        {profile.curve.map((count, cost) => (
          <span key={cost} title={`${count} carta(s) de custo ${cost === 7 ? "7+" : cost}`}>
            <i style={{ height: `${Math.max(8, Math.round((count / max) * 100))}%` }} />
            <b>{cost === 7 ? "7+" : cost}</b>
          </span>
        ))}
      </div>
    </section>
  );
}
