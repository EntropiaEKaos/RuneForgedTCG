import { getCardCollection } from "./card-collections";
import { BUILTIN_FORMATS, type FormatDef } from "./format-definitions";

/**
 * Client-safe format legality helpers.
 *
 * Keep this module free of database/control-plane imports: it is consumed by
 * client components such as the Forge and therefore must remain browser-safe.
 * Server-side runtime format loading lives in format-rules-server.ts.
 */
export function cardLegalInFormat(defId: string, format: FormatDef): boolean {
  if (!format.active) return false;
  if (format.collectionKeys.includes("*")) return true;
  const collection = getCardCollection(defId);
  return Boolean(collection && format.collectionKeys.includes(collection.key));
}

export function validateFormatDeckWithFormats(
  cards: string[],
  formatId: string,
  formats: FormatDef[],
): { ok: boolean; errors: string[]; format: FormatDef } {
  const format = formats.find((item) => item.id === formatId);
  if (!format) return { ok: false, errors: [`Formato desconhecido: ${formatId}.`], format: BUILTIN_FORMATS[0] };
  if (!format.active) return { ok: false, errors: [`Formato ${format.name} está inativo.`], format };
  const illegal = cards.filter((id) => !cardLegalInFormat(id, format));
  return {
    ok: illegal.length === 0,
    errors: illegal.length ? [`${illegal.length} carta(s) não são legais no formato ${format.name}.`] : [],
    format,
  };
}
