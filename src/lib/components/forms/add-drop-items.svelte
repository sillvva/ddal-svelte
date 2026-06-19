<script lang="ts">
	import type { GenericFormConfig } from "$lib/factories.svelte";
	import type { DmLogSchemaIn, ItemId, ItemSchema, LogSchema, LogSchemaIn } from "$lib/schemas";
	import { isDefined, sorter } from "@sillvva/utils";
	import { getContext, type Snippet } from "svelte";
	import { v7 } from "uuid";
	import Control from "./control.svelte";
	import InputWrapper from "./input-wrapper.svelte";
	import Input from "./input.svelte";
	import MarkdownInput from "./md-input.svelte";

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
	class="bg-base-100 col-span-12 flex flex-col justify-between gap-8 pt-8 md:sticky md:top-19 md:z-10 md:flex-row md:pb-4 md:max-lg:gap-4"
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
		{#each gainedField.value().filter(isDefined) as item, index (item.id)}
			{const title = $derived(entity === "magicItems" ? "Magic Item" : "Story Award")}
			{const field = $derived(
				entity === "magicItems" ? form.fields.magicItemsGained[index] : form.fields.storyAwardsGained[index]
			)}

			{#if field}
				<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
					<div class="card-body flex flex-col">
						<h4 class="text-xl">Add {title}</h4>
						<div class="flex gap-4">
							<Control class="flex-1">
								<Input field={field.id} type="hidden" />
								<Input field={field.name} type="text" label="Name" required />
							</Control>
							<button
								type="button"
								class="btn btn-error mt-10"
								onclick={(ev: Event) => {
									ev.preventDefault();
									if (field) {
										if (entity === "magicItems")
											form.fields.magicItemsGained.set(
												form.fields.magicItemsGained.value().filter((it) => it?.id !== field.id.value())
											);
										else
											form.fields.storyAwardsGained.set(
												form.fields.storyAwardsGained.value().filter((it) => it?.id !== field.id.value())
											);
									}
								}}
								aria-label="Delete Entry"
							>
								<span class="iconify mdi--trash-can size-6"></span>
							</button>
						</div>
						<Control>
							<MarkdownInput field={field.description} maxRows={8} maxLength={2000} preview />
						</Control>
					</div>
				</div>
			{/if}
		{/each}
		{#each lostField.value().filter(isDefined) as id, index (id)}
			{const title = $derived(entity === "magicItems" ? "Magic Item" : "Story Award")}
			{const arrValue = $derived(
				entity === "magicItems" ? form.fields.magicItemsLost.value() : form.fields.storyAwardsLost.value()
			)}
			{const field = $derived(entity === "magicItems" ? form.fields.magicItemsLost[index] : form.fields.storyAwardsLost[index])}

			{#if field}
				<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
					<div class="card-body flex flex-col">
						<h4 class="text-xl">Drop {title}</h4>
						<div class="flex gap-4">
							<Control class="flex-1">
								<InputWrapper {field} as="select" label="Select an Item">
									<select
										{...field.as("select")}
										id={field.as("select").name}
										class="select select-bordered w-full max-sm:text-base"
									>
										{#each items.filter((item) => item.id === field.value() || !arrValue.includes(item.id)) as item (item.id)}
											<option value={item.id}>
												{item.name}
											</option>
										{/each}
									</select>
								</InputWrapper>
							</Control>
							<button
								type="button"
								class="btn btn-error mt-10"
								onclick={(ev: Event) => {
									ev.preventDefault();
									if (field) {
										if (entity === "magicItems")
											form.fields.magicItemsLost.set(form.fields.magicItemsLost.value().filter((it) => it !== field.value()));
										else
											form.fields.storyAwardsLost.set(form.fields.storyAwardsLost.value().filter((it) => it !== field.value()));
									}
								}}
								aria-label="Delete Entry"
							>
								<span class="iconify mdi--trash-can size-6"></span>
							</button>
						</div>
						<div class="text-sm">
							{items.find((item) => field.value() === item.id)?.description || ""}
						</div>
					</div>
				</div>
			{/if}
		{/each}
	{/each}
</div>
