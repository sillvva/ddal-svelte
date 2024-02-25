<script lang="ts">
	import AddDropItems from "$lib/components/AddDropItems.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Combobox from "$lib/components/Combobox.svelte";
	import Control from "$lib/components/Control.svelte";
	import GenericInput from "$lib/components/GenericInput.svelte";
	import Input from "$lib/components/Input.svelte";
	import MdTextInput from "$lib/components/MDTextInput.svelte";
	import Submit from "$lib/components/Submit.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { logSchema, valibotForm } from "$lib/schemas";

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
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Input type="date" {superform} field="date">Date</Input>
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Combobox
				{superform}
				valueField="characterId"
				labelField="characterName"
				values={data.characters.map((char) => ({ value: char.id, label: char.name }))}
				required={!!$form.applied_date || undefined}
				onselect={() => {
					$form.applied_date = $form.applied_date || new Date();
				}}
				clearable
				onclear={() => {
					$form.applied_date = null;
				}}
			>
				Assigned Character
			</Combobox>
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Input type="date" {superform} field="applied_date" empty="null" minField="date" required={!!$form.characterId}>
				Assigned Date
			</Input>
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
		<AddDropItems {superform} />
		<Submit {superform}>Save Log</Submit>
	</SuperForm>
{/key}
