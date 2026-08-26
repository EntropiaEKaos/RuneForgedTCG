import { getCardCollection } from "./card-collections";
import { getRuntimeFormats } from "@/lib/control-plane";
import { BUILTIN_FORMATS, type FormatDef } from "./format-definitions";

export async function listFormats(): Promise<FormatDef[]> { return getRuntimeFormats(); }
export function cardLegalInFormat(defId: string, format: FormatDef): boolean {
  if (!format.active) return false;
  if (format.collectionKeys.includes("*")) return true;
  const collection = getCardCollection(defId);
  return Boolean(collection && format.collectionKeys.includes(collection.key));
}

export function validateFormatDeckWithFormats(cards: string[], formatId: string, formats: FormatDef[]): { ok:boolean; errors:string[]; format:FormatDef } {
  const format = formats.find((item) => item.id === formatId);
  if (!format) return { ok: false, errors: [`Formato desconhecido: ${formatId}.`], format: BUILTIN_FORMATS[0] };
  if (!format.active) return { ok: false, errors: [`Formato ${format.name} está inativo.`], format };
  const illegal = cards.filter((id) => !cardLegalInFormat(id, format));
  return { ok: illegal.length === 0, errors: illegal.length ? [`${illegal.length} carta(s) não são legais no formato ${format.name}.`] : [], format };
}

export async function validateFormatDeck(cards: string[], formatId = "vanilla"): Promise<{ ok:boolean; errors:string[]; format:FormatDef }> {
  return validateFormatDeckWithFormats(cards, formatId, await listFormats());
}
