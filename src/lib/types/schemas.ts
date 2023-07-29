import {
	array,
	boolean,
	date,
	isoTimestamp,
	literal,
	merge,
	minLength,
	minRange,
	nullable,
	number,
	object,
	regex,
	string,
	union,
	url,
	useDefault
} from "valibot";

import type { Output } from "valibot";

export const dateSchema = union([date(), string([isoTimestamp()])]);

export type LogSchema = Output<typeof logSchema>;
export const logSchema = object({
	id: useDefault(string(), ""),
	name: string([minLength(1, "Required")]),
	date: dateSchema,
	characterId: useDefault(string(), ""),
	characterName: useDefault(string(), ""),
	type: useDefault(union([literal("game"), literal("nongame")]), "game"),
	experience: useDefault(number("Must be a number"), 0),
	acp: useDefault(number([minRange(0, "Must be a non-negative number")]), 0),
	tcp: useDefault(number("Must be a number"), 0),
	level: useDefault(number([minRange(0, "Must be a non-negative number")]), 0),
	gold: useDefault(number("Must be a number"), 0),
	dtd: useDefault(number("Must be a number"), 0),
	description: useDefault(string(), ""),
	dm: object({
		id: useDefault(string(), ""),
		name: useDefault(string(), ""),
		DCI: useDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
		uid: useDefault(string(), "")
	}),
	is_dm_log: useDefault(boolean(), false),
	applied_date: useDefault(nullable(dateSchema), null),
	magic_items_gained: useDefault(
		array(
			object({
				id: useDefault(string(), ""),
				name: string([minLength(1, "Required")]),
				description: useDefault(string(), "")
			})
		),
		[]
	),
	magic_items_lost: useDefault(array(string([minLength(1, "Required")])), []),
	story_awards_gained: useDefault(
		array(
			object({
				id: useDefault(string(), ""),
				name: string([minLength(1, "Required")]),
				description: useDefault(string(), "")
			})
		),
		[]
	),
	story_awards_lost: useDefault(array(string([minLength(1, "Required")])), [])
});

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: string([minLength(1, "Required")]),
	campaign: string([minLength(1, "Required")]),
	race: useDefault(string(), ""),
	class: useDefault(string(), ""),
	character_sheet_url: useDefault(string([url()]), ""),
	image_url: useDefault(string([url()]), "")
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: string(),
	name: string([minLength(1, "Required")]),
	DCI: useDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
	uid: useDefault(string(), "")
});
