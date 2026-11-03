<script lang="ts">
	import { successToast } from "#lib/factories.svelte.js";
	import { logDraftMemory, type StoredLogDraft } from "#lib/log-draft-storage.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { LogId } from "#lib/schemas.js";
	import { parseEffectResult } from "#lib/util.js";
	import { topLayerDialog } from "./dialog.js";
	import LogDraftShare from "./log-draft-share.svelte";

	interface Props {
		logId: LogId;
		/** Icon-only button for log lists. */
		compact?: boolean;
	}

	let { logId, compact = false }: Props = $props();

	let pending = $state(false);
	let copied = $state.raw<StoredLogDraft | null>(null);

	async function copyDraft() {
		if (pending) return;
		pending = true;
		try {
			const result = await API.drafts.actions.copyFromLog(logId);
			const saved = await parseEffectResult(result);
			if (!saved) return;
			logDraftMemory().save(saved);
			copied = saved;
			successToast("Draft saved in this browser");
		} finally {
			pending = false;
		}
	}
</script>

<button
	type="button"
	class={["btn btn-sm", compact ? "touch-hitbox" : "h-9"]}
	aria-label="Copy as draft"
	title="Copy as draft"
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

{#if copied}
	<dialog class="modal" aria-labelledby="copy-draft-title-{copied.id}" {@attach topLayerDialog(() => (copied = null))}>
		<div class="modal-box flex flex-col gap-4">
			<h3 id="copy-draft-title-{copied.id}" class="text-lg font-semibold">Draft created</h3>
			<p class="text-sm">
				This draft is saved in this browser. Open a character and choose <span class="font-semibold">New Log from Draft</span>, or
				share the link. The link lasts 14 days after the last edit.
			</p>
			<LogDraftShare id={copied.id} />
			<div class="flex justify-between gap-2">
				<a class="btn btn-ghost btn-sm" href="/drafts/{copied.id}">Edit draft</a>
				<form method="dialog">
					<button class="btn btn-sm">Close</button>
				</form>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label="Close">close</button>
		</form>
	</dialog>
{/if}
