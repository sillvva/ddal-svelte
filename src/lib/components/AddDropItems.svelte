<script lang="ts">
	import type { MagicItem, StoryAward } from "$server/db/schema";
	import type { SuperForm } from "sveltekit-superforms";
	import type { LogSchema } from "../schemas";
	import EntityCard from "./EntityCard.svelte";
	export let superform: SuperForm<LogSchema, any>;
	export let magicItems: MagicItem[] = [];
	export let storyAwards: StoryAward[] = [];

	const { form } = superform;
</script>

<div class="no-script-hide col-span-12 flex flex-wrap gap-4">
	<button
		type="button"
		class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
		on:click={() => ($form.magic_items_gained = [...$form.magic_items_gained, { id: "", name: "", description: "" }])}
	>
		Add Magic Item
	</button>
	{#if magicItems.filter((item) => !$form.magic_items_lost.includes(item.id)).length > 0}
		<button
			type="button"
			class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
			on:click={() => {
				const items = magicItems.filter((item) => !$form.magic_items_lost.includes(item.id));
				if (items[0]) $form.magic_items_lost = [...$form.magic_items_lost, items[0].id];
			}}
		>
			Drop Magic Item
		</button>
	{/if}
	{#if $form.type === "game"}
		<button
			type="button"
			class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
			on:click={() => ($form.story_awards_gained = [...$form.story_awards_gained, { id: "", name: "", description: "" }])}
		>
			Add Story Award
		</button>
		{#if storyAwards.filter((item) => !$form.story_awards_lost.includes(item.id)).length > 0}
			<button
				type="button"
				class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
				on:click={() => {
					const items = storyAwards.filter((item) => !$form.story_awards_lost.includes(item.id));
					if (items[0]) $form.story_awards_lost = [...$form.story_awards_lost, items[0].id];
				}}
			>
				Drop Story Award
			</button>
		{/if}
	{/if}
</div>
<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
	{#each $form.magic_items_gained as _, index}
		<EntityCard
			{superform}
			type="add"
			entity="magic_items"
			nameField={`magic_items_gained[${index}].name`}
			descField={`magic_items_gained[${index}].description`}
			ondelete={() => ($form.magic_items_gained = $form.magic_items_gained.filter((_, i) => i !== index))}
		/>
	{/each}
	{#each $form.magic_items_lost as _, index}
		<EntityCard
			{superform}
			type="drop"
			entity="magic_items"
			lostField={`magic_items_lost[${index}]`}
			data={magicItems}
			arrValue={$form.magic_items_lost}
			ondelete={() => ($form.magic_items_lost = $form.magic_items_lost.filter((_, i) => i !== index))}
		/>
	{/each}
	{#each $form.story_awards_gained as _, index}
		<EntityCard
			{superform}
			type="add"
			entity="story_awards"
			nameField={`story_awards_gained[${index}].name`}
			descField={`story_awards_gained[${index}].description`}
			ondelete={() => ($form.story_awards_gained = $form.story_awards_gained.filter((_, i) => i !== index))}
		/>
	{/each}
	{#each $form.story_awards_lost as _, index}
		<EntityCard
			{superform}
			type="drop"
			entity="story_awards"
			lostField={`story_awards_lost[${index}]`}
			data={storyAwards}
			arrValue={$form.story_awards_lost}
			ondelete={() => ($form.story_awards_lost = $form.story_awards_lost.filter((_, i) => i !== index))}
		/>
	{/each}
</div>
