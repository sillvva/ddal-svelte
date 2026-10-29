import type { FullCharacterData } from "#lib/server/effect/services/characters.js";
import { omit } from "@sillvva/utils";
import * as v from "valibot";
import { itemTimelineIssues } from "./entities.js";
import { AVATAR_IMAGE_LIMITS, CHARACTER_IMAGE_LIMITS, STORED_IMAGE_CONTENT_TYPES } from "./images/limits";
import { BLANK_CHARACTER, PASSKEY_PLACEHOLDER_EMAIL_DOMAIN, PROVIDERS, themeGroups, themes } from "./constants";

export type BrandedType = v.InferOutput<ReturnType<typeof brandedId>>;
function brandedId<T extends string>(name: T) {
	return v.pipe(uuidV7, v.brand(name));
}

const string = v.pipe(v.string(), v.trim());
export const requiredString = v.pipe(string, v.regex(/^.*(\p{L}|\p{N})+.*$/u, "Required"));
export const shortString = v.pipe(string, v.maxLength(64));
export const text = v.pipe(string, v.maxLength(2000));
export const largeText = v.pipe(string, v.maxLength(5000));
export const uuidV7 = v.pipe(
	v.string(),
	v.regex(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/iu, "ID is missing or invalid")
);
function isHttpUrl(value: string) {
	try {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}

export const urlSchema = v.pipe(text, v.url("Enter a valid URL"), v.check(isHttpUrl, "Enter an http or https URL"));
export const imageUrlWithFallback = v.pipe(
	v.fallback(v.union([urlSchema, v.literal(""), v.literal(BLANK_CHARACTER)]), BLANK_CHARACTER)
);

/** Common mailbox addresses, within RFC 5321 length limits, excluding the passkey signup placeholder domain. */
function isStoredEmail(value: string) {
	const at = value.lastIndexOf("@");
	if (at < 1 || value.indexOf("@") !== at) return false;

	const local = value.slice(0, at);
	const domain = value.slice(at + 1);
	if (local.length > 64 || domain.length > 253) return false;
	if (domain === PASSKEY_PLACEHOLDER_EMAIL_DOMAIN || domain.endsWith(`.${PASSKEY_PLACEHOLDER_EMAIL_DOMAIN}`)) return false;

	const labels = domain.split(".");
	const tld = labels.at(-1);
	if (labels.length < 2 || !tld || !/^[a-z]{2,63}$/u.test(tld)) return false;

	return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label));
}

export const emailSchema = v.pipe(
	string,
	v.toLowerCase(),
	v.maxLength(254, "Email is too long"),
	v.email("Enter a valid email address"),
	v.check(isStoredEmail, "Enter a valid email address")
);

export const orEmpty = <T extends v.GenericSchema>(schema: T) => v.union([schema, v.literal("")]);
export const emptyToNull = <T extends v.GenericSchema>(schema: T) =>
	v.pipe(
		schema,
		v.transform((out) => (out === "" ? null : (out as Exclude<v.InferOutput<T>, "">)))
	);

export const integer = v.pipe(v.number(), v.integer());
export const date = v.pipe(
	v.number("Required"),
	v.minValue(new Date(2014, 0).getTime(), "Date must be 2014 or later"),
	v.transform((input) => new Date(input)),
	v.date()
);
export const nullableDate = v.pipe(
	v.number(),
	v.check((input) => new Date(input).getFullYear() >= 2014 || input === 0, "Date must be 2014 or later"),
	v.transform((input) => (input ? new Date(input) : null)),
	v.nullable(v.date())
);
// `supportedValuesOf("timeZone")` lists canonical IANA names. Hosts whose zone is
// Etc/UTC — containers and GitHub Actions included — report that zone as "UTC"
// from `getLocalTimeZone()`, and "UTC" is not in the canonical list.
const ianaTimeZones = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);

export const timezoneSchema = v.pipe(
	v.string(),
	v.check((input) => input === "" || ianaTimeZones.has(input), "Invalid timezone")
);

