import type { FullCharacterData } from "#lib/server/effect/services/characters.js";
import type { UserDM } from "#lib/server/effect/services/dms.js";
import type { FullLogData, LogSummaryData, UserLogData } from "#lib/server/effect/services/logs.js";
import { beforeNavigate } from "$app/navigation";
import type { RemoteForm, RemoteFormInput, RemoteFormIssue } from "$app/server";
import { debounce, deepEqual, isDefined, type MapKeys, type Prettify } from "@sillvva/utils";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Duration } from "effect";
import { getContext, hasContext, onMount, setContext, tick, untrack } from "svelte";
import { toast } from "svelte-sonner";
import { SvelteMap } from "svelte/reactivity";
import { v7 } from "uuid";
import type { SearchData } from "./remote/command";
import {
	buildLogSearchIndex,
	matchIndexedEntity,
	scoreSearchMatch,
	tokenizeSearchQuery,
	WHOLE_QUERY_MULTIPLIER,
	type MatchResult,
	type SearchToken
} from "./search";
import { unknownErrorMessage } from "./util";

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

export function createContext<T>(createDefault?: () => T): [() => T, (context: T) => T, () => boolean] {
	const key = Symbol("context");
	return [
		() => {
			if (hasContext(key)) return getContext(key);
			if (createDefault) return setContext(key, createDefault());
			throw new Error("Context not found");
		},
		(context) => setContext(key, context),
		() => hasContext(key)
	];
}

export function proxify<T>(object: T) {
	const _ = $state(object);
	return _;
}

export type GenericFormConfig<T extends RemoteFormInput = RemoteFormInput> = ReturnType<typeof configureForm<T>>;
export type GenericForm<T extends RemoteFormInput = RemoteFormInput> = ReturnType<GenericFormConfig<T>>;

function isEmptyInput(value: unknown): boolean {
	return value == null || typeof value !== "object" || Object.keys(value).length === 0;
}

/**
 * `enhance()` returns the Kit instance. Copy its enumerable attributes (and the
 * attachment symbol, which object spread drops) onto a new object so `onsubmit`
 * / `onchange` are not written onto that instance.
 */
function formElementAttributes<T extends object, H extends object>(enhanced: T, handlers: H): T & H {
	const attributes = { ...enhanced, ...handlers };
	const source = enhanced as Record<symbol, unknown>;
	const target = attributes as Record<symbol, unknown>;
	for (const symbol of Object.getOwnPropertySymbols(enhanced)) {
		Object.defineProperty(target, symbol, {
			configurable: true,
			enumerable: true,
			writable: true,
			value: source[symbol]
		});
	}
	return attributes as T & H;
}

type FormId<Input> = Input extends { id: infer Id } ? (Id extends string | number ? Id : string | number) : string | number;

