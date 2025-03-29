import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	users: {
		accounts: r.many.accounts(),
		authenticators: r.many.authenticators(),
		sessions: r.many.sessions(),
		characters: r.many.characters(),
		dungeonMasters: r.many.dungeonMasters()
	},
	accounts: {
		user: r.one.users({
			from: r.accounts.userId,
			to: r.users.id
		}),
		authenticator: r.one.authenticators({
			from: [r.accounts.userId, r.accounts.providerAccountId],
			to: [r.authenticators.userId, r.authenticators.providerAccountId]
		})
	},
	authenticators: {
		user: r.one.users({
			from: r.authenticators.userId,
			to: r.users.id
		}),
		account: r.one.accounts({
			from: [r.authenticators.userId, r.authenticators.providerAccountId],
			to: [r.accounts.userId, r.accounts.providerAccountId]
		})
	},
	sessions: {
		user: r.one.users({
			from: r.sessions.userId,
			to: r.users.id
		})
	},
	characters: {
		user: r.one.users({
			from: r.characters.userId,
			to: r.users.id
		}),
		logs: r.many.logs()
	},
	dungeonMasters: {
		user: r.one.users({
			from: r.dungeonMasters.owner,
			to: r.users.id
		}),
		logs: r.many.logs()
	},
	logs: {
		character: r.one.characters({
			from: r.logs.characterId,
			to: r.characters.id
		}),
		dm: r.one.dungeonMasters({
			from: r.logs.dungeonMasterId,
			to: r.dungeonMasters.id,
			optional: false
		}),
		magicItemsGained: r.many.magicItems({
			alias: "magicItemsGained"
		}),
		magicItemsLost: r.many.magicItems({
			alias: "magicItemsLost"
		}),
		storyAwardsGained: r.many.storyAwards({
			alias: "storyAwardsGained"
		}),
		storyAwardsLost: r.many.storyAwards({
			alias: "storyAwardsLost"
		})
	},
	magicItems: {
		logGained: r.one.logs({
			from: r.magicItems.logGainedId,
			to: r.logs.id,
			alias: "magicItemsGained"
		}),
		logLost: r.one.logs({
			from: r.magicItems.logLostId,
			to: r.logs.id,
			alias: "magicItemsLost"
		})
	},
	storyAwards: {
		logGained: r.one.logs({
			from: r.storyAwards.logGainedId,
			to: r.logs.id,
			alias: "storyAwardsGained"
		}),
		logLost: r.one.logs({
			from: r.storyAwards.logLostId,
			to: r.logs.id,
			alias: "storyAwardsLost"
		})
	}
}));
