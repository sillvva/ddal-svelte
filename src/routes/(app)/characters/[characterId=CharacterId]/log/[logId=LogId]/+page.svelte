<script lang="ts" module>
	import type { RouteParams } from "./$types.js";
	export async function getPageHead(params: RouteParams) {
		const data = await API.logs.forms.character({
			param: { characterId: params.characterId, logId: params.logId }
		});
		return {
			title: data.log.name || "New Log"
		};
	}
</script>

<script lang="ts">
	import { page } from "$app/state";
	import Error from "$lib/components/error.svelte";
	import Control from "$lib/components/forms/control.svelte";
	import GenericInput from "$lib/components/forms/generic-input.svelte";
	import RemoteAddDropItems from "$lib/components/forms/remote-add-drop-items.svelte";
	import RemoteCombobox from "$lib/components/forms/remote-combobox.svelte";
	import RemoteDateInput from "$lib/components/forms/remote-date-input.svelte";
	import RemoteForm from "$lib/components/forms/remote-form.svelte";
	import RemoteGenericInput from "$lib/components/forms/remote-generic-input.svelte";
	import RemoteInput from "$lib/components/forms/remote-input.svelte";
	import RemoteMdInput from "$lib/components/forms/remote-md-input.svelte";
	import RemoteSubmit from "$lib/components/forms/remote-submit.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import { defaultDM } from "$lib/entities.js";
	import * as API from "$lib/remote";
	import { type DungeonMasterId, logSchema } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { v7 } from "uuid";

	let { params } = $props();

	const global = getGlobal();
	const user = $derived(global.user!);

	const schema = logSchema;
	const form = API.logs.forms.saveCharacter;
	const firstLog = page.url.searchParams.get("firstLog") === "true";
	const character = await API.characters.queries.get({ param: params.characterId });
	const { log, initialErrors, totalLevel, dms, magicItems, storyAwards } = await API.logs.forms.character({
		param: { characterId: params.characterId, logId: params.logId, firstLog }
	});

	let data = $state(log);
	let season = $state(log.experience ? 1 : log.acp ? 8 : 9);
</script>

{#key log.id}
	<NavMenu
		crumbs={[
			{ title: "Characters", url: "/characters" },
			{ title: character.name, url: `/characters/${character.id}` },
			{ title: log.name || "New Log", url: `/characters/${character.id}/log/${log.id}` }
		]}
	/>

	<svelte:boundary>
		{#snippet failed(error)}<Error {error} />{/snippet}
		<RemoteForm {schema} {form} bind:data {initialErrors}>
			{#snippet children({ fields })}
				<RemoteInput field={fields.id} type="hidden" />
				<RemoteInput field={fields.characterId} type="hidden" />
				<RemoteInput field={fields.characterName} type="hidden" />
				<RemoteInput field={fields.appliedDate} type="number" hidden />
				{#if !firstLog}
					<Control class="col-span-12 sm:col-span-4">
						<RemoteGenericInput field={fields.type} as="select" label="Log Type">
							<select {...fields.type.as("select")} class="select select-bordered w-full">
								<option value="game">Game</option>
								<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
							</select>
						</RemoteGenericInput>
					</Control>
				{/if}
				<Control class={["col-span-12", !firstLog ? "sm:col-span-4" : "sm:col-span-6"]}>
					<RemoteInput
						field={fields.name}
						type="text"
						label="Title"
						placeholder={firstLog ? "Introduction, Character Creation, etc." : ""}
						required
					/>
				</Control>
				<Control class={["col-span-12", !firstLog ? "sm:col-span-4" : "sm:col-span-6"]}>
					<RemoteDateInput field={fields.date} label="Date" />
				</Control>
				{#if data.type === "game"}
					{#if !firstLog}
						<Control class="col-span-12 sm:col-span-6">
							<RemoteCombobox
								label="DM Name"
								valueField={fields.dm.id}
								inputField={fields.dm.name}
								values={dms.map((dm) => ({
									value: dm.id,
									label: dm.name,
									itemLabel: dm.name + (dm.isUser ? ` (Me)` : "") + (dm.DCI ? ` (${dm.DCI})` : "")
								})) || []}
								allowCustom
								onselect={({ selected }) => {
									const id = (selected?.value || v7()) as DungeonMasterId;
									const name = selected?.label;
									data.dm = dms.find((dm) => dm.id === id) || (name ? { ...data.dm, id, name } : defaultDM(user.id));
								}}
								clearable
								onclear={() => (data.dm = defaultDM(user.id))}
								link={data.dm.id ? `/dms/${data.dm.id}` : ""}
								placeholder={dms.find((dm) => dm.isUser)?.name || user.name}
							/>
						</Control>
						<Control class="col-span-12 sm:col-span-6">
							<RemoteInput
								field={fields.dm.DCI}
								type="text"
								disabled={!data.dm.name}
								placeholder={data.dm.name ? undefined : dms.find((dm) => dm.isUser)?.DCI}
								label="DM DCI"
							/>
							{#if !data.dm.name}
								<RemoteInput field={fields.dm.DCI} type="text" hidden />
							{/if}
						</Control>
					{:else}
						<RemoteInput field={fields.dm.id} type="hidden" />
						<RemoteInput field={fields.dm.name} type="text" hidden />
						<RemoteInput field={fields.dm.DCI} type="text" hidden />
					{/if}
					<RemoteInput field={fields.dm.userId} type="hidden" />
					<RemoteInput field={fields.dm.isUser} type="checkbox" hidden />
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
					{#if season === 8}
						<Control class="col-span-6 sm:col-span-2">
							<RemoteInput field={fields.acp} type="number" label="ACP" />
						</Control>
					{/if}
					{#if season === 9}
						<Control class="col-span-12 sm:col-span-4">
							<RemoteInput
								field={fields.level}
								type="number"
								label="Level"
								max={Math.max(fields.level.value(), 20 - totalLevel)}
							/>
						</Control>
					{/if}
				{:else}
					<RemoteInput field={fields.dm.id} type="hidden" />
					<RemoteInput field={fields.dm.name} type="text" hidden />
					<RemoteInput field={fields.dm.DCI} type="text" hidden />
					<RemoteInput field={fields.dm.userId} type="hidden" />
					<RemoteInput field={fields.dm.isUser} type="checkbox" hidden />
				{/if}
				{#if season === 8 || data.type === "nongame"}
					<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
						<RemoteInput field={fields.tcp} type="number" label="TCP" />
					</Control>
				{/if}
				<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
					<RemoteInput field={fields.gold} type="number" label="Gold" />
				</Control>
				<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
					<RemoteInput field={fields.dtd} type="number" label="Downtime" />
				</Control>
				<Control class="col-span-12 w-full">
					<RemoteMdInput field={fields.description} name="notes" maxRows={20} maxLength={5000} preview />
				</Control>
				<RemoteAddDropItems {fields} bind:log={data} {magicItems} {storyAwards}>
					<RemoteSubmit>Save Log</RemoteSubmit>
				</RemoteAddDropItems>
			{/snippet}
		</RemoteForm>
	</svelte:boundary>
{/key}
