import type { FullCharacterData } from "$server/data/characters";
import type { UserDMs, UserDMsWithLogs } from "$server/data/dms";
import type { FullLogData, LogSummaryData, UserLogData } from "$server/data/logs";
import type { SearchData } from "$src/routes/(api)/command/+server";
import { parseDateTime, type DateValue } from "@internationalized/date";
import { debounce, isDefined, substrCount, type MapKeys, type Prettify } from "@sillvva/utils";
import { toast } from "svelte-sonner";
import { derived, get, type Readable, type Writable } from "svelte/store";
import {
	dateProxy,
	fieldProxy,
	superForm,
	type FormOptions,
	type FormPathLeaves,
	type FormPathType,
	type SuperForm,
	type SuperValidated
} from "sveltekit-superforms";
import { valibotClient } from "sveltekit-superforms/adapters";
import * as v from "valibot";

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
		duration: 30000
	});
}

interface CustomFormOptions<S extends v.ObjectSchema<any, any>> {
	nameField?: FormPathLeaves<v.InferOutput<S>, string>;
}

export function valibotForm<S extends v.ObjectSchema<any, any>, Out extends v.InferOutput<S>, In extends v.InferInput<S>>(
	form: SuperValidated<Out, App.Superforms.Message, In>,
	schema: S,
	options?: FormOptions<Out, App.Superforms.Message, In> & CustomFormOptions<S>
) {
	const { nameField = "name", ...rest } = options || {};
	const superform = superForm(form, {
		dataType: "json",
		validators: valibotClient(schema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?",
		...rest,
		onResult(event) {
			if (["success", "redirect"].includes(event.result.type)) {
				const data = get(superform.form);
				successToast(`${data[nameField]} saved`);
			}
			rest.onResult?.(event);
		},
		onError(event) {
			errorToast(event.result.error.message);
			if (rest.onError instanceof Function) rest.onError?.(event);
		}
	});
	return superform;
}

type ArgumentsType<T> = T extends (...args: infer U) => unknown ? U : never;
type IntDateProxyOptions = Omit<NonNullable<ArgumentsType<typeof dateProxy>[2]>, "format">;

export function dateToDV(date: Date) {
	return parseDateTime(
		date
			.toLocaleDateString("sv", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			})
			.replace(" ", "T")
	);
}

export function intDateProxy<T extends Record<string, unknown>, Path extends FormPathLeaves<T, Date>>(
	form: Writable<T> | SuperForm<T>,
	path: Path,
	options?: IntDateProxyOptions
): Writable<DateValue | undefined> {
	function toValue(value?: DateValue) {
		if (!value && options?.empty !== undefined) {
			return options.empty === "null" ? null : undefined;
		}

		return value && new Date(value.toString());
	}

	const realProxy = fieldProxy(form, path, { taint: options?.taint });

	let updatedValue: DateValue | undefined = undefined;
	let initialized = false;

	const proxy: Readable<DateValue | undefined> = derived(realProxy, (value: unknown) => {
		if (!initialized) {
			initialized = true;
		}

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
			const newValue = toValue(updatedValue) as FormPathType<T, Path>;
			realProxy.set(newValue);
		},
		update(updater) {
			realProxy.update((f) => {
				updatedValue = updater(dateToDV(f as Date));
				const newValue = toValue(updatedValue) as FormPathType<T, Path>;
				return newValue;
			});
		}
	};
}

class BaseSearchFactory<TData extends Array<unknown>> {
	private EXCLUDED_SEARCH_WORDS = new Set(["and", "or", "to", "in", "a", "an", "the", "of"]);
	private POSITION_BONUS_MAX = 0.5 as const;
	private WORD_BOUNDARY_BONUS = 0.3 as const;
	private SCORE_PRECISION = 10 as const;
	private MIN_QUERY_LENGTH = 2 as const;
	private DEBOUNCE_TIME = 300 as const;

	protected _tdata = $state([] as unknown as TData);
	protected _query = $state<string>("");
	protected _terms = $state<string[]>([]);

