<script module>
	import type { PageData } from "./$types.js";
	export function getPageTitle(data: PageData) {
		return data.form.data.name;
	}
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import DeleteDm from "$lib/components/forms/DeleteDM.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { valibotForm } from "$lib/factories.svelte.js";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { sorter } from "@sillvva/utils";

	let { data } = $props();

	const global = getGlobal();
	const superform = $derived(
		valibotForm(data.form, dungeonMasterSchema, {
			onResult() {
				global.searchData = [];
			}
		})
	);

	const sortedLogs = $derived(data.dm.logs.toSorted((a, b) => sorter(a.date, b.date)));
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<SuperForm action="?/saveDM" {superform}>
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
			<div class="bg-base-100 w-full overflow-x-auto rounded-lg">
				{#if data.dm.logs.length == 0}
					<p>This DM has no logs.</p>
					<DeleteDm dm={data.dm} label="Delete DM" ondelete={() => goto("/dms")} />
				{:else}
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
				{/if}
			</div>
		</section>
	</div>
</div>
