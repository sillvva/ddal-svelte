<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	let dms = data.dms;
	let deletingDM: Array<string> = [];
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	{#if form?.error}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form.error}
		</div>
	{/if}

	<div class="flex flex-col gap-4">
		<section>
			<div class="w-full overflow-x-auto rounded-lg bg-base-100">
				<table class="table w-full">
					<thead>
						<tr class="bg-base-300">
							<th class="">DM</th>
							<th class="hidden xs:table-cell">DCI</th>
							<th class="hidden xs:table-cell">Logs</th>
							<th class="print:hidden" />
						</tr>
					</thead>
					<tbody>
						{#if !dms || dms.length == 0}
							<tr>
								<td colSpan={4} class="py-20 text-center">
									<p class="mb-4">You have no DMs.</p>
								</td>
							</tr>
						{:else}
							{#each dms as dm}
								<tr class={twMerge(deletingDM.includes(dm.id) && "hidden")}>
									<td>
										{dm.name}
										<div class="block xs:hidden">
											{#if dm.DCI}
												<p class="text-xs text-gray-500">DCI: {dm.DCI}</p>
											{/if}
											<p class="text-xs text-gray-500">{dm.logs.length} logs</p>
										</div>
									</td>
									<td class="hidden xs:table-cell">{dm.DCI || ""}</td>
									<td class="hidden xs:table-cell">{dm.logs.length}</td>
									<td class="w-16 print:hidden">
										<div class="flex flex-row justify-end gap-2">
											{#if dm.logs.length == 0}
												<form
													method="POST"
													action="?/deleteDM"
													use:enhance={() => {
														deletingDM = [...deletingDM, dm.id];
														return async ({ result }) => {
															await applyAction(result);
															if (form?.error) {
																deletingDM = deletingDM.filter((id) => id !== dm.id);
																alert(form.error);
															}
														};
													}}
												>
													<input type="hidden" name="dmId" value={dm.id} />
													<button
														class="btn sm:btn-sm"
														on:click|preventDefault={(e) => {
															if (confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`))
																e.currentTarget.form?.requestSubmit();
														}}
														aria-label="Delete DM"
													>
														<Icon src="trash-can" class="w-4" />
													</button>
												</form>
											{/if}
											<a href="/dms/{dm.id}" class="btn-primary btn sm:btn-sm" aria-label="Edit DM">
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
