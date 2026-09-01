import type { Keyword } from "./types";

declare module "./types" {
  interface PermanentStatAura {
    /** Continuous keywords granted while the Aura source remains active. */
    keywords?: Keyword[];
    /** Legacy default is allies. Aura 2.1 adds enemy-facing continuous stat debuffs. */
    affects?: "allies" | "enemies";
  }

  interface UnitInstance {
    /** Durable printed/equipment/one-shot keyword grants. Optional for historical replays. */
    durableKeywords?: Keyword[];
    /** Derived source-bound Aura keyword grants. Optional for historical replays. */
    auraKeywords?: Keyword[];
  }
}

export {};
