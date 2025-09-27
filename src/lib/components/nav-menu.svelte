<script lang="ts">
	import type { Snippet } from "svelte";
	import Breadcrumbs from "./breadcrumbs.svelte";
	import Dropdown from "./dropdown.svelte";

	interface Props {
		base?: boolean;
		hideMenuActions?: boolean;
		actions?: Snippet;
		menu?: Snippet;
	}

	let { base, hideMenuActions, actions, menu }: Props = $props();
</script>

<div class={["flex gap-4 print:hidden", base && "max-sm:hidden"]}>
	<Breadcrumbs />
	{#if !hideMenuActions && (actions || menu)}
		{@render actions?.()}
		<Dropdown class="dropdown-end">
			<ul role="menu" class="menu dropdown-content rounded-box bg-base-300 z-20 w-52 shadow-sm">
				{@render menu?.()}
			</ul>
		</Dropdown>
	{/if}
</div>
