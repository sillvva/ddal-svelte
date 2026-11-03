<script lang="ts">
	import type { OwnedDm } from "#lib/log-draft.js";
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { LogDraftData, UserId } from "#lib/schemas.js";
	import { onMount } from "svelte";

	interface Props {
		/** Fill the form once on mount, for New Log from Draft. */
		auto?: boolean;
		/** The page applies the draft to its own form data. Nothing is saved here. */
		onapply: (draft: LogDraftData, dms: readonly OwnedDm[], userId: UserId) => void;
	}

	let { auto = false, onapply }: Props = $props();

	const memory = logDraftMemory();
	let applying = $state(false);
	/** SSR can't see browser storage, so the bar renders only after this component has hydrated. */
	let mounted = $state(false);

	async function apply() {
		const stored = memory.current;
		if (!stored || applying) return;
		applying = true;
		try {
			const [dms, { user }] = await Promise.all([API.dms.queries.getAllWithoutLogs(), API.app.queries.request()]);
			if (!user) return;
			onapply(stored.data, dms, user.id);
		} finally {
			applying = false;
		}
	}

	onMount(() => {
		memory.load();
		mounted = true;
		if (auto && memory.current) void apply();
	});
</script>

{#if mounted && memory.current}
	<div class="flex flex-wrap items-center gap-2 rounded-lg bg-base-200 px-3 py-2 text-sm">
		<span class="iconify size-5 mdi--file-document-edit-outline"></span>
		<span class="flex-1">Draft available: <span class="font-semibold">{memory.current.data.name}</span></span>
		<button type="button" class="btn btn-sm" disabled={applying} onclick={() => void apply()}>
			{#if applying}
				<span class="loading loading-xs"></span>
			{/if}
			Populate from draft
		</button>
	</div>
{/if}
