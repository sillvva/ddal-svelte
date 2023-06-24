<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import Meta from "$lib/components/Meta.svelte";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	let dms = data.dms;
	let deletingDM: string[] = [];
</script>

<Meta title="{data.session?.user?.name}'s DMs" />

<div class="flex flex-col gap-4">
	<div class="flex gap-4 print:hidden">
		<div class="breadcrumbs flex-1 text-sm">
			<ul>
				<li>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
						><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
					>
				</li>
				<li class="dark:drop-shadow-md">DMs</li>
			</ul>
		</div>
	</div>

	{#if form?.error}
		<div class="alert alert-error shadow-lg mb-4">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
				><title>alert-circle</title><path
					fill="currentColor"
					d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"
				/></svg
			>
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
										<div class="flex flex-row justify-center gap-2">
											<a href="/dms/{dm.id}" class="btn-primary btn-sm btn" aria-label="Edit DM">
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
													><title>pencil</title><path
														fill="currentColor"
														d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"
													/></svg
												>
											</a>
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
														class="btn-sm btn"
														on:click|preventDefault={(e) => {
															if (confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`))
																e.currentTarget.form?.requestSubmit();
														}}
														aria-label="Delete DM"
													>
														<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
															><title>trash-can</title><path
																fill="currentColor"
																d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M9,8H11V17H9V8M13,8H15V17H13V8Z"
															/></svg
														>
													</button>
												</form>
											{/if}
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
