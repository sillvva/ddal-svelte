<script lang="ts" module>
	import type { PageData } from "./$types.js";
	export const getPageTitle = (data: Partial<PageData>) => data.form?.data.name || "New Log";
	export function getPageHead(data: Partial<PageData>) {
		return {
			title: data.form?.data.name || "New Log"
		};
	}
</script>

<script lang="ts">
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import AddDropItems from "$lib/components/forms/AddDropItems.svelte";
	import Combobox from "$lib/components/forms/Combobox.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import DateInput from "$lib/components/forms/DateInput.svelte";
	import GenericInput from "$lib/components/forms/GenericInput.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import MdTextInput from "$lib/components/forms/MDTextInput.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { valibotForm } from "$lib/factories.svelte.js";
	import * as LogsForms from "$lib/remote/logs/forms.remote";
	import { dMLogSchema } from "$lib/schemas";

	let { data, params } = $props();

	const superform = valibotForm(data.form, dMLogSchema(), {
		remote: (log) => LogsForms.save({ logId: params.logId, data: log })
	});
	const { form } = superform;

	let season = $state($form.experience ? 1 : $form.acp ? 8 : 9);
</script>

{#key $form.id}
	<Breadcrumbs />

	<SuperForm {superform}>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Input type="text" {superform} field="name" label="Title" />
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<DateInput {superform} field="date" label="Date" />
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<Combobox
				{superform}
				label="Assigned Character"
				valueField="characterId"
				inputField="characterName"
				values={data.characters.map((char) => ({ value: char.id, label: char.name }))}
				required={!!$form.appliedDate || undefined}
				onselect={() => {
					$form.appliedDate = $form.appliedDate || new Date();
				}}
				clearable
				onclear={() => {
					$form.appliedDate = null;
				}}
			/>
		</Control>
		<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
			<DateInput
				{superform}
				field="appliedDate"
				label="Assigned Date"
				empty="null"
				minDateField="date"
				required={!!$form.characterId}
			/>
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
				<Input type="number" {superform} field="experience" label="Experience" />
			</Control>
		{/if}
		{#if season === 9}
			<Control class="col-span-12 sm:col-span-4">
				<Input type="number" {superform} field="level" label="Level" />
			</Control>
		{/if}
		{#if season === 8}
			<Control class="col-span-6 sm:col-span-2">
				<Input type="number" {superform} field="acp" label="ACP" />
			</Control>
			<Control class="col-span-6 sm:col-span-2">
				<Input type="number" {superform} field="tcp" label="TCP" />
			</Control>
		{/if}
		<Control class="col-span-6 sm:col-span-2">
			<Input type="number" {superform} field="gold" label="Gold" />
		</Control>
		<Control class="col-span-6 sm:col-span-2">
			<Input type="number" {superform} field="dtd" label="Downtime" />
		</Control>
		<Control class="col-span-12">
			<MdTextInput {superform} field="description" name="notes" maxRows={20} preview />
		</Control>
		<AddDropItems {superform}>
			<Submit {superform}>Save Log</Submit>
		</AddDropItems>
	</SuperForm>
{/key}
