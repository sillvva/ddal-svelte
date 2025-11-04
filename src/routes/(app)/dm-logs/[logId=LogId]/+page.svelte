<script lang="ts">
	import Error from "$lib/components/error.svelte";
	import Control from "$lib/components/forms/control.svelte";
	import GenericInput from "$lib/components/forms/generic-input.svelte";
	import RemoteAddDropItems from "$lib/components/forms/remote-add-drop-items.svelte";
	import RemoteCombobox from "$lib/components/forms/remote-combobox.svelte";
	import RemoteDateInput from "$lib/components/forms/remote-date-input.svelte";
	import RemoteForm from "$lib/components/forms/remote-form.svelte";
	import RemoteInput from "$lib/components/forms/remote-input.svelte";
	import RemoteMdInput from "$lib/components/forms/remote-md-input.svelte";
	import RemoteSubmit from "$lib/components/forms/remote-submit.svelte";
	import Head from "$lib/components/head.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import * as API from "$lib/remote";
	import { dmLogSchema } from "$lib/schemas";
	import { getAuth } from "$lib/stores.svelte.js";

	const { params } = $props();

	const auth = $derived(await getAuth());

	const schema = dmLogSchema;
	const form = API.logs.forms.saveDM;
	const { log, characters, initialErrors } = await API.logs.forms.dm({
		param: { logId: params.logId }
	});

	let data = $state(log);
	let season = $state(log.experience ? 1 : log.acp ? 8 : 9);
</script>

{#key log.id}
	<Head title={log.name || "New Log"} />

	<NavMenu
		crumbs={[
			{ title: "DM Logs", url: "/dm-logs" },
			{ title: log.name || "New Log", url: `/dm-logs/${log.id}` }
		]}
	/>

	{#if auth.user}
		<svelte:boundary>
			{#snippet failed(error)}<Error {error} />{/snippet}
			<RemoteForm {schema} {form} {data} {initialErrors}>
				{#snippet children({ fields })}
					<RemoteInput field={fields.id} type="hidden" />
					<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
						<RemoteInput field={fields.name} type="text" label="Title" required />
					</Control>
					<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
						<RemoteDateInput field={fields.date} label="Date" />
					</Control>
					<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
						<RemoteCombobox
							label="Assigned Character"
							valueField={fields.characterId}
							inputField={fields.characterName}
							values={characters.map((char) => ({ value: char.id, label: char.name }))}
							required={!!data.appliedDate || undefined}
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
						<RemoteDateInput field={fields.appliedDate} label="Assigned Date" min={data.date} required={!!data.characterId} />
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
							<RemoteInput field={fields.experience} type="number" label="Experience" />
						</Control>
					{/if}
					{#if season === 9}
						<Control class="col-span-12 sm:col-span-4">
							<RemoteInput field={fields.level} type="number" label="Level" />
						</Control>
					{/if}
					{#if season === 8}
						<Control class="col-span-6 sm:col-span-2">
							<RemoteInput field={fields.acp} type="number" label="ACP" />
						</Control>
						<Control class="col-span-6 sm:col-span-2">
							<RemoteInput field={fields.tcp} type="number" label="TCP" />
						</Control>
					{/if}
					<Control class="col-span-6 sm:col-span-2">
						<RemoteInput field={fields.gold} type="number" label="Gold" />
					</Control>
					<Control class="col-span-6 sm:col-span-2">
						<RemoteInput field={fields.dtd} type="number" label="Downtime" />
					</Control>
					<Control class="col-span-12">
						<RemoteMdInput field={fields.description} name="notes" maxLength={5000} maxRows={20} preview />
					</Control>
					<RemoteAddDropItems {fields} bind:log={data}>
						<RemoteSubmit>Save Log</RemoteSubmit>
					</RemoteAddDropItems>
				{/snippet}
			</RemoteForm>
		</svelte:boundary>
	{/if}
{/key}
