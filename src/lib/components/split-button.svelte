<script lang="ts" generics="T extends Route">
	import { hotkey } from "#lib/attachments.js";
	import { resolveRoute, type Route, type RouteParamsProp, type SplitButtonOption } from "#lib/util.js";
	import { goto } from "$app/navigation";
	import Link from "./link.svelte";

	type Props = {
		href: T;
		label: string;
		options: readonly SplitButtonOption[];
		/** Icon-only main button, for the narrow layout. */
		compact?: boolean;
		/** Bind the N shortcut to the main button. */
		shortcut?: boolean;
		class?: string;
	} & RouteParamsProp<T>;

	let { href, params, label, options, compact = false, shortcut = false, class: className }: Props = $props();

	const resolved = $derived(resolveRoute(href, params));
	// Destructuring widens `params` to `unknown`; `Props` already guarantees it matches `href`.
	const paramsProp = $derived({ params } as unknown as RouteParamsProp<T>);
</script>

<div class={["relative inline-flex", className]}>
	<Link
		{href}
		{...paramsProp}
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
