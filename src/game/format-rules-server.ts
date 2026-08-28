import "server-only";

import { getRuntimeFormats } from "@/lib/control-plane";
import { validateFormatDeckWithFormats } from "./format-rules";
import type { FormatDef } from "./format-definitions";

/** Server-only access to runtime format configuration. */
export async function listFormats(): Promise<FormatDef[]> {
  return getRuntimeFormats();
}

export async function validateFormatDeck(
  cards: string[],
  formatId = "vanilla",
): Promise<{ ok: boolean; errors: string[]; format: FormatDef }> {
  return validateFormatDeckWithFormats(cards, formatId, await listFormats());
}
