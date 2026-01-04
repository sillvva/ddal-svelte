<script lang="ts">
	import { page } from "$app/state";
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
	import TimeZone from "$lib/components/time-zone.svelte";
	import { defaultDM, getItemEntities } from "$lib/entities.js";
	import { proxify } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { type DungeonMasterId, logSchema } from "$lib/schemas";
	import { v7 } from "uuid";

	let { params } = $props();

	// svelte-ignore await_waterfall
	const request = $derived(await API.app.queries.request());
	const user = $derived(request.user!);
	// svelte-ignore await_waterfall
	const character = $derived(await API.characters.queries.get({ param: params.characterId }));
	// svelte-ignore await_waterfall
	const dms = $derived(await API.dms.queries.getAllWithoutLogs());
	const { magicItems, storyAwards } = $derived(getItemEntities(character, { excludeDropped: true, lastLogId: params.logId }));

	const schema = logSchema;
	const form = API.logs.forms.saveCharacter;
	const firstLog = $derived(page.url.searchParams.get("firstLog") === "true");
	const initialErrors = $derived(params.logId !== "new");
	// svelte-ignore await_waterfall
	const log = $derived(
		await API.logs.forms.character({ character: { id: character.id, name: character.name }, logId: params.logId, firstLog })
	);

	let data = $derived(proxify(log));
	let season = $derived(log.experience ? 1 : log.acp ? 8 : 9);
</script>

<svelte:boundary>
	{#snippet failed(error)}<Error {error} boundary="edit-character-log" />{/snippet}
	<Head title={`${log.name || "New Log"} - ${character.name}`} />

	<NavMenu
		crumbs={[
			{ title: "Characters", url: "/characters" },
			{ title: character.name, url: `/characters/${character.id}` },
			{ title: log.name || "New Log", url: `/characters/${character.id}/log/${log.id}` }
		]}
	/>

	<RemoteForm {schema} {form} {data} {initialErrors}>
		{#snippet children({ form, initial })}
			<Input field={form.fields.id} hidden />
			<Input field={form.fields.characterId} hidden />
			<Input field={form.fields.characterName} hidden />
			<Input field={form.fields.appliedDate} type="number" hidden />
			{#if !firstLog}
				<Control class="col-span-12 sm:col-span-4 lg:col-span-3">
					<InputWrapper field={form.fields.type} as="select" label="Log Type">
						<select
							{...form.fields.type.as("select")}
							class={["select select-bordered w-full", data.type !== "game" && "text-xs!"]}
						>
							<option value="game">Game</option>
							<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
						</select>
					</InputWrapper>
				</Control>
			{/if}
			<Control class={["col-span-12", !firstLog ? "sm:col-span-8 lg:col-span-3" : "sm:col-span-4 md:col-span-5 lg:col-span-6"]}>
				<Input
					field={form.fields.name}
					type="text"
					label="Title"
					placeholder={firstLog ? "Introduction, Character Creation, etc." : ""}
					required
				/>
			</Control>
			<Control class={["col-span-12", !firstLog ? "sm:col-span-6 lg:col-span-3" : "sm:col-span-4 lg:col-span-3"]}>
				<DateInput field={form.fields.date} initial={initial.date} label="Date" timezone={data.timezone} />
			</Control>
			<Control class={["col-span-12", !firstLog ? "sm:col-span-6 lg:col-span-3" : "sm:col-span-4 md:col-span-3"]}>
				<InputWrapper field={form.fields.timezone} as="select" label="Time Zone">
					<TimeZone field={form.fields.timezone} />
				</InputWrapper>
			</Control>
			{#if data.type === "game"}
				{#if !firstLog}
					<Control class="col-span-12 sm:col-span-6">
						<Combobox
							label="DM Name"
							valueField={form.fields.dm.id}
							inputField={form.fields.dm.name}
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
						<Input
							field={form.fields.dm.DCI}
							type="text"
							disabled={!data.dm.name}
							placeholder={data.dm.name ? undefined : dms.find((dm) => dm.isUser)?.DCI}
							label="DM DCI"
						/>
						{#if !data.dm.name}
							<Input field={form.fields.dm.DCI} hidden />
						{/if}
					</Control>
				{:else}
					<Input field={form.fields.dm.id} hidden />
					<Input field={form.fields.dm.name} hidden />
					<Input field={form.fields.dm.DCI} hidden />
				{/if}
				<Input field={form.fields.dm.userId} hidden />
				<Input field={form.fields.dm.isUser} type="checkbox" hidden />
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
						<Input field={form.fields.experience} type="number" label="Experience" />
					</Control>
				{/if}
				{#if season === 8}
					<Control class="col-span-6 sm:col-span-2">
						<Input field={form.fields.acp} type="number" label="ACP" />
					</Control>
				{/if}
				{#if season === 9}
					<Control class="col-span-12 sm:col-span-4">
						<Input
							field={form.fields.level}
							type="number"
							label="Level"
							max={Math.max(form.fields.level.value(), 20 - character.totalLevel)}
						/>
					</Control>
				{/if}
			{:else}
				<Input field={form.fields.dm.id} hidden />
				<Input field={form.fields.dm.name} hidden />
				<Input field={form.fields.dm.DCI} hidden />
				<Input field={form.fields.dm.userId} hidden />
				<Input field={form.fields.dm.isUser} type="checkbox" hidden />
			{/if}
			{#if season === 8 || data.type === "nongame"}
				<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
					<Input field={form.fields.tcp} type="number" label="TCP" />
				</Control>
			{/if}
			<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
				<Input field={form.fields.gold} type="number" label="Gold" />
			</Control>
			<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
				<Input field={form.fields.dtd} type="number" label="Downtime" />
			</Control>
			<Control class="col-span-12 w-full">
				<MarkdownInput field={form.fields.description} name="notes" maxRows={20} maxLength={5000} preview />
			</Control>
			<AddDropItems {magicItems} {storyAwards}>
				<Submit>Save Log</Submit>
			</AddDropItems>
		{/snippet}
	</RemoteForm>
</svelte:boundary>
