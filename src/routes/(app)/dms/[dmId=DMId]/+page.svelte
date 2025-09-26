<script lang="ts" module>
	import type { RouteParams } from "./$types.js";
	export async function getPageTitle(params: RouteParams) {
		const data = await API.dms.forms.edit(params.dmId);
		return data.dm.name;
	}
	export async function getPageHead(params: RouteParams) {
		const data = await API.dms.forms.edit(params.dmId);
		return {
			title: data.dm.name
		};
	}
</script>

<script lang="ts">
	import { goto } from "$app/navigation";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { parseEffectResult } from "$lib/factories.svelte";
	import { successToast, valibotForm } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { sorter } from "@sillvva/utils";

	let { params } = $props();

	const global = getGlobal();

	const data = await API.dms.forms.edit(params.dmId);
	const superform = valibotForm(data.form, dungeonMasterSchema, {
		remote: API.dms.forms.save
	});
	const sortedLogs = $derived(data.dm.logs.toSorted((a, b) => sorter(a.date, b.date)));
</script>

<div class="flex flex-col gap-4">
	<Breadcrumbs />

	<SuperForm {superform}>
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
						disabled={!!API.dms.actions.deleteDM.pending}
						onclick={async () => {
							if (!confirm(`Are you sure you want to delete ${data.dm.name}? This action cannot be undone.`)) return;
							global.pageLoader = true;
							const result = await API.dms.actions.deleteDM(data.dm.id);
							const parsed = await parseEffectResult(result);
							if (parsed) {
								successToast(`${data.dm.name} deleted`);
								goto("/dms");
							}
							global.pageLoader = false;
						}}
					>
						<span class="iconify mdi--trash-can"></span>
					</button>
				</div>
			{:else}
				<div class="bg-base-100 w-full overflow-x-auto rounded-lg">
					<table class="bg-base-200 table w-full">
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
							{#each sortedLogs as log (log.id)}
								<tr>
									<td class="max-xs:px-2">
										<div class="flex flex-col gap-1">
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="text-secondary-content lg:hidden">
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
											class="text-secondary-content"
										>
											{log.name}
										</a>
									</td>
									<td class="max-xs:px-2">
										{#if log.character?.name}
											<a href={`/characters/${log.character?.id}?s=${log.id}`} class="text-secondary-content">
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
