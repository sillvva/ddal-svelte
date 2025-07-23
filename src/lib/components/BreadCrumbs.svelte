<script lang="ts">
	import { page } from "$app/state";
	import { routeModules } from "$lib/util";
	import { Breadcrumbs, type Crumb } from "svelte-breadcrumbs";
	import BackButton from "./BackButton.svelte";
</script>

<Breadcrumbs url={page.url} routeId={page.route.id} pageData={page.data} skipRoutesWithNoPage {routeModules}>
	{#snippet children({ crumbs }: { crumbs: Crumb[] })}
		{@const back = crumbs.filter((bc) => bc.url).at(-1)}
		{#if back?.url}
			<BackButton href={back.url}>{back.title}</BackButton>
		{/if}
		<div class="breadcrumbs mb-4 flex-1 text-sm max-sm:hidden print:hidden">
			<ul>
				<li>
					<span class="iconify mdi--home size-4"></span>
				</li>
				{#each crumbs as bc, i}
					{#if (bc.url || i === crumbs.length - 1) && !bc.url?.endsWith("/new")}
						{#if bc.url}
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
	{/snippet}
</Breadcrumbs>
