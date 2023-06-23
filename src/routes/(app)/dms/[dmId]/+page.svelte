<script lang="ts">
	import { enhance } from "$app/forms";
	import Meta from "$lib/components/Meta.svelte";
	import { dungeonMasterSchema } from "$lib/types/zod-schema.js";
	import SchemaForm from "$src/lib/components/SchemaForm.svelte";
	import { pageLoader } from "$src/lib/store.js";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	let dm = data.dm;

	let saveForm: SchemaForm;
	let saving = false;
	let errors: Record<string, string> = {};
</script>

<Meta title="Edit {dm.name}" />

<div class="flex flex-col gap-4">
	<div class="flex gap-4 print:hidden">
		<div class="breadcrumbs flex-1 text-sm">
			<ul>
				<li>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
						><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
					>
				</li>
				<li>
					<a href="/dms" class="text-secondary">DMs</a>
				</li>
				<li class="dark:drop-shadow-md">Edit {dm.name}</li>
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

	<SchemaForm action="?/saveDM" data={dm} bind:this={saveForm} bind:form bind:saving bind:errors schema={dungeonMasterSchema}>
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
						on:input={() => saveForm.addChanges("name")}
						required
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="name" class="label">
						<span class="label-text-alt text-error">{errors.name || ""}</span>
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
						on:input={() => saveForm.addChanges("DCI")}
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="DCI" class="label">
						<span class="label-text-alt text-error">{errors.DCI || ""}</span>
					</label>
				</div>
			</div>
			<div class="m-4 basis-full text-center">
				<button type="submit" class={twMerge("btn-primary btn", saving && "loading")} disabled={saving}>Update</button>
			</div>
		</div>
	</SchemaForm>

	<div class="mt-8 flex flex-col gap-4">
		<section>
			<h2 class="mb-2 text-2xl">Logs</h2>
			<div class="w-full overflow-x-auto rounded-lg bg-base-100">
				<table class="table w-full">
					<thead>
						<tr class="bg-base-300">
							<th class="">Date</th>
							<th class="">Adventure</th>
							<th class="">Character</th>
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
							{#each dm.logs.sort((a, b) => (a.date > b.date ? 1 : -1)) as log}
								<tr>
									<td>{log.date.toLocaleString()}</td>
									<td>{log.name}</td>
									<td>
										<a href={`/characters/${log.character?.id}`} class="text-secondary">
											{log.character?.name}
										</a>
									</td>
									<td class="w-8 print:hidden">
										<div class="flex flex-row justify-center gap-2">
											<a href={`/characters/${log.character?.id}/log/${log.id}`} class="btn-primary btn-sm btn">
												<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
													><title>pencil</title><path
														fill="currentColor"
														d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"
													/></svg
												>
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
