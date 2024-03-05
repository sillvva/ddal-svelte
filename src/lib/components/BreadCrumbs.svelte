<script lang="ts">
	import { page } from "$app/stores";
	import BackButton from "./BackButton.svelte";

	let breadcrumbs = ($page.data.breadcrumbs as Array<{ name: string; href?: string }>).map((bc, i) => ({
		name: bc.name,
		href: !bc.href || i === $page.data.breadcrumbs.length - 1 ? null : bc.href
	}));

	$: back = breadcrumbs
		.slice(0, -1)
		.filter((bc) => bc.href)
		.at(-1);
</script>

{#if back?.href}
	<BackButton href={back.href}>{back.name}</BackButton>
{/if}

<div class="breadcrumbs mb-4 hidden flex-1 text-sm sm:flex">
	<ul>
		<li>
			<span class="iconify mdi-home size-4" />
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
