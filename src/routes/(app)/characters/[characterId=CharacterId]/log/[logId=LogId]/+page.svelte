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
	import { defaultDM } from "$lib/entities";
	import { valibotForm } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { type DungeonMasterId, logSchema } from "$lib/schemas";

	let { data } = $props();

	const superform = valibotForm(data.form, logSchema, {
		remote: API.logs.forms.save
	});
	const { form } = superform;

	let season = $state($form.experience ? 1 : $form.acp ? 8 : 9);
</script>

{#key $form.id || "new"}
	<Breadcrumbs />

	<SuperForm {superform}>
		{#if !data.firstLog}
			<Control class="col-span-12 sm:col-span-4">
				<GenericInput {superform} field="type" label="Log Type">
					<select id="type" bind:value={$form.type} class="select select-bordered w-full">
						<option value="game">Game</option>
						<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
					</select>
				</GenericInput>
			</Control>
		{/if}
		<Control class={["col-span-12", !data.firstLog ? "sm:col-span-4" : "sm:col-span-6"]}>
			<Input
				type="text"
				{superform}
				field="name"
				label="Title"
				placeholder={data.firstLog ? "Introduction, Character Creation, etc." : ""}
			/>
		</Control>
		<Control class={["col-span-12", !data.firstLog ? "sm:col-span-4" : "sm:col-span-6"]}>
			<DateInput {superform} field="date" label="Date" />
		</Control>
		{#if $form.type === "game"}
			{#if !data.firstLog}
				<Control class="col-span-12 sm:col-span-6">
					<Combobox
						{superform}
						label="DM Name"
						valueField="dm.id"
						inputField="dm.name"
						values={data.dms.map((dm) => ({
							value: dm.id,
							label: dm.name,
							itemLabel: dm.name + (dm.isUser ? ` (Me)` : "") + (dm.DCI ? ` (${dm.DCI})` : "")
						})) || []}
						allowCustom
						onselect={({ selected }) => {
							const id = (selected?.value || "") as DungeonMasterId;
							const name = selected?.label;
							$form.dm = data.dms.find((dm) => dm.id === id) || (name ? { ...$form.dm, id, name } : defaultDM(data.user.id));
						}}
						clearable
						onclear={() => ($form.dm = defaultDM(data.user.id))}
						link={$form.dm.id ? `/dms/${$form.dm.id}` : ""}
						placeholder={data.dms.find((dm) => dm.isUser)?.name || data.user.name}
					/>
				</Control>
				<Control class="col-span-12 sm:col-span-6">
					<Input
						type="text"
						{superform}
						field="dm.DCI"
						disabled={!$form.dm.name}
						placeholder={$form.dm.name ? undefined : data.dms.find((dm) => dm.isUser)?.DCI}
						label="DM DCI"
					/>
				</Control>
			{/if}
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
			{#if season === 8}
				<Control class="col-span-6 sm:col-span-2">
					<Input type="number" {superform} field="acp" label="ACP" />
				</Control>
			{/if}
			{#if season === 9}
				<Control class="col-span-12 sm:col-span-4">
					<Input type="number" {superform} field="level" label="Level" max={Math.max($form.level, 20 - data.totalLevel)} />
				</Control>
			{/if}
		{/if}
		{#if season === 8 || $form.type === "nongame"}
			<Control class={$form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
				<Input type="number" {superform} field="tcp" label="TCP" />
			</Control>
		{/if}
		<Control class={$form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
			<Input type="number" {superform} field="gold" label="Gold" />
		</Control>
		<Control class={$form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
			<Input type="number" {superform} field="dtd" label="Downtime" />
		</Control>
		<Control class="col-span-12 w-full">
			<MdTextInput {superform} field="description" name="notes" maxRows={20} preview />
		</Control>
		<AddDropItems {superform} magicItems={data.magicItems} storyAwards={data.storyAwards}>
			<Submit {superform}>Save Log</Submit>
		</AddDropItems>
	</SuperForm>
{/key}
