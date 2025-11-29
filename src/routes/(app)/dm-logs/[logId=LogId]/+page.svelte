<script lang="ts">
	import Error from "$lib/components/error.svelte";
	import AddDropItems from "$lib/components/forms/add-drop-items.svelte";
	import Combobox from "$lib/components/forms/combobox.svelte";
	import Control from "$lib/components/forms/control.svelte";
	import DateInput from "$lib/components/forms/date-input.svelte";
	import InputWrapper from "$lib/components/forms/input-wrapper.svelte";
	import Input from "$lib/components/forms/input.svelte";
	import MarkdownInput from "$lib/components/forms/md-input.svelte";
	import RemoteForm from "$lib/components/forms/remote-form.svelte";
	import Submit from "$lib/components/forms/submit.svelte";
	import Head from "$lib/components/head.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import * as API from "$lib/remote";
	import { dmLogSchema } from "$lib/schemas";

	const { params } = $props();

	const schema = dmLogSchema;
	const form = API.logs.forms.saveDM;
	const initialErrors = $derived(params.logId !== "new");
	// svelte-ignore await_waterfall
	const log = $derived(
		await API.logs.forms.dm({
			param: { logId: params.logId }
		})
	);
	const characters = $derived(await API.characters.queries.getAllSelect());

	let data = $derived.by(() => {
		const data = $state(log);
		return data;
	});
	let season = $derived(log.experience ? 1 : log.acp ? 8 : 9);
</script>

<svelte:boundary>
	{#snippet failed(error)}<Error {error} boundary="edit-dm-log" />{/snippet}
	<Head title={log.name || "New Log"} />

	<NavMenu
		crumbs={[
			{ title: "DM Logs", url: "/dm-logs" },
			{ title: log.name || "New Log", url: `/dm-logs/${log.id}` }
		]}
	/>

	<RemoteForm {schema} {form} {data} {initialErrors}>
		{#snippet children({ fields })}
			<Input field={fields.id} type="hidden" />
			<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
				<Input field={fields.name} label="Title" required />
			</Control>
			<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
				<DateInput field={fields.date} label="Date" />
			</Control>
			<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
				<Combobox
					label="Assigned Character"
					valueField={fields.characterId}
					inputField={fields.characterName}
					values={characters.map((char) => ({ value: char.id, label: char.name }))}
					required={!!data.appliedDate}
					onselect={() => {
						data.appliedDate = data.date || new Date().getTime();
					}}
					clearable
					onclear={() => {
						data.appliedDate = 0;
					}}
				/>
			</Control>
			<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
				<DateInput field={fields.appliedDate} label="Assigned Date" min={data.date} required={!!data.characterId} />
			</Control>
			<Control class="col-span-12 sm:col-span-4">
				<InputWrapper type="select" labelFor="season" label="Season">
					<select
						id="season"
						bind:value={season}
						class="select select-bordered w-full"
						onchange={() => {
							data.experience = 0;
							data.acp = 0;
							data.level = 0;
							data.tcp = 0;
						}}
					>
						<option value={9}>Season 9+ (Level)</option>
						<option value={8}>Season 8 (ACP/TCP)</option>
						<option value={1}>Season 1-7 (Experience)</option>
					</select>
				</InputWrapper>
			</Control>
			{#if season === 1}
				<Control class="col-span-12 sm:col-span-4">
					<Input field={fields.experience} type="number" label="Experience" />
				</Control>
			{/if}
			{#if season === 9}
				<Control class="col-span-12 sm:col-span-4">
					<Input field={fields.level} type="number" label="Level" />
				</Control>
			{/if}
			{#if season === 8}
				<Control class="col-span-6 sm:col-span-2">
					<Input field={fields.acp} type="number" label="ACP" />
				</Control>
				<Control class="col-span-6 sm:col-span-2">
					<Input field={fields.tcp} type="number" label="TCP" />
				</Control>
			{/if}
			<Control class="col-span-6 sm:col-span-2">
				<Input field={fields.gold} type="number" label="Gold" />
			</Control>
			<Control class="col-span-6 sm:col-span-2">
				<Input field={fields.dtd} type="number" label="Downtime" />
			</Control>
			<Control class="col-span-12">
				<MarkdownInput field={fields.description} name="notes" maxLength={5000} maxRows={20} preview />
			</Control>
			<AddDropItems {fields}>
				<Submit>Save Log</Submit>
			</AddDropItems>
		{/snippet}
	</RemoteForm>
</svelte:boundary>
