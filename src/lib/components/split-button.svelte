<script lang="ts" generics="T extends PathnameWithSearchOrHash | RouteIdWithSearchOrHash">
	import { hotkey, resolveRoute, type Route, type RouteArgs } from "#lib/util.js";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import type { PathnameWithSearchOrHash, RouteIdWithSearchOrHash } from "$app/types";
	import Link from "./link.svelte";

	type Args = Parameters<typeof resolve<T>>;
	type Params = Args extends [route: unknown, params: infer P] ? P : undefined;

	/**
	 * Distributes over every route so each option's `params` is checked against its own `href`.
	 * Route IDs with dynamic segments require `params`; pathnames take none.
	 */
	type Option<R extends Route = Route> = R extends Route
		? { href: R; label: string } & (RouteArgs<R> extends [route: unknown, params: infer P]
				? { params: P }
				: { params?: undefined })
		: never;

	interface Props {
		href: T;
		params?: Params;
		label: string;
		options: readonly Option[];
		/** Icon-only main button, for the narrow layout. */
		compact?: boolean;
		/** Bind the N shortcut to the main button. */
		shortcut?: boolean;
		class?: string;
	}

	let { href, params, label, options, compact = false, shortcut = false, class: className }: Props = $props();

	const resolved = $derived(resolveRoute(href, params));
</script>

<div class={["relative inline-flex", className]}>
	<Link
		{href}
		{params}
		class={["btn rounded-e-none border-e-0 btn-primary", compact ? "inline-flex" : "btn-sm"]}
		aria-label={label}
		{@attach !compact && shortcut ? hotkey([["n", () => goto(resolved)]]) : () => {}}
	>
		{#if compact}
			<span class="iconify inline size-6 mdi--plus"></span>
		{:else}
			{label}
			{#if shortcut}
				<kbd class="kbd kbd-sm text-base-content max-sm:hover-none:hidden">N</kbd>
			{/if}
		{/if}
	</Link>
	<!-- static so the menu positions against the whole split button, not just the chevron -->
	<div class="dropdown static">
		<button
			type="button"
			tabindex="0"
			class={["btn rounded-s-none border-s-primary-content/25 px-2 btn-primary", compact ? "" : "btn-sm"]}
			aria-label="More new log options"
			aria-haspopup="menu"
		>
			<span class="iconify size-5 mdi--chevron-down"></span>
		</button>
		<ul
			tabindex="-1"
			class={[
				"dropdown-content menu top-full z-30 mt-1 w-max min-w-full rounded-box bg-base-200 p-2 shadow-lg",
				compact ? "inset-e-0" : "inset-s-0"
			]}
		>
			{#each options as option (option.label)}
				<li>
					<a href={resolveRoute(option.href, option.params)}>{option.label}</a>
				</li>
			{/each}
		</ul>
	</div>
</div>
