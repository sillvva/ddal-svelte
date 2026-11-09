<script lang="ts">
	import CopyLogDraft from "#lib/components/copy-log-draft.svelte";
	import Error from "#lib/components/error.svelte";
	import AddDropItems from "#lib/components/forms/add-drop-items.svelte";
	import Combobox from "#lib/components/forms/combobox.svelte";
	import Control from "#lib/components/forms/control.svelte";
	import DateInput from "#lib/components/forms/date-input.svelte";
	import InputWrapper from "#lib/components/forms/input-wrapper.svelte";
	import Input from "#lib/components/forms/input.svelte";
	import MarkdownInput from "#lib/components/forms/md-input.svelte";
	import RemoteForm from "#lib/components/forms/remote-form.svelte";
	import Submit from "#lib/components/forms/submit.svelte";
	import Head from "#lib/components/head.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import PopulateLogDraft from "#lib/components/populate-log-draft.svelte";
	import { defaultDM, getItemEntities } from "#lib/entities.js";
	import { proxify } from "#lib/factories.svelte.js";
	import { advancementType, applyDraftToLog } from "#lib/log-draft.js";
	import * as API from "#lib/remote/index.js";
	import { type DungeonMasterId, logSchema } from "#lib/schemas.js";
	import { page } from "$app/state";
	import { v7 } from "uuid";

	let { params } = $props();

	let notesUploading = $state(false);
</script>

