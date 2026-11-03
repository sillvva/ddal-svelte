<script lang="ts">
	import Error from "#lib/components/error.svelte";
	import Control from "#lib/components/forms/control.svelte";
	import DateInput from "#lib/components/forms/date-input.svelte";
	import GainedItems from "#lib/components/forms/gained-items.svelte";
	import InputWrapper from "#lib/components/forms/input-wrapper.svelte";
	import Input from "#lib/components/forms/input.svelte";
	import MarkdownInput from "#lib/components/forms/md-input.svelte";
	import RemoteForm from "#lib/components/forms/remote-form.svelte";
	import Submit from "#lib/components/forms/submit.svelte";
	import Head from "#lib/components/head.svelte";
	import LogDraftShare from "#lib/components/log-draft-share.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import { proxify, successToast } from "#lib/factories.svelte.js";
	import { LOG_DRAFT_LIMIT, seasonForAdvancement } from "#lib/log-draft.js";
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
	import * as API from "#lib/remote/index.js";
	import { logDraftSchema, type LogDraftId } from "#lib/schemas.js";
	import { parseEffectResult } from "#lib/util.js";
	import { goto } from "$app/navigation";

	const { params } = $props();

	const savedId = $derived(params.draftId === "new" ? null : params.draftId);
	let removing = $state(false);

	async function removeDraft(id: LogDraftId) {
		if (removing) return;
		if (!confirm("Delete this draft? The link will stop working.")) return;
		removing = true;
		const result = await API.drafts.actions.remove(id);
		const removed = await parseEffectResult(result);
		if (!removed) {
			removing = false;
			return;
		}
		const memory = logDraftMemory();
		if (memory.current?.id === id) memory.clear();
		successToast("Draft deleted");
		await goto("/dm-logs");
	}
</script>

<svelte:boundary>
	{#snippet failed(error)}<Error {error} boundary="edit-log-draft" />{/snippet}
	{const draft = $derived(await API.drafts.forms.load({ draftId: params.draftId }))}
	{const title = $derived(draft.name || "New Player Draft")}

	<Head {title} />

	<NavMenu
		crumbs={[
			{ title: "DM Logs", url: "/dm-logs" },
			{ title, url: `/drafts/${params.draftId}` }
		]}
	/>

	{#if savedId}
		{const shared = $derived(await API.drafts.queries.read(savedId))}
		<div class="mb-4 flex flex-col gap-3 rounded-lg bg-base-200 p-4">
			<p class="text-sm">
				Players open this link, then fill a new log from the draft. It works until
				<span class="font-semibold">{new Date(shared.expiresAt).toLocaleDateString([], { dateStyle: "medium" })}</span>, and
				saving again restarts the 14 days. You can keep up to {LOG_DRAFT_LIMIT} drafts.
			</p>
			<LogDraftShare id={savedId} />
		</div>
	{:else}
		<p class="mb-4 text-sm">
			Players get the title, date, DM, advancement, treasure, downtime, items, and notes. Images can't be added to a draft.
		</p>
	{/if}

	{let data = $derived(proxify(draft))}
	<RemoteForm schema={logDraftSchema} form={API.drafts.forms.save} {data} initialErrors={!!savedId} successMessage="Draft saved">
		{#snippet children(ctx)}
			{const { form, initial } = $derived(ctx)}
			{let season = $state(seasonForAdvancement(draft))}
			<Input field={form.fields.id} hidden />
			<Input field={form.fields.timezone} hidden />
			<Control class="col-span-12 sm:col-span-4">
				<InputWrapper field={form.fields.type} as="select" label="Log Type">
					<select
						{...form.fields.type.as("select")}
						id={form.fields.type.as("select").name}
						class="select-bordered select w-full"
					>
						<option value="game">Game</option>
						<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
					</select>
				</InputWrapper>
			</Control>
			<Control class="col-span-12 sm:col-span-8">
				<Input field={form.fields.name} label="Title" required />
			</Control>
			<Control class="col-span-12 sm:col-span-5">
				<DateInput field={form.fields.date} initial={initial.date ?? 0} label="Date" timezone={data.timezone} />
			</Control>
			{#if data.type === "game"}
				<Control class="col-span-12 sm:col-span-6">
					<Input field={form.fields.dm.name} label="DM Name" />
				</Control>
				<Control class="col-span-12 sm:col-span-6">
					<Input field={form.fields.dm.DCI} label="DM DCI" />
				</Control>
				<Control class="col-span-12 sm:col-span-4">
					<InputWrapper type="select" labelFor="season" label="Season">
						<select
							id="season"
							bind:value={season}
							class="select-bordered select w-full"
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
				{#if season === 9}
					<Control class="col-span-12 sm:col-span-4">
						<Input field={form.fields.level} type="number" label="Level" />
					</Control>
				{/if}
				{#if season === 8}
					<Control class="col-span-6 sm:col-span-2">
						<Input field={form.fields.acp} type="number" label="ACP" />
					</Control>
					<Control class="col-span-6 sm:col-span-2">
						<Input field={form.fields.tcp} type="number" label="TCP" />
					</Control>
				{/if}
			{:else}
				<Input field={form.fields.dm.name} hidden />
				<Input field={form.fields.dm.DCI} hidden />
				<Input field={form.fields.experience} type="number" hidden />
				<Input field={form.fields.acp} type="number" hidden />
				<Input field={form.fields.level} type="number" hidden />
			{/if}
			{#if season === 8 || data.type === "nongame"}
				{#if data.type !== "game"}
					<Control class="col-span-4">
						<Input field={form.fields.tcp} type="number" label="TCP" />
					</Control>
				{/if}
			{/if}
			<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
				<Input field={form.fields.gold} type="number" label="Gold" />
			</Control>
			<Control class={data.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4"}>
				<Input field={form.fields.dtd} type="number" label="Downtime" />
			</Control>
			<Control class="col-span-12">
				<MarkdownInput field={form.fields.description} maxLength={5000} maxRows={20} preview rejectImages />
			</Control>
			<GainedItems form={ctx}>
				<Submit form={ctx}>Save Draft</Submit>
				{#if savedId}
					{const id = savedId}
					<button type="button" class="btn btn-error" disabled={removing} onclick={() => removeDraft(id)}> Delete draft </button>
				{/if}
			</GainedItems>
		{/snippet}
	</RemoteForm>
</svelte:boundary>
