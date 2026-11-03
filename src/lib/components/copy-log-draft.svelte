<script lang="ts">
	import { successToast } from "#lib/factories.svelte.js";
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { LogId } from "#lib/schemas.js";
	import { parseEffectResult } from "#lib/util.js";
	import LogDraftShare from "./log-draft-share.svelte";

	interface Props {
		logId: string;
		compact?: boolean;
	}

	let { logId, compact = false }: Props = $props();

	let pending = $state(false);
	let shareId = $state<string | null>(null);

	async function copyDraft() {
		if (pending) return;
		pending = true;
		const result = await API.drafts.actions.copyFromLog(logId as LogId);
		const saved = await parseEffectResult(result);
		pending = false;
		if (!saved) return;
		logDraftMemory().save(saved);
		shareId = saved.id;
		successToast("Draft saved in this browser");
	}

	function close() {
		shareId = null;
	}
</script>

<button
	type="button"
	class={["btn", compact ? "btn-sm" : "h-9 btn-sm"]}
	aria-label="Copy as draft"
	disabled={pending}
	onclick={copyDraft}
>
	{#if pending}
		<span class="loading loading-xs"></span>
	{:else if compact}
		<span class="iconify size-4 mdi--content-copy"></span>
	{:else}
		Copy as draft
	{/if}
</button>

{#if shareId}
	<dialog class="modal modal-open" aria-labelledby="copy-draft-title">
		<div class="modal-box flex flex-col gap-4">
			<h3 id="copy-draft-title" class="text-lg font-semibold">Draft link</h3>
			<p class="text-sm">
				Share this link, or open a character and choose New Log from Draft. The link lasts 14 days after the last edit.
			</p>
			<LogDraftShare id={shareId} />
			<a class="link text-sm text-secondary" href="/drafts/{shareId}">Edit draft</a>
			<button type="button" class="btn w-fit btn-sm" onclick={close}>Close</button>
		</div>
		<button type="button" class="modal-backdrop" onclick={close} aria-label="Close">close</button>
	</dialog>
{/if}
