<script lang="ts">
	import type { ItemId, LogSchema } from "$lib/schemas";
	import { writable } from "svelte/store";
	import { formFieldProxy, type SuperForm } from "sveltekit-superforms";
	import Control from "./Control.svelte";
	import GenericInput from "./GenericInput.svelte";
	import Input from "./Input.svelte";
	import MdTextInput from "./MDTextInput.svelte";

	type $$Props = {
		entity: "magic_items" | "story_awards";
		superform: SuperForm<LogSchema>;
		index: number;
	} & (
		| {
				type: "add";
		  }
		| {
				type: "drop";
				data: { id: ItemId; name: string; description: string | null }[];
		  }
	);

	export let type: "add" | "drop";
	export let entity: "magic_items" | "story_awards";
	export let superform: SuperForm<LogSchema>;
	export let index: number;

	export let data: { id: ItemId; name: string; description: string | null }[] = [];

	const { form } = superform;

	const nameField =
		type === "add"
			? entity === "magic_items"
				? (`magicItemsGained[${index}].name` as const)
				: (`storyAwardsGained[${index}].name` as const)
			: undefined;
	const descField =
		type === "add"
			? entity === "magic_items"
				? (`magicItemsGained[${index}].description` as const)
				: (`storyAwardsGained[${index}].description` as const)
			: undefined;
	const lostField =
		type === "drop"
			? entity === "magic_items"
				? (`magicItemsLost[${index}]` as const)
				: (`storyAwardsLost[${index}]` as const)
			: undefined;

	const { value: lostValue } = lostField ? formFieldProxy(superform, lostField) : { value: writable("") };

	$: arrValue = type === "drop" ? (entity === "magic_items" ? $form.magicItemsLost : $form.storyAwardsLost) : [];

	const ondelete = () => {
		if (type === "add") {
			if (entity === "magic_items") $form.magicItemsGained = $form.magicItemsGained.filter((_, i) => i !== index);
			else $form.storyAwardsGained = $form.storyAwardsGained.filter((_, i) => i !== index);
		}
		if (type === "drop") {
			if (entity === "magic_items") $form.magicItemsLost = $form.magicItemsLost.filter((_, i) => i !== index);
			else $form.storyAwardsLost = $form.storyAwardsLost.filter((_, i) => i !== index);
		}
	};
</script>

{#if type === "add" && nameField && descField}
	<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col gap-4">
			{#if entity === "magic_items"}
				<h4 class="text-2xl">Add Magic Item</h4>
			{:else if entity === "story_awards"}
				<h4 class="text-2xl">Add Story Award</h4>
			{/if}
			<div class="flex gap-4">
				<Control class="flex-1">
					<Input type="text" {superform} field={nameField} required>Name</Input>
				</Control>
				<button type="button" class="btn btn-error mt-9" on:click={() => ondelete()}>
					<span class="iconify size-6 mdi--trash-can" />
				</button>
			</div>
			<Control>
				<MdTextInput {superform} field={descField} name={`add_${entity}_${index}`} maxRows={8} preview>Description</MdTextInput>
			</Control>
		</div>
	</div>
{:else if type === "drop"}
	<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col gap-4">
			{#if entity === "magic_items"}
				<h4 class="text-2xl">Drop Magic Item</h4>
			{:else if entity === "story_awards"}
				<h4 class="text-2xl">Drop Story Award</h4>
			{/if}
			<div class="flex gap-4">
				<Control class="flex-1">
					<GenericInput {superform} field={lostField} label="Select an Item">
						<select bind:value={$lostValue} id={lostField} class="select select-bordered w-full">
							{#each data.filter((item) => item.id === $lostValue || !arrValue.includes(item.id)) as item}
								<option value={item.id}>
									{item.name}
								</option>
							{/each}
						</select>
					</GenericInput>
				</Control>
				<button type="button" class="btn btn-error mt-9" on:click={() => ondelete()}>
					<span class="iconify size-6 mdi--trash-can" />
				</button>
			</div>
			<div class="text-sm">
				{data.find((item) => $lostValue === item.id)?.description || ""}
			</div>
		</div>
	</div>
{/if}
