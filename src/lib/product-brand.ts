export const PRODUCT_BRAND = {
  status: "candidate",
  displayName: "FORGED",
  subtitle: "THE CONVERGENCE",
  fullName: "FORGED: THE CONVERGENCE",
  legacyDisplayName: "RuneForge",
  storagePrefix: "forged",
  legacyStoragePrefix: "runeforge",
} as const;

export const BRAND_STORAGE_KEYS = {
  sound: `${PRODUCT_BRAND.storagePrefix}_sound`,
  music: `${PRODUCT_BRAND.storagePrefix}_music`,
  volume: `${PRODUCT_BRAND.storagePrefix}_volume`,
  alphaOnboarding: `${PRODUCT_BRAND.storagePrefix}_alpha_onboarding`,
  firstMatchGuide: `${PRODUCT_BRAND.storagePrefix}_first_match_guide`,
  journeyProgress: `${PRODUCT_BRAND.storagePrefix}_journey_progress`,
} as const;

export const LEGACY_BRAND_STORAGE_KEYS = {
  sound: `${PRODUCT_BRAND.legacyStoragePrefix}_sound`,
  music: `${PRODUCT_BRAND.legacyStoragePrefix}_music`,
  volume: `${PRODUCT_BRAND.legacyStoragePrefix}_volume`,
  alphaOnboarding: `${PRODUCT_BRAND.legacyStoragePrefix}_alpha_onboarding`,
  firstMatchGuide: `${PRODUCT_BRAND.legacyStoragePrefix}_first_match_guide`,
  journeyProgress: `${PRODUCT_BRAND.legacyStoragePrefix}_journey_progress`,
} as const;

/**
 * Read a branded local setting without breaking players who already have
 * RuneForge-era preferences. Legacy values are copied forward lazily so the
 * transition can ship without a destructive one-time migration.
 */
export function readMigratedLocalSetting(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  legacyKey: string,
): string | null {
  const current = storage.getItem(key);
  if (current !== null) return current;

  const legacy = storage.getItem(legacyKey);
  if (legacy !== null) storage.setItem(key, legacy);
  return legacy;
}

/**
 * Candidate-brand gameplay progress is mirrored to the legacy key while the
 * commercial identity is still reversible. A rollback therefore keeps the
 * newest client-only progress instead of stranding it under a candidate key.
 */
export function writeMirroredLocalSetting(
  storage: Pick<Storage, "setItem">,
  key: string,
  legacyKey: string,
  value: string,
): void {
  storage.setItem(key, value);
  storage.setItem(legacyKey, value);
}
