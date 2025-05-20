<script lang="ts">
	import { page } from "$app/state";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import DeleteDm from "$lib/components/forms/DeleteDM.svelte";
	import { excludedSearchWords } from "$lib/constants.js";
	import MiniSearch from "minisearch";
	import { SvelteSet } from "svelte/reactivity";

	let { data } = $props();

	const dms = $derived(data.dms);
	let deletingDM = new SvelteSet<string>();
	let search = $state(page.url.searchParams.get("s") || "");

	const minisearch = new MiniSearch({
		fields: ["name", "DCI"],
		idField: "id",
		processTerm: (term) => (excludedSearchWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	const indexed = $derived(
		dms
			? dms.map((dm) => ({
					id: dm.id,
					name: dm.name,
					DCI: dm.DCI
				}))
			: []
	);

	$effect(() => {
		minisearch.addAll(indexed);
		return () => minisearch.removeAll();
	});
	const msResults = $derived.by(() => {
		if (!minisearch.termCount) minisearch.addAll(indexed);
		return minisearch.search(search);
	});
	const resultsMap = $derived(new Map(msResults.map((result) => [result.id, result])));
	const results = $derived(indexed.length && search.length > 1 ? dms.filter((dm) => resultsMap.has(dm.id)) : dms);
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<div class="flex flex-col gap-4">
		<section class="flex max-w-96">
			<Search bind:value={search} placeholder="Search" />
		</section>
		<section>
			<div class="bg-base-200 w-full overflow-x-auto rounded-lg">
				<table class="table w-full">
					<thead>
						<tr class="bg-base-300 text-base-content/70">
							<th class="">DM</th>
							<th class="xs:table-cell hidden">DCI</th>
							<th class="xs:table-cell hidden">Logs</th>
							<th class="print:hidden"></th>
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
							{#each results as dm}
								<tr class="data-[deleting=true]:hidden" data-deleting={deletingDM.has(dm.id)}>
									<td>
										<a
											href="/dms/{dm.id}"
											class="text-secondary text-left font-semibold whitespace-pre-wrap"
											aria-label="Edit DM"
										>
											<SearchResults text={dm.name} {search} />
										</a>
										<div class="xs:hidden block">
											{#if dm.DCI}
												<p class="text-xs text-gray-500">DCI: <SearchResults text={dm.DCI} {search} /></p>
											{/if}
											<p class="text-xs text-gray-500">{dm.logs.length} logs</p>
										</div>
									</td>
									<td class="xs:table-cell hidden"><SearchResults text={dm.DCI || ""} {search} /></td>
									<td class="xs:table-cell hidden">{dm.logs.length}</td>
									<td class="w-16 print:hidden">
										<div class="flex flex-row justify-end gap-2">
											{#if dm.logs.length == 0}
												<DeleteDm {dm} {deletingDM} />
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
