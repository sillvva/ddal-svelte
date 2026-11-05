<script lang="ts">
	import { successToast } from "#lib/factories.svelte.js";
	import { logDraftMemory, type StoredLogDraft } from "#lib/log-draft-storage.svelte.js";
	import { onMount } from "svelte";

	interface Props {
		draft: StoredLogDraft;
	}

	let { draft }: Props = $props();

	onMount(() => {
		logDraftMemory().save(draft);
		successToast("A log draft is available");
	});
</script>
