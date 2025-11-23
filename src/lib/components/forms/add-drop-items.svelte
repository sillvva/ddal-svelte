<script lang="ts">
	import * as API from "$lib/remote";
	import type { CharacterId, DmLogSchemaIn, ItemId, LogId, LogSchema, LogSchemaIn } from "$lib/schemas";
	import { sorter } from "@sillvva/utils";
	import type { RemoteFormFields } from "@sveltejs/kit";
	import type { Snippet } from "svelte";
	import { v7 } from "uuid";
	import EntityCard from "./entity-card.svelte";

	type RequiredFields = "magicItemsGained" | "magicItemsLost" | "storyAwardsGained" | "storyAwardsLost";

	interface Props {
		fields: RemoteFormFields<LogSchemaIn> | RemoteFormFields<DmLogSchemaIn>;
		log: Omit<LogSchemaIn, "dm"> & Required<Pick<LogSchemaIn, RequiredFields>>;
		logId: LogId;
		characterId?: CharacterId;
		children?: Snippet;
	}

	let { fields, log = $bindable(), logId, characterId, children }: Props = $props();

	const newItem = () => ({ id: v7() as ItemId, name: "", description: "" }) satisfies LogSchema["magicItemsGained"][number];

	const type = $derived(log.type);
</script>

<svelte:boundary>
	{@const { magicItems, storyAwards } = await API.characters.queries.getItems({ characterId, logId })}

	{@const sortedItems = magicItems.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))}
	{@const sortedAwards = storyAwards.toSorted((a, b) => sorter(a.name.replace(/^\d+x? ?/, ""), b.name.replace(/^\d+x? ?/, "")))}
	{@const remainingItems = sortedItems.filter((item) => !log.magicItemsLost.includes(item.id))}
	{@const remainingAwards = sortedAwards.filter((item) => !log.storyAwardsLost.includes(item.id))}

	{@const itemButtons = ["Magic Items", remainingItems, log.magicItemsGained, log.magicItemsLost] as const}
	{@const awardButtons = ["Story Awards", remainingAwards, log.storyAwardsGained, log.storyAwardsLost] as const}
	{@const buttons = type === "game" ? [itemButtons, awardButtons] : [itemButtons]}

	{@const cards = [
		["magicItems", sortedItems, fields.magicItemsGained, fields.magicItemsLost],
		["storyAwards", sortedAwards, fields.storyAwardsGained, fields.storyAwardsLost]
	] as const}

	<div
		class="bg-base-100 col-span-12 flex flex-col justify-between gap-8 md:sticky md:top-19 md:z-10 md:flex-row md:py-4 md:max-lg:gap-4"
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
							{#if gained.length > 0}
								<span class="badge badge-success badge-outline max-xs:px-1 rounded-sm">
									{gained.length}
								</span>
							{/if}
							{#if lost.length > 0}
								<span class="badge badge-error badge-outline max-xs:px-1 rounded-sm">
									{lost.length}
								</span>
							{/if}
						</span>
					</button>
					<button
						type="button"
						class="btn join-item min-w-fit max-md:flex-1 max-md:px-0 max-md:data-[remaining=0]:flex-2"
						data-remaining={remaining.length}
						onclick={() => gained.push(newItem())}
						aria-label="Add Magic Item"
					>
						<span class="iconify mdi--plus max-md:size-6"></span>
					</button>
					{#if remaining.length > 0}
						<button
							type="button"
							class="btn join-item min-w-fit max-md:flex-1 max-md:px-0"
							onclick={() => {
								if (remaining[0]) lost.push(remaining[0].id);
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
				<EntityCard bind:log field={gainedField[index]!} type="add" {entity} />
			{/each}
			{#each lostField.value() as id, index (id)}
				<EntityCard bind:log field={lostField[index]!} type="drop" {entity} {items} />
			{/each}
		{/each}
	</div>
</svelte:boundary>
