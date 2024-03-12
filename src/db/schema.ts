import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, primaryKey, real, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export const users = pgTable("user", {
	id: varchar("id")
		.primaryKey()
		.notNull()
		.$default(() => createId()),
	name: varchar("name").notNull(),
	email: varchar("email"),
	emailVerified: timestamp("emailVerified", { mode: "date" }),
	image: text("image")
});

export const userRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	characters: many(characters),
	dungeonMasters: many(dungeonMasters)
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export const accounts = pgTable(
	"account",
	{
		providerAccountId: varchar("providerAccountId").notNull(),
		provider: varchar("provider").notNull(),
		type: varchar("type").notNull(),
		userId: varchar("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		refresh_token: varchar("refresh_token"),
		access_token: varchar("access_token").notNull(),
		expires_at: integer("expires_at").notNull(),
		token_type: varchar("token_type").notNull(),
		scope: varchar("scope").notNull(),
		id_token: varchar("id_token"),
		session_state: varchar("session_state")
	},
	(table) => {
		return {
			userIdIdx: index("Account_userId_idx").on(table.userId),
			accountPkey: primaryKey({ columns: [table.provider, table.providerAccountId], name: "Account_pkey" })
		};
	}
);

export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	})
}));

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export const sessions = pgTable(
	"session",
	{
		sessionToken: varchar("sessionToken").primaryKey().notNull(),
		userId: varchar("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		expires: timestamp("expires", { mode: "date" }).notNull()
	},
	(table) => {
		return {
			userIdIdx: index("Session_userId_idx").on(table.userId)
		};
	}
);

export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	})
}));

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export const characters = pgTable(
	"character",
	{
		id: varchar("id")
			.primaryKey()
			.notNull()
			.$default(() => createId()),
		name: varchar("name").notNull(),
		race: varchar("race"),
		class: varchar("class"),
		campaign: varchar("campaign"),
		image_url: varchar("image_url"),
		character_sheet_url: varchar("character_sheet_url"),
		userId: varchar("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		created_at: timestamp("created_at", { mode: "date" })
			.notNull()
			.$default(() => new Date())
	},
	(table) => {
		return {
			userIdIdx: index("Character_userId_idx").on(table.userId)
		};
	}
);

export const characterRelations = relations(characters, ({ one, many }) => ({
	user: one(users, {
		fields: [characters.userId],
		references: [users.id]
	}),
	logs: many(logs)
}));

export type DungeonMaster = typeof dungeonMasters.$inferSelect;
export type NewDungeonMaster = typeof dungeonMasters.$inferInsert;
export const dungeonMasters = pgTable(
	"dungeonmaster",
	{
		id: varchar("id")
			.primaryKey()
			.notNull()
			.$default(() => createId()),
		name: varchar("name").notNull(),
		DCI: varchar("DCI"),
		uid: varchar("uid"),
		owner: varchar("owner")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" })
	},
	(table) => {
		return {
			uidIdx: index("DungeonMaster_uid_idx").on(table.uid),
			ownerIdx: index("DungeonMaster_owner_idx").on(table.owner)
		};
	}
);

export const dungeonMasterRelations = relations(dungeonMasters, ({ one, many }) => ({
	user: one(users, {
		fields: [dungeonMasters.owner],
		references: [users.id]
	}),
	logs: many(logs)
}));

export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export const logs = pgTable(
	"log",
	{
		id: varchar("id")
			.primaryKey()
			.notNull()
			.$default(() => createId()),
		date: timestamp("date", { mode: "date" })
			.notNull()
			.$default(() => new Date()),
		name: varchar("name").notNull(),
		description: varchar("description"),
		type: varchar("type").notNull(),
		dungeonMasterId: varchar("dungeonMasterId").references(() => dungeonMasters.id, {
			onUpdate: "cascade",
			onDelete: "set null"
		}),
		is_dm_log: boolean("is_dm_log").notNull(),
		experience: integer("experience")
			.notNull()
			.$default(() => 0),
		acp: smallint("acp")
			.notNull()
			.$default(() => 0),
		tcp: smallint("tcp")
			.notNull()
			.$default(() => 0),
		level: smallint("level")
			.notNull()
			.$default(() => 0),
		gold: real("gold")
			.notNull()
			.$default(() => 0),
		dtd: smallint("dtd")
			.notNull()
			.$default(() => 0),
		applied_date: timestamp("applied_date", { mode: "date" }),
		characterId: varchar("characterId").references(() => characters.id, { onUpdate: "cascade", onDelete: "cascade" }),
		created_at: timestamp("created_at", { mode: "date" })
			.notNull()
			.$default(() => new Date())
	},
	(table) => {
		return {
			characterIdIdx: index("Log_characterId_idx").on(table.characterId),
			dungeonMasterIdIdx: index("Log_dungeonMasterId_idx").on(table.dungeonMasterId)
		};
	}
);

export const logRelations = relations(logs, ({ one, many }) => ({
	character: one(characters, {
		fields: [logs.characterId],
		references: [characters.id]
	}),
	dm: one(dungeonMasters, {
		fields: [logs.dungeonMasterId],
		references: [dungeonMasters.id]
	}),
	magic_items_gained: many(magicItems, { relationName: "magic_items_gained" }),
	magic_items_lost: many(magicItems, { relationName: "magic_items_lost" }),
	story_awards_gained: many(storyAwards, { relationName: "story_awards_gained" }),
	story_awards_lost: many(storyAwards, { relationName: "story_awards_lost" })
}));

export type MagicItem = typeof magicItems.$inferSelect;
export type NewMagicItem = typeof magicItems.$inferInsert;
export const magicItems = pgTable(
	"magicitem",
	{
		id: varchar("id")
			.primaryKey()
			.notNull()
			.$default(() => createId()),
		name: varchar("name").notNull(),
		description: text("description"),
		logGainedId: varchar("logGainedId")
			.notNull()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "cascade" }),
		logLostId: varchar("logLostId").references(() => logs.id, { onDelete: "set null", onUpdate: "cascade" })
	},
	(table) => {
		return {
			logGainedIdIdx: index("MagicItem_logGainedId_idx").on(table.logGainedId),
			logLostIdIdx: index("MagicItem_logLostId_idx").on(table.logLostId)
		};
	}
);

