<script lang="ts">
	import { enhance } from "$app/forms";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SchemaForm from "$lib/components/SchemaForm.svelte";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { pageLoader } from "$lib/store";
	import { sorter } from "$lib/utils";

	export let data;
	export let form;

	let dm = data.dm;
	let saving = false;
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<SchemaForm action="?/saveDM" schema={dungeonMasterSchema} data={dm} bind:saving let:errors>
		{#if form?.error || errors.has("form")}
			<div class="alert alert-error mb-4 shadow-lg">
				<Icon src="alert-circle" class="w-6" />
				{form?.error || errors.get("form")}
			</div>
		{/if}

		<input type="hidden" name="id" value={dm.id} />
		<input type="hidden" name="uid" value={dm.uid} />
		<input type="hidden" name="owner" value={dm.owner} />
		<div class="grid grid-cols-12 gap-4">
			<div class="col-span-12 sm:col-span-6">
				<div class="form-control w-full">
					<label for="name" class="label">
						<span class="label-text">
							DM Name
							<span class="text-error">*</span>
						</span>
					</label>
					<input type="text" name="name" bind:value={dm.name} required class="input input-bordered w-full focus:border-primary" />
					{#if errors.has("name")}
						<label for="name" class="label">
							<span class="label-text-alt text-error">{errors.get("name")}</span>
						</label>
					{/if}
				</div>
			</div>
			<div class="col-span-12 sm:col-span-6">
				<div class="form-control w-full">
					<label for="DCI" class="label">
						<span class="label-text">DCI</span>
					</label>
					<input type="text" name="DCI" bind:value={dm.DCI} class="input input-bordered w-full focus:border-primary" />
					{#if errors.has("DCI")}
						<label for="DCI" class="label">
							<span class="label-text-alt text-error">{errors.get("DCI")}</span>
						</label>
					{/if}
				</div>
			</div>
			<div class="col-span-12 m-4 text-center">
				<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
					{#if saving}
						<span class="loading" />
					{/if}
					Save DM
				</button>
			</div>
		</div>
	</SchemaForm>

	<div class="mt-4 flex flex-col gap-4 sm:mt-8">
		<section>
			<h2 class="mb-2 text-2xl">Logs</h2>
			<div class="w-full overflow-x-auto rounded-lg bg-base-100">
				{#if dm.logs.length == 0}
					<form
						class="py-20 text-center"
						method="POST"
						action="?/deleteDM"
						use:enhance={() => {
							$pageLoader = true;
							saving = true;
							return async ({ update, result }) => {
								update();
								if (result.type !== "redirect") {
									$pageLoader = false;
									saving = false;
									if (form?.error) {
										alert(form.error);
									}
								}
							};
						}}
					>
						<p class="mb-4">This DM has no logs.</p>
						<input type="hidden" name="dmId" value={dm.id} />
						<button
							class="btn btn-sm"
							on:click|preventDefault={(e) => {
								if (confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`))
									e.currentTarget.form?.requestSubmit();
							}}
						>
							Delete DM
						</button>
					</form>
				{:else}
					<table class="table w-full">
						<thead>
							<tr class="bg-base-300">
								<th class="">Date</th>
								<th class="hidden sm:table-cell">Adventure</th>
								<th class="hidden sm:table-cell">Character</th>
								<th class="print:hidden" />
							</tr>
						</thead>
						<tbody>
							{#each dm.logs.sort((a, b) => sorter(a.date, b.date)) as log}
								<tr>
									<td>
										<div class="flex flex-col gap-1">
											<span class="sm:hidden">{log.name}</span>
											<span>{log.date.toLocaleString()}</span>
											<span class="sm:hidden">
												<a href={`/characters/${log.character?.id}`} class="text-secondary">
													{log.character?.name}
												</a>
											</span>
										</div>
									</td>
									<td class="hidden sm:table-cell">{log.name}</td>
									<td class="hidden sm:table-cell">
										<a href={`/characters/${log.character?.id}`} class="text-secondary">
											{log.character?.name}
										</a>
									</td>
									<td class="w-8 align-top print:hidden">
										<div class="flex flex-row justify-center gap-2">
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="btn btn-primary sm:btn-sm">
												<Icon src="pencil" class="w-4" />
											</a>
										</div>
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
