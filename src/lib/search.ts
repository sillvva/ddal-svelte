import type { LogId } from "#lib/schemas.js";
import type { FullLogData } from "#lib/server/effect/services/logs.js";
import { substrCount } from "@sillvva/utils";
import escapeRegex from "regexp.escape";

const CONSUMABLE_REGEX =
	/^(\d+(?:x|×)? )?((Potion|(?:Spell )?Scroll|Charm|Oil|Elixir)s? of)|Alchemist('?s)? Fire|Antitoxin|Spellwrought Tattoo|Elemental Gem/;

const EXCLUDED_SEARCH_WORDS = new Set(["and", "or", "to", "in", "a", "an", "the", "of"]);
const MIN_QUERY_LENGTH = 2;
const SCORE_PRECISION = 10;
const POSITION_BONUS_MAX = 0.5;
const WORD_BOUNDARY_BONUS = 0.3;
export const WHOLE_QUERY_MULTIPLIER = 2;

export type WordToken = { type: "word"; value: string };
export type PhraseToken = { type: "phrase"; value: string };
export type SearchToken = WordToken | PhraseToken;

export type MatchResult = { matches: Set<string>; score: number };

export interface ConsolidatableItem {
	name: string;
	description?: string | null;
	logGainedId: LogId;
}

export type ConsolidatedItem<T extends ConsolidatableItem> = T & {
	/** Formatted display name (may include quantity prefix and pluralization, e.g. "2× Potions of Healing"). */
	name: string;
	/** Base singular item name derived from the source item, used for filtering logs. */
	searchName: string;
	quantity: number;
	ids: LogId[];
};

export interface PageSearchSource {
	url: { searchParams: Pick<URLSearchParams, "get"> };
	shallow?: { url: { searchParams: Pick<URLSearchParams, "get"> } } | null;
	state: App.PageState;
}

export function getPageSearchValue(currentPage: PageSearchSource, key: string): string {
	return currentPage.state.search?.[key] ?? (currentPage.shallow?.url ?? currentPage.url).searchParams.get(key) ?? "";
}

export function isConsumableItem(name: string, isMagicItems = true): boolean {
	return isMagicItems && CONSUMABLE_REGEX.test(name.trim());
}

export function getItemQuantity(name: string, isStoryAward = false): number {
	if (isStoryAward) return 1;
	return parseInt(name.trim().match(/^(\d+)(?:x|×)? /i)?.[1] || "1", 10) || 1;
}

export function getBaseItemName(name: string, isStoryAward = false): string {
	if (isStoryAward) return name;

	return name
		.trim()
		.replace(/^\d+(?:x|×)? ?/i, "")
		.replace(/^(Potion|(?:Spell )?Scroll|Charm|Oil|Elixir)s\b/, "$1")
		.replace("Spell Scroll", "Scroll");
}

export function formatItemName(name: string, qty = 1, isStoryAward = false): string {
	if (isStoryAward) return name;

	let val = getBaseItemName(name, false);

	if (qty > 1) {
		if (isConsumableItem(val, true)) {
			val = val.replace(/^(Potion|(?:Spell )?Scroll|Charm|Oil|Elixir)( .+)$/, "$1s$2");
		}
		val = `${qty}× ${val}`;
	}

	return val;
}

export function getItemSortName(name: string): string {
	return name
		.replace(/^\d+(?:x|×)? ?/i, "")
		.replace("Spell Scroll", "Scroll")
		.replace(/^(\w+)s/, "$1")
		.replace(/^(A|An|The) /, "");
}

export function consolidateItems<T extends ConsolidatableItem>(
	items: readonly T[],
	options: { isStoryAward?: boolean } = {}
): ConsolidatedItem<T>[] {
	const { isStoryAward = false } = options;
	const itemsMap = new Map<string, number>();
	const acc: ConsolidatedItem<T>[] = [];

	for (const item of items) {
		const baseName = getBaseItemName(item.name, isStoryAward);
		const qty = getItemQuantity(item.name, isStoryAward);
		const desc = item.description?.trim().slice(0, 25) || "";
		const key = `${baseName}_${desc}`;

		const existingIndex = itemsMap.get(key);
		if (existingIndex !== undefined && acc[existingIndex]) {
			const existing = acc[existingIndex]!;
			const nextQty = existing.quantity + qty;
			existing.quantity = nextQty;
			existing.name = formatItemName(baseName, nextQty, isStoryAward);
			existing.ids.push(item.logGainedId);
		} else {
			itemsMap.set(key, acc.length);
			acc.push({
				...item,
				name: formatItemName(baseName, qty, isStoryAward),
				searchName: baseName,
				quantity: qty,
				ids: [item.logGainedId]
			});
		}
	}

	return acc;
}

function tokenCheck(tokenValue: string): boolean {
	return tokenValue.length > 1 && !EXCLUDED_SEARCH_WORDS.has(tokenValue);
}

export function tokenizeSearchQuery(query: string): SearchToken[] {
	if (query.trim().length < MIN_QUERY_LENGTH) return [];

	const tokens: SearchToken[] = [];
	const regex = /"([^"]+)"|([\w-]+)/g;

	let match: RegExpExecArray | null;
	while ((match = regex.exec(query)) !== null) {
		const [, phrase, word] = match;

		if (word && tokenCheck(word)) {
			tokens.push({ type: "word", value: word });
		} else if (phrase && tokenCheck(phrase)) {
			tokens.push({ type: "phrase", value: phrase });
		}
	}

	return tokens;
}

