<script lang="ts">
	import AddDropItems from "$lib/components/AddDropItems.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Combobox from "$lib/components/Combobox.svelte";
	import Control from "$lib/components/Control.svelte";
	import DateInput from "$lib/components/DateInput.svelte";
	import GenericInput from "$lib/components/GenericInput.svelte";
	import Input from "$lib/components/Input.svelte";
	import MdTextInput from "$lib/components/MDTextInput.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { dMLogSchema } from "$lib/schemas";
	import Submit from "$src/lib/components/Submit.svelte";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";

	export let data;

	let superform = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(dMLogSchema(data.characters)),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form } = superform;

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
	<AddDropItems {superform} />
	<Submit {superform}>Save Log</Submit>
</SuperForm>
