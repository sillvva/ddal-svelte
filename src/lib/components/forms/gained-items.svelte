<script lang="ts">
	import type { GenericForm } from "#lib/factories.svelte.js";
	import type { ItemId, LogDraftSchemaIn } from "#lib/schemas.js";
	import { isDefined } from "@sillvva/utils";
	import { type Snippet } from "svelte";
	import { v7 } from "uuid";
	import Control from "./control.svelte";
	import Input from "./input.svelte";
	import MarkdownInput from "./md-input.svelte";

	interface Props {
		form: GenericForm<LogDraftSchemaIn>;
		children?: Snippet;
	}

	let { form: configuredForm, children }: Props = $props();

	const { form } = $derived(configuredForm);
	const newItem = () => ({ id: v7() as ItemId, name: "", description: "" });
	const buttons = $derived(
		form.fields.type.value() === "game"
			? ([
					["Magic Items", form.fields.magicItemsGained],
					["Story Awards", form.fields.storyAwardsGained]
				] as const)
			: ([["Magic Items", form.fields.magicItemsGained]] as const)
	);
</script>

<div
	class="col-span-12 flex flex-col justify-between gap-8 bg-base-100 pt-8 md:sticky md:top-19 md:z-10 md:flex-row md:pb-4 md:max-lg:gap-4"
>
	<div class="flex flex-wrap gap-2">
		{@render children?.()}
	</div>
	<div class="flex flex-1 flex-col gap-4 sm:flex-row md:max-w-fit">
		{#each buttons as [label, gained] (label)}
			<div class="join flex min-w-fit flex-1">
				<button
					type="button"
					tabindex="-1"
					class="btn join-item min-w-fit flex-2 basis-0 cursor-default justify-between gap-3 border-base-200! bg-base-300!"
				>
					<span>{label}</span>
					{#if gained.value().length > 0}
						<span class="badge rounded-sm badge-outline badge-success">{gained.value().length}</span>
					{/if}
				</button>
				<button
					type="button"
					class="btn join-item min-w-fit"
					onclick={() => gained.set([...gained.value(), newItem()])}
					aria-label="Add {label}"
				>
					<span class="iconify mdi--plus"></span>
				</button>
			</div>
		{/each}
	</div>
</div>

<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
	{#each form.fields.magicItemsGained.value().filter(isDefined) as item, index (item.id)}
		{@render card("Magic Item", form.fields.magicItemsGained, index)}
	{/each}
	{#if form.fields.type.value() === "game"}
		{#each form.fields.storyAwardsGained.value().filter(isDefined) as item, index (item.id)}
			{@render card("Story Award", form.fields.storyAwardsGained, index)}
		{/each}
	{/if}
</div>

{#snippet card(title: string, gained: typeof form.fields.magicItemsGained, index: number)}
	{const field = $derived(gained[index])}
	{#if field}
		<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
			<div class="card-body flex flex-col">
				<h4 class="text-xl">Add {title}</h4>
				<div class="flex gap-4">
					<Control class="flex-1">
						<Input field={field.id} type="hidden" />
						<Input field={field.name} type="text" label="Name" required />
					</Control>
					<button
						type="button"
						class="btn mt-10 btn-error"
						aria-label="Delete Entry"
						onclick={(event: Event) => {
							event.preventDefault();
							gained.set(gained.value().filter((entry) => entry?.id !== field.id.value()));
						}}
					>
						<span class="iconify size-6 mdi--trash-can"></span>
					</button>
				</div>
				<Control>
					<MarkdownInput field={field.description} maxRows={8} maxLength={2000} preview />
				</Control>
			</div>
		</div>
	{/if}
{/snippet}
