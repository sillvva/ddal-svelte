import type { FullCharacterData } from "$server/data/characters";
import type { UserDMsWithLogs } from "$server/data/dms";
import type { FullLogData, LogSummaryData } from "$server/data/logs";
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
import { excludedSearchWords } from "./constants";
import { isDefined } from "./util";

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

type SearchCounts = {
	count: number;
	previousCount: number;
};
type SearchScore = {
	score: number;
	match: string[];
};

export function createTerms(query: string) {
	return (
		query
			.trim()
			.toLowerCase()
			.match(/(?:[^\s"]+|"[^"]*")+/g)
			?.map((word) => word.replace(/^"|"$/g, ""))
			.filter((word) => word.length > 1 && !excludedSearchWords.has(word)) || []
	);
}
export class SearchFactory<TData extends SearchData | FullCharacterData[] | FullLogData[] | LogSummaryData[] | UserDMsWithLogs> {
	private _tdata = $state<TData>([] as unknown as TData);
	private _query = $state<string>("");
	private _category = $state<TData extends SearchData ? SearchData[number]["title"] | null : null>(null);
	private _terms = $derived(createTerms(this._query));
	private _globalSearches = $derived(
		this._tdata
			.filter((entry) => "items" in entry)
			.map((entry) => {
				return {
					title: entry.title,
					items: entry.items.map((item) => {
						return (() => {
							if (item.type === "character") {
								const searches: [keyof typeof item, string][] = [
									["name", item.name],
									["race", item.race || ""],
									["class", item.class || ""],
									["campaign", item.campaign || ""],
									["totalLevel", `L${item.totalLevel}`],
									["tier", `T${item.tier}`]
								];
								item.magicItems.forEach((mi) => {
									searches.push(["magicItems", mi.name]);
								});
								item.storyAwards.forEach((sa) => {
									searches.push(["storyAwards", sa.name]);
								});
								return { id: item.id, searches };
							} else if (item.type === "log") {
								const searches: [keyof typeof item, string][] = [
									["name", item.name],
									["character", item.character?.name || ""],
									["dm", item.dm?.name || ""]
								];
								item.magicItemsGained.forEach((mi) => {
									searches.push(["magicItemsGained", mi.name]);
								});
								item.storyAwardsGained.forEach((sa) => {
									searches.push(["storyAwardsGained", sa.name]);
								});
								return { id: item.id, searches };
							}
							if (item.type === "dm") {
								const searches: [keyof typeof item, string][] = [["name", item.name]];
								return { id: item.id, searches };
							}
							return { id: "", searches: [] };
						})();
					})
				};
			})
	);
	private _entitySearches = $derived(
		this._tdata
			.map((entry) => {
				if ("items" in entry) return undefined;

				return (() => {
					if ("class" in entry) {
						const searches: [keyof typeof entry, string][] = [
							["name", entry.name],
							["race", entry.race || ""],
							["class", entry.class || ""],
							["campaign", entry.campaign || ""],
							["totalLevel", `L${entry.totalLevel}`],
							["tier", `T${entry.tier}`]
						];
						entry.magicItems.forEach((mi) => {
							searches.push(["magicItems", mi.name]);
						});
						entry.storyAwards.forEach((sa) => {
							searches.push(["storyAwards", sa.name]);
						});
						return {
							id: entry.id,
							searches
						};
					}

					if ("DCI" in entry) {
						const searches: [keyof typeof entry, string][] = [
							["name", entry.name],
							["DCI", entry.DCI || ""]
						];
						return {
							id: entry.id,
							searches
						};
					}

					const searches: [keyof typeof entry, string][] = [
						["name", entry.name],
						["character", entry.character?.name || ""],
						["dm", entry.dm?.name || ""],
						["magicItemsGained", entry.magicItemsGained.map((mi) => mi.name).join(" ")],
						["storyAwardsGained", entry.storyAwardsGained.map((sa) => sa.name).join(" ")]
					];
					return {
						id: entry.id,
						searches
					};
				})();
			})
			.filter(isDefined)
	);

	constructor(data: TData) {
		this._tdata = data;
	}

	get category() {
		return this._category;
	}

	set category(category: TData extends SearchData ? SearchData[number]["title"] | null : null) {
		this._category = category;
	}

	get query() {
		return this._query;
	}

	set query(query: string) {
		this._query = query;
	}

	get terms() {
		return this._terms;
	}

	hasMatch(item: string) {
		const matches = this._terms.filter((word) => item.toLowerCase().includes(word));
		if (!matches.length) return { matches: [], score: 0 };

		// Calculate a simple match score based on:
		// - Number of matched terms
		// - Position of matches (earlier = better)
		// - Exact word matches vs partial matches
		const itemLower = item.toLowerCase();
		let score = 0;

		for (const term of matches) {
			// Count occurrences of the term in the item
			score += 1;
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

	get results() {
		return this._tdata
			.map((entry) => {
				if ("items" in entry) {
					if (this._category && entry.title !== this._category) return { title: entry.title, items: [], count: 0 };

					// Skip filtering if query is too short
					if (this._query.length < 2) {
						const items = entry.items.slice(0, this._category ? 10 : 5);
						return {
							title: entry.title,
							items: items.map((item) => ({ ...item, score: 0 })),
							count: items.length
						};
					}

					const searches = this._globalSearches.find((searches) => searches.title === entry.title);
					if (!searches) return { title: entry.title, items: [], count: 0 };

					// Build search strings once per item
					const filteredItems = entry.items
						.map((item) => {
							if (item.type === "section") return null;

							let totalScore = 0;
							const matches = new Set<string>();
							const matchTypes = new Set<string>();

							const itemSearches = searches.items.find((search) => search.id === item.id)?.searches;
							if (!itemSearches) return null;

							for (const [key, value] of itemSearches) {
								const matchResult = this.hasMatch(value);
								if (matchResult.matches.length) {
									totalScore += matchResult.score;
									matchResult.matches.forEach((match) => matches.add(match));
									matchTypes.add(key);
								}
							}

							if (matches.size !== this.terms.length) return null;
							return { ...item, score: totalScore, match: Array.from(matchTypes) };
						})
						.filter((item) => item !== null)
						.sort((a, b) => b.score - a.score)
						.slice(0, 50);

					return { title: entry.title, items: filteredItems, count: filteredItems.length };
				}

				let totalScore = 0;
				const matches = new Set<string>();
				const matchTypes = new Set<string>();

				const searches = this._entitySearches.find((searches) => searches.id === entry.id)?.searches;
				if (!searches) return null;

				for (const [key, value] of searches) {
					const matchResult = this.hasMatch(value);
					if (matchResult.matches.length) {
						totalScore += matchResult.score;
						matchResult.matches.forEach((match) => matches.add(match));
						matchTypes.add(key);
					}
				}

				if (matches.size !== this.terms.length) return null;

				return {
					...entry,
					items: [],
					count: 1,
					previousCount: 0,
					score: totalScore,
					match: Array.from(matchTypes)
				};
			})
			.filter(isDefined)
			.map((entry, i, entries) => {
				const previousEntries = entries.slice(0, i);
				const previousEntriesCount = previousEntries.reduce((sum, e) => {
					return sum + e.count;
				}, 0);

				return {
					...entry,
					previousCount: previousEntriesCount
				};
			}) as TData extends SearchData
			? Array<TData[number] & { items: Array<SearchData[number]["items"][number] & SearchScore> } & SearchCounts>
			: Array<TData[number] & SearchCounts & SearchScore>;
	}
}
