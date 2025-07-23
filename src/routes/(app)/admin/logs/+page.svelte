<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
	import { page } from "$app/state";
	import DeleteAppLog from "$lib/components/forms/DeleteAppLog.svelte";
	import type { AppLogId } from "$lib/schemas.js";
	import { debounce } from "@sillvva/utils";
	import { SvelteSet } from "svelte/reactivity";

	let { data } = $props();

	let search = $state(data.search || "");
	let deletingLog = new SvelteSet<AppLogId>();

	const debouncedSearch = debounce((value: string) => {
		if (value.trim()) {
			page.url.searchParams.set("s", value);
		} else {
			page.url.searchParams.delete("s");
		}
		const params = page.url.searchParams.size ? "?" + page.url.searchParams.toString() : "";
		goto(page.url.pathname + params, {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
			invalidateAll: true
		});
	}, 400);
</script>

<div class="mb-4 flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
			<search class="min-w-0 flex-1">
				<label class="input focus-within:border-primary sm:input-sm flex w-full items-center gap-2">
					<input
						type="text"
						bind:value={search}
						oninput={(e) => {
							debouncedSearch.call(e.currentTarget.value);
						}}
						class="w-full flex-1"
						aria-label="Search"
						placeholder={data.search}
					/>
				</label>
			</search>
		</div>
		<div class="flex justify-end text-sm">Logs are automatically deleted after 7 days.</div>
	</div>
	{#if data.metadata.hasErrors}
		{#each data.metadata.errors as error}
			<div class="alert alert-error w-fit">
				<span class="iconify mdi--alert-circle size-6"></span>
				{error.message} at position {error.position}: <kbd>{error.value}</kbd>
			</div>
		{/each}
	{/if}
</div>
<table class="linked-table bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
	<thead class="max-sm:hidden">
		<tr class="bg-base-300 text-base-content/70">
			<td>Label</td>
			<td class="text-center">Level</td>
			<td>Timestamp</td>
			{#if !data.mobile}
				<td class="w-0"></td>
			{/if}
		</tr>
	</thead>
	{#each data.logs as log}
		<tbody
			class="border-t border-neutral-500/20 first:border-0 data-[deleting=true]:hidden"
			data-deleting={deletingLog.has(log.id)}
		>
			<tr class="border-0">
				<td>{log.message}</td>
				<td class="text-center">{log.level}</td>
				<td class="whitespace-nowrap">{log.timestamp.toISOString()}</td>
				{#if !data.mobile}
					<td>
						<div class="flex justify-end gap-2">
							<button
								class="btn btn-sm btn-primary tooltip"
								data-tip="Toggle details"
								aria-label="Toggle details"
								onclick={() => {
									const details = document.querySelector(`tr[data-id="${log.id}"]`) as HTMLTableRowElement | null;
									if (details) details.dataset.details = details.dataset.details === "true" ? "false" : "true";
								}}
							>
								<span class="iconify mdi--eye"></span>
							</button>
							<DeleteAppLog {log} {deletingLog} ondelete={() => invalidateAll()} />
						</div>
					</td>
				{/if}
			</tr>
			<tr data-id={log.id} data-details={false} class="hidden data-[details=true]:table-row">
				<td colspan="4">
					<div class="grid grid-cols-1 gap-4">
						{#if log.trace}
							<div class="bg-base-100 overflow-x-scroll rounded-lg p-6">
								<h3 class="mb-2 text-lg font-bold">Trace</h3>
								<pre>{log.trace}</pre>
							</div>
						{/if}
						<div class="bg-base-100 overflow-x-scroll rounded-lg p-6">
							<h3 class="mb-2 text-lg font-bold">Annotations</h3>
							<pre>{JSON.stringify(log.annotations, null, 2)}</pre>
						</div>
					</div>
				</td>
			</tr>
		</tbody>
	{/each}
</table>
