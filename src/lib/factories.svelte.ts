/* eslint-disable svelte/prefer-svelte-reactivity */
import { beforeNavigate } from "$app/navigation";
import { navigating } from "$app/state";
import type { FullCharacterData } from "$lib/server/effect/services/characters";
import type { UserDM } from "$lib/server/effect/services/dms";
import type { FullLogData, LogSummaryData, UserLogData } from "$lib/server/effect/services/logs";
import { debounce, deepEqual, isDefined, substrCount, type MapKeys, type Prettify } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { RemoteForm, RemoteFormFields, RemoteFormInput, RemoteFormIssue } from "@sveltejs/kit";
import { Duration } from "effect";
import escapeRegex from "regexp.escape";
import { getContext, hasContext, onMount, setContext, tick, untrack } from "svelte";
import { toast } from "svelte-sonner";
import type { HTMLFormAttributes } from "svelte/elements";
import { SvelteMap } from "svelte/reactivity";
import { v7 } from "uuid";
import type { SearchData } from "./remote/command";
import { unknownErrorMessage, type HTMLEvent } from "./util";

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
	errorToast(unknownErrorMessage(error));
}

export function createContext<T>(createDefault?: () => T): [() => T, (context: T) => T] {
	const key = Symbol("context");
	return [
		() => {
			if (hasContext(key)) return getContext(key);
			if (createDefault) return setContext(key, createDefault());
			throw new Error("Context not found");
		},
		(context) => setContext(key, context)
	];
}

export function proxify<T>(object: T) {
	const _ = $state(object);
	return _;
}

export function watch<T>(args: {
	/** Depedencies to track */
	track: () => T;
	/** Effects that run once during SSR */
	ssr?: (value: T) => unknown;
	/** Effects that run once during hydration */
	hydration?: (value: T) => unknown;
	/** Effects that run on dependency change, after hydration */
	effect: (current: T, previous: T) => void | (() => void);
}) {
	args.ssr?.(args.track());
	let hydrated = false;
	let prev = args.track();
	$effect(() => {
		void args.track();
		return untrack(() => {
			if (!hydrated) {
				if (args.hydration) args.hydration(args.track());
				return void (hydrated = true);
			}
			const cleanup = args.effect(args.track(), prev);
			prev = args.track();
			return cleanup;
		});
	});
	return $state.snapshot(args.track());
}

export type GenericFormConfig = ReturnType<typeof configureForm<RemoteFormInput, undefined>>;
export type GenericForm = ReturnType<GenericFormConfig>;

type FormId<Input extends RemoteFormInput> = Input extends { id: infer Id }
	? Id extends string | number
		? Id
		: string | number
	: string | number;

export interface RemoteFormOptions<Input extends RemoteFormInput, Data extends Input | undefined = undefined> extends Omit<
	HTMLFormAttributes,
	"children" | "action" | "method" | "onsubmit"
> {
	form: RemoteForm<Input, unknown>;
	schema?: StandardSchemaV1<Input, unknown>;
	key?: FormId<Input>;
	data?: Data;
	initialErrors?: boolean;
	navBlockMessage?: string;
	onissues?: (ctx: { readonly issues: RemoteFormIssue[] }) => unknown;
	onsubmit?: <T>(ctx: { readonly dirty: boolean; readonly form: HTMLFormElement; readonly data: Input }) => Awaitable<T>;
	onresult?: (ctx: {
		readonly success: boolean;
		readonly result?: RemoteForm<Input, unknown>["result"];
		readonly issues?: RemoteFormIssue[];
		readonly error?: string;
	}) => Awaitable<void>;
	formEl?: HTMLFormElement;
}

