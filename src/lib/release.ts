import packageMetadata from "../../package.json";

/** Single canonical application release identifier. */
export const APP_RELEASE = process.env.RUNEFORGE_RELEASE?.trim() || packageMetadata.version;
