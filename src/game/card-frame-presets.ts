export const CARD_FRAME_MATERIALS = ["obsidian", "forged", "silver", "gold", "arcane", "organic"] as const;
export const CARD_FRAME_CORNERS = ["round", "cut", "notch", "crown", "claw", "storm"] as const;
export const CARD_FRAME_ORNAMENTS = ["none", "runes", "rivets", "roots", "waves", "lightning", "eclipse"] as const;

export type CardFrameMaterial = typeof CARD_FRAME_MATERIALS[number];
export type CardFrameCorner = typeof CARD_FRAME_CORNERS[number];
export type CardFrameOrnament = typeof CARD_FRAME_ORNAMENTS[number];

export interface CardFramePresetConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderWidth: number;
  radius: number;
  glow: number;
  innerLineOpacity: number;
  artInset: number;
  nameplateOpacity: number;
  foilIntensity: number;
  gradientAngle: number;
  material: CardFrameMaterial;
  cornerStyle: CardFrameCorner;
  ornament: CardFrameOrnament;
}

export interface CardFramePreset {
  id?: number;
  key: string;
  name: string;
  description?: string;
  config: CardFramePresetConfig;
  status?: string;
  enabled?: boolean;
  revision?: number;
}

export const DEFAULT_CARD_FRAME_CONFIG: CardFramePresetConfig = {
  primaryColor: "#d7a84c",
  secondaryColor: "#6b4218",
  accentColor: "#fff1af",
  borderWidth: 2,
  radius: 12,
  glow: 10,
  innerLineOpacity: 0.28,
  artInset: 0,
  nameplateOpacity: 0.86,
  foilIntensity: 0.16,
  gradientAngle: 135,
  material: "forged",
  cornerStyle: "round",
  ornament: "runes",
};

