<script lang="ts" module>
	import type { RouteParams } from "./$types.js";
	export async function getPageTitle(params: RouteParams) {
		const data = await API.logs.forms.dm({
			param: { logId: params.logId }
		});
		return data.log.name || "New Log";
	}
	export async function getPageHead(params: RouteParams) {
		const data = await API.logs.forms.dm({
			param: { logId: params.logId }
		});
		return {
			title: data.log.name || "New Log"
		};
	}
</script>

<script lang="ts">
	import Control from "$lib/components/forms/control.svelte";
	import GenericInput from "$lib/components/forms/generic-input.svelte";
	import RemoteAddDropItems from "$lib/components/forms/remote-add-drop-items.svelte";
	import RemoteCombobox from "$lib/components/forms/remote-combobox.svelte";
	import RemoteDateInput from "$lib/components/forms/remote-date-input.svelte";
	import RemoteForm from "$lib/components/forms/remote-form.svelte";
	import RemoteInput from "$lib/components/forms/remote-input.svelte";
	import RemoteMdInput from "$lib/components/forms/remote-md-input.svelte";
	import RemoteSubmit from "$lib/components/forms/remote-submit.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import * as API from "$lib/remote";
	import { logSchema } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte.js";

	const { params } = $props();

	const global = getGlobal();

	const schema = logSchema;
	const remoteForm = API.logs.forms.save;
	const { log, characters, initialErrors } = await API.logs.forms.dm({
		param: { logId: params.logId }
	});

	let season = $state(log.experience ? 1 : log.acp ? 8 : 9);
</script>

{#key log.id}
	<NavMenu />

	{#if global.user}
		<RemoteForm {schema} form={remoteForm} data={log} {initialErrors}>
			{#snippet children({ fields })}
				<RemoteInput field={fields.id} type="hidden" />
				<RemoteInput field={fields.dm.id} type="hidden" />
				<RemoteInput field={fields.dm.name} type="hidden" />
				<RemoteInput field={fields.dm.DCI} type="hidden" />
				<RemoteInput field={fields.dm.userId} type="hidden" />
				<RemoteInput field={fields.dm.isUser} type="checkbox" hidden />
				<RemoteInput field={fields.isDmLog} type="checkbox" hidden />
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
						required={!!fields.appliedDate.value() || undefined}
						onselect={() => {
							fields.appliedDate.set(fields.date.value() || new Date().getTime());
						}}
						clearable
						onclear={() => {
							fields.appliedDate.set(0);
						}}
					/>
				</Control>
				<Control class="col-span-12 sm:col-span-6 lg:col-span-3">
					<RemoteDateInput
						field={fields.appliedDate}
						label="Assigned Date"
						min={fields.date.value()}
						required={!!fields.characterId.value()}
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
				<RemoteAddDropItems form={fields}>
					<RemoteSubmit>Save Log</RemoteSubmit>
				</RemoteAddDropItems>
			{/snippet}
		</RemoteForm>
	{/if}
{/key}
