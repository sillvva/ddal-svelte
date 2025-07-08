import type { ProviderId } from "$lib/constants";
import type { CharacterId, DungeonMasterId, ItemId, LogId, UserId } from "$lib/schemas";
import { createId } from "@paralleldrive/cuid2";
import { isNotNull } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";

export type User = typeof user.$inferSelect;
export type InsertUser = typeof user.$inferInsert;
export type UpdateUser = Partial<User>;
export const user = pg.pgTable("user", {
	id: pg
		.text()
		.primaryKey()
		.$default(() => createId())
		.$type<UserId>(),
	name: pg.text().notNull(),
	email: pg.text().notNull(),
	emailVerified: pg
		.boolean()
		.notNull()
		.$default(() => false),
	image: pg.text(),
	createdAt: pg
		.timestamp("created_at", { mode: "date", withTimezone: true })
		.notNull()
		.$default(() => new Date()),
	updatedAt: pg
		.timestamp("updated_at", { mode: "date", withTimezone: true })
		.notNull()
		.$default(() => new Date())
		.$onUpdateFn(() => new Date())
});

export type Account = typeof account.$inferSelect;
export type InsertAccount = typeof account.$inferInsert;
export type UpdateAccount = Partial<Account>;
export const account = pg.pgTable(
	"account",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId()),
		accountId: pg.text("providerAccountId").notNull(),
		providerId: pg.text("provider").notNull().$type<ProviderId>(),
		userId: pg
			.text()
			.notNull()
			.references(() => user.id, { onUpdate: "cascade", onDelete: "cascade" })
			.$type<UserId>(),
		refreshToken: pg.text("refresh_token"),
		accessToken: pg.text("access_token"),
		accessTokenExpiresAt: pg.timestamp("expires_at", { mode: "date", withTimezone: true }),
		scope: pg.text(),
		idToken: pg.text("id_token"),
		createdAt: pg
			.timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.$default(() => new Date()),
		updatedAt: pg
			.timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.$default(() => new Date())
			.$onUpdateFn(() => new Date())
	},
	(table) => [
		pg.uniqueIndex("account_userId_providerAccountId_key").on(table.userId, table.accountId),
		pg.index("Account_userId_idx").on(table.userId)
	]
);

export type Session = typeof session.$inferSelect;
export type InsertSession = typeof session.$inferInsert;
export type UpdateSession = Partial<Session>;
export const session = pg.pgTable(
	"session",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId()),
		token: pg.text("sessionToken").notNull(),
		userId: pg
			.text()
			.notNull()
			.$type<UserId>()
			.references(() => user.id, { onUpdate: "cascade", onDelete: "cascade" }),
		ipAddress: pg.text("ip_address"),
		userAgent: pg.text("user_agent"),
		expiresAt: pg.timestamp("expires", { mode: "date" }).notNull(),
		createdAt: pg
			.timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.$default(() => new Date()),
		updatedAt: pg
			.timestamp("updated_at", { mode: "date", withTimezone: true })
			.notNull()
			.$default(() => new Date())
			.$onUpdateFn(() => new Date())
	},
	(table) => [pg.index("Session_userId_idx").on(table.userId)]
);

export const verification = pg.pgTable("verification", {
	id: pg.text().primaryKey().notNull(),
	identifier: pg.text().notNull(),
	value: pg.text().notNull(),
	expiresAt: pg.timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
	createdAt: pg
		.timestamp("created_at", { mode: "date", withTimezone: true })
		.notNull()
		.$default(() => new Date()),
	updatedAt: pg
		.timestamp("updated_at", { mode: "date", withTimezone: true })
		.notNull()
		.$default(() => new Date())
		.$onUpdateFn(() => new Date())
});

export type Passkey = typeof passkey.$inferSelect;
export type InsertPasskey = typeof passkey.$inferInsert;
export type UpdatePasskey = Partial<Passkey>;
export const passkey = pg.pgTable("passkey", {
	id: pg
		.text()
		.primaryKey()
		.$default(() => createId()),
	name: pg.text(),
	publicKey: pg.text().notNull(),
	userId: pg
		.text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
	credentialID: pg.text().notNull(),
	counter: pg.bigint({ mode: "number" }).notNull().default(0),
	deviceType: pg.text().notNull(),
	backedUp: pg.boolean().notNull().default(false),
	transports: pg.text().notNull(),
	createdAt: pg
		.timestamp({ mode: "date", withTimezone: true })
		.notNull()
		.$default(() => new Date()),
	aaguid: pg.text()
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;
export type UpdateCharacter = Partial<Character>;
export const characters = pg.pgTable(
	"character",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId())
			.$type<CharacterId>(),
		name: pg.text().notNull(),
		race: pg.text(),
		class: pg.text(),
		campaign: pg.text(),
		imageUrl: pg.text("image_url"),
		characterSheetUrl: pg.text("character_sheet_url"),
		userId: pg
			.text()
			.notNull()
			.$type<UserId>()
			.references(() => user.id, { onUpdate: "cascade", onDelete: "cascade" }),
		createdAt: pg
			.timestamp("created_at", { mode: "date" })
			.notNull()
			.$default(() => new Date())
	},
	(table) => [pg.index("Character_userId_idx").on(table.userId)]
);

