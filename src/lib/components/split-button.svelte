<script lang="ts">
	import { hotkey } from "#lib/util.js";
	import { goto } from "$app/navigation";

	interface Option {
		href: string;
		label: string;
	}

	interface Props {
		href: string;
		label: string;
		options: readonly Option[];
		/** Icon-only main button, for the narrow layout. */
		compact?: boolean;
		/** Bind the N shortcut to the main button. */
		shortcut?: boolean;
		class?: string;
	}

	let { href, label, options, compact = false, shortcut = false, class: className }: Props = $props();
</script>

<div class={["relative inline-flex", className]}>
	<a
		{href}
		class={["btn rounded-e-none border-e-0 btn-primary", compact ? "inline-flex" : "btn-sm"]}
		aria-label={label}
		{@attach !compact && shortcut ? hotkey([["n", () => goto(href)]]) : () => {}}
	>
		{#if compact}
			<span class="iconify inline size-6 mdi--plus"></span>
		{:else}
			{label}
			{#if shortcut}
				<kbd class="kbd kbd-sm text-base-content max-sm:hover-none:hidden">N</kbd>
			{/if}
		{/if}
	</a>
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
				"menu dropdown-content top-full z-30 mt-1 w-max min-w-full rounded-box bg-base-200 p-2 shadow-lg",
				compact ? "inset-e-0" : "inset-s-0"
			]}
		>
			{#each options as option (option.href)}
				<li>
					<a href={option.href}>{option.label}</a>
				</li>
			{/each}
		</ul>
	</div>
</div>
