<script lang="ts">
	import { resolveRoute, type Crumb } from "#lib/util.js";
	import BackButton from "./back-button.svelte";

	interface Props {
		crumbs: Crumb[];
	}

	let { crumbs }: Props = $props();

	const resolved = $derived(crumbs.map((bc) => ({ title: bc.title, url: resolveRoute(bc.href, bc.params) })));
	const back = $derived(resolved.filter((bc) => !!bc.title).at(-2));
</script>

<div class={["flex min-h-9 flex-1 items-center max-sm:min-h-8 sm:mb-4", resolved.length === 1 && "max-sm:hidden"]}>
	{#if resolved.length > 0}
		{#if back?.url && resolved.length > 1}
			<div class="flex-1 sm:hidden">
				<BackButton href={back.url}>{back.title}</BackButton>
			</div>
		{/if}
		<div class="breadcrumbs flex-1 text-sm max-sm:hidden print:hidden">
			<ul class="h-5">
				<li>
					<span class="iconify size-4 mdi--home"></span>
				</li>
				{#each resolved as bc, i (i)}
					{#if bc.url && bc.title}
						{#if bc.url !== resolved.at(-1)?.url}
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
