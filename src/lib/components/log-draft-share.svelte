<script lang="ts">
	import { successToast } from "#lib/factories.svelte.js";
	import { logDraftPath } from "#lib/log-draft.js";
	import { page } from "$app/state";
	import { clipboard } from "@svelteuidev/composables";
	import { fromAction } from "svelte/attachments";
	import { topLayerDialog } from "./dialog.js";
	import QrCode from "./qr-code.svelte";

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let qrOpen = $state(false);
	const link = $derived(`${page.url.origin}${logDraftPath(id)}`);
</script>

<div class="flex flex-wrap gap-2">
	<button
		type="button"
		class="btn btn-sm"
		onclick={() => successToast("Draft link copied")}
		{@attach fromAction(clipboard, () => link)}
	>
		<span class="iconify size-4 mdi--link-variant"></span>
		Copy link
	</button>
	<button type="button" class="btn btn-sm" onclick={() => (qrOpen = true)}>
		<span class="iconify size-4 mdi--qrcode"></span>
		Show QR code
	</button>
</div>

{#if qrOpen}
	<dialog class="modal" aria-labelledby="draft-qr-title" {@attach topLayerDialog(() => (qrOpen = false))}>
		<div class="modal-box flex w-fit flex-col items-center gap-4">
			<h3 id="draft-qr-title" class="text-lg font-semibold">Scan to open this draft</h3>
			<QrCode value={link} />
			<p class="max-w-56 text-center text-xs break-all">{link}</p>
			<form method="dialog">
				<button class="btn btn-sm">Close</button>
			</form>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label="Close">close</button>
		</form>
	</dialog>
{/if}
