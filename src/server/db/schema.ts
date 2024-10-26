import type { ProviderId } from "$lib/constants";
import type { CharacterId, DungeonMasterId, ItemId, LogId, UserId } from "$lib/schemas";
import type { ProviderType } from "@auth/core/providers";
import { createId } from "@paralleldrive/cuid2";
import { isNotNull, relations, type InferInsertModel } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";

export type User = typeof users.$inferSelect;
export type InsertUser = InferInsertModel<typeof users>;
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
	(table) => {
		return {
			userIdIdx: pg.index("Account_userId_idx").on(table.userId),
			accountPkey: pg.primaryKey({ columns: [table.provider, table.providerAccountId], name: "Account_pkey" }),
			webAuthnIdx: pg.uniqueIndex("account_userId_providerAccountId_key").on(table.userId, table.providerAccountId)
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
	(table) => {
		return {
			userIdIdx: pg.index("Session_userId_idx").on(table.userId)
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
	(table) => ({
		compositePK: pg.primaryKey({
			columns: [table.userId, table.credentialID]
		}),
		accountFK: pg.foreignKey({
			columns: [table.userId, table.providerAccountId],
			foreignColumns: [accounts.userId, accounts.providerAccountId],
			name: "public_authenticator_userId_providerAccountId_fkey"
		}),
		uniqueName: pg.unique("authenticator_userId_name_key").on(table.userId, table.name)
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
	(table) => {
		return {
			userIdIdx: pg.index("Character_userId_idx").on(table.userId)
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
	(table) => {
		return {
			uidIdx: pg.index("DungeonMaster_uid_partial_idx").on(table.uid).where(isNotNull(table.uid)),
			ownerIdx: pg.index("DungeonMaster_owner_idx").on(table.owner)
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

export const logType = pg.pgEnum("logType", ["game", "nongame"]);

export type Log = typeof logs.$inferSelect;
export type InsertLog = InferInsertModel<typeof logs>;
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
	(table) => {
		return {
			characterIdIdx: pg.index("Log_characterId_partial_idx").on(table.characterId).where(isNotNull(table.characterId)),
			dungeonMasterIdIdx: pg.index("Log_dungeonMasterId_idx").on(table.dungeonMasterId)
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
	(table) => {
		return {
			logGainedIdIdx: pg.index("MagicItem_logGainedId_idx").on(table.logGainedId),
			logLostIdIdx: pg.index("MagicItem_logLostId_idx").on(table.logLostId)
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
	(table) => {
		return {
			logGainedIdIdx: pg.index("StoryAward_logGainedId_idx").on(table.logGainedId),
			logLostIdIdx: pg.index("StoryAward_logLostId_idx").on(table.logLostId)
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