/**
 * Cache key only. A query that mints an id for a "new" route stores that id under its
 * arguments. A value that changes after each save makes the next visit mint a different id.
 */
export const draftCacheKey = v.optional(v.string(), "");

export type UserId = v.InferOutput<typeof userIdSchema>;
export const userIdSchema = brandedId("UserId");

export type CharacterId = v.InferOutput<typeof characterIdSchema>;
export const characterIdSchema = brandedId("CharacterId");

export type ImageUploadId = v.InferOutput<typeof imageUploadIdSchema>;
export const imageUploadIdSchema = brandedId("ImageUploadId");

export type CharacterIdParam = v.InferOutput<typeof characterIdParamSchema>;
export const characterIdParamSchema = v.union([characterIdSchema, v.literal("new")]);

export type CharacterSchema = v.InferOutput<typeof characterSchema>;
export const characterSchema = v.object({
	id: characterIdSchema,
	name: v.pipe(requiredString, shortString),
	campaign: v.pipe(requiredString, shortString),
	race: v.pipe(requiredString, shortString),
	class: v.pipe(requiredString, shortString),
	characterSheetUrl: orEmpty(urlSchema),
	imageUrl: imageUrlWithFallback
});

export type EditCharacterSchema = v.InferOutput<typeof editCharacterSchema>;
export type EditCharacterSchemaIn = v.InferInput<typeof editCharacterSchema>;
export const editCharacterSchema = v.object({
	...characterSchema.entries,
	firstLog: v.optional(v.boolean(), false)
});

const storedImageContentTypeSchema = v.picklist(STORED_IMAGE_CONTENT_TYPES);

export type PrepareCharacterImageSchema = v.InferOutput<typeof prepareCharacterImageSchema>;
export const prepareCharacterImageSchema = v.object({
	characterId: characterIdSchema,
	contentType: storedImageContentTypeSchema,
	bytes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(CHARACTER_IMAGE_LIMITS.maxStoredBytes))
});

export type PrepareAvatarImageSchema = v.InferOutput<typeof prepareAvatarImageSchema>;
export const prepareAvatarImageSchema = v.object({
	contentType: storedImageContentTypeSchema,
	bytes: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(AVATAR_IMAGE_LIMITS.maxStoredBytes))
});

export type CompleteCharacterImageSchema = v.InferOutput<typeof completeCharacterImageSchema>;
export const completeCharacterImageSchema = v.object({
	uploadId: imageUploadIdSchema
});

export type SaveAvatarSchema = v.InferOutput<typeof saveAvatarSchema>;
export const saveAvatarSchema = completeCharacterImageSchema;

export type DungeonMasterId = v.InferOutput<typeof dungeonMasterIdSchema>;
export const dungeonMasterIdSchema = brandedId("DungeonMasterId");

export type DungeonMasterSchema = v.InferOutput<typeof dungeonMasterSchema>;
export type DungeonMasterSchemaIn = v.InferInput<typeof dungeonMasterSchema>;
export const dungeonMasterSchema = v.object({
	id: dungeonMasterIdSchema,
	name: v.pipe(requiredString, shortString),
	DCI: v.pipe(string, v.regex(/\d{0,10}/, "Invalid DCI Format")),
	userId: userIdSchema,
	isUser: v.boolean()
});

export type DungeonMasterFormSchema = v.InferOutput<typeof dungeonMasterFormSchema>;
export type DungeonMasterFormSchemaIn = v.InferInput<typeof dungeonMasterFormSchema>;
export const dungeonMasterFormSchema = v.object({
	id: dungeonMasterIdSchema,
	name: v.pipe(requiredString, shortString),
	DCI: v.pipe(string, v.regex(/\d{0,10}/, "Invalid DCI Format"))
});

export type ItemId = v.InferOutput<typeof itemIdSchema>;
export const itemIdSchema = brandedId("ItemID");

