<script lang="ts">
	import type { GenericFormConfig } from "$lib/factories.svelte";
	import type { DmLogSchemaIn, ItemId, ItemSchema, LogSchema, LogSchemaIn } from "$lib/schemas";
	import { sorter } from "@sillvva/utils";
	import { getContext, type Snippet } from "svelte";
	import { v7 } from "uuid";
	import EntityCard from "./entity-card.svelte";

	interface Props {
		magicItems?: ItemSchema[];
		storyAwards?: ItemSchema[];
		children?: Snippet;
	}

	let { magicItems = [], storyAwards = [], children }: Props = $props();

	const configured = getContext<GenericFormConfig<LogSchemaIn | DmLogSchemaIn>>("configured-form");
	const { form } = $derived(configured());

	const newItem = () => ({ id: v7() as ItemId, name: "", description: "" }) satisfies LogSchema["magicItemsGained"][number];

	const sortedItems = $derived(
		magicItems.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))
	);
	const sortedAwards = $derived(
		storyAwards.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))
	);
	const remainingItems = $derived(sortedItems.filter((item) => !form.fields.magicItemsLost.value().includes(item.id)));
	const remainingAwards = $derived(sortedAwards.filter((item) => !form.fields.storyAwardsLost.value().includes(item.id)));

	const itemButtons = $derived([
		"Magic Items",
		remainingItems,
		form.fields.magicItemsGained,
		form.fields.magicItemsLost
	] as const);
	const awardButtons = $derived([
		"Story Awards",
		remainingAwards,
		form.fields.storyAwardsGained,
		form.fields.storyAwardsLost
	] as const);
	const buttons = $derived(form.fields.type.value() === "game" ? [itemButtons, awardButtons] : [itemButtons]);

	const cards = $derived([
		["magicItems", sortedItems, form.fields.magicItemsGained, form.fields.magicItemsLost],
		["storyAwards", sortedAwards, form.fields.storyAwardsGained, form.fields.storyAwardsLost]
	] as const);
</script>

<div
	class="bg-base-100 col-span-12 flex flex-col justify-between gap-8 md:sticky md:top-19 md:z-10 md:flex-row md:pt-8 md:pb-4 md:max-lg:gap-4"
>
	{@render children?.()}
	<div class="flex flex-1 flex-col gap-4 sm:flex-row md:max-w-fit">
		{#each buttons as [label, remaining, gained, lost], index (index)}
			<div class="join flex min-w-fit flex-1">
				<button
					type="button"
					tabindex="-1"
					class="btn join-item border-base-200! bg-base-300! min-w-fit flex-2 basis-0 cursor-default justify-between gap-3"
				>
					<span>{label}</span>
					<span class="flex flex-row gap-1">
						{#if gained.value().length > 0}
							<span class="badge badge-success badge-outline max-xs:px-1 rounded-sm">
								{gained.value().length}
							</span>
						{/if}
						{#if lost.value().length > 0}
							<span class="badge badge-error badge-outline max-xs:px-1 rounded-sm">
								{lost.value().length}
							</span>
						{/if}
					</span>
				</button>
				<button
					type="button"
					class="btn join-item min-w-fit max-md:flex-1 max-md:px-0 max-md:data-[remaining=0]:flex-2"
					data-remaining={remaining.length}
					onclick={() => gained.set([...gained.value(), newItem()])}
					aria-label="Add Magic Item"
				>
					<span class="iconify mdi--plus max-md:size-6"></span>
				</button>
				{#if remaining.length > 0}
					<button
						type="button"
						class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
						onclick={() => {
							if (remaining[0]) lost.set([...lost.value(), remaining[0].id]);
						}}
						aria-label="Remove Magic Item"
					>
						<span class="iconify mdi--minus max-md:size-6"></span>
					</button>
				{/if}
			</div>
		{/each}
	</div>
</div>
<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
	{#each cards as [entity, items, gainedField, lostField], index (index)}
		{#each gainedField.value() as item, index (item.id)}
			<EntityCard type="add" {entity} {index} />
		{/each}
		{#each lostField.value() as id, index (id)}
			<EntityCard type="drop" {entity} {index} {items} />
		{/each}
	{/each}
</div>
