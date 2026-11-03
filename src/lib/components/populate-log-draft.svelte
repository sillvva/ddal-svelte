<script lang="ts">
	import { applyDraftToLog } from "#lib/log-draft.js";
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { LogDraftData, LogSchemaIn } from "#lib/schemas.js";
	import type { GenericForm } from "#lib/factories.svelte.js";
	import { onMount } from "svelte";

	interface Props {
		form: GenericForm<LogSchemaIn>;
		data: LogSchemaIn;
		/** Fill the form once, when it was opened from New Log from Draft. */
		auto?: boolean;
		onapplied?: (draft: LogDraftData) => void;
	}

	let { form, data, auto = false, onapplied }: Props = $props();

	const memory = logDraftMemory();
	let applying = $state(false);

	async function apply() {
		const stored = memory.current;
		if (!stored || applying) return;
		applying = true;
		try {
			const [dms, request] = await Promise.all([API.dms.queries.getAllWithoutLogs(), API.app.queries.request()]);
			const user = request.user;
			if (!user) return;
			applyDraftToLog(data, stored.data, dms, user.id);
			form.form.fields.set(data);
			onapplied?.(stored.data);
		} finally {
			applying = false;
		}
	}

	// Runs after the log form has its own fields, so this fill is not replaced by the blank log.
	onMount(() => {
		memory.load();
		if (!auto || !memory.current) return;
		void apply();
	});
</script>

{#if memory.hydrated && memory.current}
	<button type="button" class="btn btn-sm" disabled={applying} onclick={() => void apply()}>
		{#if applying}
			<span class="loading loading-xs"></span>
		{/if}
		Populate from draft
	</button>
{/if}
