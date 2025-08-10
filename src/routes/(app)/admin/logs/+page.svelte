<script lang="ts">
	import { pushState } from "$app/navigation";
	import { page } from "$app/state";
	import { errorToast, successToast } from "$lib/factories.svelte.js";
	import { deleteAppLog, getAppLogs, getBaseSearch } from "$lib/remote/admin.remote.js";
	import { debounce } from "@sillvva/utils";
	import { SvelteURL } from "svelte/reactivity";

	const url = $derived(new SvelteURL(page.url));

	const baseSearch = $derived(getBaseSearch());
	const params = $derived(url.searchParams.get("s")?.trim() ?? baseSearch.current?.query ?? "");

	const logSearch = $derived(getAppLogs(params));

	const debouncedSearch = debounce((value: string) => {
		const trimmed = value.trim();
		if (trimmed) {
			url.searchParams.set("s", trimmed);
			pushState(url, {});
		} else {
			url.searchParams.delete("s");
			pushState(url, {});
		}
	}, 400);

	let syntaxReference = $state("");

	async function openSyntaxReference() {
		if (!syntaxReference) {
			syntaxReference = await fetch("/syntax-reference.md").then((res) => res.text());
		}
		pushState("", {
			modal: {
				type: "text",
				name: "Syntax Reference",
				description: syntaxReference,
				width: "64rem",
				maxWidth: "60vw",
				maxHeight: "80vh"
			}
		});
	}
</script>

<div class="fieldset mb-4 flex flex-col gap-1">
	<div class="flex items-center justify-between">
		<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
			<search class="flex flex-1">
				<div class="focus-within:outline-primary join flex flex-1 items-center rounded-lg focus-within:outline-2">
					<input
						type="text"
						id="log-search"
						defaultValue={params}
						oninput={(e) => {
							debouncedSearch.call(e.currentTarget.value);
						}}
						class="input sm:input-sm join-item flex-1"
						aria-label="Search"
						placeholder={baseSearch.current?.query ?? ""}
					/>
					<button
						class="btn sm:btn-sm join-item tooltip border-base-content/20 border max-sm:hidden"
						data-tip="Syntax Reference"
						aria-label="Syntax Reference"
						onclick={openSyntaxReference}
					>
						<span class="iconify mdi--help-circle size-6 sm:size-4"></span>
					</button>
				</div>
			</search>
		</div>
		<div class="flex justify-end text-sm max-sm:hidden">Logs are automatically deleted after 7 days.</div>
	</div>
	{#if logSearch.current?.metadata?.hasErrors}
		{#each logSearch.current.metadata.errors as error, i (i)}
			<div class="alert alert-error mt-1 w-fit rounded-lg py-1">
				<span class="iconify mdi--alert-circle size-6"></span>
				{error.message} at position {error.position}: <kbd>{error.value}</kbd>
			</div>
		{/each}
	{:else}
		<div class="label pl-3 text-sm whitespace-normal">
			Valid keys: {baseSearch.current?.validKeys.join(", ")}
		</div>
	{/if}
</div>

{#if logSearch.loading}
	<div class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
		<span class="loading loading-spinner text-secondary w-16"></span>
	</div>
{:else if logSearch.current?.logs.length}
	<div class="overflow-x-auto rounded-lg">
		<table class="bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
			<thead class="max-sm:hidden">
				<tr class="bg-base-300 text-base-content/70">
					<td>Label</td>
					<td class="text-center max-sm:hidden">Level</td>
					<td class="max-sm:hidden">Timestamp</td>
					<td class="max-xs:hidden w-0"></td>
				</tr>
			</thead>
			{#each logSearch.current.logs as log (log.id)}
				{#snippet actions()}
					<button
						class="btn btn-sm btn-primary tooltip tooltip-left"
						data-tip="Toggle details"
						aria-label="Toggle details"
						onclick={() => {
							const row = document.querySelector(`tr[data-id="${log.id}"]`) as HTMLTableRowElement | null;
							if (row) row.dataset.details = row.dataset.details === "true" ? "false" : "true";
						}}
					>
						<span class="iconify mdi--eye"></span>
					</button>
					<button
						class="btn btn-sm btn-error tooltip tooltip-left"
						data-tip="Delete log"
						aria-label="Delete log"
						onclick={async () => {
							const result = await deleteAppLog(log.id).updates(
								getAppLogs(params).withOverride((data) => ({ ...data, logs: data.logs.filter((l) => l.id !== log.id) }))
							);
							if (result.ok) {
								successToast("Log deleted");
							} else {
								errorToast(result.error.message);
							}
						}}
					>
						<span class="iconify mdi--delete"></span>
					</button>
				{/snippet}
				<tbody class="scroll-mt-16 border-t border-neutral-500/20 first:border-0 data-[deleting=true]:hidden">
					<tr class="border-0">
						<td>
							<span class="sm:hidden">[{log.level}]</span>
							{log.message}
							<div class="flex items-center justify-between">
								<div class="text-base-content/60 sm:hidden">{log.timestamp.toLocaleString()}</div>
								<div class="xs:hidden mt-2 flex gap-2">
									{@render actions()}
								</div>
							</div>
						</td>
						<td class="text-center max-sm:hidden">{log.level}</td>
						<td class="whitespace-nowrap max-sm:hidden">{log.timestamp.toISOString()}</td>
						<td class="max-xs:hidden">
							<div class="flex justify-end gap-2">
								{@render actions()}
							</div>
						</td>
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
	</div>
{:else}
	<div class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
		<div class="text-base-content/60 text-lg">No logs found</div>
	</div>
{/if}