export const magicItemRelations = relations(magicItems, ({ one }) => ({
	logGained: one(logs, {
		fields: [magicItems.logGainedId],
		references: [logs.id],
		relationName: "magic_items_gained"
	}),
	logLost: one(logs, {
		fields: [magicItems.logLostId],
		references: [logs.id],
		relationName: "magic_items_lost"
	})
}));

export type StoryAward = typeof storyAwards.$inferSelect;
export type NewStoryAward = typeof storyAwards.$inferInsert;
export const storyAwards = pgTable(
	"storyaward",
	{
		id: varchar("id")
			.primaryKey()
			.notNull()
			.$default(() => createId()),
		name: varchar("name").notNull(),
		description: text("description"),
		logGainedId: varchar("logGainedId")
			.notNull()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "cascade" }),
		logLostId: varchar("logLostId").references(() => logs.id, { onDelete: "set null", onUpdate: "cascade" })
	},
	(table) => {
		return {
			logGainedIdIdx: index("StoryAward_logGainedId_idx").on(table.logGainedId),
			logLostIdIdx: index("StoryAward_logLostId_idx").on(table.logLostId)
		};
	}
);

export const storyAwardRelations = relations(storyAwards, ({ one }) => ({
	logGained: one(logs, {
		fields: [storyAwards.logGainedId],
		references: [logs.id],
		relationName: "story_awards_gained"
	}),
	logLost: one(logs, {
		fields: [storyAwards.logLostId],
		references: [logs.id],
		relationName: "story_awards_lost"
	})
}));
