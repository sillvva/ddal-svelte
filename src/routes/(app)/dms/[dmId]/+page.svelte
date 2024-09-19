<script lang="ts">
	import { goto } from "$app/navigation";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import DeleteDm from "$lib/components/forms/DeleteDM.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { valibotForm } from "$lib/factories";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { sorter } from "@sillvva/utils";

	export let data;

	$: superform = valibotForm(data.form, dungeonMasterSchema);
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<SuperForm action="?/saveDM" {superform}>
		<Control class="col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="name">DM Name</Input>
		</Control>
		<Control class="col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="DCI">DCI</Input>
		</Control>
		<Submit {superform}>Save DM</Submit>
	</SuperForm>

	<div class="mt-4 flex flex-col gap-4 sm:mt-8">
		<section>
			<h2 class="mb-2 text-2xl">Logs</h2>
			<div class="w-full overflow-x-auto rounded-lg bg-base-100">
				{#if data.dm.logs.length == 0}
					<p>This DM has no logs.</p>
					<DeleteDm dm={data.dm} label="Delete DM" on:deleted={() => goto("/dms")} />
				{:else}
					<table class="table w-full">
						<thead>
							<tr class="bg-base-300">
								<th class="hidden sm:table-cell">Date</th>
								<th class="">Adventure</th>
								<th class="">Character</th>
							</tr>
						</thead>
						<tbody>
							{#each data.dm.logs.sort((a, b) => sorter(a.date, b.date)) as log}
								<tr>
									<td>
										<div class="flex flex-col gap-1">
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="text-secondary sm:hidden">
												{log.name}
											</a>
											<span>{new Date(log.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
										</div>
									</td>
									<td class="hidden sm:table-cell">
										<a
											href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.character?.id}/log/${log.id}`}
											class="text-secondary"
										>
											{log.name}
										</a>
									</td>
									<td>
										{#if log.character?.name}
											<a href={`/characters/${log.character?.id}`} class="text-secondary">
												{log.character?.name}
											</a>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</section>
	</div>
</div>
