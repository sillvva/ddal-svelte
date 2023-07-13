<script lang="ts">
	import { page } from "$app/stores";
	import Icon from "./Icon.svelte";

	let breadcrumbs = ($page.data.breadcrumbs as { name: string, href?: string }[]).map((bc, i) => ({
		name: bc.name,
		href: !bc.href || i === $page.data.breadcrumbs.length - 1 ? null : bc.href,
	}));
</script>

<div class="breadcrumbs mb-4 hidden flex-1 text-sm sm:flex">
	<ul>
		<li>
			<Icon src="home" class="w-4" />
		</li>
		{#each breadcrumbs as bc}
			{#if bc.href}
				<li>
					<a href={bc.href} class="text-secondary">
						{bc.name}
					</a>
				</li>
			{:else}
				<li class="overflow-hidden text-ellipsis whitespace-nowrap dark:drop-shadow-md">
					{bc.name}
				</li>
			{/if}
		{/each}
	</ul>
</div>
