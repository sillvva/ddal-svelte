import type { ProviderId } from "$lib/constants";
import type { CharacterId, DungeonMasterId, ItemId, LogId, UserId } from "$lib/schemas";
import type { ProviderType } from "@auth/core/providers";
import { createId } from "@paralleldrive/cuid2";
import { isNotNull } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UpdateUser = Partial<User>;
export const users = pg.pgTable("user", {
	id: pg
		.text()
		.primaryKey()
		.$default(() => createId())
		.$type<UserId>(),
	name: pg.text().notNull(),
	email: pg.text().notNull(),
	emailVerified: pg.timestamp({ mode: "date" }),
	image: pg.text()
});

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type UpdateAccount = Partial<Account>;
export const accounts = pg.pgTable(
	"account",
	{
		providerAccountId: pg.text().notNull(),
		provider: pg.text().notNull().$type<ProviderId>(),
		type: pg.text().$type<ProviderType>().notNull(),
		userId: pg
			.text()
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" })
			.$type<UserId>(),
		refresh_token: pg.text(),
		access_token: pg.text(),
		expires_at: pg.integer(),
		token_type: pg.text(),
		scope: pg.text(),
		id_token: pg.text(),
		session_state: pg.text(),
		lastLogin: pg.timestamp("last_login", { mode: "date", withTimezone: true })
	},
	(table) => [
		pg.primaryKey({ columns: [table.provider, table.providerAccountId], name: "Account_pkey" }),
		pg.uniqueIndex("account_userId_providerAccountId_key").on(table.userId, table.providerAccountId),
		pg.index("Account_userId_idx").on(table.userId)
	]
);

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type UpdateSession = Partial<Session>;
export const sessions = pg.pgTable(
	"session",
	{
		sessionToken: pg.text().primaryKey().notNull(),
		userId: pg
			.text()
			.notNull()
			.$type<UserId>()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		expires: pg.timestamp({ mode: "date" }).notNull(),
		createdAt: pg
			.timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.$default(() => new Date())
	},
	(table) => [pg.index("Session_userId_idx").on(table.userId)]
);

export type Authenticator = typeof authenticators.$inferSelect;
export type AuthClient = Pick<Authenticator, "credentialID" | "name">;
export type InsertAuthenticator = typeof authenticators.$inferInsert;
export type UpdateAuthenticator = Partial<Authenticator>;
export const authenticators = pg.pgTable(
	"authenticator",
	{
		credentialID: pg.text().notNull().unique(),
		userId: pg
			.text()
			.notNull()
			.$type<UserId>()
			.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
		providerAccountId: pg.text().notNull(),
		name: pg
			.text()
			.notNull()
			.$defaultFn(() => ""),
		credentialPublicKey: pg.text().notNull(),
		counter: pg.integer().notNull(),
		credentialDeviceType: pg.text().notNull(),
		credentialBackedUp: pg.boolean().notNull(),
		transports: pg.text()
	},
	(table) => [
		pg.primaryKey({
			columns: [table.userId, table.credentialID],
			name: "authenticator_pkey"
		}),
		pg.foreignKey({
			columns: [table.userId, table.providerAccountId],
			foreignColumns: [accounts.userId, accounts.providerAccountId],
			name: "public_authenticator_userId_providerAccountId_fkey"
		}),
		pg.unique("authenticator_userId_name_key").on(table.userId, table.name)
	]
);

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
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
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
		uid: pg.text().$type<UserId>(),
		owner: pg
			.text()
			.notNull()
			.$type<UserId>()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" })
	},
	(table) => [
		pg.index("DungeonMaster_uid_partial_idx").on(table.uid).where(isNotNull(table.uid)),
		pg.index("DungeonMaster_owner_idx").on(table.owner)
	]
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
