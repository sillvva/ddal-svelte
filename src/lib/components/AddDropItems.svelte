<script lang="ts">
	import type { MagicItem, StoryAward } from "$server/db/schema";
	import type { SuperForm } from "sveltekit-superforms";
	import type { LogSchema } from "../schemas";
	import EntityCard from "./EntityCard.svelte";
	export let superform: SuperForm<LogSchema, any>;
	export let magicItems: MagicItem[] = [];
	export let storyAwards: StoryAward[] = [];

	const { form } = superform;

	$: remainingItems = magicItems.filter((item) => !$form.magicItemsLost.includes(item.id));
	$: remainingAwards = storyAwards.filter((item) => !$form.storyAwardsLost.includes(item.id));
</script>

<div class="no-script-hide col-span-12 flex flex-wrap gap-4">
	<button
		type="button"
		class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
		on:click={() => ($form.magicItemsGained = [...$form.magicItemsGained, { id: "", name: "", description: "" }])}
	>
		Add Magic Item
	</button>
	{#if remainingItems.length > 0}
		<button
			type="button"
			class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
			on:click={() => {
				if (remainingItems[0]) $form.magicItemsLost = [...$form.magicItemsLost, remainingItems[0].id];
			}}
		>
			Drop Magic Item
		</button>
	{/if}
	{#if $form.type === "game"}
		<button
			type="button"
			class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
			on:click={() => ($form.storyAwardsGained = [...$form.storyAwardsGained, { id: "", name: "", description: "" }])}
		>
			Add Story Award
		</button>
		{#if remainingAwards.length > 0}
			<button
				type="button"
				class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
				on:click={() => {
					if (remainingAwards[0]) $form.storyAwardsLost = [...$form.storyAwardsLost, remainingAwards[0].id];
				}}
			>
				Drop Story Award
			</button>
		{/if}
	{/if}
</div>
<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
	{#each $form.magicItemsGained as _, index}
		<EntityCard
			{superform}
			type="add"
			entity="magic_items"
			nameField={`magicItemsGained[${index}].name`}
			descField={`magicItemsGained[${index}].description`}
			ondelete={() => ($form.magicItemsGained = $form.magicItemsGained.filter((_, i) => i !== index))}
		/>
	{/each}
	{#each $form.magicItemsLost as _, index}
		<EntityCard
			{superform}
			type="drop"
			entity="magic_items"
			lostField={`magicItemsLost[${index}]`}
			data={magicItems}
			arrValue={$form.magicItemsLost}
			ondelete={() => ($form.magicItemsLost = $form.magicItemsLost.filter((_, i) => i !== index))}
		/>
	{/each}
	{#each $form.storyAwardsGained as _, index}
		<EntityCard
			{superform}
			type="add"
			entity="story_awards"
			nameField={`storyAwardsGained[${index}].name`}
			descField={`storyAwardsGained[${index}].description`}
			ondelete={() => ($form.storyAwardsGained = $form.storyAwardsGained.filter((_, i) => i !== index))}
		/>
	{/each}
	{#each $form.storyAwardsLost as _, index}
		<EntityCard
			{superform}
			type="drop"
			entity="story_awards"
			lostField={`storyAwardsLost[${index}]`}
			data={storyAwards}
			arrValue={$form.storyAwardsLost}
			ondelete={() => ($form.storyAwardsLost = $form.storyAwardsLost.filter((_, i) => i !== index))}
		/>
	{/each}
</div>
