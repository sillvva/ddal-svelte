<script lang="ts">
	import { goto } from "$app/navigation";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import { getGlobal } from "$lib/stores.svelte";
	import type { UserDMs } from "$server/effect/dms";
	import type { SvelteSet } from "svelte/reactivity";
	import { superForm } from "sveltekit-superforms";

	const global = getGlobal();

	interface Props {
		dm: UserDMs[number];
		deletingDM?: SvelteSet<string>;
		label?: string;
		ondelete?: (event: { id: string }) => void;
	}

	let { dm, deletingDM, label = "", ondelete }: Props = $props();

	const { submit } = superForm(
		{ id: dm.id },
		{
			SPA: "/dms?/deleteDM",
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`)) return cancel();
				formData.set("id", dm.id);
				deletingDM?.add(dm.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors._errors || [];
				if (error) {
					errorToast(error);
					deletingDM?.delete(dm.id);
				} else {
					successToast(`${dm.name} deleted`);
					ondelete?.({ id: dm.id });
					global.searchData = [];
				}
			},
			onResult({ result }) {
				if (result.type === "redirect") {
					successToast(`${dm.name} deleted`);
					ondelete?.({ id: dm.id });
					global.searchData = [];
					goto(result.location);
				}
			}
		}
	);
</script>

<button type="button" class="btn btn-error sm:btn-sm" aria-label="Delete DM" onclick={submit}>
	<span class="iconify mdi--trash-can"></span>
	{label}
</button>
