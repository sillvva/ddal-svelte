<script lang="ts">
	import Error from "#lib/components/error.svelte";
	import Head from "#lib/components/head.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import StoreLogDraft from "#lib/components/store-log-draft.svelte";
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
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

	<Head title={draft.data.name || "Log draft"} />

	<NavMenu
		crumbs={[
			{ title: "Characters", url: "/characters" },
			{ title: draft.data.name || "Log draft", url: `/draft/${draft.id}` }
		]}
	/>

	<section class="flex max-w-xl flex-col gap-4">
		<h2 class="text-xl font-semibold">{draft.data.name || "Log draft"}</h2>
		<p>
			This draft is saved in this browser. Open a character and choose <span class="font-semibold">New Log from Draft</span>, or
			use <span class="font-semibold">Populate from draft</span> on a new log. Nothing is saved until you save that log.
		</p>
		<p class="text-sm text-base-content/70">
			Available until {new Date(draft.expiresAt).toLocaleDateString([], { dateStyle: "medium" })}.
		</p>
		<div class="flex flex-wrap gap-2">
			<a class="btn w-fit btn-primary btn-sm" href="/characters">Choose a character</a>
			{#if draft.owner}
				<a class="btn w-fit btn-sm" href="/drafts/{draft.id}">Edit draft</a>
			{/if}
		</div>
	</section>

	{#key draft.id}
		<StoreLogDraft draft={{ id: draft.id, data: draft.data, expiresAt: draft.expiresAt }} />
	{/key}
</svelte:boundary>
