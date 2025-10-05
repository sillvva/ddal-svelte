<script lang="ts" module>
	import type { RouteParams } from "./$types.js";
	export async function getPageTitle(params: RouteParams) {
		const dmLog = await API.logs.forms.dm({
			param: { logId: params.logId }
		});
		return dmLog.form.data.name || "New Log";
	}
	export async function getPageHead(params: RouteParams) {
		const dmLog = await API.logs.forms.dm({
			param: { logId: params.logId }
		});
		return {
			title: dmLog.form.data.name || "New Log"
		};
	}
</script>

<script lang="ts">
	import AddDropItems from "$lib/components/forms/add-drop-items.svelte";
	import Combobox from "$lib/components/forms/combobox.svelte";
	import Control from "$lib/components/forms/control.svelte";
	import DateInput from "$lib/components/forms/date-input.svelte";
	import GenericInput from "$lib/components/forms/generic-input.svelte";
	import Input from "$lib/components/forms/input.svelte";
	import MdTextInput from "$lib/components/forms/md-input.svelte";
	import Submit from "$lib/components/forms/submit.svelte";
	import SuperForm from "$lib/components/forms/superform.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import { valibotForm } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { logSchema } from "$lib/schemas";

	const { params } = $props();

	const dmLog = await API.logs.forms.dm({
		param: { logId: params.logId }
	});
	const superform = valibotForm(dmLog.form, logSchema, {
		remote: API.logs.forms.save
	});
	const { form } = superform;

	let season = $state($form.experience ? 1 : $form.acp ? 8 : 9);
</script>

{#key $form.id}
	<NavMenu />

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
				values={dmLog.characters.map((char) => ({ value: char.id, label: char.name }))}
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
