import type { ProviderType } from "@auth/core/providers";
import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { boolean, datetime, double, index, int, mysqlTable, primaryKey, text, varchar } from "drizzle-orm/mysql-core";

export type User = typeof users.$inferSelect;
export const users = mysqlTable("user", {
	id: varchar("id", { length: 256 })
		.primaryKey()
		.$defaultFn(() => createId()),
	name: varchar("name", { length: 256 }),
	email: varchar("email", { length: 256 }),
	emailVerified: datetime("emailVerified", { mode: "date" }),
	image: varchar("image", { length: 256 })
});
export const userRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	characters: many(characters),
	dms: many(dungeonMasters)
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export const accounts = mysqlTable(
	"account",
	{
		userId: varchar("userId", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 256 }).$type<ProviderType>().notNull(),
		provider: varchar("provider", { length: 256 }).notNull(),
		providerAccountId: varchar("providerAccountId", { length: 256 }).notNull(),
		refresh_token: varchar("refresh_token", { length: 256 }),
		access_token: varchar("access_token", { length: 256 }),
		expires_at: int("expires_at"),
		token_type: varchar("token_type", { length: 256 }),
		scope: varchar("scope", { length: 256 }),
		id_token: varchar("id_token", { length: 256 }),
		session_state: varchar("session_state", { length: 256 })
	},
	(account) => {
		return {
			compoundKey: primaryKey({
				columns: [account.provider, account.providerAccountId]
			}),
			userId_index: index("Account_userId_idx").on(account.userId)
		};
	}
);
export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] })
}));

export const sessions = mysqlTable(
	"session",
	{
		sessionToken: varchar("sessionToken", { length: 256 }).primaryKey(),
		userId: varchar("userId", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expires: int("expires").notNull()
	},
	(t) => {
		return {
			userId_index: index("Session_userId_idx").on(t.userId)
		};
	}
);
export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export const characters = mysqlTable(
	"character",
	{
		id: varchar("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: varchar("name", { length: 256 }).notNull(),
		race: varchar("race", { length: 256 }),
		class: varchar("class", { length: 256 }),
		campaign: varchar("campaign", { length: 256 }),
		image_url: varchar("image_url", { length: 256 }),
		character_sheet_url: varchar("character_sheet_url", { length: 256 }),
		userId: varchar("userId", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		created_at: datetime("created_at", { mode: "date" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(t) => {
		return {
			userId_index: index("Character_userId_idx").on(t.userId)
		};
	}
);
export const characterRelations = relations(characters, ({ one, many }) => ({
	user: one(users, { fields: [characters.userId], references: [users.id] }),
	logs: many(logs)
}));

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export const logs = mysqlTable(
	"log",
	{
		id: varchar("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		date: datetime("date", { mode: "date" }).notNull(),
		name: varchar("name", { length: 256 }).notNull(),
		description: text("description").notNull().default(""),
		type: varchar("type", { length: 7, enum: ["game", "nongame"] })
			.notNull()
			.default("game"),
		dungeonMasterId: varchar("dungeonMasterId", { length: 256 }).references(() => dungeonMasters.id),
		is_dm_log: boolean("is_dm_log").notNull().default(false),
		applied_date: datetime("applied_date", { mode: "date" }),
		experience: int("experience").notNull(),
		acp: int("acp").notNull(),
		tcp: int("tcp").notNull(),
		level: int("level").notNull(),
		gold: double("gold", { precision: 8, scale: 2 }).notNull(),
		dtd: int("dtd").notNull().default(0),
		characterId: varchar("characterId", { length: 256 })
			.default("")
			.references(() => characters.id, { onDelete: "cascade" }),
		created_at: datetime("created_at", { mode: "date" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
	},
	(t) => {
		return {
			dungeonMasterId_index: index("Log_dungeonMasterId_idx").on(t.dungeonMasterId),
			characterId_index: index("Log_characterId_idx").on(t.characterId)
		};
	}
);
export const logRelations = relations(logs, ({ one, many }) => ({
	dm: one(dungeonMasters, { fields: [logs.dungeonMasterId], references: [dungeonMasters.id] }),
	magic_items_gained: many(magicItems, { relationName: "magicItemsGained" }),
	magic_items_lost: many(magicItems, { relationName: "magicItemsLost" }),
	story_awards_gained: many(storyAwards, { relationName: "storyAwardsGained" }),
	story_awards_lost: many(storyAwards, { relationName: "storyAwardsLost" }),
	character: one(characters, { fields: [logs.characterId], references: [characters.id] })
}));

export type DungeonMaster = typeof dungeonMasters.$inferSelect;
export type NewDungeonMaster = typeof dungeonMasters.$inferInsert;
export const dungeonMasters = mysqlTable(
	"dungeonmaster",
	{
		id: varchar("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: varchar("name", { length: 256 }).notNull(),
		DCI: varchar("DCI", { length: 256 }),
		uid: varchar("uid", { length: 256 }),
		owner: varchar("owner", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" })
	},
	(t) => {
		return {
			uid_index: index("DungeonMaster_uid_idx").on(t.uid),
			owner_index: index("DungeonMaster_owner_idx").on(t.owner)
		};
	}
);
export const dungeonMasterRelations = relations(dungeonMasters, ({ one, many }) => ({
	logs: many(logs),
	user: one(users, { fields: [dungeonMasters.owner], references: [users.id] })
}));

export type MagicItem = typeof magicItems.$inferSelect;
export type NewMagicItem = typeof magicItems.$inferInsert;
export const magicItems = mysqlTable(
	"magicitem",
	{
		id: varchar("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: varchar("name", { length: 256 }).notNull(),
		description: varchar("description", { length: 256 }),
		logGainedId: varchar("logGainedId", { length: 256 }).references(() => logs.id, { onDelete: "cascade" }),
		logLostId: varchar("logLostId", { length: 256 }).references(() => logs.id)
	},
	(t) => {
		return {
			logGainedId_index: index("MagicItem_logGainedId_idx").on(t.logGainedId),
			logLostId_index: index("MagicItem_logLostId_idx").on(t.logLostId)
		};
	}
);
export const magicItemRelations = relations(magicItems, ({ one }) => ({
	logGained: one(logs, { fields: [magicItems.logGainedId], references: [logs.id], relationName: "magicItemsGained" }),
	logLost: one(logs, { fields: [magicItems.logLostId], references: [logs.id], relationName: "magicItemsLost" })
}));

export type StoryAward = typeof storyAwards.$inferSelect;
export type NewStoryAward = typeof storyAwards.$inferInsert;
export const storyAwards = mysqlTable(
	"storyaward",
	{
		id: varchar("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: varchar("name", { length: 256 }).notNull(),
		description: varchar("description", { length: 256 }),
		logGainedId: varchar("logGainedId", { length: 256 }).references(() => logs.id, { onDelete: "cascade" }),
		logLostId: varchar("logLostId", { length: 256 }).references(() => logs.id)
	},
	(t) => {
		return {
			logGainedId_index: index("StoryAward_logGainedId_idx").on(t.logGainedId),
			logLostId_index: index("StoryAward_logLostId_idx").on(t.logLostId)
		};
	}
);
export const storyAwardRelations = relations(storyAwards, ({ one }) => ({
	logGained: one(logs, { fields: [storyAwards.logGainedId], references: [logs.id], relationName: "storyAwardsGained" }),
	logLost: one(logs, { fields: [storyAwards.logLostId], references: [logs.id], relationName: "storyAwardsLost" })
}));
