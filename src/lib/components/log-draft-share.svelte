<script lang="ts">
	import { successToast } from "#lib/factories.svelte.js";
	import { logDraftPath } from "#lib/log-draft.js";
	import { page } from "$app/state";
	import { clipboard } from "@svelteuidev/composables";
	import { fromAction } from "svelte/attachments";
	import QrCode from "./qr-code.svelte";

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let qrOpen = $state(false);
	const link = $derived(`${page.url.origin}${logDraftPath(id)}`);

	function close() {
		qrOpen = false;
	}
</script>

<div class="flex flex-wrap gap-2">
	<button
		type="button"
		class="btn btn-sm"
		onclick={() => successToast("Draft link copied")}
		{@attach fromAction(clipboard, () => link)}
	>
		Copy link
	</button>
	<button type="button" class="btn btn-sm" onclick={() => (qrOpen = true)}>Show QR code</button>
</div>

{#if qrOpen}
	<dialog class="modal modal-open" aria-labelledby="draft-qr-title">
		<div class="modal-box flex flex-col items-center gap-4">
			<h3 id="draft-qr-title" class="text-lg font-semibold">Scan to open this draft</h3>
			<QrCode value={link} />
			<p class="text-center text-xs break-all">{link}</p>
			<button type="button" class="btn btn-sm" onclick={close}>Close</button>
		</div>
		<button type="button" class="modal-backdrop" onclick={close} aria-label="Close">close</button>
	</dialog>
{/if}
