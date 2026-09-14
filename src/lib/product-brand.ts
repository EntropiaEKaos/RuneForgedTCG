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
} as const;

export const LEGACY_BRAND_STORAGE_KEYS = {
  sound: `${PRODUCT_BRAND.legacyStoragePrefix}_sound`,
  music: `${PRODUCT_BRAND.legacyStoragePrefix}_music`,
  volume: `${PRODUCT_BRAND.legacyStoragePrefix}_volume`,
  alphaOnboarding: `${PRODUCT_BRAND.legacyStoragePrefix}_alpha_onboarding`,
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
