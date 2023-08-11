import {
	array,
	boolean,
	coerce,
	date,
	literal,
	merge,
	minLength,
	minValue,
	nullable,
	number,
	object,
	regex,
	string,
	union,
	url,
	withDefault
} from "valibot";

import type { Output } from "valibot";

export const dateSchema = coerce(date(), (input) => new Date(input as string | number | Date));

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: string(),
	name: string([minLength(1, "Required")]),
	DCI: withDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
	uid: withDefault(nullable(string()), "")
});

export type LogSchema = Output<typeof logSchema>;
export const logSchema = object({
	id: withDefault(string(), ""),
	name: string([minLength(1, "Required")]),
	date: dateSchema,
	characterId: withDefault(string(), ""),
	characterName: withDefault(string(), ""),
	type: withDefault(union([literal("game"), literal("nongame")]), "game"),
	experience: withDefault(number("Must be a number"), 0),
	acp: withDefault(number([minValue(0, "Must be a non-negative number")]), 0),
	tcp: withDefault(number("Must be a number"), 0),
	level: withDefault(number([minValue(0, "Must be a non-negative number")]), 0),
	gold: withDefault(number("Must be a number"), 0),
	dtd: withDefault(number("Must be a number"), 0),
	description: withDefault(string(), ""),
	dm: object({
		id: withDefault(string(), ""),
		name: withDefault(string(), ""),
		DCI: withDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
		uid: withDefault(string(), "")
	}),
	is_dm_log: withDefault(boolean(), false),
	applied_date: withDefault(nullable(dateSchema), null),
	magic_items_gained: withDefault(
		array(
			object({
				id: withDefault(string(), ""),
				name: string([minLength(1, "Required")]),
				description: withDefault(string(), "")
			})
		),
		[]
	),
	magic_items_lost: withDefault(array(string([minLength(1, "Required")])), []),
	story_awards_gained: withDefault(
		array(
			object({
				id: withDefault(string(), ""),
				name: string([minLength(1, "Required")]),
				description: withDefault(string(), "")
			})
		),
		[]
	),
	story_awards_lost: withDefault(array(string([minLength(1, "Required")])), [])
});

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: string([minLength(1, "Required")]),
	campaign: string([minLength(1, "Required")]),
	race: withDefault(string(), ""),
	class: withDefault(string(), ""),
	character_sheet_url: withDefault(string([url()]), ""),
	image_url: withDefault(string([url()]), "")
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);
