<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import type { BrandedFormPathLeaves, NonBrandedFormPathLeaves } from "$lib/util";
	import { writable } from "svelte/store";
	import { formFieldProxy, type SuperForm } from "sveltekit-superforms";
	import Control from "./Control.svelte";
	import GenericInput from "./GenericInput.svelte";
	import Input from "./Input.svelte";
	import MdTextInput from "./MDTextInput.svelte";

	type $$Props = {
		entity: "magic_items" | "story_awards";
		superform: SuperForm<T, any>;
		ondelete: () => void;
	} & (
		| {
				type: "add";
				nameField: NonBrandedFormPathLeaves<T, string>;
				descField: NonBrandedFormPathLeaves<T, string>;
		  }
		| {
				type: "drop";
				lostField: BrandedFormPathLeaves<T>;
				arrValue: string[];
				data: { id: string; name: string; description: string | null }[];
		  }
	);

	export let type: "add" | "drop";
	export let entity: "magic_items" | "story_awards";
	export let superform: SuperForm<T, any>;
	export let nameField: NonBrandedFormPathLeaves<T, string> | undefined = undefined;
	export let descField: NonBrandedFormPathLeaves<T, string> | undefined = undefined;
	export let lostField: BrandedFormPathLeaves<T> | undefined = undefined;
	export let arrValue: string[] = [];
	export let data: { id: string; name: string; description: string | null }[] = [];
	export let ondelete: () => void;

	const { value: lostValue } = lostField ? formFieldProxy(superform, lostField as any) : { value: writable("") };
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
				<button type="button" class="no-script-hide btn btn-error mt-9" on:click={() => ondelete()}>
					<span class="iconify size-6 mdi-trash-can" />
				</button>
			</div>
			<Control>
				<MdTextInput {superform} field={descField} maxRows={8} preview>Description</MdTextInput>
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
				<button type="button" class="no-script-hide btn btn-error mt-9" on:click={() => ondelete()}>
					<span class="iconify size-6 mdi-trash-can" />
				</button>
			</div>
			<div class="text-sm">
				{data.find((item) => $lostValue === item.id)?.description || ""}
			</div>
		</div>
	</div>
{/if}