export type DungeonMaster = typeof dungeonMasters.$inferSelect;
export type InsertDungeonMaster = typeof dungeonMasters.$inferInsert;
export type UpdateDungeonMaster = Partial<DungeonMaster>;
export const dungeonMasters = pg.pgTable(
	"dungeonmaster",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId())
			.$type<DungeonMasterId>(),
		name: pg.text().notNull(),
		DCI: pg.text(),
		userId: pg
			.text("user_id")
			.notNull()
			.$type<UserId>()
			.references(() => user.id, { onUpdate: "cascade", onDelete: "cascade" }),
		isUser: pg
			.boolean("is_user")
			.notNull()
			.$default(() => false)
	},
	(table) => [pg.index("dungeonmaster_user_id_idx").on(table.userId)]
);

export const logType = pg.pgEnum("logType", ["game", "nongame"]);

export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;
export type UpdateLog = Partial<Log>;
export const logs = pg.pgTable(
	"log",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId())
			.$type<LogId>(),
		date: pg
			.timestamp({ mode: "date" })
			.notNull()
			.$default(() => new Date()),
		name: pg.text().notNull(),
		description: pg
			.text()
			.notNull()
			.$default(() => ""),
		type: logType().notNull(),
		dungeonMasterId: pg
			.text()
			.notNull()
			.$type<DungeonMasterId>()
			.references(() => dungeonMasters.id, {
				onUpdate: "cascade",
				onDelete: "restrict"
			}),
		isDmLog: pg.boolean("is_dm_log").notNull(),
		experience: pg
			.integer("experience")
			.notNull()
			.$default(() => 0),
		acp: pg
			.smallint()
			.notNull()
			.$default(() => 0),
		tcp: pg
			.smallint()
			.notNull()
			.$default(() => 0),
		level: pg
			.smallint()
			.notNull()
			.$default(() => 0),
		gold: pg
			.real()
			.notNull()
			.$default(() => 0),
		dtd: pg
			.smallint()
			.notNull()
			.$default(() => 0),
		appliedDate: pg.timestamp("applied_date", { mode: "date" }),
		characterId: pg
			.text()
			.$type<CharacterId>()
			.references(() => characters.id, { onUpdate: "cascade", onDelete: "cascade" }),
		createdAt: pg
			.timestamp("created_at", { mode: "date" })
			.notNull()
			.$default(() => new Date())
	},
	(table) => [
		pg.index("Log_characterId_partial_idx").on(table.characterId).where(isNotNull(table.characterId)),
		pg.index("Log_dungeonMasterId_idx").on(table.dungeonMasterId)
	]
);

export type MagicItem = typeof magicItems.$inferSelect;
export type InsertMagicItem = typeof magicItems.$inferInsert;
export type UpdateMagicItem = Partial<MagicItem>;
export const magicItems = pg.pgTable(
	"magicitem",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId())
			.$type<ItemId>(),
		name: pg.text().notNull(),
		description: pg.text(),
		logGainedId: pg
			.text()
			.notNull()
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "cascade" }),
		logLostId: pg
			.text()
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "set null" })
	},
	(table) => [
		pg.index("MagicItem_logGainedId_idx").on(table.logGainedId),
		pg.index("MagicItem_logLostId_idx").on(table.logLostId)
	]
);

export type StoryAward = typeof storyAwards.$inferSelect;
export type InsertStoryAward = typeof storyAwards.$inferInsert;
export type UpdateStoryAward = Partial<StoryAward>;
export const storyAwards = pg.pgTable(
	"storyaward",
	{
		id: pg
			.text()
			.primaryKey()
			.$default(() => createId())
			.$type<ItemId>(),
		name: pg.text().notNull(),
		description: pg.text(),
		logGainedId: pg
			.text()
			.notNull()
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "cascade" }),
		logLostId: pg
			.text()
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "set null" })
	},
	(table) => [
		pg.index("StoryAward_logGainedId_idx").on(table.logGainedId),
		pg.index("StoryAward_logLostId_idx").on(table.logLostId)
	]
);
