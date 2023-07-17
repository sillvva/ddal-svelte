import { z } from "zod";

export const dateRegex =
	/^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?(Z|[+-](?:2[0-3]|[01][0-9]):[0-5][0-9])?$/;

export const logSchema = z.object({
	characterId: z.string().default(""),
	characterName: z.string().default(""),
	id: z.string().default(""),
	name: z.string().min(1, "Required"),
	date: z.date(),
	type: z.union([z.literal("game"), z.literal("nongame")]).default("game"),
	experience: z.number().default(0),
	acp: z.number().default(0),
	tcp: z.number().default(0),
	level: z.number().default(0),
	gold: z.number().default(0),
	dtd: z.number().default(0),
	description: z.string().default(""),
	dm: z.object({
		id: z.string().default(""),
		name: z.string().default(""),
		DCI: z.string().nullable().default(null),
		uid: z.string().nullable().default("")
	}),
	is_dm_log: z.boolean().default(false),
	applied_date: z.union([z.null(), z.date()]).default(null),
	magic_items_gained: z
		.array(
			z.object({
				id: z.string().default(""),
				name: z.string().min(1, "Required"),
				description: z.string().default("")
			})
		)
		.default([]),
	magic_items_lost: z.array(z.string().min(1)).default([]),
	story_awards_gained: z
		.array(
			z.object({
				id: z.string().default(""),
				name: z.string().min(1, "Required"),
				description: z.string().default("")
			})
		)
		.default([]),
	story_awards_lost: z.array(z.string().min(1)).default([])
});

export const newCharacterSchema = z.object({
	name: z.string().min(1, "Required"),
	campaign: z.string().min(1, "Required"),
	race: z.string().optional(),
	class: z.string().optional(),
	character_sheet_url: z.union([z.literal(""), z.string().url()]),
	image_url: z.union([z.literal(""), z.string().url()])
});

export const editCharacterSchema = z
	.object({
		id: z.string()
	})
	.merge(newCharacterSchema);

export const dungeonMasterSchema = z.object({
	id: z.string().default(""),
	name: z.string().min(1).default(""),
	DCI: z.string().nullable().default(null),
	uid: z.string().nullable().default("")
});
