<script lang="ts" module>
	export const pageHead = {
		title: "App Logs"
	};
</script>

<script lang="ts">
	import { pushState } from "$app/navigation";
	import LoadingPanel from "$lib/components/loading-panel.svelte";
	import { parseEffectResult } from "$lib/factories.svelte";
	import { successToast } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { getRelativeTime } from "$lib/util";
	import { debounce } from "@sillvva/utils";
	import { queryParameters, ssp } from "sveltekit-search-params";

	const params = queryParameters(
		{
			s: ssp.string()
		},
		{
			showDefaults: false
		}
	);

	const baseSearch = $derived(await API.admin.queries.getBaseSearch());
	const query = $derived(API.admin.queries.getAppLogs(params.s ?? ""));
	let loading = $derived(!query.current);
	const logSearch = $derived(await query);

	const debouncedSearch = debounce((query: string) => {
		params.s = query.trim() || null;
	}, 400);

	const formatter = new Intl.DateTimeFormat(navigator.language, {
		dateStyle: "full",
		timeStyle: "long"
	});

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

<section class="flex flex-col gap-1">
	<div class="flex items-center justify-between">
		<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
			<search class="flex flex-1">
				<div class="focus-within:outline-primary join flex flex-1 items-center rounded-lg focus-within:outline-2">
					<input
						type="text"
						id="log-search"
						value={params.s ?? ""}
						oninput={(e) => {
							loading = true;
							debouncedSearch.call(e.currentTarget.value);
						}}
						class="input sm:input-sm join-item flex-1"
						aria-label="Search"
						placeholder={baseSearch.query ?? ""}
					/>
					<div class="tooltip" data-tip="Syntax Reference">
						<button
							class="btn sm:btn-sm join-item border-base-content/20 border max-sm:hidden"
							aria-label="Syntax Reference"
							onclick={openSyntaxReference}
						>
							<span class="iconify mdi--help-circle size-6 sm:size-4"></span>
						</button>
					</div>
				</div>
			</search>
		</div>
		<div class="flex justify-end text-sm max-sm:hidden">Logs are automatically deleted after 7 days.</div>
	</div>
	{#if logSearch.metadata?.hasErrors}
		{#each logSearch.metadata.errors as error, i (i)}
			<div class="alert alert-error mt-1 w-fit rounded-lg py-1">
				<span class="iconify mdi--alert-circle size-6"></span>
				{error.message} at position {error.position}: <kbd>{error.value}</kbd>
			</div>
		{/each}
	{:else}
		<div class="label text-xs whitespace-normal">
			Valid keys: {baseSearch.validKeys.join(", ")}
		</div>
	{/if}
</section>

{#if loading}
	<LoadingPanel />
{:else if logSearch.logs.length}
	<section class="overflow-x-auto rounded-lg">
		<table class="bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
			<thead class="max-sm:hidden">
				<tr class="bg-base-300 text-base-content/70">
					<td>Label</td>
					<td class="text-center max-sm:hidden">Level</td>
					<td class="max-sm:hidden">Timestamp</td>
					<td class="max-xs:hidden w-0"></td>
				</tr>
			</thead>
			{#each logSearch.logs as log (log.id)}
				{#snippet actions()}
					<div class="sm:tooltip sm:tooltip-left" data-tip="Toggle details">
						<button
							class="btn btn-sm btn-primary"
							aria-label="Toggle details"
							onclick={() => {
								const row = document.querySelector(`tbody:has(tr[data-id="${log.id}"])`) as HTMLTableRowElement | null;
								console.log(row);
								if (row) row.dataset.details = row.dataset.details === "true" ? "false" : "true";
							}}
						>
							<span class="iconify mdi--eye"></span>
						</button>
					</div>
					<div class="sm:tooltip sm:tooltip-left" data-tip="Delete log">
						<button
							class="btn btn-sm btn-error"
							aria-label="Delete log"
							onclick={async () => {
								const result = await API.admin.actions.deleteAppLog(log.id).updates(
									API.admin.queries.getAppLogs(params.s ?? "").withOverride((data) => ({
										...data,
										logs: data.logs.filter((l) => l.id !== log.id)
									}))
								);
								const parsed = await parseEffectResult(result);
								if (parsed) successToast("Log deleted");
							}}
						>
							<span class="iconify mdi--delete"></span>
						</button>
					</div>
				{/snippet}
				<tbody
					class={[
						"group data-[details=true]:bg-base-200 scroll-mt-16 border-t border-neutral-500/20 first:border-0 data-[deleting=true]:hidden data-[details=true]:opacity-100",
						Date.now() - log.timestamp.getTime() > 24 * 60 * 60 * 1000 &&
							"bg-base-100/50 hover:bg-base-200 opacity-60 hover:opacity-100"
					]}
					data-details={false}
				>
					<tr class="border-0">
						<td>
							<div class="flex flex-col gap-1">
								<div>
									<span class="sm:hidden">[{log.level}]</span>
									{log.message}
								</div>
								<div class="flex items-center justify-between">
									<div class="text-base-content group-data-[details=true]:hidden sm:hidden">
										{getRelativeTime(log.timestamp)}
									</div>
									<div class="text-base-content/60 hidden flex-1 max-sm:group-data-[details=true]:block">
										{formatter.format(log.timestamp)}
									</div>
									<div class="xs:hidden flex gap-2">
										{@render actions()}
									</div>
								</div>
							</div>
						</td>
						<td class="text-center max-sm:hidden">{log.level}</td>
						<td class="whitespace-nowrap max-sm:hidden sm:group-data-[details=true]:hidden">
							<span class="sm:tooltip" data-tip={formatter.format(log.timestamp)}>{getRelativeTime(log.timestamp)}</span>
						</td>
						<td class="hidden sm:group-data-[details=true]:table-cell">
							{formatter.format(log.timestamp)}
						</td>
						<td class="max-xs:hidden">
							<div class="flex justify-end gap-2">
								{@render actions()}
							</div>
						</td>
					</tr>
					<tr data-id={log.id} data-details={false} class="hidden group-data-[details=true]:table-row">
						<td colspan="4">
							<div class="grid grid-cols-1 gap-4">
								{#if log.stack}
									<div class="bg-base-100 overflow-x-scroll rounded-lg p-6">
										<h3 class="mb-2 text-lg font-bold">Stack</h3>
										<pre>{log.stack}</pre>
									</div>
								{/if}
								<div class="bg-base-100 overflow-x-scroll rounded-lg p-6">
									<h3 class="mb-2 text-lg font-bold">Annotations</h3>
									<pre class="whitespace-break-spaces">{JSON.stringify(log.annotations, null, 2)}</pre>
								</div>
							</div>
						</td>
					</tr>
				</tbody>
			{/each}
		</table>
	</section>
{:else}
	<section class="bg-base-200 flex h-40 flex-col items-center justify-center rounded-lg">
		<div class="text-base-content/60 text-lg">No logs found</div>
	</section>
{/if}
