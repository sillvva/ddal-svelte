<script lang="ts">
	import type { ItemSchema, LogSchema } from "$lib/schemas";
	import { writable } from "svelte/store";
	import { formFieldProxy, type SuperForm } from "sveltekit-superforms";
	import Control from "./Control.svelte";
	import GenericInput from "./GenericInput.svelte";
	import Input from "./Input.svelte";
	import MdTextInput from "./MDTextInput.svelte";

	type Props = {
		entity: "magic_items" | "story_awards";
		superform: SuperForm<LogSchema>;
		index: number;
	} & (
		| {
				type: "add";
				data?: [];
		  }
		| {
				type: "drop";
				data: ItemSchema[];
		  }
	);

	let { entity, superform, index, type, data = [] }: Props = $props();

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
	const title = entity === "magic_items" ? "Magic Item" : "Story Award";

	const { value: lostValue } = lostField ? formFieldProxy(superform, lostField) : { value: writable("") };

	const arrValue = $derived(type === "drop" ? (entity === "magic_items" ? $form.magicItemsLost : $form.storyAwardsLost) : []);

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
	<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col">
			<h4 class="text-xl">Add {title}</h4>
			<div class="flex gap-4">
				<Control class="flex-1">
					<Input type="text" {superform} field={nameField} label="Name" required />
				</Control>
				<button type="button" class="btn btn-error mt-10" onclick={() => ondelete()} aria-label="Delete Entry">
					<span class="iconify mdi--trash-can size-6"></span>
				</button>
			</div>
			<Control>
				<MdTextInput {superform} field={descField} name={`add_${entity}_${index}`} maxRows={8} preview />
			</Control>
		</div>
	</div>
{:else if type === "drop" && lostField}
	<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col">
			<h4 class="text-xl">Drop {title}</h4>
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
				<button type="button" class="btn btn-error mt-9" onclick={() => ondelete()} aria-label="Delete Entry">
					<span class="iconify mdi--trash-can size-6"></span>
				</button>
			</div>
			<div class="text-sm">
				{data.find((item) => $lostValue === item.id)?.description || ""}
			</div>
		</div>
	</div>
{/if}
