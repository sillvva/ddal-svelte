<script lang="ts">
	import { getBreadcrumbs } from "$lib/stores.svelte";
	import { twMerge } from "tailwind-merge";
	import BackButton from "./BackButton.svelte";

	const crumbs = $derived(getBreadcrumbs());
</script>

<div class={twMerge("flex min-h-9 flex-1 items-center max-sm:min-h-8 sm:mb-4", crumbs.length === 1 && "max-sm:hidden")}>
	{#if crumbs.length > 0}
		{@const back = crumbs.filter((bc) => bc.url).at(-1)}
		{#if back?.url && crumbs.length > 1}
			<div class="flex-1 sm:hidden">
				<BackButton href={back.url}>{back.title}</BackButton>
			</div>
		{/if}
		<div class="breadcrumbs flex-1 text-sm max-sm:hidden print:hidden">
			<ul class="h-5">
				<li>
					<span class="iconify mdi--home size-4"></span>
				</li>
				{#each crumbs as bc, i (i)}
					{#if (bc.url || i === crumbs.length - 1) && bc.title}
						{#if bc.url !== crumbs.at(-1)?.url}
							<li>
								<a href={bc.url} class="text-secondary">
									{bc.title}
								</a>
							</li>
						{:else}
							<li class="ellipsis-nowrap dark:drop-shadow-md">
								{bc.title}
							</li>
						{/if}
					{/if}
				{/each}
			</ul>
		</div>
	{/if}
</div>
