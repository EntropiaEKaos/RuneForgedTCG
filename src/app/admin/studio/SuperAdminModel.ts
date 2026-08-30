import type { StudioUiCapability } from "@/lib/admin-studio-access";

export type Resource =
  | "overview" | "cards" | "mechanics" | "keywords" | "effects" | "races" | "classes"
  | "interactions" | "collections" | "card-meta" | "players" | "events" | "promotions";
export type Row = Record<string, unknown> & { id?: string | number };

export type StudioResource = {
  id: Resource;
  label: string;
  icon: string;
  capability: StudioUiCapability;
};

export const resources: StudioResource[] = [
  { id: "overview", label: "Overview", icon: "◈", capability: "authoring" },
  { id: "cards", label: "Card Studio", icon: "🃏", capability: "authoring" },
  { id: "mechanics", label: "Mechanics Studio", icon: "⚙️", capability: "authoring" },
  { id: "keywords", label: "Keywords", icon: "✦", capability: "authoring" },
  { id: "effects", label: "Effects", icon: "⚡", capability: "authoring" },
  { id: "races", label: "Races", icon: "🐉", capability: "authoring" },
  { id: "classes", label: "Classes", icon: "⚔️", capability: "authoring" },
  { id: "interactions", label: "Interactions", icon: "🔗", capability: "authoring" },
  { id: "collections", label: "Collections", icon: "📚", capability: "authoring" },
  { id: "card-meta", label: "Card Identity", icon: "🏷️", capability: "authoring" },
  { id: "players", label: "Players", icon: "👤", capability: "players" },
  { id: "events", label: "Events", icon: "🎪", capability: "liveops" },
  { id: "promotions", label: "Promotions", icon: "🎁", capability: "liveops" },
];

export const defaults: Partial<Record<Resource, Row>> = {
  keywords: { key: "", name: "", description: "", icon: "✦", engineKeyword: "", behavior: {}, enabled: true },
  effects: { key: "", name: "", description: "", kind: "damageUnit", schema: { amount: "number", target: "TargetKind" }, enabled: true },
  races: { key: "", name: "", description: "", icon: "🐉", region: "", color: "", enabled: true },
  classes: { key: "", name: "", description: "", icon: "⚔️", color: "", enabled: true },
  interactions: { name: "", sourceType: "class", sourceKey: "", targetType: "race", targetKey: "", condition: {}, effect: { kind: "buffUnit", amount: 0 }, priority: 0, enabled: true },
  collections: { key: "", name: "", description: "", code: "", symbol: "◆", banner: "", status: "draft", releaseDate: "", rotationDate: "", metadata: {} },
  "card-meta": { defId: "", collectionId: "", tags: [], classKeys: [], raceKeys: [], releaseState: "draft", notes: "" },
  events: { key: "", name: "", description: "", type: "event", status: "draft", startsAt: "", endsAt: "", rules: { mode: "" }, rewards: [], metadata: {} },
  promotions: { key: "", name: "", description: "", type: "store", status: "draft", startsAt: "", endsAt: "", conditions: {}, offers: [], metadata: {} },
};
