<script lang="ts">
	import type { ItemId, LogSchema } from "$lib/schemas";
	import type { MagicItem, StoryAward } from "$server/db/schema";
	import type { SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import EntityCard from "./EntityCard.svelte";

	export let superform: SuperForm<LogSchema>;
	export let magicItems: MagicItem[] = [];
	export let storyAwards: StoryAward[] = [];

	const { form } = superform;
	const newItem = { id: "" as ItemId, name: "", description: "" };

	$: remainingItems = magicItems.filter((item) => !$form.magicItemsLost.includes(item.id));
	$: remainingAwards = storyAwards.filter((item) => !$form.storyAwardsLost.includes(item.id));
</script>

<div class="col-span-12 flex flex-col justify-between gap-8 md:flex-row md:pb-4 md:max-lg:gap-4">
	<slot />
	<div class="flex flex-1 flex-col gap-4 sm:flex-row md:max-w-fit">
		<div class="join flex min-w-fit flex-1">
			<button
				type="button"
				tabindex="-1"
				class="btn join-item min-w-fit flex-[2] basis-0 cursor-default !border-base-200 !bg-base-300"
			>
				Magic Items
				{#if $form.magicItemsGained.length > 0}
					<span class="badge badge-success badge-outline rounded max-xs:px-1">{$form.magicItemsGained.length}</span>
				{/if}
				{#if $form.magicItemsLost.length > 0}
					<span class="badge badge-error badge-outline rounded max-xs:px-1">{$form.magicItemsLost.length}</span>
				{/if}
			</button>
			<button
				type="button"
				class={twMerge("btn join-item min-w-fit max-md:flex-1 max-md:px-0", remainingItems.length == 0 && "max-md:flex-[2]")}
				on:click={() => ($form.magicItemsGained = $form.magicItemsGained.concat(newItem))}
			>
				<span class="iconify mdi--plus max-md:size-6" />
			</button>
			{#if remainingItems.length > 0}
				<button
					type="button"
					class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
					on:click={() => {
						if (remainingItems[0]) $form.magicItemsLost = $form.magicItemsLost.concat(remainingItems[0].id);
					}}
				>
					<span class="iconify mdi--minus max-md:size-6" />
				</button>
			{/if}
		</div>
		{#if $form.type === "game"}
			<div class="join flex min-w-fit flex-1">
				<button
					type="button"
					tabindex="-1"
					class="btn join-item min-w-fit flex-[2] basis-0 cursor-default !border-base-200 !bg-base-300"
				>
					Story Awards
					{#if $form.storyAwardsGained.length > 0}
						<span class="badge badge-success badge-outline rounded max-xs:px-1">{$form.storyAwardsGained.length}</span>
					{/if}
					{#if $form.storyAwardsLost.length > 0}
						<span class="badge badge-error badge-outline rounded max-xs:px-1">{$form.storyAwardsLost.length}</span>
					{/if}
				</button>
				<button
					type="button"
					class={twMerge("btn join-item min-w-fit max-md:flex-1 max-md:px-0", remainingAwards.length == 0 && "max-md:flex-[2]")}
					on:click={() => ($form.storyAwardsGained = $form.storyAwardsGained.concat(newItem))}
				>
					<span class="iconify mdi--plus max-md:size-6" />
				</button>
				{#if remainingAwards.length > 0}
					<button
						type="button"
						class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
						on:click={() => {
							if (remainingAwards[0]) $form.storyAwardsLost = $form.storyAwardsLost.concat(remainingAwards[0].id);
						}}
					>
						<span class="iconify mdi--minus max-md:size-6" />
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
	{#each $form.magicItemsGained as _, index}
		<EntityCard {superform} type="add" entity="magic_items" {index} />
	{/each}
	{#each $form.magicItemsLost as _, index}
		<EntityCard {superform} type="drop" entity="magic_items" {index} data={magicItems} />
	{/each}
	{#each $form.storyAwardsGained as _, index}
		<EntityCard {superform} type="add" entity="story_awards" {index} />
	{/each}
	{#each $form.storyAwardsLost as _, index}
		<EntityCard {superform} type="drop" entity="story_awards" {index} data={storyAwards} />
	{/each}
</div>
