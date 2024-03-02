<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/Control.svelte";
	import Input from "$lib/components/Input.svelte";
	import Submit from "$lib/components/Submit.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { errorToast, successToast, valibotForm } from "$lib/factories";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { sorter } from "@sillvva/utils";
	import { pageLoader, searchData } from "../../+layout.svelte";

	export let data;
	export let form;

	$: superform = valibotForm(data.form, dungeonMasterSchema, {
		resetForm: false
	});
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<SuperForm action="?/saveDM" {superform}>
		<Control class="col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="name" disabled={data.form.data.uid === data.user.id ? true : undefined}>
				DM Name
			</Input>
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
				{#if data.logs.length == 0}
					<form
						method="POST"
						action={`?/deleteDM`}
						class="flex flex-col items-center gap-4 py-20"
						use:enhance={({ cancel }) => {
							if (!confirm(`Are you sure you want to delete ${data.name}? This action cannot be reversed.`)) return cancel();
							$pageLoader = true;
							return async ({ result }) => {
								await applyAction(result);
								if (form?.error) {
									errorToast(form.error);
									$pageLoader = false;
								} else {
									successToast(`${data.name} deleted`);
									$searchData = [];
								}
							};
						}}
					>
						<p>This DM has no logs.</p>
						<button type="submit" class="btn btn-error btn-sm hover:font-bold hover:text-white" aria-label="Delete DM">
							Delete DM
						</button>
					</form>
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
							{#each data.logs.sort((a, b) => sorter(a.date, b.date)) as log}
								<tr>
									<td>
										<div class="flex flex-col gap-1">
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="text-secondary sm:hidden">
												{log.name}
											</a>
											<span>{new Date(log.date).toLocaleString()}</span>
										</div>
									</td>
									<td class="hidden sm:table-cell">
										<a
											href={log.is_dm_log ? `/dm-logs/${log.id}` : `/characters/${log.character?.id}/log/${log.id}`}
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
