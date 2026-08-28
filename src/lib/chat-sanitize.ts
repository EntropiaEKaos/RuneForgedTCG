const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;

export function sanitizeChat(input: unknown, maxLength = 200): string {
  if (typeof input !== "string") return "";
  return input.normalize("NFKC").replace(CONTROL, "").replace(BIDI, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
