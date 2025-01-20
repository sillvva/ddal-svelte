<script lang="ts">
	import { goto } from "$app/navigation";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import { global } from "$lib/stores.svelte";
	import type { LogData } from "$server/data/logs";
	import { superForm } from "sveltekit-superforms";

	interface Props {
		log: LogData;
		deletingLog?: string[];
		label?: string;
		ondelete?: (event: { id: string }) => void;
	}

	let { log, deletingLog = $bindable([]), label = "", ondelete }: Props = $props();

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
					ondelete?.({ id: log.id });
					global.searchData = [];
				}
			},
			onResult({ result }) {
				if (result.type === "redirect") {
					successToast(`${log.name} deleted`);
					ondelete?.({ id: log.id });
					global.searchData = [];
					goto(result.location);
				}
			}
		}
	);
</script>

<button type="button" class="btn btn-error btn-sm" aria-label="Delete Log" onclick={submit}>
	<span class="iconify size-4 mdi--trash-can"></span>
	{label}
</button>