export type ItemSchema = v.InferOutput<typeof itemSchema>;
export type ItemSchemaIn = v.InferInput<typeof itemSchema>;
const itemSchema = v.object({
	id: itemIdSchema,
	name: requiredString,
	description: text
});

export type ItemsGainedSchema = v.InferOutput<typeof itemsGainedSchema>;
export const itemsGainedSchema = v.optional(v.array(itemSchema), []);

export type ItemsLostSchema = v.InferOutput<typeof itemsLostSchema>;
export const itemsLostSchema = v.optional(v.array(itemIdSchema), []);

export type LogId = v.InferOutput<typeof logIdSchema>;
export const logIdSchema = brandedId("LogId");

export type LogIdParam = v.InferOutput<typeof logIdParamSchema>;
export const logIdParamSchema = v.union([logIdSchema, v.literal("new")]);

export type LogSchema = v.InferOutput<typeof logSchema>;
export type LogSchemaIn = v.InferInput<typeof logSchema>;
export const logSchema = v.object({
	id: logIdSchema,
	name: v.pipe(requiredString, shortString),
	date: date,
	timezone: timezoneSchema,
	characterId: emptyToNull(orEmpty(characterIdSchema)),
	characterName: shortString,
	appliedDate: nullableDate,
	type: v.optional(v.picklist(["game", "nongame"]), "game"),
	experience: v.optional(v.pipe(integer, v.minValue(0)), 0),
	acp: v.optional(v.pipe(integer, v.minValue(0)), 0),
	tcp: v.optional(integer, 0),
	level: v.optional(v.pipe(integer, v.minValue(0)), 0),
	gold: v.optional(v.number(), 0),
	dtd: v.optional(integer, 0),
	description: v.optional(largeText, ""),
	dm: v.object({
		...dungeonMasterSchema.entries,
		id: orEmpty(dungeonMasterIdSchema),
		name: v.optional(shortString, ""),
		isUser: v.optional(v.boolean(), false)
	}),
	isDmLog: v.optional(v.boolean(), false),
	magicItemsGained: itemsGainedSchema,
	magicItemsLost: itemsLostSchema,
	storyAwardsGained: itemsGainedSchema,
	storyAwardsLost: itemsLostSchema
});

export type DmLogSchema = v.InferOutput<typeof dmLogSchema>;
export type DmLogSchemaIn = v.InferInput<typeof dmLogSchema>;
export const dmLogSchema = v.object({
	...omit(logSchema.entries, ["dm"]),
	isDmLog: v.optional(v.boolean(), true)
});

export const characterLogSchema = (character: FullCharacterData) =>
	v.pipe(
		logSchema,
		v.check((input) => !input.isDmLog, "Only character logs can be saved here."),
		v.forward(
			v.check((input) => {
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.totalLevel < 20 || input.acp - logACP === 0;
			}, `Cannot increase level above 20. Current: ${character.totalLevel}`),
			["acp"]
		),
		v.forward(
			v.check((input) => {
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.totalLevel + input.level - logLevel <= 20;
			}, `Cannot increase level above 20. Current: ${character.totalLevel}`),
			["level"]
		),
		v.forward(
			v.check((input) => {
				const logGold = character.logs.find((log) => log.id === input.id)?.gold || 0;
				return character.totalGold + input.gold - logGold >= 0;
			}, `Cannot reduce total gold to less than 0. Current: ${character.totalGold.toLocaleString()}`),
			["gold"]
		),
		v.forward(
			v.check((input) => {
				const logTCP = character.logs.find((log) => log.id === input.id)?.tcp || 0;
				return character.totalTcp + input.tcp - logTCP >= 0;
			}, `Cannot reduce total TCP to less than 0. Current: ${character.totalTcp}`),
			["tcp"]
		),
		v.forward(
			v.check((input) => {
				const issue = itemTimelineIssues(character.logs, input).find((item) => item.field === "magicItemsLost");
				return !issue;
			}, "This item is not held on this log's date"),
			["magicItemsLost"]
		),
		v.forward(
			v.check((input) => {
				const issue = itemTimelineIssues(character.logs, input).find((item) => item.field === "storyAwardsLost");
				return !issue;
			}, "This item is not held on this log's date"),
			["storyAwardsLost"]
		),
		v.forward(
			v.check((input) => {
				const issue = itemTimelineIssues(character.logs, input).find((item) => item.field === "date");
				return !issue;
			}, "An item gained in this log is dropped in an earlier log"),
			["date"]
		)
	);

