/* eslint-disable svelte/prefer-svelte-reactivity */
import { goto } from "$app/navigation";
import type { FullCharacterData } from "$lib/server/effect/services/characters";
import type { UserDM } from "$lib/server/effect/services/dms";
import type { FullLogData, LogSummaryData, UserLogData } from "$lib/server/effect/services/logs";
import { getLocalTimeZone, parseAbsoluteToLocal, toCalendarDateTime, type DateValue } from "@internationalized/date";
import { debounce, isDefined, substrCount, type MapKeys, type Prettify } from "@sillvva/utils";
import { isHttpError } from "@sveltejs/kit";
import { Duration } from "effect";
import escape from "regexp.escape";
import { toast } from "svelte-sonner";
import { SvelteMap } from "svelte/reactivity";
import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import {
	dateProxy,
	fieldProxy,
	superForm,
	type FormOptions,
	type FormPathLeaves,
	type Infer,
	type InferIn,
	type SuperForm,
	type SuperValidated
} from "sveltekit-superforms";
import { valibotClient } from "sveltekit-superforms/adapters";
import * as v from "valibot";
import type { FullPathname } from "./constants";
import type { SearchData } from "./remote/command";
import type { EffectFailure, EffectResult } from "./server/effect/runtime";
import { isRedirectFailure, type Awaitable } from "./util";

export function successToast(message: string) {
	toast.success("Success", {
		description: message,
		classes: {
			description: "text-white!"
		}
	});
}

export function errorToast(message: string) {
	toast.error("Error", {
		description: message,
		classes: {
			description: "text-white!"
		},
		duration: Duration.toMillis("30 seconds")
	});
}

export function unknownErrorToast(error: unknown) {
	if (typeof error === "string") errorToast(error);
	else if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string")
		errorToast(error.message);
	else if (isHttpError(error)) errorToast(error.body.message);
	else errorToast("An unknown error occurred");
}

export interface CustomFormOptions<Out extends Record<string, unknown>> {
	remote?: (data: Out) => Promise<EffectResult<SuperValidated<Out> | FullPathname>>;
	onSuccessResult?: (data: Out) => Awaitable<void>;
	onErrorResult?: (error: EffectFailure["error"]) => Awaitable<void>;
}

