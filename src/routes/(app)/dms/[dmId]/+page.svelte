<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/Control.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Input from "$lib/components/Input.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { dungeonMasterSchema } from "$lib/schemas";
	import { sorter } from "$lib/util";
	import Submit from "$src/lib/components/Submit.svelte";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { pageLoader } from "../../+layout.svelte";

	export let data;

	const superform = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(dungeonMasterSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<SuperForm action="?/saveDM" {superform} showMessage>
		<Control class="col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="name" required disabled={data.form.data.uid === data.user.id ? true : undefined}>
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
								if ("data" in result && result.data?.message) {
									alert(result.data.message);
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
