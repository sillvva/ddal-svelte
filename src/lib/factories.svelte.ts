import type { FullCharacterData } from "$server/data/characters";
import type { UserDMs, UserDMsWithLogs } from "$server/data/dms";
import type { FullLogData, LogSummaryData, UserLogData } from "$server/data/logs";
import type { SearchData } from "$src/routes/(api)/command/+server";
import { parseDateTime, type DateValue } from "@internationalized/date";
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
import { isDefined, occurrences } from "./util";

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

type SearchScore = {
	score: number;
};

type ExpandedSearchData<TData extends SearchData[number]> = TData extends {
	title: infer Title;
	items: Array<infer Item>;
}
	? {
			title: Title;
			items: (Item &
				SearchScore & {
					match: (Title extends "Sections" ? never : keyof Item)[];
				})[];
		} & { count: number }
	: never;

export function createTerms(query: string) {
	const excludedSearchWords = new Set(["and", "or", "to", "in", "a", "an", "the", "of"]);

	return (
		query
			.trim()
			.toLowerCase()
			.match(/(?:[^\s"]+|"[^"]*")+/g)
			?.map((word) => word.replace(/^"|"$/g, ""))
			.filter((word) => word.length > 1 && !excludedSearchWords.has(word)) || []
	);
}

abstract class BaseSearchFactory<TData> {
	protected _query = $state<string>("");
	protected _terms = $derived(createTerms(this._query));

	get query() {
		return this._query;
	}

	set query(query: string) {
		this._query = query;
	}

	protected hasMatch(item: string) {
		const itemLower = item.toLowerCase();
		const matches = this._terms.filter((word) => itemLower.includes(word));
		if (!matches.length) return { matches: [], score: 0 };

		let score = 0;
		for (const term of matches) {
			// Count occurrences of the term in the item
			score += occurrences(itemLower, term);
			// Bonus for early position (max 0.5 bonus)
			const index = itemLower.indexOf(term);
			score += Math.max(0, 0.5 - (index / itemLower.length) * 0.5);
			// Bonus for exact word boundary matches
			const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, "i");
			if (wordBoundaryRegex.test(item)) {
				score += 0.3;
			}
		}

		// Normalize score by number of terms searched
		score = Math.round((score / this._terms.length) * 10) / 10;

		return { matches, score };
	}

	abstract get results(): any;

	static getCharacterIndex(item: FullCharacterData) {
		return {
			id: item.id,
			index: new Map([
				["id", new Set([item.id])],
				["name", new Set([item.name])],
				["race", new Set([item.race || ""])],
				["class", new Set([item.class || ""])],
				["campaign", new Set([item.campaign || ""])],
				["totalLevel", new Set([`L${item.totalLevel}`])],
				["tier", new Set([`T${item.tier}`])],
				["magicItems", new Set(item.magicItems.map((mi) => mi.name))],
				["storyAwards", new Set(item.storyAwards.map((sa) => sa.name))]
			] as const satisfies [keyof typeof item, Set<string>][])
		};
	}

	static getLogIndex(item: FullLogData | LogSummaryData | UserLogData) {
		return {
			id: item.id,
			index: new Map([
				["id", new Set([item.id])],
				["name", new Set([item.name])],
				["character", new Set([item.character?.name || ""])],
				["dm", new Set([item.dm?.name || ""])],
				["magicItemsGained", new Set(item.magicItemsGained.map((mi) => mi.name))],
				["storyAwardsGained", new Set(item.storyAwardsGained.map((sa) => sa.name))]
			] as const satisfies [keyof typeof item, Set<string>][])
		};
	}

	static getDMIndex(item: (UserDMsWithLogs | UserDMs)[number]) {
		return {
			id: item.id,
			index: new Map([
				["id", new Set([item.id])],
				["name", new Set([item.name])],
				["DCI", new Set([item.DCI || ""])]
			] as const satisfies [keyof typeof item, Set<string>][])
		};
	}
}

export class GlobalSearchFactory extends BaseSearchFactory<SearchData> {
	private _tdata = $state<SearchData>([] as unknown as SearchData);
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
									return BaseSearchFactory.getCharacterIndex(item);
								} else if (item.type === "dm") {
									return BaseSearchFactory.getDMIndex(item);
								} else if (item.type === "log") {
									return BaseSearchFactory.getLogIndex(item);
								}
							})
							.filter(isDefined)
							.map((item) => [item.id, item.index])
					)
				];
			})
		)
	);

	constructor(data: SearchData) {
		super();
		this._tdata = data;
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
				// Skip if category is set and doesn't match
				if (this._category && entry.title !== this._category) return { title: entry.title, items: [], count: 0 };

				// Skip filtering if query is too short
				if (this._query.length < 2) {
					const items = entry.items.slice(0, this._category ? 10 : 5);
					return {
						title: entry.title,
						items: items.map((item) => ({ ...item, score: 0, match: [] })),
						count: items.length
					} as ExpandedSearchData<SearchData[number]>;
				}

				const index = this._searchMap.get(entry.title);
				// Skip if no index found
				if (!index) return { title: entry.title, items: [], count: 0 };

				const filteredItems = entry.items
					.map((item) => {
						if (item.type === "section") return null;

						const itemIndex = index.get(item.id);
						if (!itemIndex) return null;

						let totalScore = 0;
						const keys = Array.from(itemIndex.keys());
						const matches = new Set<string>();
						const matchTypes = new Set<(typeof keys)[number]>();

						for (const [key, values] of itemIndex) {
							for (const value of values) {
								const matchResult = this.hasMatch(value);
								if (matchResult.matches.length) {
									totalScore += matchResult.score;
									matchResult.matches.forEach((match) => matches.add(match));
									matchTypes.add(key);
								}
							}
						}

						if (matches.size !== this._terms.length) return null;
						return { ...item, score: totalScore, match: Array.from(matchTypes) };
					})
					.filter(isDefined);

				return {
					title: entry.title,
					items: filteredItems.sort((a, b) => b.score - a.score).slice(0, 50),
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
	private _tdata = $state<TData>([] as unknown as TData);
	private _searchMap = $derived(
		new Map(
			this._tdata
				.map((entry) => {
					if ("class" in entry) {
						return BaseSearchFactory.getCharacterIndex(entry);
					} else if ("isUser" in entry) {
						return BaseSearchFactory.getDMIndex(entry);
					} else {
						return BaseSearchFactory.getLogIndex(entry);
					}
				})
				.map((entry) => [entry.id, entry.index])
		)
	);

	constructor(data: TData) {
		super();
		this._tdata = data;
	}

	get results(): (TData[number] &
		SearchScore & {
			match: (keyof TData[number])[];
		})[] {
		return this._tdata
			.map((entry) => {
				let totalScore = 0;

				const index = this._searchMap.get(entry.id);
				if (!index) return null;

				const keys = Array.from(index.keys());
				const matches = new Set<string>();
				const matchTypes = new Set<(typeof keys)[number]>();

				for (const [key, values] of index) {
					for (const value of values) {
						const matchResult = this.hasMatch(value);
						if (matchResult.matches.length) {
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
					match: Array.from(matchTypes) as (keyof TData[number])[]
				};
			})
			.filter(isDefined);
	}
}
