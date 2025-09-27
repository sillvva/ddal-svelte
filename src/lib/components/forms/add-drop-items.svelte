<script lang="ts">
	import type { ItemId, LogSchema } from "$lib/schemas";
	import type { MagicItem, StoryAward } from "$lib/server/db/schema";
	import { sorter } from "@sillvva/utils";
	import type { Snippet } from "svelte";
	import type { SuperForm } from "sveltekit-superforms";
	import { v7 } from "uuid";
	import EntityCard from "./entity-card.svelte";

	interface Props {
		superform: SuperForm<LogSchema, App.Superforms.Message>;
		magicItems?: MagicItem[];
		storyAwards?: StoryAward[];
		children?: Snippet;
	}

	let { superform, magicItems = [], storyAwards = [], children }: Props = $props();

	const { form } = superform;
	const newItem = () => ({ id: v7() as ItemId, name: "", description: "" }) satisfies LogSchema["magicItemsGained"][0];

	const sortedItems = $derived(
		magicItems.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))
	);
	const sortedAwards = $derived(
		storyAwards.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))
	);
	const remainingItems = $derived(sortedItems.filter((item) => !$form.magicItemsLost.includes(item.id)));
	const remainingAwards = $derived(sortedAwards.filter((item) => !$form.storyAwardsLost.includes(item.id)));
</script>

<div
	class="bg-base-100 col-span-12 flex flex-col justify-between gap-8 md:sticky md:top-19 md:z-10 md:flex-row md:py-4 md:max-lg:gap-4"
>
	{@render children?.()}
	<div class="flex flex-1 flex-col gap-4 sm:flex-row md:max-w-fit">
		<div class="join flex min-w-fit flex-1">
			<button
				type="button"
				tabindex="-1"
				class="btn join-item border-base-200! bg-base-300! min-w-fit flex-2 basis-0 cursor-default justify-between gap-3"
			>
				<span>Magic Items</span>
				<span class="flex flex-row gap-1">
					{#if $form.magicItemsGained.length > 0}
						<span class="badge badge-success badge-outline max-xs:px-1 rounded-sm">
							{$form.magicItemsGained.length}
						</span>
					{/if}
					{#if $form.magicItemsLost.length > 0}
						<span class="badge badge-error badge-outline max-xs:px-1 rounded-sm">
							{$form.magicItemsLost.length}
						</span>
					{/if}
				</span>
			</button>
			<button
				type="button"
				class="btn join-item min-w-fit max-md:flex-1 max-md:px-0 max-md:data-[remaining=0]:flex-2"
				data-remaining={remainingItems.length}
				onclick={() => ($form.magicItemsGained = $form.magicItemsGained.concat(newItem()))}
				aria-label="Add Magic Item"
			>
				<span class="iconify mdi--plus max-md:size-6"></span>
			</button>
			{#if remainingItems.length > 0}
				<button
					type="button"
					class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
					onclick={() => {
						if (remainingItems[0]) $form.magicItemsLost = $form.magicItemsLost.concat(remainingItems[0].id);
					}}
					aria-label="Remove Magic Item"
				>
					<span class="iconify mdi--minus max-md:size-6"></span>
				</button>
			{/if}
		</div>
		{#if $form.type === "game"}
			<div class="join flex min-w-fit flex-1">
				<button
					type="button"
					tabindex="-1"
					class="btn join-item border-base-200! bg-base-300! min-w-fit flex-2 basis-0 cursor-default justify-between gap-3"
				>
					<span>Story Awards</span>
					<span class="flex flex-row gap-1">
						{#if $form.storyAwardsGained.length > 0}
							<span class="badge badge-success badge-outline max-xs:px-1 rounded-sm">
								{$form.storyAwardsGained.length}
							</span>
						{/if}
						{#if $form.storyAwardsLost.length > 0}
							<span class="badge badge-error badge-outline max-xs:px-1 rounded-sm">
								{$form.storyAwardsLost.length}
							</span>
						{/if}
					</span>
				</button>
				<button
					type="button"
					class="btn join-item min-w-fit max-md:flex-1 max-md:px-0 max-md:data-[remaining=0]:flex-2"
					data-remaining={remainingItems.length}
					onclick={() => ($form.storyAwardsGained = $form.storyAwardsGained.concat(newItem()))}
					aria-label="Add Story Award"
				>
					<span class="iconify mdi--plus max-md:size-6"></span>
				</button>
				{#if remainingAwards.length > 0}
					<button
						type="button"
						class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
						onclick={() => {
							if (remainingAwards[0]) $form.storyAwardsLost = $form.storyAwardsLost.concat(remainingAwards[0].id);
						}}
						aria-label="Remove Story Award"
					>
						<span class="iconify mdi--minus max-md:size-6"></span>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
	{#each $form.magicItemsGained as _, index (index)}
		<EntityCard {superform} type="add" entity="magicItems" {index} />
	{/each}
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
	{#each $form.magicItemsLost as _, index (index)}
		<EntityCard {superform} type="drop" entity="magicItems" {index} items={sortedItems} />
	{/each}
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
	{#each $form.storyAwardsGained as _, index (index)}
		<EntityCard {superform} type="add" entity="storyAwards" {index} />
	{/each}
	<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
	{#each $form.storyAwardsLost as _, index (index)}
		<EntityCard {superform} type="drop" entity="storyAwards" {index} items={sortedAwards} />
	{/each}
</div>