export function valibotForm<S extends v.GenericSchema, Out extends Infer<S, "valibot">, In extends InferIn<S, "valibot">>(
	form: SuperValidated<Out, App.Superforms.Message, In>,
	schema: S,
	{
		remote,
		invalidateAll: invalidate,
		onSuccessResult = (data) => (typeof data === "object" && "name" in data ? successToast(`${data.name} saved`) : undefined),
		onErrorResult = (error) => errorToast(error.message),
		onSubmit,
		onResult,
		...rest
	}: FormOptions<Out, App.Superforms.Message, In> & CustomFormOptions<Out> = {}
) {
	const pending = writable(false);
	const superform = superForm(form, {
		dataType: "json",
		validators: valibotClient(schema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?",
		...rest,
		onSubmit: async (event) => {
			pending.set(true);
			if (remote) {
				event.cancel();

				const willInvalidate = invalidate !== false;
				const data = get(superform.form);
				const result = await remote(data);
				if (result.ok) {
					if (typeof result.data === "string") {
						superform.tainted.set(undefined);
						await onSuccessResult(data);
						await goto(result.data, {
							invalidateAll: willInvalidate
						});
						return;
					}

					const hasErrors = Object.keys(result.data.errors).length > 0;
					superform.errors.set(result.data.errors);
					superform.message.set(result.data.message);
					superform.form.set(result.data.data, {
						taint: hasErrors ? true : "untaint-form"
					});

					if (!hasErrors) await onSuccessResult(data);
					pending.set(false);
				} else {
					await onErrorResult(result.error);
					if (isRedirectFailure(result.error)) {
						superform.tainted.set(undefined);
						await goto(result.error.redirectTo, {
							invalidateAll: willInvalidate
						});
					} else {
						const error = result.error.message;
						superform.errors.set({ _errors: [error] });
					}
					pending.set(false);
				}
			}

			onSubmit?.(event);
		},
		onResult(event) {
			if (event.result.type !== "redirect") pending.set(false);
			if (["success", "redirect"].includes(event.result.type)) {
				onSuccessResult(get(superform.form));
			}
			onResult?.(event);
		}
	});
	return {
		...superform,
		pending
	};
}

type ArgumentsType<T> = T extends (...args: infer U) => unknown ? U : never;
type IntDateProxyOptions = Omit<NonNullable<ArgumentsType<typeof dateProxy>[2]>, "format">;

export function dateToDV(date: Date | null | undefined) {
	if (!date) return undefined;
	return toCalendarDateTime(parseAbsoluteToLocal(date.toISOString()));
}

export function intDateProxy<T extends Record<string, unknown>, Path extends FormPathLeaves<T, Date>>(
	form: Writable<T> | SuperForm<T>,
	path: Path,
	options?: IntDateProxyOptions
): Writable<DateValue | undefined> {
	function toValue(value?: DateValue) {
		if (!value) return options?.empty === "null" ? null : undefined;
		return value.toDate(getLocalTimeZone());
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const realProxy = fieldProxy<T, any, Date | null | undefined>(form, path, { taint: options?.taint });

	let updatedValue: DateValue | undefined = undefined;
	const proxy: Readable<DateValue | undefined> = derived(realProxy, (value: unknown) => {
		// Prevent proxy updating itself
		if (updatedValue !== undefined) {
			const current = updatedValue;
			updatedValue = undefined;
			return current;
		}

		if (value instanceof Date) return dateToDV(value);

		return undefined;
	});

	return {
		subscribe: proxy.subscribe,
		set(val: DateValue | undefined) {
			updatedValue = val;
			realProxy.set(toValue(updatedValue));
		},
		update(updater) {
			realProxy.update((f) => {
				updatedValue = updater(dateToDV(f));
				return toValue(updatedValue);
			});
		}
	};
}

type WordToken = { type: "word"; value: string };
type PhraseToken = { type: "phrase"; value: string };
type Token = WordToken | PhraseToken;

class BaseSearchFactory<TData extends Array<unknown>> {
	private EXCLUDED_SEARCH_WORDS = new Set(["and", "or", "to", "in", "a", "an", "the", "of"]);
	private DEBOUNCE_TIME = 300 as const;
	private MIN_QUERY_LENGTH = 2 as const;
	private SCORE_PRECISION = 10 as const;
	private POSITION_BONUS_MAX = 0.5 as const;
	private WORD_BOUNDARY_BONUS = 0.3 as const;
	protected WHOLE_QUERY_MULTIPLIER = 2 as const;

	protected _tdata = $state([] as unknown as TData);
	protected _query = $state<string>("");
	protected _tokens = $state<Token[]>([]);

	private _matchCache = new Map<string, { matches: Set<string>; score: number }>();

	private _debouncedTokens = debounce((query: string) => {
		this._tokens = this.tokenize(query);
	}, this.DEBOUNCE_TIME);

	constructor(data: TData, defaultQuery: string = "") {
		this._tdata = data;
		this._query = defaultQuery;
		this._tokens = this.tokenize(defaultQuery);
	}

	get query() {
		return this._query;
	}

	set query(query: string) {
		this._query = query;
		this._matchCache.clear();

		if (query.trim().length < this.MIN_QUERY_LENGTH) this._tokens = [];
		else this._debouncedTokens.call(query);
	}

	get tokens() {
		return this._tokens;
	}

	get terms() {
		return this._tokens.map((t) => t.value);
	}

	private tokenCheck(tokenValue: string) {
		return tokenValue.length > 1 && !this.EXCLUDED_SEARCH_WORDS.has(tokenValue);
	}

	private tokenize(query: string) {
		if (query.trim().length < this.MIN_QUERY_LENGTH) return [];

		const tokens: Token[] = [];
		const regex = /"([^"]+)"|(\w+)/g;

		let match: RegExpExecArray | null;
		while ((match = regex.exec(query)) !== null) {
			const [, phrase, word] = match;

			if (word && this.tokenCheck(word)) {
				tokens.push({ type: "word", value: word });
			} else if (phrase && this.tokenCheck(phrase)) {
				tokens.push({ type: "phrase", value: phrase });
			}
		}

		return tokens;
	}

	protected hasMatch(item: string) {
		const cacheKey = `${item}:${this._tokens.map((t) => t.value).join(",")}`;

		if (this._matchCache.has(cacheKey)) {
			return this._matchCache.get(cacheKey)!;
		}

		const itemLower = item.toLowerCase();
		const matches = new Set<string>();

		let score = 0;
		for (const token of this._tokens) {
			let subtotal = 0;

			const oc = substrCount(itemLower, token.value);
			if (!oc) continue;
			subtotal += oc;

			const index = itemLower.indexOf(token.value);
			subtotal += Math.max(0, this.POSITION_BONUS_MAX - (index / itemLower.length) * this.POSITION_BONUS_MAX);

			const escapedTerm = escape(token.value);
			if (new RegExp(`\\b${escapedTerm}\\b`, "i").test(item)) {
				subtotal += this.WORD_BOUNDARY_BONUS;
			}

			if (token.type === "phrase") {
				const phraseMultiplier = (token.value.split(/\s+/).length + 2) / 2;
				subtotal *= phraseMultiplier;
			}

			score += subtotal;
			matches.add(token.value);
		}

		score = Math.round((score / this._tokens.length) * this.SCORE_PRECISION) / this.SCORE_PRECISION;

		const result = { matches, score };
		this._matchCache.set(cacheKey, result);
		return result;
	}

	protected getCharacterIndex(item: FullCharacterData) {
		return {
			id: item.id,
			index: new Map([
				["id", [item.id]],
				["name", [item.name]],
				["race", [item.race || ""]],
				["class", [item.class || ""]],
				["campaign", [item.campaign || ""]],
				["totalLevel", [`L${item.totalLevel}`]],
				["tier", [`T${item.tier}`]],
				["magicItems", item.magicItems.map((mi) => mi.name)],
				["storyAwards", item.storyAwards.map((sa) => sa.name)]
			] as const satisfies [keyof typeof item, string[]][])
		};
	}

	protected getLogIndex(item: FullLogData | LogSummaryData | UserLogData) {
		return {
			id: item.id,
			index: new Map([
				["id", [item.id]],
				["name", [item.name]],
				["character", [item.character?.name || ""]],
				["dm", [item.dm?.name || ""]],
				["magicItemsGained", item.magicItemsGained.map((mi) => mi.name)],
				["storyAwardsGained", item.storyAwardsGained.map((sa) => sa.name)]
			] as const satisfies [keyof typeof item, string[]][])
		};
	}

	protected getDMIndex(item: UserDM) {
		return {
			id: item.id,
			index: new Map([
				["id", [item.id]],
				["name", [item.name]],
				["DCI", [item.DCI || ""]]
			] as const satisfies [keyof typeof item, string[]][])
		};
	}
}

