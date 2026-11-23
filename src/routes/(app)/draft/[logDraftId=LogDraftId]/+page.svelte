<script lang="ts">
	import Error from "#lib/components/error.svelte";
	import Head from "#lib/components/head.svelte";
	import Link from "#lib/components/link.svelte";
	import LogDraftCharacterPicker from "#lib/components/log-draft-character-picker.svelte";
	import LogDraftFaq from "#lib/components/log-draft-faq.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import StoreLogDraft from "#lib/components/store-log-draft.svelte";
	import { logDraftMemory } from "#lib/log-draft.svelte.js";
	import * as API from "#lib/remote/index.js";

	const { params } = $props();

	/** A link to a deleted or expired draft should not leave its old copy on offer. */
	function forgetMissingDraft() {
		const memory = logDraftMemory();
		memory.load();
		if (memory.current?.id === params.logDraftId) memory.clear();
	}
</script>

<svelte:boundary>
	{#snippet failed(error)}
		<div class="contents" {@attach forgetMissingDraft}></div>
		<Error {error} boundary="log-draft" />
	{/snippet}
	{const draft = $derived(await API.drafts.queries.read(params.logDraftId))}
	{const isDm = $derived(draft.data.kind === "dm")}
	{const characters = $derived(isDm ? [] : await API.characters.queries.getAll())}

	<Head title={draft.data.name || "Log draft"} />

	<NavMenu
		crumbs={[
			isDm ? { title: "DM Logs", href: "dm-logs" } : { title: "Characters", href: "characters" },
			{ title: draft.data.name || "Log draft", href: "/(app)/draft/[logDraftId=LogDraftId]", params: { logDraftId: draft.id } }
		]}
	/>

	<section class="flex max-w-xl flex-col gap-4">
		<h2 class="text-xl font-semibold">{draft.data.name || "Log draft"}</h2>
		<p>
			This draft is saved in this browser.
			{#if isDm}
				Open DM Logs and choose <span class="font-semibold">New Log from Draft</span>, or use
				<span class="font-semibold">Populate from draft</span> on a new DM log.
			{:else}
				Pick a character below, or open a character and choose <span class="font-semibold">New Log from Draft</span>, or use
				<span class="font-semibold">Populate from draft</span> on a new character log.
			{/if}
			Nothing is saved until you save that log.
		</p>
		<p class="text-sm text-base-content/70">
			Available until {new Date(draft.expiresAt).toLocaleDateString([], { dateStyle: "medium" })}.
		</p>
		{#if !isDm}
			<LogDraftCharacterPicker {characters} />
		{/if}
		<div class="flex flex-wrap gap-2">
			{#if isDm}
				<Link href="dm-logs" class="btn w-fit btn-primary btn-sm">Go to DM Logs</Link>
			{:else if characters.length}
				<Link href="characters" class="btn w-fit btn-sm">All characters</Link>
			{/if}
			{#if draft.owner}
				<Link href="/(app)/drafts/[draftId=DraftId]" params={{ draftId: draft.id }} class="btn w-fit btn-sm">Edit draft</Link>
			{/if}
		</div>
	</section>

	<div class="mt-8">
		<LogDraftFaq />
	</div>

	{#key draft.id}
		<StoreLogDraft draft={{ id: draft.id, data: draft.data, expiresAt: draft.expiresAt }} />
	{/key}
</svelte:boundary>
