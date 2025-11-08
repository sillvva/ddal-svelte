<script lang="ts">
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
	{#if !hideMenuActions && (actions || menu)}
		{@render actions?.()}
		<button
			tabindex="0"
			class="btn btn-sm touch-hitbox h-9"
			aria-label="Menu"
			popovertarget="nav-menu"
			style:anchor-name="--nav-menu"
		>
			<span class="iconify mdi--dots-horizontal size-6"></span>
		</button>
		<ul
			role="menu"
			class="dropdown menu dropdown-bottom dropdown-end rounded-box bg-base-300 z-20 w-52 shadow-sm"
			popover
			id="nav-menu"
			style:position-anchor="--nav-menu"
		>
			{@render menu?.()}
		</ul>
	{/if}
</div>
