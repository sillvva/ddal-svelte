<script lang="ts">
	import { errorToast, successToast } from "$lib/factories";
	import { searchData } from "$lib/stores";
	import type { UserDMsWithLogs } from "$server/data/dms";
	import { createEventDispatcher } from "svelte";
	import { superForm } from "sveltekit-superforms";

	export let dm: UserDMsWithLogs[number];
	export let deletingDM: string[] = [];
	export let label = "";

	const dispatch = createEventDispatcher<{
		deleted: { id: string };
	}>();

	const { submit } = superForm(
		{ id: dm.id },
		{
			SPA: "/dms?/deleteDM",
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`)) return cancel();
				formData.set("id", dm.id);
				deletingDM = deletingDM.concat(dm.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors._errors || [];
				if (error) {
					errorToast(error);
					deletingDM = deletingDM.filter((id) => id !== dm.id);
				} else {
					successToast(`${dm.name} deleted`);
					dispatch("deleted", { id: dm.id });
					$searchData = [];
				}
			}
		}
	);
</script>

<button type="button" class="btn btn-error sm:btn-sm" aria-label="Delete DM" on:click={submit}>
	<span class="iconify mdi-trash-can" />
	{label}
</button>
