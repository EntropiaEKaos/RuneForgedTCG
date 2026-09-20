import type { BattlefieldPresentationEvent } from "../battlefield-lab-scenario";

export type BattlefieldQueuedPresentationEvent = {
  sequence: number;
  event: BattlefieldPresentationEvent;
};

export class BattlefieldPresentationEventQueue {
  private nextSequence = 1;
  private pending: BattlefieldQueuedPresentationEvent[] = [];
  private inFlight: BattlefieldQueuedPresentationEvent | null = null;

  enqueue(event: BattlefieldPresentationEvent): BattlefieldQueuedPresentationEvent {
    const queued = { sequence: this.nextSequence++, event };
    this.pending.push(queued);
    return queued;
  }

  drain(limit = Number.POSITIVE_INFINITY): BattlefieldQueuedPresentationEvent[] {
    if (limit <= 0 || this.pending.length === 0) return [];
    return this.pending.splice(0, Math.min(this.pending.length, Math.floor(limit)));
  }

  beginNext(): BattlefieldQueuedPresentationEvent | null {
    if (this.inFlight) return null;
    this.inFlight = this.pending.shift() ?? null;
    return this.inFlight;
  }

  complete(sequence: number): boolean {
    if (!this.inFlight || this.inFlight.sequence !== sequence) return false;
    this.inFlight = null;
    return true;
  }

  clear(): void {
    this.pending = [];
    this.inFlight = null;
  }

  get active(): BattlefieldQueuedPresentationEvent | null {
    return this.inFlight;
  }

  get size(): number {
    return this.pending.length + (this.inFlight ? 1 : 0);
  }
}