export function scoreSearchMatch(item: string, tokens: readonly SearchToken[], cache?: Map<string, MatchResult>): MatchResult {
	const cacheKey = `${item}:${tokens.map((t) => t.value).join(",")}`;
	const cached = cache?.get(cacheKey);
	if (cached) return cached;

	const itemLower = item.toLowerCase();
	const matches = new Set<string>();

	let score = 0;
	for (const token of tokens) {
		let subtotal = 0;
		const tokenLower = token.value.toLowerCase();

		const oc = substrCount(itemLower, tokenLower);
		if (!oc) continue;
		subtotal += oc;

		const index = itemLower.indexOf(tokenLower);
		subtotal += Math.max(0, POSITION_BONUS_MAX - (index / itemLower.length) * POSITION_BONUS_MAX);

		const escapedTerm = escapeRegex(token.value);
		if (new RegExp(`\\b${escapedTerm}\\b`, "i").test(item)) {
			subtotal += WORD_BOUNDARY_BONUS;
		}

		if (token.type === "phrase") {
			const phraseMultiplier = (token.value.split(/\s+/).length + 2) / 2;
			subtotal *= phraseMultiplier;
		}

		score += subtotal;
		matches.add(token.value);
	}

	if (matches.size === tokens.length) score *= WHOLE_QUERY_MULTIPLIER;

	score = tokens.length ? Math.round((score / tokens.length) * SCORE_PRECISION) / SCORE_PRECISION : 0;

	const result = { matches, score };
	cache?.set(cacheKey, result);
	return result;
}

export interface SearchableLog {
	id: LogId;
	name: string;
	character?: { name: string } | null;
	dm?: { name: string } | null;
	magicItemsGained: ReadonlyArray<{ name: string }>;
	magicItemsLost?: ReadonlyArray<{ name: string }>;
	storyAwardsGained: ReadonlyArray<{ name: string }>;
	storyAwardsLost?: ReadonlyArray<{ name: string }>;
}

export function buildLogSearchIndex(item: SearchableLog) {
	return {
		id: item.id,
		index: new Map([
			["id", [item.id]],
			["name", [item.name]],
			["character", [item.character?.name || ""]],
			["dm", [item.dm?.name || ""]],
			["magicItemsGained", item.magicItemsGained.map((mi) => mi.name)],
			["magicItemsLost", item.magicItemsLost?.map((mi) => mi.name) ?? []],
			["storyAwardsGained", item.storyAwardsGained.map((sa) => sa.name)],
			["storyAwardsLost", item.storyAwardsLost?.map((sa) => sa.name) ?? []]
		] as const satisfies [keyof FullLogData, string[]][])
	};
}

export function matchIndexedEntity<TKey extends string>(
	index: Map<TKey, string[]>,
	tokens: readonly SearchToken[],
	cache?: Map<string, MatchResult>
): { score: number; match: Set<TKey> } | null {
	let totalScore = 0;
	const matchedTokens = new Set<string>();
	const matchTypes = new Set<TKey>();

	for (const [key, values] of index) {
		for (const value of values) {
			const matchResult = scoreSearchMatch(value, tokens, cache);
			if (matchResult.matches.size) {
				totalScore += matchResult.score;
				matchResult.matches.forEach((match) => matchedTokens.add(match));
				matchTypes.add(key);
			}
		}
	}

	if (matchedTokens.size !== tokens.length) return null;

	return {
		score: totalScore * WHOLE_QUERY_MULTIPLIER,
		match: matchTypes
	};
}