export interface RemoteFormOptions<Input extends RemoteFormInput = RemoteFormInput> {
	form: RemoteForm<Input, unknown>;
	schema?: StandardSchemaV1<Input, unknown>;
	preflight?: boolean;
	key?: FormId<Input>;
	data?: Input;
	initialErrors?: boolean;
	navBlockMessage?: string | null;
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

export function configureForm<Input extends RemoteFormInput = RemoteFormInput>(getProps: () => RemoteFormOptions<Input>) {
	const {
		form: remoteForm,
		schema,
		preflight = false,
		data: formData,
		key: formKey,
		initialErrors: initialErrorsProp,
		navBlockMessage,
		onsubmit,
		onresult,
		onissues,
		formEl
	} = $derived(getProps());

	type FormData = Input extends undefined ? Record<string, never> : Input;
	const data = $derived((formData ?? {}) as FormData);
	// A new uuid on every key re-evaluation would be a new `.for()` instance. Keep one fallback.
	const fallbackKey = v7() as FormId<Input>;
	const key = $derived((formKey ?? data.id ?? fallbackKey) as FormId<Input>);

	const form = $derived(schema && preflight ? remoteForm.for(key).preflight(schema) : remoteForm.for(key));

	const firstSnapshot = untrack(() => $state.snapshot(data));
	let initial = $state.raw(firstSnapshot);
	// Kit registers `.for(key)` in an `$effect.pre`. A preload fork can commit a different
	// instance whose input is still `{}`. Remember which instance we seeded and fill any empty one.
	let seededForm = untrack(() => {
		form.fields.set(data);
		return form;
	});
	let lastDataSnapshot = firstSnapshot;
	let validatedFor: typeof form | undefined;

	let touched = $state.raw(false);
	let submitting = $state.raw(false);
	let submitted = $state.raw(false);
	let dirty = $derived(!deepEqual(initial, $state.snapshot(form.fields.value())));

	const attributes = $derived(
		formElementAttributes(
			form.enhance(async (submittedForm) => {
				if (submitting) return;
				const formEl = submittedForm.element;
				const data = submittedForm.fields.value();

				const bf = !onsubmit || (await onsubmit({ dirty, form: formEl, data }));
				if (!bf) return;

				submitting = true;
				const wasDirty = dirty;
				try {
					dirty = false;
					const success = await submittedForm.submit();
					submitted = true;

					onresult?.({ success, result: submittedForm.result, issues: allIssues });
					if (allIssues) onissues?.({ issues: allIssues });

					if (!success) {
						dirty = wasDirty;
						await focusInvalid();
					}
				} catch (error) {
					onresult?.({ success: false, error: unknownErrorMessage(error) });
					dirty = wasDirty;
				} finally {
					submitting = false;
				}
			}),
			{
				onsubmit: focusInvalid,
				...(preflight
					? {
							oninput: () => {
								if (lastIssues) debouncedValidate.call();
							}
						}
					: {
							onchange: () => {
								if (lastIssues) validate().then(focusInvalid);
							}
						})
			}
		)
	);

	const result = $derived(form.result);
	const issues = $derived(form.fields.issues());
	const allIssues = $derived(form.fields.allIssues());
	const initialErrors = $derived(initialErrorsProp ?? !!data?.id);
	let lastIssues = $state.raw<RemoteFormIssue[] | undefined>();

	$effect.pre(() => {
		const instance = form;
		const next = data;
		const snap = $state.snapshot(next);
		const fieldsNow = instance.fields.value();

		untrack(() => {
			const swapped = instance !== seededForm;
			const emptied = isEmptyInput(fieldsNow) && !isEmptyInput(snap) && !touched && !submitting;
			if (swapped || emptied) {
				instance.fields.set(next);
				initial = snap;
				touched = false;
				seededForm = instance;
				lastDataSnapshot = snap;
				return;
			}

			if (!deepEqual(snap, lastDataSnapshot)) {
				lastDataSnapshot = snap;
				// `fields.value()` is a clone. Skip the write when it already matches the new data
				// so a keystroke on the shared object does not assign over itself.
				if (!deepEqual(fieldsNow, snap)) instance.fields.set(next);
			}
		});
	});

	$effect(() => {
		const instance = form;
		untrack(() => {
			if (!initialErrors || !instance || validatedFor === instance) return;
			validatedFor = instance;
			void validate(true).then(focusInvalid);
		});
	});

	const debouncedValidate = debounce(validate, 300);

	async function validate(reset = false) {
		await form.validate({ all: true, preflightOnly: preflight });
		if (allIssues && onissues && !deepEqual(lastIssues, allIssues)) onissues({ issues: allIssues });
		if (allIssues) lastIssues = allIssues;
		else if (reset) lastIssues = undefined;
	}

	async function focusInvalid() {
		await tick();

		if (allIssues) lastIssues = allIssues;
		else return;

		const invalid = formEl?.querySelector<HTMLElement>(
			":is(input, select, textarea):not(.hidden, [type=hidden], :disabled)[aria-invalid]"
		);
		invalid?.focus();

		if (
			formEl?.querySelector(":is(input, select, textarea):disabled") &&
			allIssues?.some((issue) => issue.message.includes("undefined"))
		) {
			console.warn(
				"Ensure form fields are not disabled when the validation is run.",
				"Disabled fields are treated as undefined values, because they are excluded from the form data."
			);
		}
	}

	onMount(() => {
		const handleFocusIn = () => void (touched = true);
		formEl?.addEventListener("focusin", handleFocusIn);
		return () => {
			formEl?.removeEventListener("focusin", handleFocusIn);
		};
	});

	beforeNavigate((ev) => {
		if (ev.shallow) return;
		if ((dirty || issues) && navBlockMessage && navBlockMessage.length > 0 && !confirm(navBlockMessage)) ev.cancel();
	});

	return () => ({
		form,
		attributes,
		initial,
		touched,
		dirty,
		submitting,
		submitted,
		result,
		issues,
		allIssues,
		validate,
		debouncedValidate,
		reset: () => form.fields.set(initial)
	});
}

class BaseSearchFactory<TData extends Array<unknown>> {
	private DEBOUNCE_TIME = 300 as const;
	private MIN_QUERY_LENGTH = 2 as const;
	protected WHOLE_QUERY_MULTIPLIER = WHOLE_QUERY_MULTIPLIER;

	protected _tdata = $state.raw([] as unknown as TData);
	protected _query = $state.raw<string>("");
	protected _tokens = $state.raw<SearchToken[]>([]);

	protected _matchCache = new Map<string, MatchResult>();

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

	private tokenize(query: string) {
		return tokenizeSearchQuery(query);
	}

	protected hasMatch(item: string) {
		return scoreSearchMatch(item, this._tokens, this._matchCache);
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
		return buildLogSearchIndex(item);
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

				const index = this._indexMap.get(entry.id) as Map<TDataKeys, string[]>;
				if (!index) return null;

				const matched = matchIndexedEntity(index, this._tokens, this._matchCache);
				if (!matched) return null;

				return {
					...entry,
					score: matched.score,
					match: matched.match
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
