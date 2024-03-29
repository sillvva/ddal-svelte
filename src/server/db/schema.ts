import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	varchar
} from "drizzle-orm/pg-core";

type InsertOmit = "id" | "createdAt";

export type User = typeof users.$inferSelect;
export type InsertUser = Omit<typeof users.$inferInsert, InsertOmit>;
export type UpdateUser = Partial<User>;
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
export type InsertAccount = Omit<typeof accounts.$inferInsert, InsertOmit>;
export type UpdateAccount = Partial<InsertAccount>;
export const accounts = pgTable(
	"account",
	{
		providerAccountId: varchar("providerAccountId").notNull(),
		provider: varchar("provider").notNull(),
		type: varchar("type").notNull(),
		userId: varchar("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		refreshToken: varchar("refresh_token"),
		accessToken: varchar("access_token").notNull(),
		expiresAt: integer("expires_at").notNull(),
		tokenType: varchar("token_type").notNull(),
		scope: varchar("scope").notNull(),
		idToken: varchar("id_token"),
		sessionState: varchar("session_state"),
		lastLogin: timestamp("last_login", { mode: "date" })
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
export type InsertSession = Omit<typeof sessions.$inferInsert, InsertOmit>;
export type UpdateSession = Partial<InsertSession>;
export const sessions = pgTable(
	"session",
	{
		sessionToken: varchar("sessionToken").primaryKey().notNull(),
		userId: varchar("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		expires: timestamp("expires", { mode: "date" }).notNull(),
		createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
			.notNull()
			.$default(() => new Date())
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
export type InsertCharacter = Omit<typeof characters.$inferInsert, InsertOmit>;
export type UpdateCharacter = Partial<InsertCharacter>;
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
		imageUrl: varchar("image_url"),
		characterSheetUrl: varchar("character_sheet_url"),
		userId: varchar("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "date" })
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
export type InsertDungeonMaster = Omit<typeof dungeonMasters.$inferInsert, InsertOmit>;
export type UpdateDungeonMaster = Partial<InsertDungeonMaster>;
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

export const logType = pgEnum("logType", ["game", "nongame"]);

export type Log = typeof logs.$inferSelect;
export type InsertLog = Omit<typeof logs.$inferInsert, InsertOmit>;
export type UpdateLog = Partial<InsertLog>;
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
		type: logType("type").notNull(),
		dungeonMasterId: varchar("dungeonMasterId").references(() => dungeonMasters.id, {
			onUpdate: "cascade",
			onDelete: "set null"
		}),
		isDmLog: boolean("is_dm_log").notNull(),
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
		appliedDate: timestamp("applied_date", { mode: "date" }),
		characterId: varchar("characterId").references(() => characters.id, { onUpdate: "cascade", onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "date" })
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
	magicItemsGained: many(magicItems, { relationName: "magicItemsGained" }),
	magicItemsLost: many(magicItems, { relationName: "magicItemsLost" }),
	storyAwardsGained: many(storyAwards, { relationName: "storyAwardsGained" }),
	storyAwardsLost: many(storyAwards, { relationName: "storyAwardsLost" })
}));

export type MagicItem = typeof magicItems.$inferSelect;
export type InsertMagicItem = Omit<typeof magicItems.$inferInsert, InsertOmit>;
export type UpdateMagicItem = Partial<InsertMagicItem>;
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
		relationName: "magicItemsGained"
	}),
	logLost: one(logs, {
		fields: [magicItems.logLostId],
		references: [logs.id],
		relationName: "magicItemsLost"
	})
}));

export type StoryAward = typeof storyAwards.$inferSelect;
export type InsertStoryAward = Omit<typeof storyAwards.$inferInsert, InsertOmit>;
export type UpdateStoryAward = Partial<InsertStoryAward>;
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
		relationName: "storyAwardsGained"
	}),
	logLost: one(logs, {
		fields: [storyAwards.logLostId],
		references: [logs.id],
		relationName: "storyAwardsLost"
	})
}));
