<script lang="ts">
	import { goto } from "$app/navigation";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import type { AppLogId } from "$lib/schemas";
	import type { AppLog } from "$lib/server/db/schema";
	import { getGlobal } from "$lib/stores.svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import { superForm } from "sveltekit-superforms";

	const global = getGlobal();

	interface Props {
		log: AppLog;
		deletingLog?: SvelteSet<AppLogId>;
		label?: string;
		ondelete?: (event: { id: string }) => void;
	}

	let { log, deletingLog, label = "", ondelete }: Props = $props();

	const { submit } = superForm(
		{ id: log.id },
		{
			SPA: "?/deleteLog",
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete this log? This action cannot be reversed.`)) return cancel();
				formData.set("id", log.id);
				deletingLog?.add(log.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors._errors || [];
				if (error) {
					errorToast(error);
					deletingLog?.delete(log.id);
				} else {
					successToast(`Log deleted`);
					ondelete?.({ id: log.id });
					global.searchData = [];
				}
			},
			onResult({ result }) {
				if (result.type === "redirect") {
					successToast(`Log deleted`);
					ondelete?.({ id: log.id });
					global.searchData = [];
					goto(result.location);
				}
			}
		}
	);
</script>

<button class="btn btn-sm btn-error tooltip tooltip-left" data-tip="Delete log" aria-label="Delete log" onclick={submit}>
	<span class="iconify mdi--delete"></span>
	{label}
</button>
