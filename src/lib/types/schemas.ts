import { withDefault } from "$lib/types/valibot/custom";
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
	url
} from "valibot";

import type { Output } from "valibot";

export const dateSchema = coerce(date(), (input) => new Date(input as string | number | Date));

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: withDefault(string(), ""),
	name: withDefault(string(), "Me"),
	DCI: withDefault(nullable(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])), null),
	uid: withDefault(nullable(string()), "")
});

export type LogSchema = Output<typeof logSchema>;
export const logSchema = object({
	id: withDefault(string(), ""),
	name: string([minLength(1, "Log Name Required")]),
	date: dateSchema,
	characterId: withDefault(string(), ""),
	characterName: withDefault(string(), ""),
	type: withDefault(union([literal("game"), literal("nongame")]), "game"),
	experience: withDefault(number("Experience must be a number"), 0),
	acp: withDefault(number([minValue(0, "ACP must be a non-negative number")]), 0),
	tcp: withDefault(number("TCP must be a number"), 0),
	level: withDefault(number([minValue(0, "Level must be a non-negative number")]), 0),
	gold: withDefault(number("Gold must be a number"), 0),
	dtd: withDefault(number("Downtime days must be a number"), 0),
	description: withDefault(string(), ""),
	dm: dungeonMasterSchema,
	is_dm_log: withDefault(boolean(), false),
	applied_date: withDefault(nullable(dateSchema), null),
	magic_items_gained: array(
		object({
			id: withDefault(string(), ""),
			name: string([minLength(1, "Item Name Required")]),
			description: withDefault(string(), "")
		})
	),
	magic_items_lost: array(string([minLength(1, "Invalid Item ID")])),
	story_awards_gained: array(
		object({
			id: withDefault(string(), ""),
			name: string([minLength(1, "Story Award Name Required")]),
			description: withDefault(string(), "")
		})
	),
	story_awards_lost: array(string([minLength(1, "Invalid Story Award ID")]))
});

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: string([minLength(1, "Character Name Required")]),
	campaign: withDefault(string(), ""),
	race: withDefault(string(), ""),
	class: withDefault(string(), ""),
	character_sheet_url: withDefault(string([url()]), ""),
	image_url: withDefault(string([url()]), "")
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);
