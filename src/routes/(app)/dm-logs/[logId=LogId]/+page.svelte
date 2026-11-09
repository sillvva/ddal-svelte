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
	import { proxify } from "#lib/factories.svelte.js";
	import { advancementType, applyDraftToDmLog } from "#lib/log-draft.js";
	import * as API from "#lib/remote/index.js";
	import { dmLogSchema } from "#lib/schemas.js";
	import { page } from "$app/state";

	const { params } = $props();

	let notesUploading = $state(false);

	const schema = dmLogSchema;
	const form = API.logs.forms.saveDM;
	const initialErrors = $derived(params.logId !== "new");
	const draft = $derived(page.url.searchParams.get("draft") ?? "");
	const fromDraft = $derived(page.url.searchParams.get("fromDraft") === "1");
</script>

<svelte:boundary>
	{#snippet failed(error)}<Error {error} boundary="edit-dm-log" />{/snippet}
	{#if params.logId}
		{const log = $derived(
			await API.logs.forms.dm({
				param: { logId: params.logId },
				draft
			})
		)}

		<Head title={log.name || "New Log"} />

		<NavMenu
			crumbs={[
				{ title: "DM Logs", url: "/dm-logs" },
				{ title: log.name || "New Log", url: `/dm-logs/${log.id}` }
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
				{#if params.logId === "new"}
					<div class="col-span-12 mb-2">
						<PopulateLogDraft
							kind="dm"
							auto={fromDraft}
							onapply={(draft) => {
								applyDraftToDmLog(data, draft);
								form.fields.set(data);
								advType = advancementType(draft);
							}}
						/>
					</div>
				{/if}
				<Input field={form.fields.id} type="hidden" />
				<Input field={form.fields.timezone} hidden />
				<Control class="col-span-12 sm:col-span-7">
					<Input field={form.fields.name} label="Title" required />
				</Control>
				<Control class="col-span-12 sm:col-span-5">
					<DateInput field={form.fields.date} initial={initial.date} label="Date" timezone={data.timezone} />
				</Control>
				<Control class="col-span-12 sm:col-span-7">
					{const characters = $derived(await API.characters.queries.getAllSelect())}
					<Combobox
						label="Assigned Character"
						valueField={form.fields.characterId}
						inputField={form.fields.characterName}
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
				<Control class="col-span-12 sm:col-span-5">
					<DateInput
						field={form.fields.appliedDate}
						initial={initial.appliedDate}
						label="Assigned Date"
						min={data.date}
						required={!!data.characterId}
						timezone={data.timezone}
					/>
				</Control>
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
				{#if advType === "level"}
					<Control class="col-span-12 sm:col-span-4">
						<Input field={form.fields.level} type="number" label="Level" />
					</Control>
				{/if}
				{#if advType === "acp"}
					<Control class="col-span-6 sm:col-span-2">
						<Input field={form.fields.acp} type="number" label="ACP" />
					</Control>
					<Control class="col-span-6 sm:col-span-2">
						<Input field={form.fields.tcp} type="number" label="TCP" />
					</Control>
				{/if}
				<Control class="col-span-6 sm:col-span-2">
					<Input field={form.fields.gold} type="number" label="Gold" />
				</Control>
				<Control class="col-span-6 sm:col-span-2">
					<Input field={form.fields.dtd} type="number" label="Downtime" />
				</Control>
				<Control class="col-span-12">
					<MarkdownInput
						field={form.fields.description}
						maxLength={5000}
						maxRows={20}
						preview
						images
						onpending={(count) => (notesUploading = count > 0)}
					/>
				</Control>
				<AddDropItems form={ctx}>
					<Submit form={ctx} disabled={notesUploading}>Save Log</Submit>
				</AddDropItems>
			{/snippet}
		</RemoteForm>
	{/if}
</svelte:boundary>
