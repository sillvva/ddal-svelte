<script lang="ts">
	import { page } from "$app/state";
	import { Breadcrumbs, type Crumb } from "svelte-breadcrumbs";
	import BackButton from "./BackButton.svelte";
</script>

<div class="mb-4 flex flex-1 items-center max-sm:h-8">
	<Breadcrumbs url={page.url} routeId={page.route.id} pageData={page.data} skipRoutesWithNoPage>
		{#snippet children({ crumbs }: { crumbs: Crumb[] })}
			{@const back = crumbs.filter((bc) => bc.url).at(-1)}
			{#if back?.url}
				<div class="flex-1 sm:hidden">
					<BackButton href={back.url}>{back.title}</BackButton>
				</div>
			{/if}
			<div class="breadcrumbs flex-1 text-sm max-sm:hidden print:hidden">
				<ul class="h-5">
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
</div>
