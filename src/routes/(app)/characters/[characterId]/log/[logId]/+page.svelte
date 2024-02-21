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
		<Input type="text" {superform} field="name">Title</Input>
	</Control>
	<Control class="col-span-12 sm:col-span-4">
		<DateInput {superform} field="date">Date</DateInput>
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
				onselect={({ selected }) => {
					const id = selected?.value;
					const name = selected?.label;
					$form.dm = data.dms.find((dm) => dm.id === id) || (name ? { ...$form.dm, name } : defaultDM(data.user.id));
				}}
				clearable
				onclear={() => ($form.dm = defaultDM(data.user.id))}
				link={$form.dm.id ? `/dms/${$form.dm.id}` : ""}
				placeholder={data.user.name || "Me"}
			>
				DM Name
			</Combobox>
		</Control>
		<Control class="col-span-12 sm:col-span-6">
			<Input
				type="text"
				{superform}
				field="dm.DCI"
				disabled={!$form.dm.name}
				placeholder={$form.dm.name ? undefined : data.dms.find((dm) => dm.uid === data.user.id)?.DCI}
			>
				DM DCI
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
		{#if season === 8}
			<Control class="col-span-6 sm:col-span-2">
				<Input type="number" {superform} field="acp">ACP</Input>
			</Control>
		{/if}
		{#if season === 9}
			<Control class="col-span-12 sm:col-span-4">
				<Input type="number" {superform} field="level" max={Math.max($form.level, 20 - data.totalLevel)}>Level</Input>
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
