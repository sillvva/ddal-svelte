<script module lang="ts">
	import type { PageData } from "./$types.js";
	export function getPageTitle(data: PageData) {
		return `Edit ${data.form.data.name}`;
	}
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import Breadcrumbs from "$lib/components/Breadcrumb.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { errorToast, successToast, valibotForm } from "$lib/factories.svelte.js";
	import { deleteDM, saveDM } from "$lib/remote/dms.remote.js";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { sorter } from "@sillvva/utils";

	let { data } = $props();

	const superform = $derived(valibotForm(data.form, dungeonMasterSchema, { remote: true }));
	const sortedLogs = $derived(data.dm.logs.toSorted((a, b) => sorter(a.date, b.date)));
</script>

<div class="flex flex-col gap-4">
	<Breadcrumbs />

	<SuperForm {superform} remote={saveDM} onRemoteSuccess={(data) => successToast(`${data.name} saved`)}>
		<Control class="col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="name" label="DM Name" />
		</Control>
		<Control class="col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="DCI" label="DCI" />
		</Control>
		<Submit {superform}>Save DM</Submit>
	</SuperForm>

	<div class="mt-4 flex flex-col gap-4 sm:mt-8">
		<section>
			<h2 class="mb-2 text-2xl">Logs</h2>
			{#if data.dm.logs.length == 0}
				<div class="bg-base-200 flex h-40 flex-col items-center justify-center gap-2 rounded-lg">
					<p>This DM has no logs.</p>
					<button
						type="button"
						class="btn btn-error sm:btn-sm"
						aria-label="Delete DM"
						onclick={async () => {
							if (!confirm(`Are you sure you want to delete ${data.dm.name}? This action cannot be undone.`)) return;
							const result = await deleteDM(data.dm.id);
							if (result.ok) {
								successToast(`${data.dm.name} deleted`);
								goto("/dms");
							} else {
								errorToast(result.error.message);
							}
						}}
					>
						<span class="iconify mdi--trash-can"></span>
					</button>
				</div>
			{:else}
				<div class="bg-base-100 w-full overflow-x-auto rounded-lg">
					<table class="table w-full">
						<thead>
							<tr class="bg-base-300">
								<th class="max-lg:hidden">Date</th>
								<th class="max-xs:px-2">Adventure</th>
								<th class="max-xs:px-2">Character</th>
								{#if data.dm.isUser}
									<th class="max-md:hidden">Type</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each sortedLogs as log}
								<tr>
									<td class="max-xs:px-2">
										<div class="flex flex-col gap-1">
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="text-secondary lg:hidden">
												{log.name}
											</a>
											<div class="min-w-max">
												{new Date(log.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
											</div>
											<div class="min-w-max md:hidden">{log.isDmLog ? "DM Log" : "Log"} ({log.type})</div>
										</div>
									</td>
									<td class="max-lg:hidden">
										<a
											href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.character?.id}/log/${log.id}`}
											class="text-secondary"
										>
											{log.name}
										</a>
									</td>
									<td class="max-xs:px-2">
										{#if log.character?.name}
											<a href={`/characters/${log.character?.id}`} class="text-secondary">
												{log.character?.name}
											</a>
										{/if}
									</td>
									{#if data.dm.isUser}
										<td class="max-md:hidden">
											<div class="min-w-max">{log.isDmLog ? "DM Log" : "Log"} ({log.type})</div>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</div>
</div>
