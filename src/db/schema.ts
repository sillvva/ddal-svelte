import type { ProviderType } from "@auth/core/providers";
import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export type User = typeof users.$inferSelect;
export const users = sqliteTable("User", {
	id: text("id", { length: 256 })
		.primaryKey()
		.$defaultFn(() => createId()),
	name: text("name", { length: 256 }),
	email: text("email", { length: 256 }),
	emailVerified: text("emailVerified").$type<Date>(),
	image: text("image", { length: 256 })
});
export const userRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	characters: many(characters),
	dms: many(dungeonMasters)
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export const accounts = sqliteTable(
	"Account",
	{
		userId: text("userId", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type", { length: 256 }).$type<ProviderType>().notNull(),
		provider: text("provider", { length: 256 }).notNull(),
		providerAccountId: text("providerAccountId", { length: 256 }).notNull(),
		refresh_token: text("refresh_token", { length: 256 }),
		access_token: text("access_token", { length: 256 }),
		expires_at: integer("expires_at"),
		token_type: text("token_type", { length: 256 }),
		scope: text("scope", { length: 256 }),
		id_token: text("id_token", { length: 256 }),
		session_state: text("session_state", { length: 256 })
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

export const sessions = sqliteTable(
	"Session",
	{
		sessionToken: text("sessionToken", { length: 256 }).primaryKey(),
		userId: text("userId", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expires: integer("expires", { mode: "timestamp_ms" }).notNull()
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
export const characters = sqliteTable(
	"Character",
	{
		id: text("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: text("name", { length: 256 }).notNull(),
		race: text("race", { length: 256 }),
		class: text("class", { length: 256 }),
		campaign: text("campaign", { length: 256 }),
		image_url: text("image_url", { length: 256 }),
		character_sheet_url: text("character_sheet_url", { length: 256 }),
		userId: text("userId", { length: 256 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		created_at: text("created_at")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
			.$type<Date>()
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
export const logs = sqliteTable(
	"Log",
	{
		id: text("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		date: text("date").notNull(),
		name: text("name", { length: 256 }).notNull(),
		description: text("description", { length: 256 }).notNull().default(""),
		type: text("type", { length: 256, enum: ["game", "nongame"] })
			.notNull()
			.default("game"),
		dungeonMasterId: text("dungeonMasterId", { length: 256 }).references(() => dungeonMasters.id),
		is_dm_log: integer("is_dm_log", { mode: "boolean" }).notNull().default(false),
		applied_date: text("applied_date"),
		experience: integer("experience").notNull(),
		acp: integer("acp").notNull(),
		tcp: integer("tcp").notNull(),
		level: integer("level").notNull(),
		gold: real("gold").notNull(),
		dtd: integer("dtd").notNull().default(0),
		characterId: text("characterId", { length: 256 })
			.default("")
			.references(() => characters.id, { onDelete: "cascade" }),
		created_at: text("created_at")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`)
			.$type<Date>()
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
export const dungeonMasters = sqliteTable(
	"DungeonMaster",
	{
		id: text("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: text("name", { length: 256 }).notNull(),
		DCI: text("DCI", { length: 256 }),
		uid: text("uid", { length: 256 }),
		owner: text("owner", { length: 256 })
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
export const magicItems = sqliteTable(
	"MagicItem",
	{
		id: text("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: text("name", { length: 256 }).notNull(),
		description: text("description", { length: 256 }),
		logGainedId: text("logGainedId", { length: 256 }).references(() => logs.id, { onDelete: "cascade" }),
		logLostId: text("logLostId", { length: 256 }).references(() => logs.id)
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
export const storyAwards = sqliteTable(
	"StoryAward",
	{
		id: text("id", { length: 256 })
			.primaryKey()
			.$defaultFn(() => createId()),
		name: text("name", { length: 256 }).notNull(),
		description: text("description", { length: 256 }),
		logGainedId: text("logGainedId", { length: 256 }).references(() => logs.id, { onDelete: "cascade" }),
		logLostId: text("logLostId", { length: 256 }).references(() => logs.id)
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
