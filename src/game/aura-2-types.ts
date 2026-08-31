import type { Keyword } from "./types";

declare module "./types" {
  interface PermanentStatAura {
    /** Continuous keywords granted while the Aura source remains active. */
    keywords?: Keyword[];
  }

  interface UnitInstance {
    /** Durable printed/equipment/one-shot keyword grants. Optional for historical replays. */
    durableKeywords?: Keyword[];
    /** Derived source-bound Aura keyword grants. Optional for historical replays. */
    auraKeywords?: Keyword[];
  }
}

export {};
