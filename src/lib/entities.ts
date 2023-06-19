import type { getCharacter } from "$src/server/data/characters";
import type { MagicItem, StoryAward } from "@prisma/client";

export const getMagicItems = (
	character: Exclude<Awaited<ReturnType<typeof getCharacter>>, null>,
	options?: {
		lastLogId?: string;
		excludeDropped?: boolean;
	}
) => {
	const { lastLogId = "", excludeDropped = false } = options || {};
	const magicItems: MagicItem[] = [];
	let lastLog = false;
	character.logs.forEach((log) => {
		if (lastLog) return;
		if (log.id === lastLogId) {
			lastLog = true;
			return;
		}
		log.magic_items_gained.forEach((item) => {
			magicItems.push(item);
		});
		log.magic_items_lost.forEach((item) => {
			magicItems.splice(
				magicItems.findIndex((i) => i.id === item.id),
				1
			);
		});
	});
	return magicItems.filter((item) => !excludeDropped || !item.logLostId);
};

export const getStoryAwards = (
	character: Exclude<Awaited<ReturnType<typeof getCharacter>>, null>,
	options?: {
		lastLogId?: string;
		excludeDropped?: boolean;
	}
) => {
	const { lastLogId = "", excludeDropped = false } = options || {};
	const storyAwards: StoryAward[] = [];
	let lastLog = false;
	character.logs.forEach((log) => {
		if (lastLog) return;
		if (log.id === lastLogId) {
			lastLog = true;
			return;
		}
		log.story_awards_gained.forEach((item) => {
			storyAwards.push(item);
		});
		log.story_awards_lost.forEach((item) => {
			storyAwards.splice(
				storyAwards.findIndex((i) => i.id === item.id),
				1
			);
		});
	});
	return storyAwards.filter((item) => !excludeDropped || !item.logLostId);
};