export function configureForm<Input extends RemoteFormInput, Data extends Input | undefined = undefined>(
	getProps: () => RemoteFormOptions<Input, Data>
) {
	type Fields = RemoteFormFields<unknown>;

	const {
		form: remoteForm,
		schema,
		data: formData,
		key: formKey,
		initialErrors: initialErrorsProp,
		navBlockMessage,
		onsubmit,
		onresult,
		onissues,
		...rest
	} = $derived(getProps());

	type FormData = Data extends undefined ? Record<string, never> : Data;
	const data = $derived((formData ?? {}) as FormData);
	const key = $derived(formKey ?? ((data.id ?? v7()) as FormId<Input>));
	const form = $derived(schema ? remoteForm.for(key).preflight(schema) : remoteForm.for(key));

	let initial = $state.raw(
		watch({
			track: () => data,
			ssr: (data) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				form.fields.set(data as any);
			},
			effect: (data) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				form.fields.set(data as any);
			}
		})
	);

	let touched = $state.raw(false);
	let submitting = $state.raw(false);
	let submitted = $state.raw(false);
	let dirty = $derived(!deepEqual(initial, $state.snapshot(form.fields.value())));
	const pending = $derived(submitting || !!$effect.pending() || !!navigating.to);

	const attributes = $derived(
		Object.assign(
			form.enhance(async ({ submit, form: formEl, data }) => {
				if (pending) return;

				const bf = !onsubmit || (await onsubmit({ dirty, form: formEl, data }));
				if (!bf) return;

				submitting = true;
				submitted = true;
				const wasDirty = dirty;
				try {
					dirty = false;
					await submit();

					const success = !allIssues;
					onresult?.({ success, result: form.result, issues: allIssues });

					if (!success) {
						dirty = wasDirty;
						await focusInvalid();
						onissues?.({ issues: allIssues });
					}
				} catch (error) {
					onresult?.({ success: false, error: unknownErrorMessage(error) });
					dirty = wasDirty;
				} finally {
					submitting = false;
				}
			}),
			{
				...rest,
				onsubmit: focusInvalid,
				oninput: (ev: HTMLEvent<HTMLFormElement>) => {
					const { oninput } = getProps();
					if (lastIssues) debouncedValidate.call();
					oninput?.(ev);
				}
			}
		)
	);

	const result = $derived(form.result);
	const issues = $derived(form.fields.issues());
	const allIssues = $derived((form.fields as Fields).allIssues());
	const initialErrors = $derived(initialErrorsProp ?? !!data?.id);
	let lastIssues = $state.raw<RemoteFormIssue[] | undefined>();

	watch({
		track: () => form,
		hydration: async () => {
			// for some reason, the form incorrectly shows
			// errors during hydration if called immediately
			setTimeout(() => {
				if (initialErrors) validate();
			}, 50);
		},
		effect: (form) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			form.fields.set(data as any);
			initial = $state.snapshot(data);
			touched = false;
			if (initialErrors) validate(true);
		}
	});

	const debouncedValidate = debounce(validate, 300);

	async function validate(reset = false) {
		const { onissues } = getProps();
		await form.validate({ includeUntouched: true, preflightOnly: true });
		if (allIssues && onissues && !deepEqual(lastIssues, allIssues)) onissues({ issues: allIssues });
		if (reset) lastIssues = undefined;
		if (allIssues) lastIssues = allIssues;
	}

	async function focusInvalid() {
		await tick();

		if (allIssues) lastIssues = allIssues;
		else return;

		const el = rest.formEl;
		if (!el) return;

		const invalid = el.querySelector(":is(input, select, textarea):not(.hidden, [type=hidden], :disabled)[aria-invalid]") as
			| HTMLInputElement
			| HTMLSelectElement
			| HTMLTextAreaElement
			| null;
		invalid?.focus();
	}

	onMount(() => {
		const handleFocusIn = () => void (touched = true);
		rest.formEl?.addEventListener("focusin", handleFocusIn);
		return () => {
			rest.formEl?.removeEventListener("focusin", handleFocusIn);
		};
	});

	beforeNavigate((ev) => {
		if ((dirty || issues) && navBlockMessage && !confirm(navBlockMessage)) ev.cancel();
	});

	return () => ({
		form,
		attributes,
		initial,
		touched,
		dirty,
		submitting,
		submitted,
		pending,
		result,
		issues,
		allIssues,
		validate,
		debouncedValidate,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		reset: () => form.fields.set(initial as any)
	});
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

	protected _tdata = $state.raw([] as unknown as TData);
	protected _query = $state.raw<string>("");
	protected _tokens = $state.raw<Token[]>([]);

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
		const regex = /"([^"]+)"|([\w-]+)/g;

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
			const tokenLower = token.value.toLowerCase();

			const oc = substrCount(itemLower, tokenLower);
			if (!oc) continue;
			subtotal += oc;

			const index = itemLower.indexOf(tokenLower);
			subtotal += Math.max(0, this.POSITION_BONUS_MAX - (index / itemLower.length) * this.POSITION_BONUS_MAX);

			const escapedTerm = escapeRegex(token.value);
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

		if (matches.size === this._tokens.length) score *= this.WHOLE_QUERY_MULTIPLIER;

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
				const matchedTokens = new Set<string>();
				const matchTypes = new Set<TDataKeys>();

				for (const [key, values] of index) {
					for (const value of values) {
						const matchResult = this.hasMatch(value);
						if (matchResult.matches.size) {
							totalScore += matchResult.score;
							matches.add(value);
							matchResult.matches.forEach((match) => matchedTokens.add(match));
							matchTypes.add(key);
						}
					}
				}

				if (matches.size === 1 && matchedTokens.size !== this._tokens.length) {
					totalScore *= 0;
					matches.clear();
				}
				if (matches.size === 0) return null;
				if (matchedTokens.size === this._tokens.length) totalScore *= this.WHOLE_QUERY_MULTIPLIER;

				return {
					...entry,
					score: totalScore,
					match: matchTypes
				};
			})
			.filter(isDefined);
	}
}

export function swipeAction(actions: { left?: () => Promise<void>; right?: () => Promise<void> }) {
	return (container: HTMLDivElement) => {
		const buttonWidth = 90;
		const hasLeftButton = container.querySelector(".action.left") !== null;
		const checkScroll = async (threshold: number) => {
			const scrollLeft = container.scrollLeft - (hasLeftButton ? buttonWidth : 0);
			if (0 - scrollLeft >= threshold) {
				// Only fire once per open
				if (!container.dataset.open) {
					container.dataset.open = "true";
					container.scrollLeft = 0;
					await actions.left?.();
				}
			} else if (scrollLeft >= threshold) {
				// Only fire once per open
				if (!container.dataset.open) {
					container.dataset.open = "true";
					container.scrollLeft = 0;
					await actions.right?.();
				}
			} else {
				container.dataset.open = "";
			}
		};

		const scrollListener = () => checkScroll(buttonWidth);
		const touchendListener = () => checkScroll((buttonWidth * 2) / 3);

		// Listen to scroll and touchend
		container.addEventListener("scroll", scrollListener);
		container.addEventListener("touchend", touchendListener);

		// Cleanup
		return () => {
			container.removeEventListener("scroll", scrollListener);
			container.removeEventListener("touchend", touchendListener);
		};
	};
}
