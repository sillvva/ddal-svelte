<script lang="ts">
	import { errorToast, successToast } from "$lib/factories";
	import { searchData } from "$lib/stores";
	import type { UserDMsWithLogs } from "$server/data/dms";
	import { superForm } from "sveltekit-superforms";

	interface Props {
		dm: UserDMsWithLogs[number];
		deletingDM?: string[];
		label?: string;
		ondelete?: (event: { id: string }) => void;
	}

	let { dm, deletingDM = $bindable([]), label = "", ondelete }: Props = $props();

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
					ondelete?.({ id: dm.id });
					$searchData = [];
				}
			}
		}
	);
</script>

<button type="button" class="btn btn-error sm:btn-sm" aria-label="Delete DM" onclick={submit}>
	<span class="iconify mdi--trash-can"></span>
	{label}
</button>
