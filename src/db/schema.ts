/**
 * Public database schema facade.
 *
 * Tables are grouped by domain under ./schema so the rest of the application
 * keeps a stable `@/db/schema` import while schema ownership stays modular.
 */
export * from "./schema/gameplay";
export * from "./schema/players";
export * from "./schema/multiplayer";
export * from "./schema/admin-content";
export * from "./schema/admin-ops";
export * from "./schema/commerce";
export * from "./schema/site-content";
