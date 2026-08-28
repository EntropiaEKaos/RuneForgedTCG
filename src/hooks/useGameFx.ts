"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCard } from "@/game/cards";
import {
  deriveGameEvents,
  getUnitFromEvent,
  isDamageEvent,
  isHealEvent,
  isLevelEvent,
  type GameEvent,
} from "@/game/events";
import type { GameState, PlayerId } from "@/game/types";

export interface FxEvent {
  key: string;
  type: "dmg" | "heal" | "death" | "nexushit" | "levelup" | "impact" | "summon" | "poison" | "barrier" | "barrierbreak" | "frost" | "stun";
  text: string;
  color: string;
  pos: { x: number; y: number } | null;
  unitId?: string;
  side?: PlayerId;
}

export interface GameFxState {
  fx: FxEvent[];
  shaking: boolean;
  hitStop: boolean;
  nexusFlash: { player: number; ai: number };
  levelBanner: string | null;
  impactFlash: "red" | "cyan" | "gold" | null;
  impactLabel: string | null;
}

function statusLabel(status: "barrier" | "frostbitten" | "stunned"): Pick<FxEvent, "text" | "color" | "type"> {
  switch (status) {
    case "barrier":
      return { type: "barrier", text: "🛡 BARREIRA", color: "#67e8f9" };
    case "frostbitten":
      return { type: "frost", text: "❄ CONGELADO", color: "#7dd3fc" };
    case "stunned":
      return { type: "stun", text: "✦ ATORDOADO", color: "#c4b5fd" };
  }
}

function toFx(event: GameEvent, state: GameState): Omit<FxEvent, "key" | "pos"> | null {
  switch (event.type) {
    case "UNIT_SUMMONED":
      return { type: "summon", text: "✦", color: "#fde68a", unitId: event.unitId, side: event.player };
    case "UNIT_DAMAGED":
      return { type: "dmg", text: `-${event.amount}`, color: "#f87171", unitId: event.unitId, side: event.player };
    case "UNIT_HEALED":
      return { type: "heal", text: `+${event.amount}`, color: "#4ade80", unitId: event.unitId, side: event.player };
    case "UNIT_DIED":
      return { type: "death", text: "💀", color: "#94a3b8", unitId: event.unitId, side: event.player };
    case "UNIT_LEVELLED_UP":
      return {
        type: "levelup",
        text: getCard(event.toDefId).name,
        color: "#fbbf24",
        unitId: event.unitId,
        side: event.player,
      };
    case "UNIT_ATTACK_STARTED":
      return { type: "impact", text: "⚔", color: "#fbbf24", unitId: event.unitId, side: event.player };
    case "STATUS_APPLIED": {
      const label = statusLabel(event.status);
      return { ...label, unitId: event.unitId, side: event.player };
    }
    case "STATUS_REMOVED":
      return { type: "barrierbreak", text: "◇ BARREIRA ROMPIDA", color: "#a5f3fc", unitId: event.unitId, side: event.player };
    case "NEXUS_DAMAGED":
      return { type: "nexushit", text: `-${event.amount}`, color: "#f87171", side: event.player };
    case "NEXUS_HEALED":
      return { type: "nexushit", text: `+${event.amount}`, color: "#4ade80", side: event.player };
    case "NEXUS_POISONED":
      return { type: "poison", text: `🧪 +${event.amount} · ${event.total}/10`, color: "#a3e635", side: event.player };
  }
}

