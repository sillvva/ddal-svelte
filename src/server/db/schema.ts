import { type ProviderId } from "$lib/constants";
import { type CharacterId, type DungeonMasterId, type ItemId, type LogId, type UserId } from "$lib/schemas";
import type { ProviderType } from "@auth/core/providers";
import { createId } from "@paralleldrive/cuid2";
import { isNotNull, relations, type InferInsertModel } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex
} from "drizzle-orm/pg-core";

export type User = typeof users.$inferSelect;
export type InsertUser = InferInsertModel<typeof users>;
export type UpdateUser = Partial<User>;
export const users = pgTable("user", {
	id: text("id")
		.primaryKey()
		.$default(() => createId())
		.$type<UserId>(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	emailVerified: timestamp("emailVerified", { mode: "date" }),
	image: text("image")
});

export const userRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	characters: many(characters),
	dungeonMasters: many(dungeonMasters),
	authenticators: many(authenticators)
}));

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = InferInsertModel<typeof accounts>;
export type UpdateAccount = Partial<Account>;
export const accounts = pgTable(
	"account",
	{
		providerAccountId: text("providerAccountId").notNull(),
		provider: text("provider").notNull().$type<ProviderId>(),
		type: text("type").$type<ProviderType>().notNull(),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" })
			.$type<UserId>(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type"),
		scope: text("scope"),
		id_token: text("id_token"),
		session_state: text("session_state"),
		lastLogin: timestamp("last_login", { mode: "date", withTimezone: true })
	},
	(table) => {
		return {
			userIdIdx: index("Account_userId_idx").on(table.userId),
			accountPkey: primaryKey({ columns: [table.provider, table.providerAccountId], name: "Account_pkey" }),
			webAuthnIdx: uniqueIndex("account_userId_providerAccountId_key").on(table.userId, table.providerAccountId)
		};
	}
);

export const accountRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
	authenticator: one(authenticators)
}));

export type Session = typeof sessions.$inferSelect;
export type InsertSession = InferInsertModel<typeof sessions>;
export type UpdateSession = Partial<Session>;
export const sessions = pgTable(
	"session",
	{
		sessionToken: text("sessionToken").primaryKey().notNull(),
		userId: text("userId")
			.notNull()
			.$type<UserId>()
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

export type Authenticator = typeof authenticators.$inferSelect;
export type AuthClient = Pick<Authenticator, "credentialID" | "name">;
export type InsertAuthenticator = InferInsertModel<typeof authenticators>;
export type UpdateAuthenticator = Partial<Authenticator>;
export const authenticators = pgTable(
	"authenticator",
	{
		credentialID: text("credentialID").notNull().unique(),
		userId: text("userId")
			.notNull()
			.$type<UserId>()
			.references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
		providerAccountId: text("providerAccountId").notNull(),
		name: text("name")
			.notNull()
			.$defaultFn(() => ""),
		credentialPublicKey: text("credentialPublicKey").notNull(),
		counter: integer("counter").notNull(),
		credentialDeviceType: text("credentialDeviceType").notNull(),
		credentialBackedUp: boolean("credentialBackedUp").notNull(),
		transports: text("transports")
	},
	(table) => ({
		compositePK: primaryKey({
			columns: [table.userId, table.credentialID]
		}),
		accountFK: foreignKey({
			columns: [table.userId, table.providerAccountId],
			foreignColumns: [accounts.userId, accounts.providerAccountId],
			name: "public_authenticator_userId_providerAccountId_fkey"
		}),
		uniqueName: unique("authenticator_userId_name_key").on(table.userId, table.name)
	})
);

export const authenticatorRelations = relations(authenticators, ({ one }) => ({
	user: one(users, {
		fields: [authenticators.userId],
		references: [users.id]
	}),
	account: one(accounts, {
		fields: [authenticators.userId, authenticators.providerAccountId],
		references: [accounts.userId, accounts.providerAccountId]
	})
}));

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = InferInsertModel<typeof characters>;
export type UpdateCharacter = Partial<Character>;
export const characters = pgTable(
	"character",
	{
		id: text("id")
			.primaryKey()
			.$default(() => createId())
			.$type<CharacterId>(),
		name: text("name").notNull(),
		race: text("race"),
		class: text("class"),
		campaign: text("campaign"),
		imageUrl: text("image_url"),
		characterSheetUrl: text("character_sheet_url"),
		userId: text("userId")
			.notNull()
			.$type<UserId>()
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
export type InsertDungeonMaster = InferInsertModel<typeof dungeonMasters>;
export type UpdateDungeonMaster = Partial<DungeonMaster>;
export const dungeonMasters = pgTable(
	"dungeonmaster",
	{
		id: text("id")
			.primaryKey()
			.$default(() => createId())
			.$type<DungeonMasterId>(),
		name: text("name").notNull(),
		DCI: text("DCI"),
		uid: text("uid").$type<UserId>(),
		owner: text("owner")
			.notNull()
			.$type<UserId>()
			.references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" })
	},
	(table) => {
		return {
			uidIdx: index("DungeonMaster_uid_partial_idx").on(table.uid).where(isNotNull(table.uid)),
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
export type InsertLog = InferInsertModel<typeof logs>;
export type UpdateLog = Partial<Log>;
export const logs = pgTable(
	"log",
	{
		id: text("id")
			.primaryKey()
			.$default(() => createId())
			.$type<LogId>(),
		date: timestamp("date", { mode: "date" })
			.notNull()
			.$default(() => new Date()),
		name: text("name").notNull(),
		description: text("description"),
		type: logType("type").notNull(),
		dungeonMasterId: text("dungeonMasterId")
			.$type<DungeonMasterId>()
			.references(() => dungeonMasters.id, {
				onUpdate: "cascade",
				onDelete: "restrict"
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
		characterId: text("characterId")
			.$type<CharacterId>()
			.references(() => characters.id, { onUpdate: "cascade", onDelete: "cascade" }),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$default(() => new Date())
	},
	(table) => {
		return {
			characterIdIdx: index("Log_characterId_partial_idx").on(table.characterId).where(isNotNull(table.characterId)),
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
export type InsertMagicItem = InferInsertModel<typeof magicItems>;
export type UpdateMagicItem = Partial<MagicItem>;
export const magicItems = pgTable(
	"magicitem",
	{
		id: text("id")
			.primaryKey()
			.$default(() => createId())
			.$type<ItemId>(),
		name: text("name").notNull(),
		description: text("description"),
		logGainedId: text("logGainedId")
			.notNull()
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "cascade" }),
		logLostId: text("logLostId")
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "set null" })
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
export type InsertStoryAward = InferInsertModel<typeof storyAwards>;
export type UpdateStoryAward = Partial<StoryAward>;
export const storyAwards = pgTable(
	"storyaward",
	{
		id: text("id")
			.primaryKey()
			.$default(() => createId())
			.$type<ItemId>(),
		name: text("name").notNull(),
		description: text("description"),
		logGainedId: text("logGainedId")
			.notNull()
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "cascade" }),
		logLostId: text("logLostId")
			.$type<LogId>()
			.references(() => logs.id, { onUpdate: "cascade", onDelete: "set null" })
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
