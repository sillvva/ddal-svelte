<script lang="ts">
	import { errorToast, successToast } from "$lib/factories";
	import { searchData } from "$lib/stores";
	import type { LogData } from "$server/data/logs";
	import { createEventDispatcher } from "svelte";
	import { superForm } from "sveltekit-superforms";

	export let log: LogData;
	export let deletingLog: string[] = [];
	export let label = "";

	const dispatch = createEventDispatcher<{
		deleted: { id: string };
	}>();

	const { submit } = superForm(
		{ id: log.id },
		{
			SPA: "?/deleteLog",
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete ${log.name}? This action cannot be reversed.`)) return cancel();
				formData.set("id", log.id);
				deletingLog = deletingLog.concat(log.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors._errors || [];
				if (error) {
					errorToast(error);
					deletingLog = deletingLog.filter((id) => id !== log.id);
				} else {
					successToast(`${log.name} deleted`);
					dispatch("deleted", { id: log.id });
					$searchData = [];
				}
			}
		}
	);
</script>

<button type="button" class="btn btn-error btn-sm" aria-label="Delete Log" on:click={submit}>
	<span class="iconify size-4 mdi--trash-can" />
	{label}
</button>