const presetsByKey: Record<string, CardFramePreset> = {};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function shortText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeColor(value: unknown, fallback: string): string {
  const color = shortText(value, 32);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

export function framePresetSlug(value: unknown): string {
  return shortText(value, 80).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export function normalizeCardFramePreset(raw: unknown): { value: CardFramePreset | null; errors: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { value: null, errors: ["Frame preset must be an object"] };
  const source = raw as Record<string, unknown>;
  const rawConfig = source.config && typeof source.config === "object" && !Array.isArray(source.config)
    ? source.config as Record<string, unknown>
    : source;
  const errors: string[] = [];
  const key = framePresetSlug(source.key);
  const name = shortText(source.name, 120);
  if (!key || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(key)) errors.push("Frame key must use letters, numbers, dash or underscore");
  if (!name) errors.push("Frame name is required");
  const material = shortText(rawConfig.material || DEFAULT_CARD_FRAME_CONFIG.material, 24) as CardFrameMaterial;
  const cornerStyle = shortText(rawConfig.cornerStyle || DEFAULT_CARD_FRAME_CONFIG.cornerStyle, 24) as CardFrameCorner;
  const ornament = shortText(rawConfig.ornament || DEFAULT_CARD_FRAME_CONFIG.ornament, 24) as CardFrameOrnament;
  if (!CARD_FRAME_MATERIALS.includes(material)) errors.push("Invalid frame material");
  if (!CARD_FRAME_CORNERS.includes(cornerStyle)) errors.push("Invalid corner style");
  if (!CARD_FRAME_ORNAMENTS.includes(ornament)) errors.push("Invalid ornament");
  if (errors.length) return { value: null, errors };
  return {
    value: {
      id: Number.isInteger(Number(source.id)) ? Number(source.id) : undefined,
      key,
      name,
      description: shortText(source.description, 400),
      config: {
        primaryColor: safeColor(rawConfig.primaryColor, DEFAULT_CARD_FRAME_CONFIG.primaryColor),
        secondaryColor: safeColor(rawConfig.secondaryColor, DEFAULT_CARD_FRAME_CONFIG.secondaryColor),
        accentColor: safeColor(rawConfig.accentColor, DEFAULT_CARD_FRAME_CONFIG.accentColor),
        borderWidth: clamp(rawConfig.borderWidth, 1, 6, DEFAULT_CARD_FRAME_CONFIG.borderWidth),
        radius: clamp(rawConfig.radius, 4, 28, DEFAULT_CARD_FRAME_CONFIG.radius),
        glow: clamp(rawConfig.glow, 0, 36, DEFAULT_CARD_FRAME_CONFIG.glow),
        innerLineOpacity: clamp(rawConfig.innerLineOpacity, 0, 0.8, DEFAULT_CARD_FRAME_CONFIG.innerLineOpacity),
        artInset: clamp(rawConfig.artInset, 0, 12, DEFAULT_CARD_FRAME_CONFIG.artInset),
        nameplateOpacity: clamp(rawConfig.nameplateOpacity, 0.25, 0.98, DEFAULT_CARD_FRAME_CONFIG.nameplateOpacity),
        foilIntensity: clamp(rawConfig.foilIntensity, 0, 1, DEFAULT_CARD_FRAME_CONFIG.foilIntensity),
        gradientAngle: clamp(rawConfig.gradientAngle, 0, 360, DEFAULT_CARD_FRAME_CONFIG.gradientAngle),
        material,
        cornerStyle,
        ornament,
      },
      status: shortText(source.status, 24) || undefined,
      enabled: source.enabled == null ? undefined : Boolean(source.enabled),
      revision: Number.isInteger(Number(source.revision)) ? Number(source.revision) : undefined,
    },
    errors: [],
  };
}

export function replaceRegisteredCardFramePresets(rows: unknown[]) {
  for (const key of Object.keys(presetsByKey)) delete presetsByKey[key];
  for (const row of rows) {
    const normalized = normalizeCardFramePreset(row);
    if (!normalized.value) continue;
    presetsByKey[normalized.value.key] = normalized.value;
  }
}

export function getCardFramePreset(key: string | null | undefined): CardFramePreset | undefined {
  return key ? presetsByKey[framePresetSlug(key)] : undefined;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = safeColor(hex, "#ffffff").slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function clipPathForCorner(style: CardFrameCorner): string | null {
  if (style === "cut") return "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)";
  if (style === "notch") return "polygon(0 0,42% 0,50% 7px,58% 0,100% 0,100% 100%,58% 100%,50% calc(100% - 7px),42% 100%,0 100%)";
  if (style === "crown") return "polygon(8px 0,38% 0,43% 7px,50% 0,57% 7px,62% 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px)";
  if (style === "claw") return "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 4px) calc(100% - 12px),100% calc(100% - 22px),100% 100%,0 100%,0 12px,4px 12px,0 22px,0 0)";
  if (style === "storm") return "polygon(8px 0,100% 0,100% 58%,calc(100% - 6px) 64%,100% 70%,100% 100%,0 100%,0 42%,6px 36%,0 30%,0 8px)";
  return null;
}

function materialLayer(config: CardFramePresetConfig): string {
  const p = config.primaryColor;
  const s = config.secondaryColor;
  const a = config.accentColor;
  switch (config.material) {
    case "obsidian": return `linear-gradient(${config.gradientAngle}deg,${hexToRgba(a,.12)},transparent 28%,${hexToRgba(p,.08)} 62%,${hexToRgba(s,.2)})`;
    case "silver": return `linear-gradient(${config.gradientAngle}deg,${hexToRgba(a,.35)},${hexToRgba(p,.16)} 28%,transparent 52%,${hexToRgba(s,.3)})`;
    case "gold": return `linear-gradient(${config.gradientAngle}deg,${hexToRgba(a,.42)},${hexToRgba(p,.2)} 34%,transparent 58%,${hexToRgba(s,.34)})`;
    case "arcane": return `radial-gradient(circle at 50% 16%,${hexToRgba(a,.28)},transparent 34%),linear-gradient(${config.gradientAngle}deg,${hexToRgba(p,.2)},transparent 48%,${hexToRgba(s,.3)})`;
    case "organic": return `radial-gradient(ellipse at 20% 80%,${hexToRgba(p,.22)},transparent 40%),radial-gradient(ellipse at 82% 14%,${hexToRgba(a,.16)},transparent 36%)`;
    default: return `linear-gradient(${config.gradientAngle}deg,${hexToRgba(a,.22)},transparent 28%,${hexToRgba(p,.14)} 58%,${hexToRgba(s,.28)})`;
  }
}

function ornamentLayer(config: CardFramePresetConfig): string {
  const p = hexToRgba(config.primaryColor, .28);
  const a = hexToRgba(config.accentColor, .22);
  switch (config.ornament) {
    case "runes": return `repeating-linear-gradient(45deg,transparent 0 12px,${p} 13px 14px,transparent 15px 26px)`;
    case "rivets": return `radial-gradient(circle at 8px 8px,${a} 0 1.5px,transparent 2px)`;
    case "roots": return `repeating-radial-gradient(ellipse at 0 100%,transparent 0 13px,${p} 14px 15px,transparent 16px 27px)`;
    case "waves": return `repeating-radial-gradient(ellipse at 50% 100%,transparent 0 11px,${a} 12px 13px,transparent 14px 22px)`;
    case "lightning": return `repeating-linear-gradient(118deg,transparent 0 18px,${a} 19px 21px,transparent 22px 38px)`;
    case "eclipse": return `radial-gradient(circle at 50% 8%,transparent 0 12px,${p} 13px 15px,transparent 16px 28px)`;
    default: return "none";
  }
}

export function cardFramePresetCss(rows: unknown[]): string {
  const rules: string[] = [];
  for (const row of rows) {
    const normalized = normalizeCardFramePreset(row);
    if (!normalized.value) continue;
    const preset = normalized.value;
    const c = preset.config;
    const slug = framePresetSlug(preset.key);
    const selector = `.card-shell.card-frame-${slug}`;
    const clip = clipPathForCorner(c.cornerStyle);
    const glow = hexToRgba(c.primaryColor, Math.min(.72, .16 + c.glow / 64));
    const inner = hexToRgba(c.accentColor, c.innerLineOpacity);
    rules.push(`${selector}{border-color:${c.primaryColor}!important;border-width:${c.borderWidth}px!important;border-radius:${c.radius}px!important;box-shadow:0 0 ${c.glow}px ${glow},inset 0 0 0 1px ${inner}!important;${clip ? `clip-path:${clip};` : ""}}`);
    rules.push(`${selector} .card-art{inset:${c.artInset}px;border-radius:${Math.max(2,c.radius-c.artInset)}px;}`);
    rules.push(`${selector} .card-frame-ornament{inset:0;border-radius:${c.radius}px;background-image:${materialLayer(c)},${ornamentLayer(c)};background-size:auto,${c.ornament === "rivets" ? "18px 18px" : "auto"};opacity:.95;}`);
    rules.push(`${selector} .card-frame-ornament i{border-color:${c.accentColor}!important;filter:drop-shadow(0 0 ${Math.max(1, Math.round(c.glow / 4))}px ${glow});}`);
    rules.push(`${selector} .card-nameplate{background:linear-gradient(90deg,${hexToRgba(c.secondaryColor,c.nameplateOpacity)},${hexToRgba(c.primaryColor,Math.max(.22,c.nameplateOpacity-.34))},${hexToRgba(c.secondaryColor,c.nameplateOpacity)});border-color:${hexToRgba(c.accentColor,.3)};}`);
    rules.push(`${selector} .card-sheen{opacity:${Math.max(.04,Math.min(.7,c.foilIntensity))};background:linear-gradient(${c.gradientAngle}deg,transparent 10%,${hexToRgba(c.accentColor,c.foilIntensity)} 42%,transparent 66%);}`);
  }
  return rules.join("\n");
}
