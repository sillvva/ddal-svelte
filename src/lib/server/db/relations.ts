import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	user: {
		accounts: r.many.account(),
		sessions: r.many.session(),
		characters: r.many.characters(),
		dungeonMasters: r.many.dungeonMasters(),
		logDrafts: r.many.logDrafts(),
		passkeys: r.many.passkey(),
		imageUploads: r.many.imageUploads()
	},
	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id
		})
	},
	passkey: {
		user: r.one.user({
			from: r.passkey.userId,
			to: r.user.id
		})
	},
	session: {
		user: r.one.user({
			from: r.session.userId,
			to: r.user.id
		})
	},
	characters: {
		user: r.one.user({
			from: r.characters.userId,
			to: r.user.id
		}),
		logs: r.many.logs(),
		imageUploads: r.many.imageUploads()
	},
	imageUploads: {
		user: r.one.user({
			from: r.imageUploads.userId,
			to: r.user.id,
			optional: false
		}),
		character: r.one.characters({
			from: r.imageUploads.characterId,
			to: r.characters.id
		}),
		logImages: r.many.logImages()
	},
	logImages: {
		log: r.one.logs({
			from: r.logImages.logId,
			to: r.logs.id,
			optional: false
		}),
		upload: r.one.imageUploads({
			from: r.logImages.uploadId,
			to: r.imageUploads.id,
			optional: false
		})
	},
	dungeonMasters: {
		user: r.one.user({
			from: r.dungeonMasters.userId,
			to: r.user.id
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
		}),
		images: r.many.logImages()
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
	logDrafts: {
		user: r.one.user({
			from: r.logDrafts.userId,
			to: r.user.id
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
