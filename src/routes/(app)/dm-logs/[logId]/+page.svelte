<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Combobox from "$lib/components/Combobox.svelte";
	import Control from "$lib/components/Control.svelte";
	import DateInput from "$lib/components/DateInput.svelte";
	import EntityCard from "$lib/components/EntityCard.svelte";
	import GenericInput from "$lib/components/GenericInput.svelte";
	import Input from "$lib/components/Input.svelte";
	import MdTextInput from "$lib/components/MDTextInput.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { dMLogSchema } from "$lib/schemas";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";

	export let data;

	let superform = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(dMLogSchema(data.characters)),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form, errors, submitting, message } = superform;

	let season: 1 | 8 | 9 = $form.experience ? 1 : $form.acp ? 8 : 9;
</script>

<BreadCrumbs />

<SuperForm action="?/saveLog" {superform} showMessage>
	<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
		<Input type="text" {superform} field="name" required>Title</Input>
	</Control>
	<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
		<DateInput {superform} field="date" required>Date</DateInput>
	</Control>
	<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
		<Combobox
			{superform}
			idField="characterId"
			field="characterName"
			errorField="characterId"
			values={data.characters.map((char) => ({ value: char.id, label: char.name }))}
			required={!!$form.applied_date}
			on:select={(e) => {
				const character = data.characters.find((c) => c.id === e.detail?.selected?.value);
				if (character) {
					$form.characterId = character.id;
					$form.characterName = character.name;
					$form.applied_date = $form.applied_date || new Date();
				} else {
					$form.characterId = "";
					$form.characterName = "";
					// if (data.logId === "new") $form.applied_date = null;
				}
			}}
			clearable
			on:clear={() => {
				$form.characterId = "";
				$form.characterName = "";
				$form.applied_date = null;
			}}
		>
			Assigned Character
		</Combobox>
	</Control>
	<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
		<DateInput {superform} field="applied_date" empty="null" minField="date" required={!!$form.characterId}>
			Assigned Date
		</DateInput>
	</Control>
	<Control class="col-span-12 sm:col-span-4">
		<GenericInput labelFor="season" label="Season">
			<select id="season" bind:value={season} class="select select-bordered w-full">
				<option value={9}>Season 9+</option>
				<option value={8}>Season 8</option>
				<option value={1}>Season 1-7</option>
			</select>
		</GenericInput>
	</Control>
	{#if season === 1}
		<Control class="col-span-12 sm:col-span-4">
			<Input type="number" {superform} field="experience" min="0">Experience</Input>
		</Control>
	{/if}
	{#if season === 9}
		<Control class="col-span-12 sm:col-span-4">
			<Input type="number" {superform} field="level" min="0">Level</Input>
		</Control>
	{/if}
	{#if season === 8}
		<Control class="col-span-6 sm:col-span-2">
			<Input type="number" {superform} field="acp" min="0">ACP</Input>
		</Control>
		<Control class="col-span-6 sm:col-span-2">
			<Input type="number" {superform} field="tcp" min="0">TCP</Input>
		</Control>
	{/if}
	<Control class="col-span-6 sm:col-span-2">
		<Input type="number" {superform} field="gold" min="0">Gold</Input>
	</Control>
	<Control class="col-span-6 sm:col-span-2">
		<Input type="number" {superform} field="dtd" min="0">Downtime</Input>
	</Control>
	<Control class="col-span-12">
		<MdTextInput {superform} field="description" maxRows={20} preview>Notes</MdTextInput>
	</Control>
	<div class="no-script-hide col-span-12 flex flex-wrap gap-4">
		<button
			type="button"
			class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
			on:click={() => ($form.magic_items_gained = [...$form.magic_items_gained, { id: "", name: "", description: "" }])}
		>
			Add Magic Item
		</button>
		<button
			type="button"
			class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
			on:click={() => ($form.story_awards_gained = [...$form.story_awards_gained, { id: "", name: "", description: "" }])}
		>
			Add Story Award
		</button>
	</div>
	<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
		{#each $form.magic_items_gained as _, index}
			<EntityCard
				{superform}
				type="add"
				entity="magic_items"
				nameField={`magic_items_gained[${index}].name`}
				descField={`magic_items_gained[${index}].description`}
				on:delete={() => ($form.magic_items_gained = $form.magic_items_gained.filter((_, i) => i !== index))}
			/>
		{/each}
		{#each $form.story_awards_gained as _, index}
			<EntityCard
				{superform}
				type="add"
				entity="story_awards"
				nameField={`story_awards_gained[${index}].name`}
				descField={`story_awards_gained[${index}].description`}
				on:delete={() => ($form.story_awards_gained = $form.story_awards_gained.filter((_, i) => i !== index))}
			/>
		{/each}
		<div class="col-span-12 text-center">
			<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
				{#if $submitting}
					<span class="loading" />
				{/if}
				Save Log
			</button>
		</div>
	</div>
</SuperForm>
