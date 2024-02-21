<script lang="ts">
	import AddDropItems from "$lib/components/AddDropItems.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Combobox from "$lib/components/Combobox.svelte";
	import Control from "$lib/components/Control.svelte";
	import DateInput from "$lib/components/DateInput.svelte";
	import GenericInput from "$lib/components/GenericInput.svelte";
	import Input from "$lib/components/Input.svelte";
	import MdTextInput from "$lib/components/MDTextInput.svelte";
	import Submit from "$lib/components/Submit.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { defaultDM } from "$lib/entities";
	import { logSchema } from "$lib/schemas";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";

	export let data;

	let superform = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(logSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form } = superform;

	let season: 1 | 8 | 9 = $form.experience ? 1 : $form.acp ? 8 : 9;

	function setDM(id: string, value: Partial<{ name: string; DCI: string | null }>) {
		$form.dm =
			data.dms.find((dm) => dm.id === id) ||
			(("name" in value ? value.name : $form.dm.name) || ("DCI" in value ? value.DCI : $form.dm.DCI)
				? {
						...$form.dm,
						...value
					}
				: defaultDM(data.user.id));
	}
</script>

<BreadCrumbs />

<SuperForm action="?/saveLog" {superform} showMessage>
	<Control class="col-span-12 sm:col-span-4">
		<GenericInput {superform} field="type" label="Log Type">
			<select id="type" bind:value={$form.type} class="select select-bordered w-full">
				<option value="game">Game</option>
				<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
			</select>
		</GenericInput>
	</Control>
	<Control class="col-span-12 sm:col-span-4">
		<Input type="text" {superform} field="name" required>Title</Input>
	</Control>
	<Control class="col-span-12 sm:col-span-4">
		<DateInput {superform} field="date" required>Date</DateInput>
	</Control>
	{#if $form.type === "game"}
		<Control class="col-span-12 sm:col-span-6">
			<Combobox
				{superform}
				idField="dm.id"
				field="dm.name"
				values={data.dms.map((dm) => ({
					value: dm.id,
					label: dm.name,
					itemLabel: dm.name + (dm.uid === data.user.id ? ` (Me)` : "") + (dm.DCI ? ` (${dm.DCI})` : "")
				})) || []}
				allowCustom
				required={!!$form.dm.DCI}
				on:select={(e) => setDM(e.detail?.selected?.value || "", { name: e.detail?.input })}
				clearable
				on:clear={() => ($form.dm = defaultDM(data.user.id))}
			>
				DM Name
			</Combobox>
		</Control>
		<Control class="col-span-12 sm:col-span-6">
			<Combobox
				{superform}
				idField="dm.id"
				field="dm.DCI"
				values={data.dms
					.filter((dm) => dm.DCI)
					.map((dm) => ({
						value: dm.id,
						label: dm.DCI || "",
						itemLabel: `${dm.DCI} (${dm.name}${dm.uid === data.user.id ? `, Me` : ""})`
					})) || []}
				allowCustom
				on:select={(e) => setDM(e.detail?.selected?.value || "", { DCI: e.detail?.input || null })}
				clearable
				on:clear={() => ($form.dm = defaultDM(data.user.id))}
			>
				DM DCI
			</Combobox>
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
		{#if season === 8}
			<Control class="col-span-6 sm:col-span-2">
				<Input type="number" {superform} field="acp" min="0">ACP</Input>
			</Control>
		{/if}
		{#if season === 9}
			<Control class="col-span-12 sm:col-span-4">
				<Input type="number" {superform} field="level" min="0" max={Math.max($form.level, 20 - data.totalLevel)}>Level</Input>
			</Control>
		{/if}
	{/if}
	{#if season === 8 || $form.type === "nongame"}
		<Control class={$form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
			<Input type="number" {superform} field="tcp">TCP</Input>
		</Control>
	{/if}
	<Control class={$form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
		<Input type="number" {superform} field="gold">Gold</Input>
	</Control>
	<Control class={$form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
		<Input type="number" {superform} field="dtd">Downtime</Input>
	</Control>
	<Control class="col-span-12 w-full">
		<MdTextInput {superform} field="description" maxRows={20} preview>Notes</MdTextInput>
	</Control>
	<AddDropItems {superform} magicItems={data.magicItems} storyAwards={data.storyAwards} />
	<Submit {superform}>Save Log</Submit>
</SuperForm>