function locateEvent(event: GameEvent): { x: number; y: number } | null {
  if (event.type === "NEXUS_DAMAGED" || event.type === "NEXUS_HEALED" || event.type === "NEXUS_POISONED") {
    const el = document.querySelector(`[data-nexus-side="${event.player}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top - 8 };
  }

  if ("unitId" in event) {
    const el = document.querySelector(`[data-unit-id="${event.unitId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + 4 };
    }
    const box = document.querySelector(`[data-bench-side="${event.player}"]`);
    if (box) {
      const rect = box.getBoundingClientRect();
      return { x: rect.left + Math.min(140, Math.max(80, rect.width / 2)), y: rect.top + 28 };
    }
  }
  return null;
}

function playEventSound(event: GameEvent): void {
  import("@/lib/sounds").then(({ sfx }) => {
    switch (event.type) {
      case "UNIT_DAMAGED":
      case "UNIT_DIED":
      case "NEXUS_DAMAGED":
        sfx.damage();
        break;
      case "UNIT_ATTACK_STARTED":
        sfx.attack();
        break;
      case "UNIT_SUMMONED":
        sfx.cardPlay();
        break;
      case "UNIT_HEALED":
      case "NEXUS_HEALED":
        sfx.heal();
        break;
      case "UNIT_LEVELLED_UP":
        sfx.levelUp();
        break;
      case "STATUS_APPLIED":
        sfx.status(event.status);
        break;
      case "STATUS_REMOVED":
        sfx.barrierBreak();
        break;
      case "NEXUS_POISONED":
        sfx.poison();
        break;
      default:
        break;
    }
  }).catch(() => {});
}

/**
 * Converts authoritative state transitions into short-lived presentation FX.
 * No gameplay mutation belongs in this hook.
 */
export function useGameFx(state: GameState | null): GameFxState {
  const previousRef = useRef<GameState | null>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const [fx, setFx] = useState<FxEvent[]>([]);
  const [shaking, setShaking] = useState(false);
  const [hitStop, setHitStop] = useState(false);
  const [nexusFlash, setNexusFlash] = useState<{ player: number; ai: number }>({ player: 0, ai: 0 });
  const [levelBanner, setLevelBanner] = useState<string | null>(null);
  const [impactFlash, setImpactFlash] = useState<"red" | "cyan" | "gold" | null>(null);
  const [impactLabel, setImpactLabel] = useState<string | null>(null);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const id = window.setTimeout(() => { timersRef.current.delete(id); callback(); }, delay);
    timersRef.current.add(id);
  }, []);

  useEffect(() => () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!state) {
      previousRef.current = null;
      return;
    }

    const previous = previousRef.current;
    previousRef.current = state;
    // A new match should establish a fresh FX baseline rather than replaying
    // the entire opening state as summon/damage events.
    if (!previous || previous === state || (previous.phase === "gameover" && state.phase !== "gameover")) return;

    const events = deriveGameEvents(previous, state);
    if (!events.length) return;

    const stamped = events
      .map((event, index) => {
        const visual = toFx(event, state);
        if (!visual) return null;
        return {
          ...visual,
          pos: locateEvent(event),
          key: `${Date.now()}_${index}_${"unitId" in event ? event.unitId : event.player}_${event.type}`,
        } satisfies FxEvent;
      })
      .filter((event): event is FxEvent => event !== null);

    if (!stamped.length) return;

    setFx((list) => [...list, ...stamped]);
    const keys = new Set(stamped.map((event) => event.key));
    schedule(() => setFx((list) => list.filter((event) => !keys.has(event.key))), 1300);

    if (events.some(isDamageEvent)) {
      setImpactFlash("red");
      schedule(() => setImpactFlash(null), 260);
      setHitStop(true);
      schedule(() => setHitStop(false), 90);
    } else if (events.some(isLevelEvent)) {
      setImpactFlash("gold");
      schedule(() => setImpactFlash(null), 420);
    } else if (events.some(isHealEvent)) {
      setImpactFlash("cyan");
      schedule(() => setImpactFlash(null), 260);
    }

    const damageCount = events.filter(isDamageEvent).length;
    const label = events.some((event) => event.type === "UNIT_LEVELLED_UP")
      ? "ASCENSÃO"
      : events.some((event) => event.type === "NEXUS_DAMAGED")
        ? damageCount >= 3 ? `IMPACTO EM CADEIA ×${damageCount}` : "NEXUS ATINGIDO"
        : events.some((event) => event.type === "UNIT_DIED")
          ? damageCount >= 3 ? `COLAPSO ×${damageCount}` : "UNIDADE DESTRUÍDA"
          : damageCount >= 3 ? `COMBO ×${damageCount}` : null;
    if (label) {
      setImpactLabel(label);
      schedule(() => setImpactLabel((current) => current === label ? null : current), 900);
      if (damageCount >= 3) import("@/lib/sounds").then(({ sfx }) => sfx.combo(damageCount)).catch(() => {});
    }

    for (const event of events) {
      playEventSound(event);
      if (event.type === "NEXUS_DAMAGED" && event.player === "player") {
        setShaking(true);
        schedule(() => setShaking(false), 500);
      }
      if (event.type === "NEXUS_DAMAGED" || event.type === "NEXUS_HEALED") {
        setNexusFlash((current) => ({
          ...current,
          [event.player]: current[event.player] + 1,
        }));
      }
      if (event.type === "UNIT_LEVELLED_UP") {
        const unit = getUnitFromEvent(state, event);
        const name = unit ? getCard(unit.defId).name : getCard(event.toDefId).name;
        setLevelBanner(name);
        schedule(() => setLevelBanner((current) => (current === name ? null : current)), 2000);
      }
    }
  }, [state, schedule]);

  return { fx, shaking, hitStop, nexusFlash, levelBanner, impactFlash, impactLabel };
}
