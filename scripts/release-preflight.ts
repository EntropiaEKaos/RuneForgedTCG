import packageMetadata from "../package.json";

const failures: string[] = [];
const required = ["DATABASE_URL", "PLAYER_SESSION_SECRET", "ADMIN_SESSION_SECRET", "MFA_ENCRYPTION_KEY", "PAYMENT_ENCRYPTION_KEY"] as const;

for (const key of required) {
  const value = process.env[key]?.trim() || "";
  if (!value) failures.push(`${key} is missing`);
  if ((key.endsWith("SECRET") || key.includes("ENCRYPTION_KEY")) && value.length < 32) failures.push(`${key} must contain at least 32 characters`);
  if (/change[_ -]?me|development-session-secret/i.test(value)) failures.push(`${key} still contains a placeholder/default value`);
}

const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
if (!url) failures.push("NEXT_PUBLIC_APP_URL is missing");
else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") failures.push("NEXT_PUBLIC_APP_URL must use HTTPS in production");
  } catch {
    failures.push("NEXT_PUBLIC_APP_URL is invalid");
  }
}

if (!["true", "false"].includes(process.env.TRUST_PROXY || "")) failures.push("TRUST_PROXY must explicitly be true or false");
if (!["true", "false"].includes(process.env.RANKED_RELEASE_CERTIFIED || "")) failures.push("RANKED_RELEASE_CERTIFIED must explicitly be true or false; use true only after npm run ranked:verify passes in the release pipeline");

const release = process.env.RUNEFORGE_RELEASE?.trim();
if (release && release !== packageMetadata.version) failures.push(`RUNEFORGE_RELEASE (${release}) must match package version (${packageMetadata.version})`);

const assetMode = (process.env.ASSET_STORAGE_MODE?.trim().toLowerCase() || "s3");
if (assetMode === "s3") {
  for (const key of ["ASSET_S3_ENDPOINT", "ASSET_S3_BUCKET", "ASSET_S3_ACCESS_KEY_ID", "ASSET_S3_SECRET_ACCESS_KEY", "ASSET_PUBLIC_BASE_URL"] as const) {
    const value = process.env[key]?.trim() || "";
    if (!value) failures.push(`${key} is required when ASSET_STORAGE_MODE=s3`);
    if (/replace-me|example\.com/i.test(value)) failures.push(`${key} still contains a placeholder value`);
  }
  for (const key of ["ASSET_S3_ENDPOINT", "ASSET_PUBLIC_BASE_URL"] as const) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    try { if (new URL(value).protocol !== "https:") failures.push(`${key} must use HTTPS`); }
    catch { failures.push(`${key} is invalid`); }
  }
} else if (assetMode === "local") {
  if (process.env.ALLOW_LOCAL_ASSET_STORAGE !== "true") failures.push("Local asset storage is not durable in production; use ASSET_STORAGE_MODE=s3 or explicitly set ALLOW_LOCAL_ASSET_STORAGE=true for a persistent Node host");
} else {
  failures.push("ASSET_STORAGE_MODE must be s3 or local");
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log("RELEASE PREFLIGHT: PASS");
