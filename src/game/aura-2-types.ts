import type { Keyword, MechanicCondition } from "./types";

declare module "./types" {
  interface PermanentStatAura {
    /** Continuous keywords granted while an allied Aura source remains active. */
    keywords?: Keyword[];
    /** Continuous keywords suppressed while an enemy Aura source remains active. */
    suppressKeywords?: Keyword[];
    /** Legacy default is allies. Aura 2.1 adds enemy-facing continuous effects. */
    affects?: "allies" | "enemies";
    /** Aura 2.5 controller-scoped condition. Missing means always active. */
    condition?: MechanicCondition;
  }

  interface UnitInstance {
    /** Durable printed/equipment/one-shot keyword grants. Optional for historical replays. */
    durableKeywords?: Keyword[];
    /** Derived source-bound allied Aura keyword grants. Optional for historical replays. */
    auraKeywords?: Keyword[];
    /** Derived source-bound hostile Aura keyword suppressions. Optional for historical replays. */
    auraSuppressedKeywords?: Keyword[];
  }
}

export {};