	private _debouncedTerms = debounce((query: string) => {
		this._terms = this.createTerms(query);
	}, this.DEBOUNCE_TIME);

	constructor(data: TData, defaultQuery: string = "") {
		this._tdata = data;
		this._query = defaultQuery;
		this._terms = this.createTerms(defaultQuery);
	}

	get query() {
		return this._query;
	}

	set query(query: string) {
		this._query = query;

		if (query.trim().length < this.MIN_QUERY_LENGTH) this._terms = [];
		else this._debouncedTerms.call(query);
	}

	get terms() {
		return this._terms;
	}

	private createTerms(query: string) {
		if (query.trim().length < this.MIN_QUERY_LENGTH) return [];

		return (
			query
				.trim()
				.toLowerCase()
				.match(/(?:[^\s"]+|"[^"]*")+/g)
				?.map((word) => word.replace(/^"|"$/g, ""))
				.filter((word) => word.length > 1 && !this.EXCLUDED_SEARCH_WORDS.has(word)) || []
		);
	}

	protected hasMatch(item: string) {
		const itemLower = item.toLowerCase();
		const matches = new Set<string>();

		let score = 0;
		for (const term of this._terms) {
			const oc = substrCount(itemLower, term);
			if (!oc) continue;
			score += oc;

			const index = itemLower.indexOf(term);
			score += Math.max(0, this.POSITION_BONUS_MAX - (index / itemLower.length) * this.POSITION_BONUS_MAX);

			const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			if (new RegExp(`\\b${escapedTerm}\\b`, "i").test(item)) {
				score += this.WORD_BOUNDARY_BONUS;
			}

			matches.add(term);
		}

		score = Math.round((score / this._terms.length) * this.SCORE_PRECISION) / this.SCORE_PRECISION;

		return { matches, score };
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

	protected getDMIndex(item: (UserDMsWithLogs | UserDMs)[number]) {
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

type MapIndexKeys<T extends (...args: any) => any> = MapKeys<ReturnType<T>["index"]>;
type CharacterIndexKeys = MapIndexKeys<BaseSearchFactory<any>["getCharacterIndex"]>;
type LogIndexKeys = MapIndexKeys<BaseSearchFactory<any>["getLogIndex"]>;
type DMIndexKeys = MapIndexKeys<BaseSearchFactory<any>["getDMIndex"]>;

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
	private _searchMap = $derived(
		new Map(
			this._tdata.map((entry) => {
				return [
					entry.title,
					new Map(
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
		)
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

				if (!this._terms.length) {
					const items = entry.items.slice(0, this._category ? this.MAX_RESULTS_WITH_CATEGORY : this.MAX_RESULTS_WITHOUT_CATEGORY);
					return {
						title: entry.title,
						items: items.map((item) => ({ ...item, score: 0, match: new Set() })),
						count: items.length
					} as ExpandedSearchData<SearchData[number]>;
				}

				const index = this._searchMap.get(entry.title);
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

						if (matches.size !== this._terms.length) return null;
						return { ...item, score: totalScore, match: matchTypes };
					})
					.filter(isDefined);

				return {
					title: entry.title,
					items: filteredItems.sort((a, b) => b.score - a.score).slice(0, this.MAX_RESULTS_PER_CATEGORY),
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
	TData extends FullCharacterData[] | FullLogData[] | LogSummaryData[] | UserDMsWithLogs
> extends BaseSearchFactory<TData> {
	private _searchMap = $derived(
		new Map(
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
		)
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
				if (!this._terms.length) {
					return {
						...entry,
						score: 0,
						match: new Set<TDataKeys>()
					};
				}

				let totalScore = 0;

				const index = this._searchMap.get(entry.id) as Map<TDataKeys, string[]>;
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

				if (matches.size !== this._terms.length) return null;

				return {
					...entry,
					score: totalScore,
					match: matchTypes
				};
			})
			.filter(isDefined);
	}
}