export const dMLogSchema = (characters: FullCharacterData[] = []) =>
	v.pipe(
		dmLogSchema,
		v.check((input) => input.isDmLog, "Only DM logs can be saved here."),
		v.forward(
			v.check((input) => {
				const characterIds = characters.map((c) => c.id);
				return !input.characterId || !characterIds.length || characterIds.includes(input.characterId);
			}, "Character not found"),
			["characterId"]
		),
		v.forward(
			v.check((input) => !!input.characterId || !input.appliedDate, "Character is required if applied date is set"),
			["characterId"]
		),
		v.forward(
			v.check((input) => !!input.appliedDate || !input.characterId, "Applied date is required if character is selected"),
			["appliedDate"]
		),
		v.forward(
			v.check(
				(input) => !input.appliedDate || input.appliedDate.getTime() >= input.date.getTime(),
				"Applied date must be after log date"
			),
			["appliedDate"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character) return true;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				return character.totalLevel < 20 || input.acp - logACP === 0;
			}, "Cannot increase level above 20"),
			["acp"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character) return true;
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				return character.totalLevel + input.level - logLevel <= 20;
			}, "Cannot increase level above 20"),
			["level"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character) return true;
				const logGold = character.logs.find((log) => log.id === input.id)?.gold || 0;
				return character.totalGold + input.gold - logGold >= 0;
			}, "Cannot reduce character's total gold to less than 0"),
			["gold"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((c) => c.id === input.characterId);
				if (!character) return true;
				const logTCP = character.logs.find((log) => log.id === input.id)?.tcp || 0;
				return character.totalTcp + input.tcp - logTCP >= 0;
			}, "Cannot reduce character's total TCP to less than 0"),
			["tcp"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((entry) => entry.id === input.characterId);
				if (!character) return true;
				return !itemTimelineIssues(character.logs, input).some((item) => item.field === "magicItemsLost");
			}, "This item is not held on this log's date"),
			["magicItemsLost"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((entry) => entry.id === input.characterId);
				if (!character) return true;
				return !itemTimelineIssues(character.logs, input).some((item) => item.field === "storyAwardsLost");
			}, "This item is not held on this log's date"),
			["storyAwardsLost"]
		),
		v.forward(
			v.check((input) => {
				const character = characters.find((entry) => entry.id === input.characterId);
				if (!character) return true;
				return !itemTimelineIssues(character.logs, input).some((item) => item.field === "date");
			}, "An item gained in this log is dropped in an earlier log"),
			["appliedDate"]
		)
	);

export type AppCookie = v.InferOutput<typeof appCookieSchema>;
export const appCookieSchema = v.optional(
	v.object({
		settings: v.optional(
			v.object({
				theme: v.optional(v.fallback(v.picklist(themes.map((t) => t.value)), "system"), "system"),
				mode: v.optional(v.picklist(themeGroups), "dark"),
				autoWebAuthn: v.optional(v.boolean(), false),
				provider: v.optional(v.picklist(PROVIDERS.map((p) => p.id))),
				timezone: v.optional(timezoneSchema, ""),
				maxwidth: v.optional(v.picklist(["container", "full"]), "container")
			}),
			{}
		),
		characters: v.optional(
			v.object({
				magicItems: v.optional(v.boolean(), false),
				display: v.optional(v.picklist(["list", "grid"]), "list"),
				firstLog: v.optional(v.boolean(), false)
			}),
			{}
		),
		log: v.optional(
			v.object({
				descriptions: v.optional(v.boolean(), false)
			}),
			{}
		),
		dmLogs: v.optional(
			v.object({
				sort: v.optional(v.picklist(["asc", "desc"]), "asc"),
				descriptions: v.optional(v.boolean(), false)
			}),
			{}
		)
	}),
	{}
);

