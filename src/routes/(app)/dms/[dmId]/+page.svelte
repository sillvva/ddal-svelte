<script lang="ts">
	// import { enhance } from "$app/forms";
	import { applyAction, enhance } from "$app/forms";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { sorter } from "$lib/util";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { pageLoader } from "../../+layout.svelte";

	export let data;
	export let form;

	const dmForm = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(dungeonMasterSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form: dmFormData, errors, submitting, message } = dmForm;
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<SuperForm action="?/saveDM" superForm={dmForm}>
		{#if $message}
			<div class="alert alert-error mb-4 shadow-lg">
				<Icon src="alert-circle" class="w-6" />
				{$message}
			</div>
		{/if}

		<div class="grid grid-cols-12 gap-4">
			<div class="col-span-12 sm:col-span-6">
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
						bind:value={$dmFormData.name}
						required
						class="input input-bordered w-full focus:border-primary"
					/>
					{#if $errors.name}
						<label for="name" class="label">
							<span class="label-text-alt text-error">{$errors.name}</span>
						</label>
					{/if}
				</div>
			</div>
			<div class="col-span-12 sm:col-span-6">
				<div class="form-control w-full">
					<label for="DCI" class="label">
						<span class="label-text">DCI</span>
					</label>
					<input type="text" name="DCI" bind:value={$dmFormData.DCI} class="input input-bordered w-full focus:border-primary" />
					{#if $errors.DCI}
						<label for="DCI" class="label">
							<span class="label-text-alt text-error">{$errors.DCI}</span>
						</label>
					{/if}
				</div>
			</div>
			<div class="col-span-12 m-4 text-center">
				<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
					{#if $submitting}
						<span class="loading" />
					{/if}
					Save DM
				</button>
			</div>
		</div>
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
								if (form?.message) {
									alert(form.message);
									$pageLoader = false;
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
								<th class="">Date</th>
								<th class="hidden sm:table-cell">Adventure</th>
								<th class="hidden sm:table-cell">Character</th>
								<th class="print:hidden" />
							</tr>
						</thead>
						<tbody>
							{#each data.logs.sort((a, b) => sorter(a.date, b.date)) as log}
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