type MapIndexKeys<F> = F extends (...args: infer _A) => { index: Map<infer K, infer V> } ? MapKeys<Map<K, V>> : never;
type CharacterIndexKeys = MapIndexKeys<BaseSearchFactory<unknown[]>["getCharacterIndex"]>;
type LogIndexKeys = MapIndexKeys<BaseSearchFactory<unknown[]>["getLogIndex"]>;
type DMIndexKeys = MapIndexKeys<BaseSearchFactory<unknown[]>["getDMIndex"]>;

type ExpandedSearchData<TData extends SearchData[number]> = TData extends {
	title: infer Title;
	items: Array<infer Item>;
}
	? {
			title: Title;
			items: Prettify<
				Item & {
					score: number;
					match: Set<
						Title extends "Sections"
							? never
							: Title extends "Characters"
								? CharacterIndexKeys
								: Title extends "Logs"
									? LogIndexKeys
									: DMIndexKeys
					>;
				}
			>[];
			count: number;
		}
	: never;

export class GlobalSearchFactory extends BaseSearchFactory<SearchData> {
	private MAX_RESULTS_PER_CATEGORY = 50 as const;
	private MAX_RESULTS_WITHOUT_CATEGORY = 5 as const;
	private MAX_RESULTS_WITH_CATEGORY = 10 as const;

	private _category = $state<SearchData[number]["title"] | null>(null);
	private _indexMap = new SvelteMap(
		this._tdata.map((entry) => {
			return [
				entry.title,
				new SvelteMap(
					entry.items
						.map((item) => {
							if (item.type === "character") {
								return this.getCharacterIndex(item);
							} else if (item.type === "dm") {
								return this.getDMIndex(item);
							} else if (item.type === "log") {
								return this.getLogIndex(item);
							}
						})
						.filter(isDefined)
						.map((item) => [item.id, item.index])
				)
			];
		})
	);

	constructor(data: SearchData, defaultQuery: string = "") {
		super(data, defaultQuery);
	}

