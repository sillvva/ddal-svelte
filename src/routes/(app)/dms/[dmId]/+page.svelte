<script lang="ts">
	import { enhance } from "$app/forms";
	import Meta from "$lib/components/Meta.svelte";
	import { dungeonMasterSchema } from "$lib/types/zod-schema.js";
	import Icon from "$src/lib/components/Icon.svelte";
	import SchemaForm from "$src/lib/components/SchemaForm.svelte";
	import { pageLoader } from "$src/lib/store.js";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	let dm = data.dm;

	let saving = false;
	let errors: Record<string, string> = {};
</script>

<Meta title="Edit {dm.name}" />

<div class="flex flex-col gap-4">
	<div class="flex gap-4 print:hidden">
		<div class="breadcrumbs flex-1 text-sm">
			<ul>
				<li>
					<Icon src="home" class="w-4" />
				</li>
				<li>
					<a href="/dms" class="text-secondary">DMs</a>
				</li>
				<li class="dark:drop-shadow-md">Edit {dm.name}</li>
			</ul>
		</div>
	</div>

	{#if form?.error}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form.error}
		</div>
	{/if}

	<SchemaForm action="?/saveDM" data={dm} bind:form bind:saving bind:errors schema={dungeonMasterSchema}>
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