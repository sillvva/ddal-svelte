import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type CacheKey = [string, ...string[]];

export type CacheData = typeof cacheTable.$inferSelect;
export const cacheTable = sqliteTable("cache", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	ttl: integer("ttl", { mode: "timestamp" }).notNull()
});
