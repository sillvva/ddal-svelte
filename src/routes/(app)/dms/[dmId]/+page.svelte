<script lang="ts">
	import { enhance } from "$app/forms";
	import BackButton from "$lib/components/BackButton.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SchemaForm from "$lib/components/SchemaForm.svelte";
	import { SvelteMap, pageLoader } from "$lib/store";
	import { sorter } from "$lib/utils";
	import { dungeonMasterSchema } from "$src/lib/types/schemas";

	export let data;
	export let form;

	let dm = data.dm;

	let saving = false;
	let errors = new SvelteMap<string, string>();
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<BackButton href="/dms">DMs</BackButton>

	{#if form?.error}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form.error}
		</div>
	{/if}

	<SchemaForm action="?/saveDM" schema={dungeonMasterSchema} data={dm} bind:form bind:saving bind:errors>
		<input type="hidden" name="dmID" value={dm.id} />
		<div class="flex flex-wrap">
			<div class="basis-full px-2 sm:basis-1/2">
				<div class="form-control w-full">
					<label for="name" class="label">
						<span class="label-text">
							DM Name
							<span class="text-error">*</span>
						</span>
					</label>
					<input
						type="text"
						name="name"
						bind:value={dm.name}
						required
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="name" class="label">
						<span class="label-text-alt text-error">{errors.get("name") || ""}</span>
					</label>
				</div>
			</div>
			<div class="basis-full px-2 sm:basis-1/2">
				<div class="form-control w-full">
					<label for="DCI" class="label">
						<span class="label-text">DCI</span>
					</label>
					<input
						type="text"
						name="DCI"
						bind:value={dm.DCI}
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="DCI" class="label">
						<span class="label-text-alt text-error">{errors.get("DCI") || ""}</span>
					</label>
				</div>
			</div>
			<div class="m-4 basis-full text-center">
				<button
					type="submit"
					class="btn-primary btn disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50"
					disabled={saving}
				>
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
						{#if dm.logs.length == 0}
							<tr>
								<td colSpan={4} class="py-20 text-center">
									<p class="mb-4">This DM has no logs.</p>
									<form
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
										<input type="hidden" name="dmId" value={dm.id} />
										<button
											class="btn-sm btn"
											on:click|preventDefault={(e) => {
												if (confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`))
													e.currentTarget.form?.requestSubmit();
											}}
										>
											Delete DM
										</button>
									</form>
								</td>
							</tr>
						{:else}
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
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="btn-primary btn sm:btn-sm">
												<Icon src="pencil" class="w-4" />
											</a>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
