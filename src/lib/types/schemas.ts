import {
	array,
	boolean,
	date,
	literal,
	merge,
	minLength,
	minRange,
	nullable,
	nullish,
	number,
	object,
	regex,
	string,
	union,
	url,
	useDefault
} from "valibot";

import type { Output } from "valibot";

const dateRegex =
	/^\d{4}-(0[1-9]|1[0-2])-([12]\d|0[1-9]|3[01])T((0|1)\d|2[0-4]):[0-5]\d:[0-5]\d(\.\d{3})?(Z|(\+|-)((0|1)\d|2[0-4]):[0-5]\d)$/;
export const dateSchema = union([date(), string([regex(dateRegex)])], "Invalid Date Format");

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: string(),
	name: string([minLength(1, "Required")]),
	DCI: useDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
	uid: useDefault(nullish(string()), "")
});

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
		uid: useDefault(nullish(string()), "")
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