	get category() {
		return this._category;
	}

	set category(category: SearchData[number]["title"] | null) {
		this._category = category;
	}

	get results() {
		return this._tdata
			.map((entry) => {
				type TDataKeys = typeof entry.title extends "Sections"
					? never
					: typeof entry.title extends "Characters"
						? CharacterIndexKeys
						: typeof entry.title extends "Logs"
							? LogIndexKeys
							: DMIndexKeys;

				if (this._category && entry.title !== this._category) return { title: entry.title, items: [], count: 0 };

				if (!this._tokens.length) {
					const items = entry.items.slice(0, this._category ? this.MAX_RESULTS_WITH_CATEGORY : this.MAX_RESULTS_WITHOUT_CATEGORY);
					return {
						title: entry.title,
						items: items.map((item) => ({ ...item, score: 0, match: new Set() })),
						count: items.length
					} as ExpandedSearchData<SearchData[number]>;
				}

				const index = this._indexMap.get(entry.title);
				if (!index) return { title: entry.title, items: [], count: 0 };

				const filteredItems = entry.items
					.map((item) => {
						if (item.type === "section") return null;

						const itemIndex = index.get(item.id) as Map<TDataKeys, string[]>;
						if (!itemIndex) return null;

						let totalScore = 0;
						const matches = new Set<string>();
						const matchTypes = new Set<TDataKeys>();

						for (const [key, values] of itemIndex) {
							for (const value of values) {
								const matchResult = this.hasMatch(value);
								if (matchResult.matches.size) {
									totalScore += matchResult.score;
									matchResult.matches.forEach((match) => matches.add(match));
									matchTypes.add(key);
								}
							}
						}

						if (matches.size === 0) return null;
						if (matches.size === this._tokens.length) totalScore *= this.WHOLE_QUERY_MULTIPLIER;

						return { ...item, score: totalScore, match: matchTypes };
					})
					.filter(isDefined);

				return {
					title: entry.title,
					items: filteredItems.toSorted((a, b) => b.score - a.score).slice(0, this.MAX_RESULTS_PER_CATEGORY),
					count: filteredItems.length
				} as ExpandedSearchData<SearchData[number]>;
			})
			.map((entry, i, entries) => {
				const previousEntries = entries.slice(0, i);
				const previousEntriesCount = previousEntries.reduce((sum, e) => {
					return sum + e.count;
				}, 0);

				return {
					...entry,
					previousCount: previousEntriesCount
				};
			});
	}
}

export class EntitySearchFactory<
	TData extends FullCharacterData[] | FullLogData[] | LogSummaryData[] | UserDM[]
> extends BaseSearchFactory<TData> {
	private _indexMap = new SvelteMap(
		this._tdata
			.map((entry) => {
				if ("class" in entry) {
					return this.getCharacterIndex(entry);
				} else if ("isUser" in entry) {
					return this.getDMIndex(entry);
				} else {
					return this.getLogIndex(entry);
				}
			})
			.map((entry) => [entry.id, entry.index])
	);

	constructor(data: TData, defaultQuery: string = "") {
		super(data, defaultQuery);
	}

	get results() {
		type TDataKeys = TData extends FullCharacterData[]
			? CharacterIndexKeys
			: TData extends FullLogData[] | LogSummaryData[]
				? LogIndexKeys
				: DMIndexKeys;

		return this._tdata
			.map((entry: TData[number]) => {
				if (!this._tokens.length) {
					return {
						...entry,
						score: 0,
						match: new Set<TDataKeys>()
					};
				}

				let totalScore = 0;

				const index = this._indexMap.get(entry.id) as Map<TDataKeys, string[]>;
				if (!index) return null;

				const matches = new Set<string>();
				const matchTypes = new Set<TDataKeys>();

				for (const [key, values] of index) {
					for (const value of values) {
						const matchResult = this.hasMatch(value);
						if (matchResult.matches.size) {
							totalScore += matchResult.score;
							matchResult.matches.forEach((match) => matches.add(match));
							matchTypes.add(key);
						}
					}
				}

				if (matches.size === 0) return null;
				if (matches.size === this._tokens.length) totalScore *= this.WHOLE_QUERY_MULTIPLIER;

				return {
					...entry,
					score: totalScore,
					match: matchTypes
				};
			})
			.filter(isDefined);
	}
}
