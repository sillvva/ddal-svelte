<script lang="ts">
	import type { ItemId, LogSchema, LogSchemaIn } from "$lib/schemas";
	import type { MagicItem, StoryAward } from "$lib/server/db/schema";
	import { sorter } from "@sillvva/utils";
	import type { RemoteFormFields } from "@sveltejs/kit";
	import type { Snippet } from "svelte";
	import { v7 } from "uuid";
	import RemoteEntityCard from "./remote-entity-card.svelte";
	interface Props {
		form: RemoteFormFields<LogSchemaIn>;
		magicItems?: MagicItem[];
		storyAwards?: StoryAward[];
		children?: Snippet;
	}

	let { form, magicItems = [], storyAwards = [], children }: Props = $props();

	const newItem = () => ({ id: v7() as ItemId, name: "", description: "" }) satisfies LogSchema["magicItemsGained"][number];

	const type = $derived(form.type.value());
	const sortedItems = $derived(
		magicItems.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))
	);
	const sortedAwards = $derived(
		storyAwards.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))
	);
	const remainingItems = $derived(sortedItems.filter((item) => !form.magicItemsLost.value().includes(item.id)));
	const remainingAwards = $derived(sortedAwards.filter((item) => !form.storyAwardsLost.value().includes(item.id)));

	const buttons = $derived([
		["Magic Items", remainingItems, form.magicItemsGained, form.magicItemsLost] as const,
		...(type === "game" ? [["Story Awards", remainingAwards, form.storyAwardsGained, form.storyAwardsLost] as const] : [])
	]);

	const cards = $derived([
		["magicItems", sortedItems, form.magicItemsGained, form.magicItemsLost],
		["storyAwards", sortedAwards, form.storyAwardsGained, form.storyAwardsLost]
	] as const);
</script>

<div
	class="bg-base-100 col-span-12 flex flex-col justify-between gap-8 md:sticky md:top-19 md:z-10 md:flex-row md:py-4 md:max-lg:gap-4"
>
	{@render children?.()}
	<div class="flex flex-1 flex-col gap-4 sm:flex-row md:max-w-fit">
		{#each buttons as [label, remaining, gainedField, lostField], index (index)}
			<div class="join flex min-w-fit flex-1">
				<button
					type="button"
					tabindex="-1"
					class="btn join-item border-base-200! bg-base-300! min-w-fit flex-2 basis-0 cursor-default justify-between gap-3"
				>
					<span>{label}</span>
					<span class="flex flex-row gap-1">
						{#if gainedField.value().length > 0}
							<span class="badge badge-success badge-outline max-xs:px-1 rounded-sm">
								{gainedField.value().length}
							</span>
						{/if}
						{#if lostField.value().length > 0}
							<span class="badge badge-error badge-outline max-xs:px-1 rounded-sm">
								{lostField.value().length}
							</span>
						{/if}
					</span>
				</button>
				<button
					type="button"
					class="btn join-item min-w-fit max-md:flex-1 max-md:px-0 max-md:data-[remaining=0]:flex-2"
					data-remaining={remaining.length}
					onclick={() => gainedField.set(gainedField.value().concat(newItem()))}
					aria-label="Add Magic Item"
				>
					<span class="iconify mdi--plus max-md:size-6"></span>
				</button>
				{#if remaining.length > 0}
					<button
						type="button"
						class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
						onclick={() => {
							if (remaining[0]) lostField.set(lostField.value().concat(remaining[0].id));
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
			<RemoteEntityCard {form} field={gainedField[index]!} type="add" {entity} />
		{/each}
		{#each lostField.value() as id, index (id)}
			<RemoteEntityCard {form} field={lostField[index]!} type="drop" {entity} {items} />
		{/each}
	{/each}
</div>
