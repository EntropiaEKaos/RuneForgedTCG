export type CommanderResyncTrigger = "mutation_conflict" | "network_reconnect" | "window_focus" | "visibility_resume";

export function commanderMutationNeedsResync(status: number): boolean {
  return status === 409;
}

export function commanderRevisionChanged(previousRevision: number | null | undefined, nextRevision: number | null | undefined): boolean {
  if (!Number.isInteger(previousRevision) || !Number.isInteger(nextRevision)) return false;
  return previousRevision !== nextRevision;
}

export function commanderResumeNeedsResync(trigger: CommanderResyncTrigger, online: boolean = true): boolean {
  if (!online) return false;
  return trigger === "network_reconnect" || trigger === "window_focus" || trigger === "visibility_resume";
}
