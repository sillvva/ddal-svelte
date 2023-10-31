import {
	array,
	boolean,
	custom,
	date,
	literal,
	maxLength,
	merge,
	minLength,
	minValue,
	nullable,
	nullish,
	number,
	object,
	optional,
	regex,
	string,
	union,
	url,
	type Input,
	type Output,
	type Pipe
} from "valibot";

export type DungeonMasterSchema = Output<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = object({
	id: optional(string(), ""),
	name: optional(string(), "Me"),
	DCI: nullish(string([regex(/[0-9]{0,10}/, "Invalid DCI Format")])),
	uid: nullable(string()),
	owner: string()
});

const itemSchema = (type: "Item" | "Story Award") =>
	object({
		id: optional(string(), ""),
		name: optional(string([minLength(1, `${type} Name Required`)]), ""),
		description: optional(string(), "")
	});

const notNaN: Pipe<number> = [custom((input) => !isNaN(input))];

export type LogSchema = Output<typeof logSchema>;
export type LogSchemaIn = Input<typeof logSchema>;
export const logSchema = object({
	id: nullish(string(), ""),
	name: optional(string([minLength(1, "Log Name Required")]), ""),
	date: date("Invalid Date"),
	characterId: optional(string(), ""),
	characterName: optional(string(), ""),
	type: optional(union([literal("game"), literal("nongame")]), "game"),
	experience: optional(number("Experience must be a number", notNaN), 0),
	acp: optional(number([minValue(0, "ACP must be a non-negative number"), ...notNaN]), 0),
	tcp: optional(number("TCP must be a number", notNaN), 0),
	level: optional(number([minValue(0, "Level must be a non-negative number"), ...notNaN]), 0),
	gold: optional(number("Gold must be a number", notNaN), 0),
	dtd: optional(number("Downtime days must be a number", notNaN), 0),
	description: nullish(string(), ""),
	dm: dungeonMasterSchema,
	is_dm_log: optional(boolean(), false),
	applied_date: nullable(date("Invalid Date")),
	magic_items_gained: array(itemSchema("Item")),
	magic_items_lost: array(string([minLength(1, "Invalid Item ID")])),
	story_awards_gained: array(itemSchema("Story Award")),
	story_awards_lost: array(string([minLength(1, "Invalid Story Award ID")]))
});

const optionalURL = optional(union([string([url("Invalid URL")]), string([maxLength(0)])], "Invalid URL"), "");

export type NewCharacterSchema = Output<typeof newCharacterSchema>;
export const newCharacterSchema = object({
	name: optional(string([minLength(1, "Character Name Required")]), ""),
	campaign: optional(string(), ""),
	race: optional(string(), ""),
	class: optional(string(), ""),
	character_sheet_url: optionalURL,
	image_url: optionalURL
});

export type EditCharacterSchema = Output<typeof editCharacterSchema>;
export const editCharacterSchema = merge([object({ id: string() }), newCharacterSchema]);