export const appDefaults = v.parse(appCookieSchema, {});

export type LocalsAccount = v.InferOutput<typeof localsAccountSchema>;
export const localsAccountSchema = v.object({
	id: v.string(),
	accountId: v.string(),
	providerId: v.picklist(PROVIDERS.map((p) => p.id)),
	userId: userIdSchema,
	refreshToken: v.nullable(v.string()),
	accessToken: v.nullable(v.string()),
	accessTokenExpiresAt: v.nullable(v.date()),
	refreshTokenExpiresAt: v.nullable(v.date()),
	scope: v.nullable(v.string()),
	idToken: v.nullable(v.string()),
	password: v.nullable(v.string()),
	createdAt: v.date(),
	updatedAt: v.date()
});

export type PasskeyId = v.InferOutput<typeof passkeyIdSchema>;
export const passkeyIdSchema = brandedId("PasskeyId");

export type LocalsPasskey = v.InferOutput<typeof localsPasskeySchema>;
export const localsPasskeySchema = v.object({
	id: passkeyIdSchema,
	name: v.nullable(v.string()),
	publicKey: v.string(),
	userId: userIdSchema,
	credentialID: v.string(),
	counter: v.number(),
	deviceType: v.string(),
	backedUp: v.boolean(),
	transports: v.string(),
	createdAt: v.date(),
	aaguid: v.nullable(v.string())
});

export type Role = v.InferOutput<typeof roleSchema>;
export const roleSchema = v.picklist(["user", "admin"]);

export type LocalsUser = v.InferOutput<typeof localsUserSchema>;
export const localsUserSchema = v.object({
	id: userIdSchema,
	name: requiredString,
	email: requiredString,
	emailVerified: v.boolean(),
	onboarded: v.boolean(),
	image: v.nullish(imageUrlWithFallback),
	role: roleSchema,
	banned: v.boolean(),
	banReason: v.nullish(v.string()),
	banExpires: v.nullish(v.date()),
	createdAt: v.date(),
	updatedAt: v.date(),
	accounts: v.array(v.pick(localsAccountSchema, ["id", "accountId", "providerId", "createdAt", "updatedAt"])),
	passkeys: v.array(v.pick(localsPasskeySchema, ["id", "name", "createdAt"]))
});

export type OnboardingSchema = v.InferOutput<typeof onboardingSchema>;
export const onboardingSchema = v.object({
	name: v.pipe(requiredString, shortString),
	email: emailSchema,
	/** Empty when the passkey signup did not choose a profile picture. */
	uploadId: v.pipe(
		v.optional(v.union([imageUploadIdSchema, v.literal("")]), ""),
		v.transform((id): ImageUploadId | null => (id === "" ? null : id))
	)
});

export type LocalsSession = v.InferOutput<typeof localsSessionSchema>;
export const localsSessionSchema = v.object({
	id: v.string(),
	userId: userIdSchema,
	ipAddress: v.nullish(v.string()),
	userAgent: v.nullish(v.string()),
	impersonatedBy: v.nullish(userIdSchema),
	expiresAt: v.date(),
	createdAt: v.date(),
	updatedAt: v.date()
});

export type AppLogId = v.InferOutput<typeof appLogId>;
export const appLogId = brandedId("AppLogId");

export type AppLogSchema = v.InferOutput<typeof appLogSchema>;
export const appLogSchema = v.object({
	id: appLogId,
	label: v.string(),
	level: v.picklist(["ALL", "FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE", "OFF"]),
	annotations: v.object({
		routeId: v.nullable(v.string()),
		params: v.record(v.string(), v.optional(v.string())),
		userId: v.optional(userIdSchema),
		username: v.optional(v.string()),
		extra: v.record(v.string(), v.unknown())
	}),
	timestamp: v.date()
});