<svelte:boundary>
	{#snippet failed(error)}<Error {error} boundary="edit-character-log" />{/snippet}
	{const character = $derived(await API.characters.queries.get({ param: params.characterId }))}
	{const schema = logSchema}
	{const form = API.logs.forms.saveCharacter}
	{const firstLog = $derived(page.url.searchParams.get("firstLog") === "true")}
	{const fromDraft = $derived(page.url.searchParams.get("fromDraft") === "1")}
	{const draft = $derived(page.url.searchParams.get("draft") ?? "")}
	{const initialErrors = $derived(params.logId !== "new")}
	{#if params.logId}
		{const log = $derived(
			await API.logs.forms.character({
				character: { id: character.id, name: character.name },
				logId: params.logId,
				firstLog,
				draft
			})
		)}

		<Head title={`${log.name || "New Log"} - ${character.name}`} />

		<NavMenu
			crumbs={[
				{ title: "Characters", url: "/characters" },
				{ title: character.name, url: `/characters/${character.id}` },
				{ title: log.name || "New Log", url: `/characters/${character.id}/log/${log.id}` }
			]}
		>
			{#snippet actions()}
				{#if params.logId !== "new"}
					<CopyLogDraft logId={params.logId} />
				{/if}
			{/snippet}
		</NavMenu>

		{let data = $derived(proxify(log))}
		<RemoteForm {schema} {form} {data} {initialErrors}>
			{#snippet children(ctx)}
				{const { form, initial } = $derived(ctx)}
				{let advType = $state(advancementType(log))}
				{#if params.logId === "new" && !firstLog}
					<div class="col-span-12 mb-2">
						<PopulateLogDraft
							kind="character"
							auto={fromDraft}
							onapply={async (draft) => {
								const [dms, { user }] = await Promise.all([API.dms.queries.getAllWithoutLogs(), API.app.queries.request()]);
								if (!user) return;
								applyDraftToLog(data, draft, dms, user.id);
								form.fields.set(data);
								advType = advancementType(draft);
							}}
						/>
					</div>
				{/if}
				<Input field={form.fields.id} hidden />
				<Input field={form.fields.characterId} hidden />
				<Input field={form.fields.characterName} hidden />
				<Input field={form.fields.appliedDate} type="number" hidden />
				<Input field={form.fields.timezone} hidden />
				{#if !firstLog}
					<Control class="col-span-12 sm:col-span-2 md:col-span-3 lg:col-span-4">
						<InputWrapper field={form.fields.type} as="select" label="Log Type">
							<select
								{...form.fields.type.as("select")}
								id={form.fields.type.as("select").name}
								class={["select-bordered select w-full max-sm:text-base", data.type !== "game" && "text-xs!"]}
							>
								<option value="game">Game</option>
								<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
							</select>
						</InputWrapper>
					</Control>
				{/if}
				<Control class={["col-span-12", !firstLog ? "sm:col-span-5 lg:col-span-4" : "sm:col-span-6 md:col-span-7 lg:col-span-8"]}>
					<Input
						field={form.fields.name}
						type="text"
						label="Title"
						placeholder={firstLog ? "Introduction, Character Creation, etc." : ""}
						required
					/>
				</Control>
				<Control class={["col-span-12", !firstLog ? "sm:col-span-5 md:col-span-4" : "sm:col-span-6 md:col-span-5 lg:col-span-4"]}>
					<DateInput
						field={form.fields.date}
						initial={initial.date}
						label="Date"
						timezone={data.timezone}
						onchange={(timestamp) => {
							const available = getItemEntities(character, { excludeDropped: true, logId: log.id, asOf: timestamp });
							const itemIds = new Set<string>(available.magicItems.map((item) => item.id));
							const awardIds = new Set<string>(available.storyAwards.map((item) => item.id));
							const itemsLost = form.fields.magicItemsLost.value().filter((id) => !!id && itemIds.has(id));
							const awardsLost = form.fields.storyAwardsLost.value().filter((id) => !!id && awardIds.has(id));
							if (itemsLost.length !== form.fields.magicItemsLost.value().length) form.fields.magicItemsLost.set(itemsLost);
							if (awardsLost.length !== form.fields.storyAwardsLost.value().length) form.fields.storyAwardsLost.set(awardsLost);
						}}
					/>
				</Control>
				{const { magicItems, storyAwards } = $derived(
					getItemEntities(character, { excludeDropped: true, logId: log.id, asOf: form.fields.date.value() })
				)}
				{#if data.type === "game"}
					{#if !firstLog}
						{const dms = $derived(await API.dms.queries.getAllWithoutLogs())}
						{const request = $derived(await API.app.queries.request())}
						{const user = $derived(request.user!)}
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
								link={data.dm.id && data.dm.name ? `/dms/${data.dm.id}` : ""}
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
						<InputWrapper type="select" labelFor="adv-type" label="Advancement Type">
							<select
								id="adv-type"
								bind:value={advType}
								class="select-bordered select w-full max-sm:text-base"
								onchange={() => {
									data.experience = 0;
									data.acp = 0;
									data.level = 0;
									data.tcp = 0;
								}}
							>
								<option value="level">Level</option>
								<option value="acp">ACP/TCP</option>
								<option value="experience">Experience</option>
							</select>
						</InputWrapper>
					</Control>
					{#if advType === "experience"}
						<Control class="col-span-12 sm:col-span-4">
							<Input field={form.fields.experience} type="number" label="Experience" />
						</Control>
					{/if}
					{#if advType === "acp"}
						<Control class="col-span-6 sm:col-span-2">
							<Input field={form.fields.acp} type="number" label="ACP" />
						</Control>
					{/if}
					{#if advType === "level"}
						<Control class="col-span-12 sm:col-span-4">
							<Input
								field={form.fields.level}
								type="number"
								label="Level"
								max={Math.max(form.fields.level.value() || 0, 20 - character.totalLevel)}
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
				{#if advType === "acp" || data.type === "nongame"}
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
					<MarkdownInput
						field={form.fields.description}
						maxRows={20}
						maxLength={5000}
						preview
						images
						onpending={(count) => (notesUploading = count > 0)}
					/>
				</Control>
				<AddDropItems form={ctx} {magicItems} {storyAwards}>
					<Submit form={ctx} disabled={notesUploading}>Save Log</Submit>
				</AddDropItems>
			{/snippet}
		</RemoteForm>
	{/if}
</svelte:boundary>
