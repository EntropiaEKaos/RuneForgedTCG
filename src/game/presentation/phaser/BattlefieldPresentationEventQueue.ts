import type { BattlefieldPresentationEvent } from "../battlefield-lab-scenario";

export type BattlefieldQueuedPresentationEvent = {
  sequence: number;
  event: BattlefieldPresentationEvent;
};

export class BattlefieldPresentationEventQueue {
  private nextSequence = 1;
  private pending: BattlefieldQueuedPresentationEvent[] = [];

  enqueue(event: BattlefieldPresentationEvent): BattlefieldQueuedPresentationEvent {
    const queued = { sequence: this.nextSequence++, event };
    this.pending.push(queued);
    return queued;
  }

  drain(limit = Number.POSITIVE_INFINITY): BattlefieldQueuedPresentationEvent[] {
    if (limit <= 0 || this.pending.length === 0) return [];
    return this.pending.splice(0, Math.min(this.pending.length, Math.floor(limit)));
  }

  clear(): void {
    this.pending = [];
  }

  get size(): number {
    return this.pending.length;
  }
}
