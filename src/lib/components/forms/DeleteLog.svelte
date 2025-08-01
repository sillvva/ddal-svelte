<script lang="ts">
	import { goto } from "$app/navigation";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import type { LogId } from "$lib/schemas";
	import type { FullLogData } from "$lib/server/effect/logs";
	import { getGlobal } from "$lib/stores.svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import { superForm } from "sveltekit-superforms";

	const global = getGlobal();

	interface Props {
		log: FullLogData;
		deletingLog?: SvelteSet<string>;
		label?: string;
		ondelete?: (event: { id: LogId }) => void;
	}

	let { log, deletingLog, label = "", ondelete }: Props = $props();

	const { submit } = superForm(
		{ id: log.id },
		{
			SPA: log.isDmLog ? "/dm-logs?/deleteLog" : `/characters/${log.characterId}?/deleteLog`,
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete ${log.name}? This action cannot be reversed.`)) return cancel();
				formData.set("id", log.id);
				deletingLog?.add(log.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors._errors || [];
				if (error) {
					errorToast(error);
					deletingLog?.delete(log.id);
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
	<span class="iconify mdi--trash-can size-4"></span>
	{label}
</button>
