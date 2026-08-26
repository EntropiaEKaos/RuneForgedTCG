export type Resource =
  | "overview" | "cards" | "mechanics" | "keywords" | "effects" | "races" | "classes"
  | "interactions" | "collections" | "card-meta" | "players" | "events" | "promotions";
export type Row = Record<string, unknown> & { id?: string | number };

export const resources: { id: Resource; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◈" }, { id: "cards", label: "Card Studio", icon: "🃏" },
  { id: "mechanics", label: "Mechanics Studio", icon: "⚙️" }, { id: "keywords", label: "Keywords", icon: "✦" },
  { id: "effects", label: "Effects", icon: "⚡" }, { id: "races", label: "Races", icon: "🐉" },
  { id: "classes", label: "Classes", icon: "⚔️" }, { id: "interactions", label: "Interactions", icon: "🔗" },
  { id: "collections", label: "Collections", icon: "📚" }, { id: "card-meta", label: "Card Identity", icon: "🏷️" },
  { id: "players", label: "Players", icon: "👤" }, { id: "events", label: "Events", icon: "🎪" },
  { id: "promotions", label: "Promotions", icon: "🎁" },
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
