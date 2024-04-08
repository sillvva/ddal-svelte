<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import AddDropItems from "$lib/components/forms/AddDropItems.svelte";
	import Combobox from "$lib/components/forms/Combobox.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import DateInput from "$lib/components/forms/DateInput.svelte";
	import GenericInput from "$lib/components/forms/GenericInput.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import MdTextInput from "$lib/components/forms/MDTextInput.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { valibotForm } from "$lib/factories.js";
	import { logSchema } from "$lib/schemas";

	export let data;

	$: superform = valibotForm(data.form, logSchema);
	$: form = superform.form;

	let season: 1 | 8 | 9 = 9;
	$: season = $form.experience ? 1 : $form.acp ? 8 : 9;
</script>

{#key $form.id}
	<BreadCrumbs />

	<SuperForm action="?/saveLog" {superform} showMessage>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Input type="text" {superform} field="name">Title</Input>
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3 lg:[&_[data-segment]]:text-xs">
			<DateInput {superform} field="date">Date</DateInput>
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Combobox
				{superform}
				valueField="characterId"
				labelField="characterName"
				values={data.characters.map((char) => ({ value: char.id, label: char.name }))}
				required={!!$form.appliedDate || undefined}
				onselect={() => {
					$form.appliedDate = $form.appliedDate || new Date();
				}}
				clearable
				onclear={() => {
					$form.appliedDate = null;
				}}
			>
				Assigned Character
			</Combobox>
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3 lg:[&_[data-segment]]:text-xs">
			<DateInput {superform} field="appliedDate" empty="null" minDateField="date" required={!!$form.characterId}>Date</DateInput>
		</Control>
		<Control class="col-span-12 sm:col-span-4">
			<GenericInput labelFor="season" label="Season">
				<select id="season" bind:value={season} class="select select-bordered w-full">
					<option value={9}>Season 9+ (Level)</option>
					<option value={8}>Season 8 (ACP/TCP)</option>
					<option value={1}>Season 1-7 (Experience)</option>
				</select>
			</GenericInput>
		</Control>
		{#if season === 1}
			<Control class="col-span-12 sm:col-span-4">
				<Input type="number" {superform} field="experience">Experience</Input>
			</Control>
		{/if}
		{#if season === 9}
			<Control class="col-span-12 sm:col-span-4">
				<Input type="number" {superform} field="level">Level</Input>
			</Control>
		{/if}
		{#if season === 8}
			<Control class="col-span-6 sm:col-span-2">
				<Input type="number" {superform} field="acp">ACP</Input>
			</Control>
			<Control class="col-span-6 sm:col-span-2">
				<Input type="number" {superform} field="tcp">TCP</Input>
			</Control>
		{/if}
		<Control class="col-span-6 sm:col-span-2">
			<Input type="number" {superform} field="gold">Gold</Input>
		</Control>
		<Control class="col-span-6 sm:col-span-2">
			<Input type="number" {superform} field="dtd">Downtime</Input>
		</Control>
		<Control class="col-span-12">
			<MdTextInput {superform} field="description" maxRows={20} preview>Notes</MdTextInput>
		</Control>
		<AddDropItems {superform}>
			<Submit {superform}>Save Log</Submit>
		</AddDropItems>
	</SuperForm>
{/key}
