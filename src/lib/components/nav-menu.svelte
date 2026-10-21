<script lang="ts">
	import type { Crumb } from "#lib/util.js";
	import type { Snippet } from "svelte";
	import Breadcrumbs from "./breadcrumbs.svelte";

	interface Props {
		crumbs: Crumb[];
		base?: boolean;
		hideMenuActions?: boolean;
		actions?: Snippet;
		menu?: Snippet;
	}

	let { crumbs, base, hideMenuActions, actions, menu }: Props = $props();
</script>

<div class={["flex gap-4 print:hidden", base && "max-sm:hidden"]}>
	<Breadcrumbs {crumbs} />
	{#if !hideMenuActions}
		{#if actions}
			{@render actions?.()}
		{/if}
		{#if menu}
			<button
				tabindex="0"
				class="btn touch-hitbox h-9 btn-sm"
				aria-label="Menu"
				popovertarget="nav-menu"
				style:anchor-name="--nav-menu"
			>
				<span class="iconify size-6 mdi--dots-horizontal"></span>
			</button>
			<ul
				role="menu"
				class="menu dropdown dropdown-end dropdown-bottom z-20 w-52 rounded-box bg-base-300 shadow-sm"
				popover
				id="nav-menu"
				style:position-anchor="--nav-menu"
			>
				{@render menu?.()}
			</ul>
		{/if}
	{/if}
</div>
