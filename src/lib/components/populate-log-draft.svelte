<script lang="ts">
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
	import type { LogDraftData, LogDraftKind } from "#lib/schemas.js";
	import { onMount } from "svelte";

	interface Props {
		/** Only drafts of this kind are offered. */
		kind: LogDraftKind;
		/** Fill the form once on mount, for New Log from Draft. */
		auto?: boolean;
		/** The page applies the draft to its own form data. Nothing is saved here. */
		onapply: (draft: LogDraftData) => void | Promise<void>;
	}

	let { kind, auto = false, onapply }: Props = $props();

	const memory = logDraftMemory();
	const stored = $derived(memory.current?.data.kind === kind ? memory.current : null);
	let applying = $state(false);
	/** SSR can't see browser storage, so the bar renders only after this component has hydrated. */
	let mounted = $state(false);

	async function apply() {
		if (!stored || applying) return;
		applying = true;
		try {
			await onapply(stored.data);
		} finally {
			applying = false;
		}
	}

	onMount(() => {
		memory.load();
		mounted = true;
		if (auto && stored) void apply();
	});
</script>

{#if mounted && stored}
	<div class="flex flex-wrap items-center gap-2 rounded-lg bg-base-200 px-3 py-2 text-sm">
		<span class="iconify size-5 mdi--file-document-edit-outline"></span>
		<span class="flex-1">Draft available: <span class="font-semibold">{stored.data.name}</span></span>
		<button type="button" class="btn btn-sm" disabled={applying} onclick={() => void apply()}>
			{#if applying}
				<span class="loading loading-xs"></span>
			{/if}
			Populate from draft
		</button>
	</div>
{/if}
